/*
 * design-grid-tool.js — Set Design Grid and Set Design North commands
 *
 * Both commands share the same two-click state machine. _setNorthMode
 * controls what happens at commit time:
 *   false (Set Design Grid)  → creates/updates Design Grid, sets state.designGridAngle
 *   true  (Set Design North) → calls setDesignNorth(), compass only, no grid change
 *
 * COORDINATE LAW: True North = Three.js -Z axis. Never invert.
 */

import * as THREE from 'three';
import { state }               from './state.js';
import { showFeedback }        from './ui.js';
import { showGridSpacingPopup } from './grid.js';
import { setDesignNorth }      from './north-state.js';
import { animateCameraToGrid, switchMode, update2DCamera } from './viewport.js';
import { updateDesignData }    from './gpr-file.js';

const SNAP_RADIUS_PX = 20;

// ── Module state ──────────────────────────────────────────────────────────────
let _setNorthMode = false;   // true = Set Design North; false = Set Design Grid

// Click state machine
let _toolState = 'idle';

let _surface   = null;
let _origin    = null;
let _snapPoint = null;
let _snapMarker = null;
let _prevLine   = null;

// Snap mesh cache — built once when tool activates, cleared on reset.
// Avoids traversing 1000+ building meshes every pointermove frame.
let _snapMeshCache = null;

// ── Public API ────────────────────────────────────────────────────────────────

export function initDesignGridTool() {}  // reserved for future one-time setup

export function startSetDesignGrid() {
  _setNorthMode = false;
  _reset();
  _snapMeshCache = _collectSnapMeshes();
  _toolState = 'await_origin';
  showFeedback('Double-click a surface for a surface grid, or click to set Design Origin', 0);
  state.renderer.domElement.style.cursor = 'crosshair';
}

export function startSetDesignNorth() {
  _setNorthMode = true;
  _reset();
  _snapMeshCache = _collectSnapMeshes();
  _toolState = 'await_origin';
  showFeedback('Click to set the Design North origin', 0);
  state.renderer.domElement.style.cursor = 'crosshair';
}

export function cancelDesignTool() { _reset(); }
export function isDesignToolActive() { return _toolState !== 'idle'; }

// ── Event handlers ────────────────────────────────────────────────────────────

/** Called from canvas dblclick. Returns true if event consumed. */
export function handleDesignToolDblClick(e) {
  // Set Design Grid only: dblclick selects surface while awaiting origin
  if (!_setNorthMode && _toolState === 'await_origin') {
    const surface = _hitTestSurface(e);
    if (surface) {
      _surface = surface;
      showFeedback('Click to set Design Origin on the surface', 0);
      return true;
    }
    return false;
  }

  // Idle mode: surface grid activation / deactivation
  if (_toolState === 'idle') {
    const surface = _hitTestSurface(e);
    if (surface) {
      const mgr = state.designGridManager;
      if (mgr?.hasSurfaceGrid(surface.id)) {
        state.activeSurfaceId = surface.id;
        mgr.activateSurfaceGrid(surface.id);
        state.selectedSurface = surface;
        state.canvasMode = 'surface';
        switchMode('2d');
        showFeedback(`Surface ${surface.id} grid active — double-click outside to exit`, 0);
      } else {
        state.selectedSurface = surface;
        switchMode('2d');
        showFeedback(`Surface ${surface.id} selected — use Design > Set Design Grid`, 0);
      }
      return true;
    }
    if (state.activeSurfaceId !== null) {
      state.activeSurfaceId = null;
      state.selectedSurface = null;
      state.designGridManager?.deactivateSurfaceGrid();
      showFeedback('Returned to model grid');
      return true;
    }
  }
  return false;
}

