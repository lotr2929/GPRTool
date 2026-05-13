/*
 * build-draw.js — 2D building drawing tools for GPRTool
 *
 * Tools: ConstructionLine, RadialLines, Rectangle, Circle, Line
 * Pattern: identical to design-grid-tool.js (two-click state machine, snap, preview)
 *
 * COORDINATE LAW: True North = Three.js -Z. NEVER invert. East = +X. Up = +Y.
 * See _architecture.md for full invariant list.
 */

import * as THREE from 'three';
import { state }        from './state.js';
import { showFeedback } from './ui.js';

const SNAP_PX   = 20;        // snap radius in pixels
const GUIDE_EXT = 5000;      // construction line extension metres
const PREVIEW_MAT = new THREE.LineDashedMaterial({ color: 0x0099ff, dashSize: 0.3, gapSize: 0.2, depthTest: false });
const CLINE_MAT   = new THREE.LineDashedMaterial({ color: 0x0088ff, dashSize: 0.5, gapSize: 0.3, transparent: true, opacity: 0.8 });
const MESH_MAT    = new THREE.MeshStandardMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
const WIRE_MAT    = new THREE.LineBasicMaterial({ color: 0x333333 });

// ── Module state ──────────────────────────────────────────────
let _activeTool = 'idle';    // 'idle' | 'cline' | 'radial' | 'rect' | 'circle' | 'line'
let _phase      = 0;         // click phase within current tool
let _pt1        = null;      // first click world point
let _snapPt     = null;
let _snapMarker = null;
let _preview    = null;      // preview line/shape
let _snapCache  = null;
let _dimSpan    = null;      // injected dimension display in status bar

// ── Ensure groups exist ───────────────────────────────────────
function _ensureGroups() {
  if (!state.constructionLines) {
    state.constructionLines = new THREE.Group();
    state.constructionLines.name = 'constructionLines';
    state.scene.add(state.constructionLines);
  }
  if (!state.userGeometry) {
    state.userGeometry = new THREE.Group();
    state.userGeometry.name = 'userGeometry';
    state.scene.add(state.userGeometry);
  }
}

// ── Public API ────────────────────────────────────────────────
export function startConstructionLine() { _start('cline', 'Click start point of construction line'); }
export function startRadialLines()      { _start('radial', 'Click centre point for radial lines'); }
export function startRectangle()        { _start('rect',   'Click first corner of rectangle'); }
export function startCircle()           { _start('circle', 'Click centre of circle'); }
export function startLine()             { _start('line',   'Click start of line'); }
export function cancelBuildingDraw()    { _reset(); }
export function isBuildingDrawActive()  { return _activeTool !== 'idle'; }

function _start(tool, msg) {
  _reset();
  _activeTool = tool;
  _phase      = 0;
  _snapCache  = _collectSnapMeshes();
  _ensureGroups();
  _ensureDimSpan();
  showFeedback(msg, 0);
  state.renderer.domElement.style.cursor = 'crosshair';
}

// ── Event handlers (called from app.js) ──────────────────────
export function handleBuildingClick(e) {
  if (_activeTool === 'idle') return false;
  const pt = _snapPt ?? _groundPt(e);
  if (!pt) return false;
  if (_phase === 0) { _pt1 = pt.clone(); _phase = 1; _afterFirstClick(); return true; }
  if (_phase === 1) { _commit(pt); return true; }
  return false;
}

export function handleBuildingMove(e) {
  if (_activeTool === 'idle') return;
  _snapPt = _findSnap(e);
  _updateSnapMarker(_snapPt);
  const pt = _snapPt ?? _groundPt(e);
  if (!pt) return;
  if (_phase === 1 && _pt1) _updatePreview(_pt1, pt);
  _updateDimDisplay(pt);
}

// ── After first click messages ────────────────────────────────
function _afterFirstClick() {
  const msgs = {
    cline:  'Click end point — construction line will extend infinitely',
    radial: 'Click to set radius and confirm radial lines (uses 12 spokes)',
    rect:   'Click opposite corner',
    circle: 'Click to set radius',
    line:   'Click end point',
  };
  showFeedback(msgs[_activeTool] || '', 0);
}

// ── Commit: build final geometry ──────────────────────────────
function _commit(pt2) {
  switch (_activeTool) {
    case 'cline':  _commitCLine(_pt1, pt2);   break;
    case 'radial': _commitRadial(_pt1, pt2);  break;
    case 'rect':   _commitRect(_pt1, pt2);    break;
    case 'circle': _commitCircle(_pt1, pt2);  break;
    case 'line':   _commitLine(_pt1, pt2);    break;
  }
  _reset();
}

