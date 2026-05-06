/**
 * north-point-2d.js — 2D DOM compass widget (entry point)
 *
 * Owns: DOM wiring, drag, resize, pointer events, position/size persistence.
 * Delegates:
 *   Angle state + rotate mode + SVG rendering → north-state.js
 *   DN / TN input popups                      → north-input.js
 *   Angle parsing / formatting                → north-angle.js
 *
 * Re-exports the public angle API so all existing callers remain unchanged:
 *   import { getDesignNorthAngle, setDesignNorth, ... } from './north-point-2d.js'
 */

import { formatNorthAngle } from './north-angle.js';
import {
  initNorthState, injectDNGroup, setTNNeedleEl, updateCompassDisplay,
  applyDesignNorth, applyGlobalNorth,
  getDesignNorthAngle, getGlobalNorthAngle,
  enterRotateMode, exitRotateMode, isInRotateMode,
  startRotating, stopRotating, isCurrentlyRotating,
  setDesignNorth, resetDesignNorth,
} from './north-state.js';
import { initNorthInput } from './north-input.js';

// Re-exports — all callers import from here, unchanged
export { getDesignNorthAngle, getGlobalNorthAngle, setDesignNorth, resetDesignNorth };

// ── Constants ─────────────────────────────────────────────────────────────────
const NP_KEY         = 'gprtool-np2d-state';
const NP_BASE_W      = 77;
const NP_BASE_H      = 86;
const NP_MARGIN      = 16;
const DRAG_THRESHOLD = 5;
const MIN_W          = 38;
const MAX_W          = 231;

// ── Module state ──────────────────────────────────────────────────────────────
let npEl, npRotEl, npCtxEl, npVP;
let npW      = NP_BASE_W;
let getState;

let isDragging       = false;
let dragPending      = false;
let dragStartClient  = { x: 0, y: 0 };
let dragOffset       = { x: 0, y: 0 };

let isResizing   = false;
let resizeHandle = null;
let resizeStart  = { w: NP_BASE_W, anchor: { x: 0, y: 0 } };

// Drag-rotate session state (local only; rotate mode flags live in north-state.js)
let rotateStartAngle       = 0;
let rotateStartGlobalNorth = 0;

// ── Size / position helpers ───────────────────────────────────────────────────

function heightFromWidth(w) { return Math.round(w * (NP_BASE_H / NP_BASE_W)); }

function applySize(w) {
  npW = Math.max(MIN_W, Math.min(MAX_W, w));
  npEl.style.width  = npW + 'px';
  npEl.style.height = heightFromWidth(npW) + 'px';
}

function applyPos(right, bottom) {
  const vw = npVP.clientWidth;
  const vh = npVP.clientHeight;
  right  = Math.max(0, Math.min(vw - npW,                right));
  bottom = Math.max(0, Math.min(vh - heightFromWidth(npW), bottom));
  npEl.style.right  = right  + 'px';
  npEl.style.bottom = bottom + 'px';
  npEl.style.left   = '';
  npEl.style.top    = '';
  saveState();
}

function resetPosInternal() {
  npEl.style.right  = NP_MARGIN + 'px';
  npEl.style.bottom = NP_MARGIN + 'px';
  npEl.style.left   = '';
  npEl.style.top    = '';
  saveState();
}

function angleFromNPCenter(clientX, clientY) {
  const rect = npEl.getBoundingClientRect();
  const cx   = rect.left + rect.width  * 0.5;
  const cy   = rect.top  + rect.height * 0.555;
  return Math.atan2(clientX - cx, cy - clientY) * 180 / Math.PI;
}

// ── Persistence ───────────────────────────────────────────────────────────────

