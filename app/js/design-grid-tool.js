/*
 * design-grid-tool.js — Interactive commands: Set Design Grid, Set Design North
 *
 * State machine for two-click placement:
 *   idle → await surface/origin → await Y-axis/direction → (spacing popup) → done
 *
 * Also owns persistent surface-grid mode:
 *   idle mode + dblclick surface → enter surface grid mode
 *   idle mode + dblclick outside → exit surface grid mode (stay 2D)
 *
 * COORDINATE LAW: True North = Three.js -Z axis. Never invert.
 */

import * as THREE from 'three';
import { state }              from './state.js';
import { showFeedback }       from './ui.js';
import { showGridSpacingPopup } from './grid.js';
import { setDesignNorth }     from './north-state.js';
import { animateCameraToGrid, switchMode } from './viewport.js';
import { updateDesignData }   from './gpr-file.js';

const SNAP_RADIUS_PX = 20;

// ── Tool state ────────────────────────────────────────────────────────────────
// States:
//   idle             — no command active
//   grid_await       — Set Design Grid started; waiting for surface dblclick or ground click
//   grid_origin      — surface captured; waiting for origin click on that surface
//   grid_yaxis       — origin set; waiting for Y-axis direction click
//   north_await      — Set Design North started; waiting for origin click
//   north_yaxis      — north origin set; waiting for direction click

let _toolState  = 'idle';
let _surface    = null;   // captured surface (null = ground plane)
let _origin     = null;   // THREE.Vector3 — first click (Design Origin)
let _snapPoint  = null;   // THREE.Vector3 — nearest vertex within snap radius (or null)
let _snapMarker = null;   // THREE.Mesh — green dot at snap position
let _prevLine   = null;   // THREE.Line — direction preview from origin to mouse

// ── Public API ────────────────────────────────────────────────────────────────

export function initDesignGridTool() {
  // Nothing to initialise — state is module-level; called once after scene is ready
}

export function startSetDesignGrid() {
  _reset();
  _toolState = 'grid_await';
  showFeedback('Double-click a surface to set a surface grid, or click to set Design Origin', 0);
  state.renderer.domElement.style.cursor = 'crosshair';
}

export function startSetDesignNorth() {
  _reset();
  _toolState = 'north_await';
  showFeedback('Click to set Design Origin for Design North', 0);
  state.renderer.domElement.style.cursor = 'crosshair';
}

export function cancelDesignTool() { _reset(); }
export function isDesignToolActive() { return _toolState !== 'idle'; }

// ── Event handlers — called from app.js ───────────────────────────────────────

/**
 * Handle dblclick on the viewport canvas.
 * Returns true if the event was consumed by the design tool.
 */
export function handleDesignToolDblClick(e) {
  // ── In grid_await: try surface capture ────────────────────────────────────
  if (_toolState === 'grid_await') {
    const surface = _hitTestSurface(e);
    if (surface) {
      _surface   = surface;
      _toolState = 'grid_origin';
      showFeedback('Click to set Design Origin on the surface', 0);
      return true;
    }
    return false; // no surface hit — fall through to other handlers
  }

  // ── In idle: surface grid activation / deactivation ───────────────────────
  if (_toolState === 'idle') {
    const surface = _hitTestSurface(e);

    if (surface) {
      const mgr = state.designGridManager;
      if (mgr?.hasSurfaceGrid(surface.id)) {
        // Activate the surface grid
        state.activeSurfaceId = surface.id;
        mgr.activateSurfaceGrid(surface.id);
        state.selectedSurface = surface;
        state.canvasMode = 'surface';
        switchMode('2d');
        showFeedback(`Surface ${surface.id} grid active — double-click outside to exit`, 0);
      } else {
        // No grid set yet — select surface only
        state.selectedSurface = surface;
        switchMode('2d');
        showFeedback(`Surface ${surface.id} selected — Design > Set Design Grid to set a grid`, 0);
      }
      return true;
    }

    if (state.activeSurfaceId !== null) {
      // Double-click outside — exit surface grid mode, stay 2D
      state.activeSurfaceId = null;
      state.selectedSurface = null;
      state.designGridManager?.deactivateSurfaceGrid();
      showFeedback('Returned to model grid');
      return true;
    }
  }

  return false;
}

/**
 * Handle single click on the viewport canvas.
 * Returns true if the event was consumed by the design tool.
 */