function _commitCLine(a, b) {
  const dir = b.clone().sub(a).normalize();
  if (dir.lengthSq() < 1e-10) return;
  const p0 = a.clone().addScaledVector(dir, -GUIDE_EXT);
  const p1 = a.clone().addScaledVector(dir,  GUIDE_EXT);
  const geo = new THREE.BufferGeometry().setFromPoints([p0, p1]);
  const seg = new THREE.LineSegments(geo, CLINE_MAT.clone());
  seg.computeLineDistances();
  state.constructionLines.add(seg);
  showFeedback('Construction line added — Edit > Clear Guides to remove');
}

function _commitRadial(centre, rim) {
  const r = centre.distanceTo(rim);
  if (r < 0.01) return;
  const SPOKES = 12;
  for (let i = 0; i < SPOKES; i++) {
    const angle = (i / SPOKES) * Math.PI * 2;
    const dx = Math.sin(angle), dz = -Math.cos(angle);     // North = -Z
    const dir = new THREE.Vector3(dx, 0, dz);
    const p0  = centre.clone().addScaledVector(dir, -GUIDE_EXT);
    const p1  = centre.clone().addScaledVector(dir,  GUIDE_EXT);
    const geo = new THREE.BufferGeometry().setFromPoints([p0, p1]);
    const seg = new THREE.LineSegments(geo, CLINE_MAT.clone());
    seg.computeLineDistances();
    state.constructionLines.add(seg);
  }
  showFeedback(`${SPOKES} radial construction lines added`);
}

function _commitRect(a, b) {
  const pts = [
    new THREE.Vector2(a.x, a.z),
    new THREE.Vector2(b.x, a.z),
    new THREE.Vector2(b.x, b.z),
    new THREE.Vector2(a.x, b.z),
  ];
  const shape = new THREE.Shape(pts);
  const geo   = new THREE.ShapeGeometry(shape);
  // ShapeGeometry lives in XY; rotate to XZ plane
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  const mesh  = new THREE.Mesh(geo, MESH_MAT.clone());
  mesh.receiveShadow = true;
  const edges = new THREE.EdgesGeometry(geo);
  const wire  = new THREE.LineSegments(edges, WIRE_MAT.clone());
  const grp   = new THREE.Group();
  grp.add(mesh); grp.add(wire);
  grp.name = 'rect';
  state.userGeometry.add(grp);
  showFeedback(`Rectangle ${Math.abs(b.x-a.x).toFixed(1)}m × ${Math.abs(b.z-a.z).toFixed(1)}m added`);
}

function _commitCircle(centre, rim) {
  const r   = centre.distanceTo(rim);
  if (r < 0.01) return;
  const geo = new THREE.CircleGeometry(r, 64);
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  geo.translate(centre.x, 0, centre.z);
  const mesh  = new THREE.Mesh(geo, MESH_MAT.clone());
  mesh.receiveShadow = true;
  const edges = new THREE.EdgesGeometry(geo);
  const wire  = new THREE.LineSegments(edges, WIRE_MAT.clone());
  const grp   = new THREE.Group();
  grp.add(mesh); grp.add(wire);
  grp.name = 'circle';
  state.userGeometry.add(grp);
  showFeedback(`Circle r=${r.toFixed(1)}m added`);
}

function _commitLine(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const seg = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x222222 }));
  seg.name  = 'userLine';
  state.userGeometry.add(seg);
  showFeedback(`Line ${a.distanceTo(b).toFixed(1)}m added`);
}

// ── Preview (rubber-band) ─────────────────────────────────────
function _updatePreview(a, b) {
  _clearPreview();
  let pts;
  switch (_activeTool) {
    case 'cline':  { const d = b.clone().sub(a).normalize();
                     pts = [a.clone().addScaledVector(d,-GUIDE_EXT), a.clone().addScaledVector(d,GUIDE_EXT)]; break; }
    case 'rect':   pts = [a, new THREE.Vector3(b.x,0,a.z), b, new THREE.Vector3(a.x,0,b.z), a]; break;
    case 'circle': { const r = a.distanceTo(b); pts = []; const N = 64;
                     for (let i = 0; i <= N; i++) { const ang = (i/N)*Math.PI*2;
                       pts.push(new THREE.Vector3(a.x + r*Math.sin(ang), 0, a.z - r*Math.cos(ang))); }
                     break; }
    default:       pts = [a, b]; break;
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  _preview  = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x0099ff, depthTest: false, transparent: true, opacity: 0.6 }));
  _preview.renderOrder = 997;
  state.scene.add(_preview);
}

