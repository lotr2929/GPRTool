/*
 * model.js — 3D model loading for GPRTool
 *
 * Covers: OBJ, GLTF, IFC loading; unit-scale detection; edge overlay.
 * onModelLoaded() stays in app.js until its dependencies are extracted.
 *
 * Each loader calls onLoaded(group, filename, format) on success.
 * Call initModel() once after the scene is ready (for IFC wasm path).
 */

import * as THREE from 'three';
import { OBJLoader }  from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { state } from './state.js';
import { showFeedback } from './ui.js';

// ── OBJ ───────────────────────────────────────────────────────────────────

export function loadOBJ(file, onLoaded) {
  const url = URL.createObjectURL(file);
  new OBJLoader().load(url, group => {
    URL.revokeObjectURL(url);
    onLoaded(group, file.name, 'OBJ');
  }, undefined, err => {
    URL.revokeObjectURL(url);
    console.error('[OBJ]', err);
    showFeedback('Failed to load OBJ file');
  });
}

// ── GLTF / GLB ────────────────────────────────────────────────────────────

export function loadGLTF(file, onLoaded) {
  const url = URL.createObjectURL(file);
  new GLTFLoader().load(url, gltf => {
    URL.revokeObjectURL(url);
    onLoaded(gltf.scene, file.name, 'GLTF');
  }, undefined, err => {
    URL.revokeObjectURL(url);
    console.error('[GLTF]', err);
    showFeedback('Failed to load GLTF/GLB file');
  });
}

// ── IFC ───────────────────────────────────────────────────────────────────

export function loadIFC(file, onLoaded) {
  showFeedback('IFC loading — coming soon');
}

// ── Edge overlay ──────────────────────────────────────────────────────────

export function addEdgeOverlay(modelGroup) {
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.35 });
  const toAdd = [];
  modelGroup.traverse(child => {
    if (!child.isMesh) return;
    const edges = new THREE.EdgesGeometry(child.geometry, 20);
    const line  = new THREE.LineSegments(edges, edgeMat);
    line.matrix.copy(child.matrixWorld);
    line.matrixAutoUpdate = false;
    line.name = '__edge__';
    toAdd.push(line);
  });
  toAdd.forEach(l => modelGroup.add(l));
}

// ── Unit scale detection ──────────────────────────────────────────────────

export function detectAndApplyUnitScale(group) {
  const box  = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);

  // Heuristic: if max dimension < 0.1, likely millimetres exported as metres
  // If > 1000, likely millimetres stored as-is
  let scale = 1;
  if (maxDim > 500)  { scale = 0.001; console.log('[Model] Auto-scale: mm→m (÷1000)'); }
  else if (maxDim < 0.1) { scale = 1000; console.log('[Model] Auto-scale: m→mm (×1000)'); }

  if (scale !== 1) {
    group.scale.setScalar(scale);
    group.updateMatrixWorld(true);
  }
  return { scale };
}
