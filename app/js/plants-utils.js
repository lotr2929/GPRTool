import * as THREE from 'three';
import { state } from './state.js';

export function placementTypeForCategory(cat) {
  if (!cat) return 'circle';
  const c = cat.toLowerCase();
  if (c.includes('tree') || c.includes('shrub') || c.includes('bamboo') || c.includes('palm')) return 'circle';
  return 'polygon';
}

export function substrateCapRadius(depth_mm) {
  if (!depth_mm || depth_mm <= 0) return Infinity;
  const table = state._substrateCapTable;
  if (!table) return Infinity;
  for (const cap of table) {
    if (depth_mm <= cap.depth_mm) return cap.max_radius_m;
  }
  return Infinity;
}

export function substrateCapLabel(depth_mm) {
  if (!depth_mm || depth_mm <= 0) return null;
  const table = state._substrateCapTable;
  if (!table) return null;
  for (const cap of table) {
    if (depth_mm <= cap.depth_mm) return cap.label;
  }
  return null;
}

export function radiusLimits(species, surface) {
  const sz = species?.size;
  const spMin = sz?.canopy_radius_min_m  ?? 0.5;
  const spMax = sz?.canopy_radius_max_m  ?? 15;
  const spDef = sz?.canopy_radius_typical_m ?? 3;
  const subMm   = surface?.substrate_mm;
  const capMax  = substrateCapRadius(subMm);
  const finalMax = Math.min(spMax === 999 ? 50 : spMax, capMax === Infinity ? 50 : capMax);
  const finalDef = Math.min(spDef === 999 ? 3 : spDef, finalMax);
  return {
    min: spMin, max: finalMax, def: finalDef,
    capLabel: subMm ? substrateCapLabel(subMm) : null,
    substrateOk: !sz?.min_substrate_mm || !subMm || subMm >= sz.min_substrate_mm
  };
}

export function getSurfaceCentre(surface) {
  surface.mesh.geometry.computeBoundingBox();
  const box = new THREE.Box3().copy(surface.mesh.geometry.boundingBox).applyMatrix4(surface.mesh.matrixWorld);
  const c = new THREE.Vector3();
  box.getCenter(c);
  return c;
}

export function raycastSurface(ndc, surface) {
  const r = new THREE.Raycaster();
  r.setFromCamera(ndc, state.camera2D);
  const hits = r.intersectObject(surface.mesh, false);
  return hits.length ? hits[0].point : null;
}

export function worldToSurfaceUV(worldPt, surface) {
  const n = surface.worldNormal.clone().normalize();
  const isH = Math.abs(n.y) > 0.7;
  const c = getSurfaceCentre(surface);
  if (isH) return { u: worldPt.x - c.x, v: worldPt.z - c.z };
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, n).normalize();
  return { u: worldPt.clone().sub(c).dot(right), v: worldPt.y - c.y };
}

export function surfaceUVToWorld(u, v, surface) {
  const n = surface.worldNormal.clone().normalize();
  const isH = Math.abs(n.y) > 0.7;
  const c = getSurfaceCentre(surface);
  if (isH) return new THREE.Vector3(c.x + u, c.y + 0.05, c.z + v);
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, n).normalize();
  return c.clone().addScaledVector(right, u).addScaledVector(up, v).addScaledVector(n, 0.05);
}

export function canvasNDC(e) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
}

export function polygonArea(pts) {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].u + pts[i].u) * (pts[j].v - pts[i].v);
  }
  return Math.abs(area / 2);
}

export function proxyMatForCategory(cat) {
  if (!cat) return state.PROXY_MAT.tree;
  const c = cat.toLowerCase();
  if (c.includes('tree')) return state.PROXY_MAT.tree;
  if (c.includes('shrub')) return state.PROXY_MAT.shrub;
  if (c.includes('bamboo') || c.includes('palm')) return state.PROXY_MAT.bamboo;
  return state.PROXY_MAT.polygon;
}