/** Called from canvas click. Returns true if event consumed. */
export function handleDesignToolClick(e) {
  if (_toolState === 'idle') return false;

  // ── First click: set origin ───────────────────────────────────────────────
  if (_toolState === 'await_origin') {
    // For Set Design Grid: if user single-clicks a surface, remind them to double-click
    if (!_setNorthMode) {
      const surface = _hitTestSurface(e);
      if (surface && !_surface) {
        showFeedback('Double-click the surface to use it as the grid plane', 0);
        return true;
      }
    }
    const pt = _getClickPoint(e, _surface);
    if (!pt) return false;
    _origin    = (_snapPoint ?? pt).clone();
    _toolState = 'await_direction';
    _clearSnapMarker();
    const hint = _setNorthMode
      ? 'Click to set Design North direction from origin'
      : 'Click to set Y-axis direction of the Design Grid';
    showFeedback(hint, 0);
    return true;
  }

  // ── Second click: set direction ──────────────────────────────────────────
  if (_toolState === 'await_direction') {
    const pt = _getClickPoint(e, _surface);
    if (!pt) return false;
    const target = (_snapPoint ?? pt).clone();
    const yAxis  = _computeAxisDir(_origin, target, _surface);
    const angle  = _vectorToNorthAngle(yAxis);

    if (_setNorthMode) {
      // Set Design North — update compass, rotate 2D view, then offer grid spacing
      setDesignNorth(angle);
      state.rotate2D = Math.atan2(yAxis.x, -yAxis.z);
      if (_origin) state.pan2D = { x: _origin.x, z: _origin.z };
      switchMode('2d');
      update2DCamera();
      const label = _formatAngle(angle);
      showFeedback(`Design North set — ${label} from True North`);
      if (state.northPointEl) state.northPointEl.style.display = '';
      updateDesignData({ design_north_angle: angle }).catch(() => {});
      // Ensure horizontal grid exists, then show spacing popup
      if (state.designGridManager && !state.designGridManager.grids.has('design-grid-horizontal')) {
        state.designGridManager.initHorizontal(
          state.manualGridSpacing ?? 100,
          state.manualMinorDivisions ?? 10,
          5000,
          _origin ?? new THREE.Vector3(0, 0, 0)
        );
      }
      _reset();
      showGridSpacingPopup(e.clientX, e.clientY);
    } else {
      // Set Design Grid — capture then reset before popup opens
      const o = _origin.clone();
      const n = _surface ? _surface.normal.clone().normalize() : new THREE.Vector3(0, 1, 0);
      const x = new THREE.Vector3().crossVectors(yAxis, n).normalize();
      const s = _surface;
      _reset();
      showGridSpacingPopup(e.clientX, e.clientY, (maj, min) => {
        _commitDesignGrid(o, x, yAxis, n, s, maj ?? 100, min ?? 10, angle);
      });
    }
    return true;
  }

  return false;
}

/** Called from canvas pointermove. Updates snap indicator and preview line. */
export function handleDesignToolMouseMove(e) {
  if (_toolState === 'idle') return;

  if (_toolState === 'await_origin') {
    _snapPoint = _findSnapPoint(e, _surface);
    _updateSnapMarker(_snapPoint);
    _clearPrevLine();
    return;
  }

  if (_toolState === 'await_direction' && _origin) {
    _snapPoint = _findSnapPoint(e, _surface);
    _updateSnapMarker(_snapPoint);
    const pt = _snapPoint ?? _getClickPoint(e, _setNorthMode ? null : _surface);
    if (pt) _updatePrevLine(_origin, pt);
  }
}

// ── Commit Design Grid ────────────────────────────────────────────────────────

