/*
 * north-state.js — Design North / Global North angle state
 *
 * Owns: designNorthAngle, globalNorthAngle, rotate-mode flags,
 *       SVG group injection, and compass needle/label rendering.
 *
 * Initialise once:  initNorthState(npEl, saveCallback)
 * Then inject SVG:  injectDNGroup(svg) + setTNNeedleEl(el)
 *
 * Imports: north-angle.js only.
 */

import { formatNorthAngleCompact } from './north-angle.js';

const SVG_CX = 32;   // viewBox centre X
const SVG_CY = 40;   // viewBox centre Y

// ── Module state ──────────────────────────────────────────────────────────────
let _npEl         = null;   // set by initNorthState — for cursor / class changes
let _saveCallback = null;   // set by initNorthState — called after any angle change

let _dn = 0;   // designNorthAngle
let _gn = 0;   // globalNorthAngle (True North offset)

let _dnGroupEl  = null;   // green DN arrow SVG group  (set by injectDNGroup)
let _dnLabelEl  = null;   // angle label inside DN group
let _tnNeedleEl = null;   // TN needle group from the static SVG (set by setTNNeedleEl)

let _rotateMode = false;
let _isRotating = false;

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Call once from initNorthPoint2D, before restoreState.
 * @param {HTMLElement} npEl         — compass container (for cursor / class)
 * @param {Function}    saveCallback — called after every angle change
 */
export function initNorthState(npEl, saveCallback) {
  _npEl         = npEl;
  _saveCallback = saveCallback ?? null;
}

export function setTNNeedleEl(el) { _tnNeedleEl = el; }

// ── Angle setters ─────────────────────────────────────────────────────────────

export function applyDesignNorth(deg) {
  _dn = deg ?? 0;
  if (_dnLabelEl) _dnLabelEl.textContent = formatNorthAngleCompact(_dn - _gn);
  const clearItem = document.getElementById('np-ctx-clear-dn');
  if (clearItem) clearItem.style.display = _dn !== 0 ? '' : 'none';
  _saveCallback?.();
}

export function applyGlobalNorth(deg) {
  _gn = deg ?? 0;
  if (_dnLabelEl) _dnLabelEl.textContent = formatNorthAngleCompact(_dn - _gn);
  _saveCallback?.();
}

// ── Public angle API ──────────────────────────────────────────────────────────

export function setDesignNorth(deg)   { applyDesignNorth(deg); }
export function resetDesignNorth()    { applyDesignNorth(0);   }
export function getDesignNorthAngle() { return _dn; }
export function getGlobalNorthAngle() { return _gn; }

// ── Rotate mode ───────────────────────────────────────────────────────────────

export function enterRotateMode() {
  _rotateMode = true;
  if (_npEl) { _npEl.style.cursor = 'crosshair'; _npEl.classList.add('np-rotating'); }
}

export function exitRotateMode() {
  _rotateMode = false;
  _isRotating = false;
  if (_npEl) { _npEl.style.cursor = 'grab'; _npEl.classList.remove('np-rotating'); }
}

export function startRotating()       { _isRotating = true;   }
export function stopRotating()        { _isRotating = false;  }
export function isInRotateMode()      { return _rotateMode;   }
export function isCurrentlyRotating() { return _isRotating;   }

// ── SVG injection ─────────────────────────────────────────────────────────────

/**
 * Inject the green Design North arrow into the compass SVG.
 * Call once from initNorthPoint2D after body HTML is in the DOM.
 *
 * Arrow geometry (local SVG coords, pointing up at rotation = 0):
 *   Shaft: (SVG_CX, 18) → (SVG_CX, 62)  — full diameter of the circle
 *   Dot:   r=3 at (SVG_CX, 18)           — marks the Design North tip
 */
export function injectDNGroup(svg) {
  svg.setAttribute('overflow', 'visible');

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.id = 'np-dn-group';
  g.style.display = 'none';

  const shaft = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  shaft.setAttribute('x1', SVG_CX); shaft.setAttribute('y1', '18');
  shaft.setAttribute('x2', SVG_CX); shaft.setAttribute('y2', '62');
  shaft.setAttribute('stroke', '#4a8a4a');
  shaft.setAttribute('stroke-width', '0.75');

  const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  head.setAttribute('cx', SVG_CX); head.setAttribute('cy', '18');
  head.setAttribute('r', '3');     head.setAttribute('fill', '#4a8a4a');

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.id = 'np-dn-label';
  label.setAttribute('font-size', '7');
  label.setAttribute('font-family', 'Outfit, sans-serif');
  label.setAttribute('fill', '#4a8a4a');

  g.appendChild(shaft); g.appendChild(head); g.appendChild(label);
  svg.appendChild(g);

  _dnGroupEl = g;
  _dnLabelEl = label;
}

// ── Compass display ───────────────────────────────────────────────────────────

/**
 * Update housing rotation, TN needle, and DN arrow/label.
 * Called every animation frame by north-point-2d.js updateNorthRotation().
 *
 * @param {HTMLElement} npRotEl     — the rotating housing element
 * @param {string}      currentMode — '2d' | '3d'
 * @param {number}      rotate2D    — current 2D view rotation in radians
 */
export function updateCompassDisplay(npRotEl, currentMode, rotate2D) {
  const iconRot = currentMode === '2d'
    ? _dn - (rotate2D * 180 / Math.PI)
    : _dn;
  npRotEl.style.transform = `rotate(${iconRot}deg)`;

  if (_tnNeedleEl) {
    _tnNeedleEl.setAttribute('transform',
      `rotate(${_gn - _dn}, ${SVG_CX}, ${SVG_CY})`);
  }

  if (_dnGroupEl && _dnLabelEl) {
    _dnGroupEl.setAttribute('transform', `rotate(0, ${SVG_CX}, ${SVG_CY})`);
    _dnGroupEl.style.display = _dn !== _gn ? '' : 'none';

    const LABEL_Y   = 13;
    const CLASH_DEG = 35;
    const SIDE_X    = -4;
    let normTN = (((_gn - _dn) % 360) + 360) % 360;
    if (normTN > 180) normTN -= 360;

    if (Math.abs(normTN) < CLASH_DEG) {
      if (normTN >= 0) {
        _dnLabelEl.setAttribute('x', SVG_CX - SIDE_X);
        _dnLabelEl.setAttribute('text-anchor', 'end');
      } else {
        _dnLabelEl.setAttribute('x', SVG_CX + SIDE_X);
        _dnLabelEl.setAttribute('text-anchor', 'start');
      }
    } else {
      _dnLabelEl.setAttribute('x', SVG_CX);
      _dnLabelEl.setAttribute('text-anchor', 'middle');
    }
    _dnLabelEl.setAttribute('y', LABEL_Y);
  }
}
