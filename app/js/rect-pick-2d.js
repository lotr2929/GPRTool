/*
 * rect-pick-2d.js — Rectangle picker for the Three.js 2D orthographic view
 *
 * Lets the user drag a rectangle on the Three.js canvas (not Cesium).
 * Converts screen coordinates → scene space (metres) for extractSite().
 *
 * Usage:
 *   startRect2D(onComplete, onCancel)
 *   cancelRect2D()
 *
 * onComplete called with { xMin, xMax, zMin, zMax } in scene space (metres).
 * Sets state._rectPickActive = true while active (suppresses 2D pan in app.js).
 */

import * as THREE from 'three';
import { state }               from './state.js';
import { hasRealWorldAnchor } from './real-world.js';

// ── Module state ──────────────────────────────────────────────────────────────
let _active      = false;
let _overlay     = null;
let _startClient = null;   // { x, y } in clientX/clientY (viewport coords)
let _onComplete  = null;
let _onCancel    = null;

// ── Public API ────────────────────────────────────────────────────────────────

export function startRect2D(onComplete, onCancel) {
  if (_active) cancelRect2D();
  _active     = true;
  state._rectPickActive = true;
  _onComplete = onComplete;
  _onCancel   = onCancel ?? null;
  _createOverlay();
  const canvas = state.renderer?.domElement;
  if (!canvas) { _cleanup(); return; }
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('pointerdown', _onDown);
}

export function cancelRect2D() {
  if (!_active) return;
  _cleanup();
  _onCancel?.();
}

// ── Event handlers ────────────────────────────────────────────────────────────

function _onDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  _startClient = { x: e.clientX, y: e.clientY };
  // Listen on document so pointer capture issues don't matter
  document.addEventListener('pointermove', _onMove);
  document.addEventListener('pointerup',   _onUp);
}

function _onMove(e) {
  if (!_startClient) return;
  _drawRect(_startClient, { x: e.clientX, y: e.clientY });
}

function _onUp(e) {
  document.removeEventListener('pointermove', _onMove);
  document.removeEventListener('pointerup',   _onUp);
  if (!_startClient || !hasRealWorldAnchor()) { _cleanup(); _onCancel?.(); return; }

  const endClient = { x: e.clientX, y: e.clientY };
  const dist = Math.hypot(endClient.x - _startClient.x, endClient.y - _startClient.y);
  if (dist < 15) { _cleanup(); _onCancel?.(); return; }

  const canvas = state.renderer?.domElement;
  if (!canvas || !state.camera2D) { _cleanup(); _onCancel?.(); return; }

  const startScene = _clientToScene(_startClient);
  const endScene   = _clientToScene(endClient);
  if (!startScene || !endScene) { _cleanup(); _onCancel?.(); return; }

  const bounds = {
    xMin: Math.min(startScene.x, endScene.x),
    xMax: Math.max(startScene.x, endScene.x),
    zMin: Math.min(startScene.z, endScene.z),
    zMax: Math.max(startScene.z, endScene.z),
  };

  const cb = _onComplete;
  _cleanup();
  cb?.(bounds);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _clientToScene(client) {
  const canvas = state.renderer?.domElement;
  if (!canvas || !state.camera2D) return null;
  const rect = canvas.getBoundingClientRect();
  state.camera2D.updateMatrixWorld(true);
  const ndc = new THREE.Vector3(
    ((client.x - rect.left) / rect.width)  *  2 - 1,
    -((client.y - rect.top)  / rect.height) *  2 + 1,
    0
  );
  ndc.unproject(state.camera2D);
  return { x: ndc.x, z: ndc.z };
}

function _createOverlay() {
  if (_overlay) _overlay.remove();
  _overlay = document.createElement('div');
  _overlay.id = 'rect-pick-overlay';
  _overlay.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:9999',
    'border:2px dashed var(--accent-mid,#4a8a4a)',
    'background:rgba(74,138,74,0.08)',
    'display:none',
    'box-sizing:border-box',
  ].join(';');
  document.body.appendChild(_overlay);
}

function _drawRect(start, cur) {
  if (!_overlay) return;
  const l = Math.min(start.x, cur.x);
  const t = Math.min(start.y, cur.y);
  const w = Math.abs(cur.x - start.x);
  const h = Math.abs(cur.y - start.y);
  _overlay.style.display = 'block';
  _overlay.style.left    = l + 'px';
  _overlay.style.top     = t + 'px';
  _overlay.style.width   = w + 'px';
  _overlay.style.height  = h + 'px';
}

function _cleanup() {
  _active      = false;
  _startClient = null;
  _onComplete  = null;
  _onCancel    = null;
  state._rectPickActive = false;
  document.removeEventListener('pointermove', _onMove);
  document.removeEventListener('pointerup',   _onUp);
  const canvas = state.renderer?.domElement;
  if (canvas) {
    canvas.style.cursor = '';
    canvas.removeEventListener('pointerdown', _onDown);
  }
  if (_overlay) { _overlay.remove(); _overlay = null; }
}