function _commitDesignGrid(origin, xAxis, yAxis, normal, surface, majorSpacing, minorDivisions, angle) {
  const mgr = state.designGridManager;
  if (!mgr) return;

  const spacing = majorSpacing ?? 100;
  const minor   = minorDivisions ?? 0;
  const extent  = 5000;
  let   grid;

  if (surface) {
    mgr.addSurfaceGrid(surface.id, { origin, xAxis, normal, majorSpacing: spacing, minorDivisions: minor, extent });
    state.activeSurfaceId = surface.id;
    grid = mgr.grids.get(`surface-${surface.id}`);
    showFeedback(`Surface grid set — ${spacing} m`);
  } else {
    // Horizontal model grid
    state.designGridAngle = angle;                          // drives animation loop rotation
    state.designOrigin    = origin.clone();
    mgr.initHorizontal(spacing, minor, extent, origin);
    // Compass NOT affected — only Set Design North touches the compass
    if (state.axesHelper) state.axesHelper.position.set(origin.x, 0.1, origin.z);
    grid = mgr.grids.get('design-grid-horizontal');
    showFeedback(`Design Grid set — ${spacing} m`);
  }

  updateDesignData({
    surface_grids:      mgr.serialise(),
    design_origin:      origin ? { x: origin.x, y: 0, z: origin.z } : null,
    design_grid_angle:  angle,
  }).catch(() => {});

  if (!grid) return;

  if (surface) {
    animateCameraToGrid(grid, () => {
      state.selectedSurface = surface;
      state.canvasMode      = 'surface';
      mgr.activateSurfaceGrid(surface.id);
      switchMode('2d');
      state.camera2D.up.copy(grid.yAxis).normalize();
      state.camera2D.lookAt(grid.origin);
      state.camera2D.updateProjectionMatrix();
    });
  } else {
    // No animation for horizontal — just rotate 2D view and pan to origin
    state.rotate2D = Math.atan2(yAxis.x, -yAxis.z);
    state.pan2D    = { x: origin.x, z: origin.z };
    switchMode('2d');
    update2DCamera();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _reset() {
  _toolState = 'idle';
  _surface   = null;
  _origin    = null;
  _snapPoint = null;
  _snapMeshCache = null;
  _clearSnapMarker();
  _clearPrevLine();
  if (state.renderer) state.renderer.domElement.style.cursor = '';
  showFeedback('');
}

function _hitTestSurface(e) {
  if (!state.surfaces?.length) return null;
  const canvas = state.renderer.domElement;
  const rect   = canvas.getBoundingClientRect();
  const ndc    = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width)  *  2 - 1,
    -((e.clientY - rect.top)  / rect.height) *  2 + 1,
  );
  const rc   = new THREE.Raycaster();
  rc.setFromCamera(ndc, state.camera);
  const hits = rc.intersectObjects(state.surfaces.map(s => s.mesh).filter(Boolean), false);
  if (!hits.length) return null;
  return state.surfaces.find(s => s.mesh === hits[0].object) ?? null;
}

function _getClickPoint(e, surface) {
  const canvas = state.renderer.domElement;
  const rect   = canvas.getBoundingClientRect();
  const ndc    = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width)  *  2 - 1,
    -((e.clientY - rect.top)  / rect.height) *  2 + 1,
  );
  const rc = new THREE.Raycaster();
  rc.setFromCamera(ndc, state.camera);

  if (surface) {
    const hits = rc.intersectObject(surface.mesh, false);
    if (hits.length) return hits[0].point;
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      surface.normal.clone().normalize(), surface.centre,
    );
    const pt = new THREE.Vector3();
    return rc.ray.intersectPlane(plane, pt) ? pt : null;
  }

  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pt     = new THREE.Vector3();
  return rc.ray.intersectPlane(ground, pt) ? pt : null;
}

function _findSnapPoint(e, surface) {
  const canvas = state.renderer.domElement;
  const rect   = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const cam = state.camera;

  // Use the pre-built cache or fall back to live collect
  const meshes = surface ? [surface.mesh] : (_snapMeshCache ?? _collectSnapMeshes());

  const v    = new THREE.Vector3();
  const proj = new THREE.Vector3();
  let best = null, bestD = Infinity;

  // ── Snap to nearest VERTEX ─────────────────────────────────────────────
  for (const mesh of meshes) {
    const pos = mesh.geometry?.attributes?.position;
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      proj.copy(v).project(cam);
      if (proj.z > 1) continue;
      const px = ( proj.x * 0.5 + 0.5) * canvas.clientWidth;
      const py = (-proj.y * 0.5 + 0.5) * canvas.clientHeight;
      const d  = Math.hypot(sx - px, sy - py);
      if (d < SNAP_RADIUS_PX && d < bestD) { bestD = d; best = v.clone(); }
    }
  }

  // ── Snap to nearest point ON A LINE/EDGE (only if no vertex snap found) ─
  if (!best) {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const pa = new THREE.Vector3(), pb = new THREE.Vector3();
    for (const mesh of meshes) {
      if (!mesh.isLine && !mesh.isLineSegments) continue;
      const pos = mesh.geometry?.attributes?.position;
      if (!pos) continue;
      const step = mesh.isLineSegments ? 2 : 1;
      for (let i = 0; i + 1 < pos.count; i += step) {
        a.fromBufferAttribute(pos, i    ).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(pos, i + 1).applyMatrix4(mesh.matrixWorld);
        pa.copy(a).project(cam);
        pb.copy(b).project(cam);
        if (pa.z > 1 && pb.z > 1) continue;
        const pax = ( pa.x * 0.5 + 0.5) * canvas.clientWidth;
        const pay = (-pa.y * 0.5 + 0.5) * canvas.clientHeight;
        const pbx = ( pb.x * 0.5 + 0.5) * canvas.clientWidth;
        const pby = (-pb.y * 0.5 + 0.5) * canvas.clientHeight;
        // Project cursor onto screen-space segment AB → parameter t ∈ [0,1]
        const abx = pbx - pax, aby = pby - pay;
        const len2 = abx * abx + aby * aby;
        if (len2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((sx - pax) * abx + (sy - pay) * aby) / len2));
        const cx = pax + t * abx, cy = pay + t * aby;
        const d  = Math.hypot(sx - cx, sy - cy);
        if (d < SNAP_RADIUS_PX && d < bestD) {
          bestD = d;
          // Interpolate in world space using same t
          best = a.clone().lerp(b, t);
        }
      }
    }
  }

  return best;
}