export function handleDesignToolClick(e) {
  if (_toolState === 'idle') return false;

  // ── grid_await: first click ───────────────────────────────────────────────
  if (_toolState === 'grid_await') {
    // If the click hits a surface, don't process it as a ground click —
    // the user should double-click for surface mode.
    const surface = _hitTestSurface(e);
    if (surface) {
      showFeedback('Double-click the surface to use it as the grid plane', 0);
      return true; // consume but don't process
    }
    // Ground plane origin
    const pt = _getClickPoint(e, null);
    if (!pt) return false;
    _origin    = (_snapPoint ?? pt).clone();
    _toolState = 'grid_yaxis';
    _clearSnapMarker();
    showFeedback('Click to set Y-axis direction (Design North of this grid)', 0);
    return true;
  }

  // ── grid_origin: click on surface to set origin ───────────────────────────
  if (_toolState === 'grid_origin') {
    const pt = _getClickPoint(e, _surface);
    if (!pt) return false;
    _origin    = (_snapPoint ?? pt).clone();
    _toolState = 'grid_yaxis';
    _clearSnapMarker();
    showFeedback('Click to set Y-axis direction (Design North of this grid)', 0);
    return true;
  }

  // ── grid_yaxis: second click — sets Y-axis, opens spacing popup ───────────
  if (_toolState === 'grid_yaxis') {
    const pt = _getClickPoint(e, _surface);
    if (!pt) return false;
    const target = (_snapPoint ?? pt).clone();

    const yAxis  = _computeAxisDir(_origin, target, _surface);
    const normal = _surface ? _surface.normal.clone().normalize()
                            : new THREE.Vector3(0, 1, 0);
    // xAxis is perpendicular to yAxis in the surface plane
    const xAxis  = new THREE.Vector3().crossVectors(yAxis, normal).normalize();

    // Capture before reset
    const o = _origin.clone();
    const x = xAxis.clone();
    const y = yAxis.clone();
    const n = normal.clone();
    const s = _surface;

    _reset(); // clear tool state before popup opens

    showGridSpacingPopup(e.clientX, e.clientY, (maj, min) => {
      _commitDesignGrid(o, x, y, n, s, maj ?? 100, min ?? 0);
    });
    return true;
  }

  // ── north_await: first click — sets Design North origin ──────────────────
  if (_toolState === 'north_await') {
    const pt = _getClickPoint(e, null);
    if (!pt) return false;
    _origin    = (_snapPoint ?? pt).clone();
    _toolState = 'north_yaxis';
    _clearSnapMarker();
    showFeedback('Click to set Design North direction from origin', 0);
    return true;
  }

  // ── north_yaxis: second click — sets direction, applies Design North ──────
  if (_toolState === 'north_yaxis') {
    const pt = _getClickPoint(e, null);
    if (!pt) return false;
    const target = (_snapPoint ?? pt).clone();
    const dir    = _computeAxisDir(_origin, target, null);
    const angle  = _vectorToNorthAngle(dir);
    setDesignNorth(angle);
    showFeedback(`Design North set — ${angle >= 0 ? '+' : ''}${angle.toFixed(1)}°`);
    updateDesignData({ design_north_angle: angle }).catch(() => {});
    _reset();
    return true;
  }

  return false;
}

/**
 * Handle pointermove on the viewport canvas.
 * Shows snap indicator and direction preview line.
 */
export function handleDesignToolMouseMove(e) {
  if (_toolState === 'idle') return;

  // Origin selection phases: show snap dot
  if (_toolState === 'grid_await' || _toolState === 'grid_origin' || _toolState === 'north_await') {
    _snapPoint = _findSnapPoint(e, _surface);
    _updateSnapMarker(_snapPoint);
    _clearPrevLine();
    return;
  }

  // Direction selection phases: show snap dot + preview line from origin
  if ((_toolState === 'grid_yaxis' || _toolState === 'north_yaxis') && _origin) {
    _snapPoint = _findSnapPoint(e, _surface);
    _updateSnapMarker(_snapPoint);
    const pt = _snapPoint ?? _getClickPoint(e, _surface);
    if (pt) _updatePrevLine(_origin, pt);
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** Reset all tool state and remove 3D indicators. */
function _reset() {
  _toolState = 'idle';
  _surface   = null;
  _origin    = null;
  _snapPoint = null;
  _clearSnapMarker();
  _clearPrevLine();
  if (state.renderer) state.renderer.domElement.style.cursor = '';
  showFeedback('');
}

/** Raycast against all surface meshes; return the surface hit or null. */
function _hitTestSurface(e) {
  if (!state.surfaces?.length) return null;
  const canvas = state.renderer.domElement;
  const rect   = canvas.getBoundingClientRect();
  const ndc    = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width)  *  2 - 1,
    -((e.clientY - rect.top)  / rect.height) *  2 + 1,
  );
  const rc = new THREE.Raycaster();
  rc.setFromCamera(ndc, state.camera);
  const meshes = state.surfaces.map(s => s.mesh).filter(Boolean);
  const hits   = rc.intersectObjects(meshes, false);
  if (!hits.length) return null;
  return state.surfaces.find(s => s.mesh === hits[0].object) ?? null;
}

