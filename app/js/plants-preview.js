import * as THREE from 'three';
import { state } from './state.js';
import { surfaceUVToWorld } from './plants-utils.js';

export function clearPreview() {
  if (state.previewMesh) {
    if (Array.isArray(state.previewMesh)) {
      state.previewMesh.forEach(m => { state.scene.remove(m); m.geometry?.dispose(); });
    } else {
      state.scene.remove(state.previewMesh); state.previewMesh.geometry?.dispose();
    }
    state.previewMesh = null;
  }
}

export function showCirclePreview(cx, cz, radius, surface) {
  clearPreview();
  const segs = 48;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(surfaceUVToWorld(cx + Math.cos(a) * radius, cz + Math.sin(a) * radius, surface));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  state.previewMesh = new THREE.Line(geom, state.PROXY_MAT.previewLine);
  state.previewMesh.renderOrder = 10;
  state.scene.add(state.previewMesh);
}

export function showPolygonPreview(pts, mouseUV, surface) {
  clearPreview();
  const lines = [];
  if (pts.length >= 2) {
    const worldPts = pts.map(p => surfaceUVToWorld(p.u, p.v, surface));
    lines.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(worldPts), state.PROXY_MAT.previewLine));
  }
  if (pts.length >= 1 && mouseUV) {
    const lastW = surfaceUVToWorld(pts[pts.length - 1].u, pts[pts.length - 1].v, surface);
    lines.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints([lastW, surfaceUVToWorld(mouseUV.u, mouseUV.v, surface)]), state.PROXY_MAT.previewLine));
  }
  lines.forEach(l => { l.renderOrder = 10; state.scene.add(l); });
  state.previewMesh = lines;
}
