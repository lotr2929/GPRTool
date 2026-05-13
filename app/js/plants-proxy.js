import * as THREE from 'three';
import { state } from './state.js';
import { surfaceUVToWorld, getSurfaceCentre, proxyMatForCategory } from './plants-utils.js';

export function buildCircleProxy(inst, surface, species) {
  const { cx, cz, radius } = inst.placement;
  const worldCentre = surfaceUVToWorld(cx, cz, surface);
  const cat = (species.category || '').toLowerCase();
  const isTree  = cat.includes('tree') || cat.includes('palm');
  const isShrub = cat.includes('shrub');
  const group = new THREE.Group();
  if (isTree) {
    const cSphere = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.8, 10, 8), state.PROXY_MAT.tree.clone());
    cSphere.position.set(0, radius * 0.8 + radius * 0.5, 0);
    group.add(cSphere);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.07, radius * 0.1, radius * 1.2, 6), state.PROXY_MAT.trunk.clone());
    trunk.position.set(0, radius * 0.6, 0);
    group.add(trunk);
  } else if (isShrub) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), state.PROXY_MAT.shrub.clone());
    sphere.position.set(0, radius * 0.6, 0);
    group.add(sphere);
  } else {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.7, radius * 3, 6), state.PROXY_MAT.bamboo.clone());
    cyl.position.set(0, radius * 1.5, 0);
    group.add(cyl);
  }
  const circlePts = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    circlePts.push(surfaceUVToWorld(cx + Math.cos(a) * radius, cz + Math.sin(a) * radius, surface));
  }
  const lineLoop = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts), new THREE.LineBasicMaterial({ color: 0x2d7a2d }));
  lineLoop.renderOrder = 3;
  state.scene.add(lineLoop);
  inst.placement._footprintLine = lineLoop;
  group.position.copy(worldCentre);
  group.renderOrder = 3;
  state.plantProxyGroup.add(group);
  return group;
}

export function buildPolygonProxy(inst, surface, species) {
  const { points } = inst.placement;
  if (points.length < 3) return null;
  const worldPts = points.map(p => surfaceUVToWorld(p.u, p.v, surface));
  const n = surface.worldNormal.clone().normalize();
  const isH = Math.abs(n.y) > 0.7;
  let shapePts;
  if (isH) {
    shapePts = worldPts.map(p => new THREE.Vector2(p.x, p.z));
  } else {
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, n).normalize();
    const c = getSurfaceCentre(surface);
    shapePts = worldPts.map(p => { const d = p.clone().sub(c); return new THREE.Vector2(d.dot(right), p.y - c.y); });
  }
  const shape = new THREE.Shape(shapePts);
  const geom = new THREE.ShapeGeometry(shape);
  if (!isH) {
    const c = getSurfaceCentre(surface);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, n).normalize();
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const wp = c.clone().addScaledVector(right, pos.getX(i)).addScaledVector(up, pos.getY(i)).addScaledVector(n, 0.05);
      pos.setXYZ(i, wp.x, wp.y, wp.z);
    }
    pos.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(geom, proxyMatForCategory(species.category).clone());
  if (isH) mesh.position.y = getSurfaceCentre(surface).y + 0.06;
  mesh.renderOrder = 3;
  state.plantProxyGroup.add(mesh);
  const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints([...worldPts, worldPts[0]]), new THREE.LineBasicMaterial({ color: 0x2d7a2d }));
  outline.renderOrder = 4;
  state.scene.add(outline);
  inst.placement._outlineLine = outline;
  return mesh;
}

export function removeProxyForInstance(inst) {
  if (!inst.placement) return;
  if (inst.placement.mesh) { state.plantProxyGroup.remove(inst.placement.mesh); inst.placement.mesh.traverse(c => c.geometry?.dispose()); }
  if (inst.placement._footprintLine) { state.scene.remove(inst.placement._footprintLine); inst.placement._footprintLine.geometry?.dispose(); }
  if (inst.placement._outlineLine) { state.scene.remove(inst.placement._outlineLine); inst.placement._outlineLine.geometry?.dispose(); }
}

export function clearAllProxies() {
  state.surfaces.forEach(s => { (s.plants || []).forEach(inst => removeProxyForInstance(inst)); });
  while (state.plantProxyGroup.children.length) {
    const c = state.plantProxyGroup.children[0];
    c.geometry?.dispose();
    state.plantProxyGroup.remove(c);
  }
}
