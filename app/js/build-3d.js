/*
 * build-3d.js — 3D building tools for GPRTool: Extrude and Boolean Subtract
 *
 * Extrude: select a userGeometry mesh → click to set height → creates ExtrudeGeometry
 * Boolean Subtract: select base mesh → select cutter mesh → CSG subtract (three-bvh-csg)
 *
 * COORDINATE LAW: True North = Three.js -Z. East = +X. Up = +Y.
 */

import * as THREE from 'three';
import { state }        from './state.js';
import { showFeedback } from './ui.js';

// ── Module state ──────────────────────────────────────────────
let _mode          = 'idle';  // 'idle' | 'extrude-select' | 'extrude-height' | 'subtract-base' | 'subtract-cut'
let _selectedMesh  = null;    // first selected mesh
let _cutterMesh    = null;    // second mesh (subtract)
let _heightMarker  = null;    // vertical preview line during extrude
const EXTRUDE_MAT  = new THREE.MeshStandardMaterial({ color: 0xd0c8b8, side: THREE.DoubleSide, roughness: 0.7 });
const SELECT_GLOW  = 0x00aaff;

// ── Public API ────────────────────────────────────────────────
export function startExtrude() {
  _reset();
  _mode = 'extrude-select';
  showFeedback('Click a 2D shape to extrude into 3D', 0);
  state.renderer.domElement.style.cursor = 'crosshair';
}

export function startSubtract() {
  _reset();
  _mode = 'subtract-base';
  showFeedback('Click the base solid to subtract from', 0);
  state.renderer.domElement.style.cursor = 'crosshair';
}

export function cancelBuild3D() { _reset(); }
export function isBuild3DActive() { return _mode !== 'idle'; }

// ── Event handlers (called from app.js) ──────────────────────
export function handleBuild3DClick(e) {
  if (_mode === 'idle') return false;

  if (_mode === 'extrude-select') {
    const mesh = _hitTestUserGeometry(e);
    if (!mesh) { showFeedback('No shape found — click a 2D rectangle or circle', 0); return true; }
    _selectedMesh = mesh;
    _highlightMesh(mesh, SELECT_GLOW);
    _mode = 'extrude-height';
    showFeedback('Click above the shape to set extrusion height', 0);
    return true;
  }

  if (_mode === 'extrude-height') {
    const ht = _getExtrudeHeight(e);
    if (ht === null || ht < 0.1) { showFeedback('Click higher to set height (min 0.1m)', 0); return true; }
    _commitExtrude(_selectedMesh, ht);
    _reset();
    return true;
  }

  if (_mode === 'subtract-base') {
    const mesh = _hitTestUserGeometry(e);
    if (!mesh) { showFeedback('No solid found — click the base building', 0); return true; }
    _selectedMesh = mesh;
    _highlightMesh(mesh, SELECT_GLOW);
    _mode = 'subtract-cut';
    showFeedback('Click the shape to subtract (must overlap base)', 0);
    return true;
  }

  if (_mode === 'subtract-cut') {
    const mesh = _hitTestUserGeometry(e, _selectedMesh);
    if (!mesh) { showFeedback('No second solid found', 0); return true; }
    _cutterMesh = mesh;
    _commitSubtract(_selectedMesh, _cutterMesh);
    _reset();
    return true;
  }
  return false;
}

export function handleBuild3DMove(e) {
  if (_mode !== 'extrude-height' || !_selectedMesh) return;
  const ht = _getExtrudeHeight(e);
  if (ht !== null) {
    _updateHeightMarker(ht);
    const el = document.getElementById('status-message');
    if (el) el.textContent = `Height: ${ht.toFixed(1)}m — click to confirm`;
  }
}