// ── Dimension display in status bar ──────────────────────────
function _ensureDimSpan() {
  if (_dimSpan) return;
  const bar = document.getElementById('feedback-bar');
  if (!bar) return;
  _dimSpan = document.createElement('span');
  _dimSpan.id = 'build-dim';
  _dimSpan.style.cssText = 'margin-left:8px;font-size:11px;color:var(--text-secondary,#888);font-variant-numeric:tabular-nums';
  bar.appendChild(_dimSpan);
}

function _updateDimDisplay(pt) {
  if (!_dimSpan || !_pt1) { if (_dimSpan) _dimSpan.textContent = ''; return; }
  const dx = Math.abs(pt.x - _pt1.x).toFixed(1);
  const dz = Math.abs(pt.z - _pt1.z).toFixed(1);
  const d  = _pt1.distanceTo(pt).toFixed(1);
  if (_activeTool === 'rect')   _dimSpan.textContent = `  W: ${dx}m  H: ${dz}m`;
  else if (_activeTool === 'circle') _dimSpan.textContent = `  r: ${d}m`;
  else                               _dimSpan.textContent = `  ${d}m`;
}

// ── Reset ─────────────────────────────────────────────────────
function _reset() {
  _activeTool = 'idle'; _phase = 0; _pt1 = null; _snapPt = null; _snapCache = null;
  _clearSnapMarker(); _clearPreview();
  if (_dimSpan) { _dimSpan.textContent = ''; }
  if (state.renderer) state.renderer.domElement.style.cursor = '';
  showFeedback('');
}

// ── Shared helpers (identical to design-grid-tool.js pattern) ─
function _groundPt(e) {
  const c = state.renderer.domElement, r = c.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  const rc  = new THREE.Raycaster(); rc.setFromCamera(ndc, state.camera);
  const pl  = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  const pt  = new THREE.Vector3();
  return rc.ray.intersectPlane(pl, pt) ? pt : null;
}

function _findSnap(e) {
  const c = state.renderer.domElement, r = c.getBoundingClientRect();
  const sx = e.clientX-r.left, sy = e.clientY-r.top;
  const cam = state.camera, meshes = _snapCache ?? _collectSnapMeshes();
  const v = new THREE.Vector3(), proj = new THREE.Vector3();
  let best = null, bestD = Infinity;
  for (const mesh of meshes) {
    const pos = mesh.geometry?.attributes?.position;
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      proj.copy(v).project(cam);
      if (proj.z > 1) continue;
      const px = (proj.x*.5+.5)*c.clientWidth, py = (-proj.y*.5+.5)*c.clientHeight;
      const d = Math.hypot(sx-px, sy-py);
      if (d < SNAP_PX && d < bestD) { bestD = d; best = v.clone(); }
    }
  }
  return best;
}

function _collectSnapMeshes() {
  const r = [];
  state.surfaces?.forEach(s => { if (s.mesh) r.push(s.mesh); });
  state.cadmapperGroup?.traverse(o => { if (o.isMesh||o.isLine||o.isLineSegments) r.push(o); });
  state.userGeometry?.traverse(o  => { if (o.isMesh||o.isLine||o.isLineSegments) r.push(o); });
  state.constructionLines?.traverse(o => { if (o.isLineSegments) r.push(o); });
  return r;
}

function _updateSnapMarker(pt) {
  _clearSnapMarker();
  if (!pt) return;
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.2,8,8), new THREE.MeshBasicMaterial({color:0x00cc44,depthTest:false}));
  m.position.copy(pt); m.renderOrder = 998;
  state.scene.add(m); _snapMarker = m;
}
function _clearSnapMarker() {
  if (_snapMarker) { state.scene.remove(_snapMarker); _snapMarker.geometry.dispose(); _snapMarker.material.dispose(); _snapMarker = null; }
}
function _clearPreview() {
  if (_preview) { state.scene.remove(_preview); _preview.geometry.dispose(); _preview.material?.dispose(); _preview = null; }
}

// ── Clear all construction lines (Edit > Clear Guides) ────────
export function clearConstructionLines() {
  if (!state.constructionLines) return;
  while (state.constructionLines.children.length) {
    const c = state.constructionLines.children[0];
    state.constructionLines.remove(c);
    c.geometry?.dispose(); c.material?.dispose();
  }
  showFeedback('Construction lines cleared');
}
