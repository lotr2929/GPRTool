/*
 * rect-pick-2d.js — Rectangle picker for the Three.js 2D orthographic view
 *
 * Lets the user drag a rectangle on the Three.js canvas (not Cesium).
 * Converts screen coordinates → scene → WGS84 bbox for extractSite().
 *
 * Usage:
 *   startRect2D(onComplete, onCancel)
 *   cancelRect2D()
 *
 * onComplete called with { north, south, east, west } in decimal degrees.
 */

import * as THREE from 'three';
import { state }         from './state.js';
import { sceneToWGS84, hasRealWorldAnchor } from './real-world.js';

// ── Module state ──────────────────────────────────────────────────────────────
let _active      = false;
let _overlay     = null;
let _startScreen = null;
let _onComplete  = null;
let _onCancel    = null;

// ── Public API ────────────────────────────────────────────────────────────────

export function startRect2D(onComplete, onCancel) {
  if (_active) cancelRect2D();
  _active     = true;
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
  const canvas = state.renderer.domElement;
  const rect   = canvas.getBoundingClientRect();
  _startScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  canvas.addEventListener('pointermove', _onMove);
  canvas.addEventListener('pointerup',   _onUp);
  canvas.setPointerCapture(e.pointerId);
}

function _onMove(e) {
  if (!_startScreen) return;
  const canvas = state.renderer.domElement;
  const rect   = canvas.getBoundingClientRect();
  _drawRect(rect, _startScreen, { x: e.clientX - rect.left, y: e.clientY - rect.top });
}

function _onUp(e) {
  const canvas = state.renderer.domElement;
  canvas.removeEventListener('pointermove', _onMove);
  canvas.removeEventListener('pointerup',   _onUp);
  if (!_startScreen || !hasRealWorldAnchor()) { _cleanup(); _onCancel?.(); return; }
  const rect = canvas.getBoundingClientRect();
  const endScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  if (Math.abs(endScreen.x - _startScreen.x) < 20 ||
      Math.abs(endScreen.y - _startScreen.y) < 20) {
    _cleanup(); _onCancel?.(); return;
  }
  const ss = _screenToScene(_startScreen, rect);
  const es = _screenToScene(endScreen, rect);
  const sw = sceneToWGS84(ss.x, ss.z);
  const ew = sceneToWGS84(es.x, es.z);
  const bbox = {
    north: Math.max(sw.lat, ew.lat), south: Math.min(sw.lat, ew.lat),
    east:  Math.max(sw.lng, ew.lng), west:  Math.min(sw.lng, ew.lng),
  };
  const cb = _onComplete;
  _cleanup();
  cb?.(bbox);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _screenToScene(screen, canvasRect) {
  const ndc = new THREE.Vector3(
    (screen.x / canvasRect.width)  *  2 - 1,
    -(screen.y / canvasRect.height) *  2 + 1,
    0
  );
  ndc.unproject(state.camera2D);
  return { x: ndc.x, z: ndc.z };
}

function _createOverlay() {
  if (_overlay) _overlay.remove();
  _overlay = document.createElement('div');
  _overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:900;' +
    'border:2px dashed var(--accent-mid,#4a8a4a);background:rgba(74,138,74,0.08);display:none;';
  document.body.appendChild(_overlay);
}

function _drawRect(canvasRect, start, cur) {
  if (!_overlay) return;
  const l = canvasRect.left + Math.min(start.x, cur.x);
  const t = canvasRect.top  + Math.min(start.y, cur.y);
  const w = Math.abs(cur.x - start.x);
  const h = Math.abs(cur.y - start.y);
  Object.assign(_overlay.style, { display:'block', left:l+'px', top:t+'px', width:w+'px', height:h+'px' });
}

function _cleanup() {
  _active = false; _startScreen = null; _onComplete = null; _onCancel = null;
  const canvas = state.renderer?.domElement;
  if (canvas) {
    canvas.style.cursor = '';
    canvas.removeEventListener('pointerdown', _onDown);
    canvas.removeEventListener('pointermove', _onMove);
    canvas.removeEventListener('pointerup',   _onUp);
  }
  if (_overlay) { _overlay.remove(); _overlay = null; }
}