function saveState() {
  try {
    localStorage.setItem(NP_KEY, JSON.stringify({
      right:   parseFloat(npEl.style.right)  || NP_MARGIN,
      bottom:  parseFloat(npEl.style.bottom) || NP_MARGIN,
      w:       npW,
      visible: npEl.style.display !== 'none',
      dn:      getDesignNorthAngle(),
      tn:      getGlobalNorthAngle(),
    }));
  } catch {}
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(NP_KEY));
    if (saved) {
      if (saved.w)                applySize(saved.w);
      if (saved.visible === false) npEl.style.display = 'none';
      if (saved.right !== undefined) applyPos(saved.right, saved.bottom);
      else                           resetPosInternal();
      // Angles default to 0; restored from .gpr project file when project opens
      applyDesignNorth(0);
      applyGlobalNorth(0);
    } else {
      resetPosInternal();
    }
  } catch {
    resetPosInternal();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function toggleNorthPoint() {
  if (!npEl) return;
  npEl.style.display = npEl.style.display === 'none' ? '' : 'none';
  saveState();
}

export function setNorthPoint2DVisible(visible) {
  if (!npEl) return;
  npEl.style.display = visible ? '' : 'none';
}

export function resetNorthPos() {
  if (!npEl) return;
  resetPosInternal();
}

export function setNorthPointMode(mode) {
  // '3d': hide DOM widget — 3D gizmo takes over; '2d': always visible
  if (!npEl) return;
  npEl.style.display = mode === '3d' ? 'none' : '';
}

export function updateNorthRotation() {
  if (!npRotEl || !npEl || npEl.style.display === 'none') return;
  const { currentMode, rotate2D } = getState();
  updateCompassDisplay(npRotEl, currentMode, rotate2D);
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initNorthPoint2D(getStateCallback) {
  getState = getStateCallback;
  npEl    = document.getElementById('np-container');
  npRotEl = document.getElementById('np-rotator');
  npCtxEl = document.getElementById('np-ctx-menu');
  npVP    = document.getElementById('viewport');

  if (!npEl || !npRotEl || !npVP) {
    console.warn('north-point-2d: required DOM elements not found');
    return;
  }

  // Initialise angle state module (pass npEl for cursor/class changes + save callback)
  initNorthState(npEl, saveState);

  // Inject green DN arrow and grab TN needle from the static SVG
  const svg = npRotEl.querySelector('svg');
  if (svg) {
    setTNNeedleEl(svg.getElementById('np-tn-needle'));
    injectDNGroup(svg);
  }

  // Initialise input popups (pass getter so they can position themselves)
  initNorthInput(() => npEl);

  applySize(NP_BASE_W);
  restoreState();

  // Click toggles resize-handle selection ring
  npEl.addEventListener('click', e => {
    if (e.target.classList.contains('resize-handle')) return;
    npEl.classList.toggle('np-selected');
  });
  document.addEventListener('click', e => {
    if (!npEl.contains(e.target)) npEl.classList.remove('np-selected');
  });

  npEl.querySelectorAll('.resize-handle').forEach(h =>
    h.addEventListener('pointerdown', onResizeDown));

  npEl.addEventListener('pointerdown', onDragDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup',   onPointerUp);

  // Context menu
  npEl.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    if (npCtxEl) {
      npCtxEl.style.left = e.clientX + 'px';
      npCtxEl.style.top  = e.clientY + 'px';
      npCtxEl.style.display = 'block';
    }
  });
  document.addEventListener('click', e => {
    if (npCtxEl && !npCtxEl.contains(e.target)) npCtxEl.style.display = 'none';
  });

  document.getElementById('np-ctx-reset')?.addEventListener('click', () => {
    resetNorthPos();
    if (npCtxEl) npCtxEl.style.display = 'none';
  });
  document.getElementById('np-ctx-hide')?.addEventListener('click', () => {
    toggleNorthPoint();
    if (npCtxEl) npCtxEl.style.display = 'none';
  });
  // np-ctx-rotate-np removed — "Rotate N Point" deprecated; use Set Design North command
}

// ── Resize ────────────────────────────────────────────────────────────────────

function onResizeDown(e) {
  e.preventDefault(); e.stopPropagation();
  isResizing   = true;
  resizeHandle = e.target.dataset.handle;
  resizeStart.w = npW;

  const L = npEl.offsetLeft, T = npEl.offsetTop;
  const R = L + npW,         B = T + heightFromWidth(npW);
  switch (resizeHandle) {
    case 'se': resizeStart.anchor = { x: L, y: T }; break;
    case 'nw': resizeStart.anchor = { x: R, y: B }; break;
    case 'ne': resizeStart.anchor = { x: L, y: B }; break;
    case 'sw': resizeStart.anchor = { x: R, y: T }; break;
  }
  npEl.classList.add('np-resizing');
  npEl.setPointerCapture(e.pointerId);
}

function handleResize(e) {
  if (!isResizing) return;
  const vpRect = npVP.getBoundingClientRect();
  const mouseX = e.clientX - vpRect.left;
  const mouseY = e.clientY - vpRect.top;
  const { x: ax, y: ay } = resizeStart.anchor;

  let dW, dH;
  switch (resizeHandle) {
    case 'se': dW = mouseX - ax; dH = mouseY - ay; break;
    case 'nw': dW = ax - mouseX; dH = ay - mouseY; break;
    case 'ne': dW = mouseX - ax; dH = ay - mouseY; break;
    case 'sw': dW = ax - mouseX; dH = mouseY - ay; break;
  }
  applySize(Math.round((dW + dH * (NP_BASE_W / NP_BASE_H)) / 2));

  const newH = heightFromWidth(npW);
  let newLeft, newTop;
  switch (resizeHandle) {
    case 'se': newLeft = ax;       newTop = ay;        break;
    case 'nw': newLeft = ax - npW; newTop = ay - newH; break;
    case 'ne': newLeft = ax;       newTop = ay - newH; break;
    case 'sw': newLeft = ax - npW; newTop = ay;        break;
  }
  npEl.style.left = newLeft + 'px'; npEl.style.top = newTop + 'px';
  npEl.style.right = ''; npEl.style.bottom = '';
}

function stopResize() {
  if (!isResizing) return;
  isResizing = false; resizeHandle = null;
  npEl.classList.remove('np-resizing');
  applyPos(
    npVP.clientWidth  - npEl.offsetLeft - npW,
    npVP.clientHeight - npEl.offsetTop  - heightFromWidth(npW),
  );
}

// ── Drag ──────────────────────────────────────────────────────────────────────

function onDragDown(e) {
  if (e.target.classList.contains('resize-handle') || isResizing) return;
  if (e.button !== 0) return;

  if (isInRotateMode()) {
    startRotating();
    rotateStartAngle       = angleFromNPCenter(e.clientX, e.clientY);
    rotateStartGlobalNorth = getGlobalNorthAngle();
    npEl.setPointerCapture(e.pointerId);
    e.stopPropagation();
    return;
  }

  dragPending     = true;
  dragStartClient = { x: e.clientX, y: e.clientY };
  const vr = npVP.getBoundingClientRect();
  dragOffset = {
    x: (npEl.offsetLeft + npW)                  - (e.clientX - vr.left),
    y: (npEl.offsetTop  + heightFromWidth(npW)) - (e.clientY - vr.top),
  };
  npEl.setPointerCapture(e.pointerId);
  e.stopPropagation();
}

function handleDrag(e) {
  if (isCurrentlyRotating()) {
    const newGN = rotateStartGlobalNorth + (angleFromNPCenter(e.clientX, e.clientY) - rotateStartAngle);
    applyGlobalNorth(newGN);
    const field = document.getElementById('np-tn-field');
    if (field) field.value = formatNorthAngle(newGN);
    return;
  }
  if (!dragPending && !isDragging) return;
  if (!isDragging) {
    if (Math.hypot(e.clientX - dragStartClient.x, e.clientY - dragStartClient.y) < DRAG_THRESHOLD) return;
    isDragging = true;
    npEl.style.cursor = 'grabbing';
  }
  const vr = npVP.getBoundingClientRect();
  applyPos(
    npVP.clientWidth  - (e.clientX - vr.left + dragOffset.x),
    npVP.clientHeight - (e.clientY - vr.top  + dragOffset.y),
  );
}

function stopDrag() {
  if (isCurrentlyRotating()) { stopRotating(); return; }
  dragPending = false;
  if (!isDragging) return;
  isDragging = false;
  npEl.style.cursor = isInRotateMode() ? 'crosshair' : 'grab';
}

// ── Combined pointer handlers ─────────────────────────────────────────────────

function onPointerMove(e) { handleResize(e); handleDrag(e); }
function onPointerUp()    { stopResize();    stopDrag();    }