/** Collect all meshes/lines eligible for snapping when no surface is explicitly selected. */
function _collectSnapMeshes() {
  const result = [];
  if (state.surfaces?.length) {
    state.surfaces.forEach(s => { if (s.mesh) result.push(s.mesh); });
  }
  if (state.cadmapperGroup) {
    state.cadmapperGroup.traverse(obj => {
      // Include meshes (buildings) AND line objects (road edges, paths)
      if (obj.isMesh || obj.isLine || obj.isLineSegments) result.push(obj);
    });
  }
  return result;
}

function _computeAxisDir(origin, target, surface) {
  const normal = surface ? surface.normal.clone().normalize() : new THREE.Vector3(0, 1, 0);
  const dir = target.clone().sub(origin);
  if (dir.length() < 1e-6) return new THREE.Vector3(0, 0, -1);
  dir.addScaledVector(normal, -dir.dot(normal));
  if (dir.length() < 1e-6) return new THREE.Vector3(0, 0, -1);
  return dir.normalize();
}

function _vectorToNorthAngle(dir) {
  return Math.atan2(dir.x, -dir.z) * 180 / Math.PI;
}

function _formatAngle(deg) {
  const abs = Math.abs(deg);
  const dir = deg >= 0 ? 'E' : 'W';
  const d   = Math.floor(abs);
  const m   = Math.round((abs - d) * 60);
  return m === 0 ? `${d}° ${dir}` : `${d}°${m}' ${dir}`;
}

// ── Snap marker ───────────────────────────────────────────────────────────────

function _updateSnapMarker(point) {
  _clearSnapMarker();
  if (!point) return;
  const geo = new THREE.SphereGeometry(0.25, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00cc44, depthTest: false });
  _snapMarker = new THREE.Mesh(geo, mat);
  _snapMarker.position.copy(point);
  _snapMarker.renderOrder = 998;
  state.scene.add(_snapMarker);
}

function _clearSnapMarker() {
  if (_snapMarker) {
    state.scene.remove(_snapMarker);
    _snapMarker.geometry.dispose();
    _snapMarker.material.dispose();
    _snapMarker = null;
  }
}

// ── Direction preview line ────────────────────────────────────────────────────

function _updatePrevLine(origin, target) {
  _clearPrevLine();
  const geo = new THREE.BufferGeometry().setFromPoints([origin, target]);
  _prevLine = new THREE.Line(geo, new THREE.LineBasicMaterial({
    color: 0x0099ff, depthTest: false, transparent: true, opacity: 0.75,
  }));
  _prevLine.renderOrder = 997;
  state.scene.add(_prevLine);
}

function _clearPrevLine() {
  if (_prevLine) {
    state.scene.remove(_prevLine);
    _prevLine.geometry.dispose();
    _prevLine.material.dispose();
    _prevLine = null;
  }
}