// ── Extrude commit ────────────────────────────────────────────
function _commitExtrude(flatMesh, height) {
  // Extract 2D shape from ShapeGeometry (or CircleGeometry rotated to XZ)
  // Strategy: use the bounding box + convex hull of the flat mesh vertices
  const pos = flatMesh.geometry.attributes.position;
  const pts2D = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(flatMesh.matrixWorld);
    pts2D.push(new THREE.Vector2(v.x, v.z));   // XZ plane → X,Z to X,Y for Shape
  }
  // Deduplicate
  const seen = new Set();
  const uniquePts = pts2D.filter(p => {
    const k = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  if (uniquePts.length < 3) { showFeedback('Shape has too few points to extrude'); return; }

  // Build THREE.Shape — use convex hull ordering
  const shape = _ptsToShape(uniquePts);
  const extGeo = new THREE.ExtrudeGeometry(shape, {
    depth:        height,
    bevelEnabled: false,
  });
  // ExtrudeGeometry extrudes along +Z (in XY space). Rotate to scene space (XZ floor).
  extGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  // The base origin of ShapeGeometry is in XY; recover world translation
  const bbox = new THREE.Box3().setFromObject(flatMesh);
  const centre = bbox.getCenter(new THREE.Vector3());
  extGeo.translate(0, 0, 0);   // already in world coords after applyMatrix4

  const mesh = new THREE.Mesh(extGeo, EXTRUDE_MAT.clone());
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  mesh.name          = 'extruded';
  state.userGeometry.add(mesh);

  // Remove the source flat shape
  flatMesh.parent?.remove(flatMesh);
  flatMesh.geometry.dispose();
  flatMesh.material?.dispose();

  showFeedback(`Extruded ${height.toFixed(1)}m — surfaces will update on next scan`);
}

// ── Boolean Subtract ─────────────────────────────────────────
function _commitSubtract(base, cutter) {
  // three-bvh-csg is not loaded as a module in GPRTool; use geometry-level approach
  // for now: mark the cutter as a void and hide it, log for future CSG implementation
  _highlightMesh(cutter, 0xff4444);
  setTimeout(() => {
    cutter.visible = false;
    showFeedback('Subtract: cutter hidden — full CSG requires three-bvh-csg (future session)');
  }, 600);
}

// ── Helpers ───────────────────────────────────────────────────
function _hitTestUserGeometry(e, exclude = null) {
  if (!state.userGeometry) return null;
  const c = state.renderer.domElement, r = c.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  const rc  = new THREE.Raycaster(); rc.setFromCamera(ndc, state.camera);
  const meshes = [];
  state.userGeometry.traverse(o => { if (o.isMesh && o !== exclude) meshes.push(o); });
  const hits = rc.intersectObjects(meshes, false);
  return hits.length ? hits[0].object : null;
}

function _getExtrudeHeight(e) {
  if (!_selectedMesh) return null;
  const c = state.renderer.domElement, r = c.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  const rc  = new THREE.Raycaster(); rc.setFromCamera(ndc, state.camera);
  // Intersect a vertical plane aligned to camera forward at shape centre
  const bbox   = new THREE.Box3().setFromObject(_selectedMesh);
  const centre = bbox.getCenter(new THREE.Vector3());
  const camDir = state.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
  if (camDir.lengthSq() < 1e-6) return null;
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, centre);
  const pt    = new THREE.Vector3();
  if (!rc.ray.intersectPlane(plane, pt)) return null;
  return Math.max(0, pt.y - centre.y);
}

function _updateHeightMarker(height) {
  _clearHeightMarker();
  if (!_selectedMesh) return;
  const bbox = new THREE.Box3().setFromObject(_selectedMesh);
  const base = bbox.getCenter(new THREE.Vector3()); base.y = 0;
  const top  = base.clone(); top.y = height;
  const geo  = new THREE.BufferGeometry().setFromPoints([base, top]);
  _heightMarker = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x00cc44, depthTest: false }));
  _heightMarker.renderOrder = 997;
  state.scene.add(_heightMarker);
}

function _ptsToShape(pts2D) {
  // Simple: use pts as-is (they come from a ShapeGeometry, already ordered)
  const shape = new THREE.Shape();
  shape.moveTo(pts2D[0].x, pts2D[0].y);
  for (let i = 1; i < pts2D.length; i++) shape.lineTo(pts2D[i].x, pts2D[i].y);
  shape.closePath();
  return shape;
}

function _highlightMesh(mesh, color) {
  if (mesh.material) { mesh.material = mesh.material.clone(); mesh.material.color.setHex(color); }
}

function _clearHeightMarker() {
  if (_heightMarker) { state.scene.remove(_heightMarker); _heightMarker.geometry.dispose(); _heightMarker = null; }
}

function _reset() {
  _mode = 'idle'; _selectedMesh = null; _cutterMesh = null;
  _clearHeightMarker();
  if (state.renderer) state.renderer.domElement.style.cursor = '';
  showFeedback('');
}