/** Raycast to a 3D world point — against the surface mesh or the ground plane. */
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
    // Try mesh hit first
    const hits = rc.intersectObject(surface.mesh, false);
    if (hits.length) return hits[0].point;
    // Fallback: intersect the surface plane
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      surface.normal.clone().normalize(), surface.centre,
    );
    const pt = new THREE.Vector3();
    return rc.ray.intersectPlane(plane, pt) ? pt : null;
  }

  // Ground plane Y = 0
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pt     = new THREE.Vector3();
  return rc.ray.intersectPlane(ground, pt) ? pt : null;
}

/**
 * Find the nearest vertex within SNAP_RADIUS_PX of the mouse position.
 * Searches the given surface's mesh (or all surface meshes if surface is null).
 * Returns a Vector3 in world space, or null if none within radius.
 */
function _findSnapPoint(e, surface) {
  const canvas = state.renderer.domElement;
  const rect   = canvas.getBoundingClientRect();
  const sx     = e.clientX - rect.left;
  const sy     = e.clientY - rect.top;
  const cam    = state.camera;

  const meshes = surface ? [surface.mesh]
                         : state.surfaces.map(s => s.mesh).filter(Boolean);

  const v    = new THREE.Vector3();
  const proj = new THREE.Vector3();
  let best   = null;
  let bestD  = Infinity;

  for (const mesh of meshes) {
    const pos = mesh.geometry?.attributes?.position;
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      proj.copy(v).project(cam);
      if (proj.z > 1) continue; // behind camera
      const px = ( proj.x *  0.5 + 0.5) * canvas.clientWidth;
      const py = (-proj.y *  0.5 + 0.5) * canvas.clientHeight;
      const d  = Math.hypot(sx - px, sy - py);
      if (d < SNAP_RADIUS_PX && d < bestD) { bestD = d; best = v.clone(); }
    }
  }
  return best;
}

/**
 * Compute the Y-axis direction (normalised vector in the plane).
 * The plane is the surface plane, or the horizontal ground plane.
 * Fallback: True North (-Z axis) if the direction vector is degenerate.
 */
function _computeAxisDir(origin, target, surface) {
  const normal = surface ? surface.normal.clone().normalize()
                         : new THREE.Vector3(0, 1, 0);
  const dir = target.clone().sub(origin);
  if (dir.length() < 1e-6) return new THREE.Vector3(0, 0, -1); // True North fallback
  // Project onto plane: remove the component along the normal
  dir.addScaledVector(normal, -dir.dot(normal));
  if (dir.length() < 1e-6) return new THREE.Vector3(0, 0, -1);
  return dir.normalize();
}

/**
 * Convert a world-space direction vector to a bearing angle from True North.
 * True North = Three.js -Z. East = +X.
 * Returns degrees clockwise from True North (positive = east, negative = west).
 */
function _vectorToNorthAngle(dir) {
  // atan2(east, north) = atan2(+X, -Z)  → clockwise from True North
  return Math.atan2(dir.x, -dir.z) * 180 / Math.PI;
}

/** Commit a new Design Grid (surface or model-level) and animate to it. */
function _commitDesignGrid(origin, xAxis, yAxis, normal, surface, majorSpacing, minorDivisions) {
  const mgr = state.designGridManager;
  if (!mgr) return;

  const spacing = majorSpacing ?? 100;
  const minor   = minorDivisions ?? 0;
  const extent  = 5000;

  let grid;

  if (surface) {
    // Per-surface Design Grid
    mgr.addSurfaceGrid(surface.id, { origin, xAxis, normal, majorSpacing: spacing, minorDivisions: minor, extent });
    state.activeSurfaceId = surface.id;
    grid = mgr.grids.get(`surface-${surface.id}`);
    showFeedback(`Surface ${surface.id} Design Grid set — ${spacing} m`);
  } else {
    // Model-level Design Grid (horizontal)
    // Y-axis direction = Design North bearing
    const angle = _vectorToNorthAngle(yAxis);
    mgr.initHorizontal(spacing, minor, extent, origin);
    setDesignNorth(angle);
    grid = mgr.grids.get('design-grid-horizontal');
    showFeedback(`Design Grid set — ${spacing} m · Design North ${angle >= 0 ? '+' : ''}${angle.toFixed(1)}°`);
  }

  // Persist
  updateDesignData({ surface_grids: mgr.serialise() }).catch(() => {});

  if (!grid) return;

  // Animate camera to face the grid, then switch to 2D
  animateCameraToGrid(grid, () => {
    if (surface) {
      state.selectedSurface = surface;
      state.canvasMode      = 'surface';
      mgr.activateSurfaceGrid(surface.id);
    }
    switchMode('2d');
  });
}

// ── Snap marker (green dot at snap point) ────────────────────────────────────

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

// ── Direction preview line (from origin to mouse) ────────────────────────────

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
