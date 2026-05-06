/*
 * north-input.js — Design North and True North text input popups
 *
 * Two floating panels that appear beside the NPoint compass.
 * Call initNorthInput(getNpEl) once from initNorthPoint2D.
 *
 * Imports: north-angle.js (parse/format), north-state.js (setters, exitRotateMode).
 * No circular dependencies.
 */

import { parseNorthAngle, formatNorthAngle } from './north-angle.js';
import {
  applyDesignNorth, applyGlobalNorth,
  getDesignNorthAngle, getGlobalNorthAngle,
  exitRotateMode,
} from './north-state.js';

// ── Module state ──────────────────────────────────────────────────────────────
let _getNpEl = null;   // () => HTMLElement

export function initNorthInput(getNpEl) {
  _getNpEl = getNpEl;
}

// ── Shared helper ─────────────────────────────────────────────────────────────

function positionPopup(el) {
  const rect = _getNpEl?.().getBoundingClientRect();
  if (!rect) return;
  el.style.right  = (window.innerWidth  - rect.left + 8) + 'px';
  el.style.bottom = (window.innerHeight - rect.bottom)   + 'px';
}

// ── Design North input ────────────────────────────────────────────────────────

export function showDNInput(autoFocus = true) {
  let inp = document.getElementById('np-dn-input');
  if (!inp) {
    inp = document.createElement('div');
    inp.id = 'np-dn-input';
    inp.innerHTML = `
      <div class="np-dn-title">Design North</div>
      <input type="text" id="np-dn-field"
        placeholder="e.g. 7, 7.4, 7\u00b022', 7W"
        autocomplete="off" spellcheck="false">
      <div class="np-dn-hint">+ or E\u00a0=\u00a0east &nbsp;|\u00a0- or W\u00a0=\u00a0west</div>`;
    document.body.appendChild(inp);

    document.getElementById('np-dn-field').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const deg = parseNorthAngle(e.target.value.trim());
        if (deg !== null) { applyDesignNorth(deg); hideDNInput(); }
        else {
          e.target.classList.add('np-dn-invalid');
          setTimeout(() => e.target.classList.remove('np-dn-invalid'), 600);
        }
        e.preventDefault();
      }
      if (e.key === 'Escape') { hideDNInput(); e.stopPropagation(); }
    });
    document.getElementById('np-dn-field').addEventListener('input',
      e => e.target.classList.remove('np-dn-invalid'));
  }

  positionPopup(inp);
  inp.style.display = 'block';
  const field = document.getElementById('np-dn-field');
  const cur   = getDesignNorthAngle();
  field.value = cur !== 0 ? formatNorthAngle(cur) : '';
  field.classList.remove('np-dn-invalid');
  if (autoFocus) requestAnimationFrame(() => field.focus());

  document.removeEventListener('keydown', _onDNKey, true);
  document.addEventListener('keydown', _onDNKey, true);
  document.removeEventListener('click', _onClickOutsideDN);
  setTimeout(() => document.addEventListener('click', _onClickOutsideDN), 50);
}

export function hideDNInput() {
  const inp = document.getElementById('np-dn-input');
  if (inp) inp.style.display = 'none';
  document.removeEventListener('click', _onClickOutsideDN);
  document.removeEventListener('keydown', _onDNKey, true);
  exitRotateMode();
}

function _onDNKey(e) {
  const inp = document.getElementById('np-dn-input');
  if (!inp || inp.style.display === 'none') return;
  if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); hideDNInput(); return; }
  if (e.key === 'Enter') {
    e.stopPropagation(); e.preventDefault();
    const field = document.getElementById('np-dn-field');
    if (!field) return;
    const deg = parseNorthAngle(field.value.trim());
    if (deg !== null) { applyDesignNorth(deg); hideDNInput(); }
    else {
      field.classList.add('np-dn-invalid');
      setTimeout(() => field.classList.remove('np-dn-invalid'), 600);
    }
  }
}

function _onClickOutsideDN(e) {
  const inp  = document.getElementById('np-dn-input');
  const npEl = _getNpEl?.();
  if (inp && !inp.contains(e.target) && (!npEl || !npEl.contains(e.target))) hideDNInput();
}

// ── True North input ──────────────────────────────────────────────────────────

export function showTNInput(autoFocus = true) {
  let inp = document.getElementById('np-tn-input');
  if (!inp) {
    inp = document.createElement('div');
    inp.id = 'np-tn-input';
    inp.innerHTML = `
      <div class="np-dn-title">True North Offset</div>
      <input type="text" id="np-tn-field"
        placeholder="e.g. 7, 7.4, 7\u00b022', 7W"
        autocomplete="off" spellcheck="false">
      <div class="np-dn-hint">+ or E\u00a0=\u00a0east &nbsp;|\u00a0- or W\u00a0=\u00a0west</div>`;
    document.body.appendChild(inp);

    document.getElementById('np-tn-field').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const deg = parseNorthAngle(e.target.value.trim());
        if (deg !== null) { applyGlobalNorth(deg); hideTNInput(); }
        else {
          e.target.classList.add('np-dn-invalid');
          setTimeout(() => e.target.classList.remove('np-dn-invalid'), 600);
        }
        e.preventDefault();
      }
      if (e.key === 'Escape') { hideTNInput(); e.stopPropagation(); }
    });
    document.getElementById('np-tn-field').addEventListener('input',
      e => e.target.classList.remove('np-dn-invalid'));
  }

  positionPopup(inp);
  inp.style.display = 'block';
  const field = document.getElementById('np-tn-field');
  const cur   = getGlobalNorthAngle();
  field.value = cur !== 0 ? formatNorthAngle(cur) : '';
  field.classList.remove('np-dn-invalid');
  if (autoFocus) requestAnimationFrame(() => field.focus());

  document.removeEventListener('keydown', _onTNKey, true);
  document.addEventListener('keydown', _onTNKey, true);
  document.removeEventListener('click', _onClickOutsideTN);
  setTimeout(() => document.addEventListener('click', _onClickOutsideTN), 50);
}

export function hideTNInput() {
  const inp = document.getElementById('np-tn-input');
  if (inp) inp.style.display = 'none';
  document.removeEventListener('click', _onClickOutsideTN);
  document.removeEventListener('keydown', _onTNKey, true);
  exitRotateMode();
}

function _onTNKey(e) {
  const inp = document.getElementById('np-tn-input');
  if (!inp || inp.style.display === 'none') return;
  if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); hideTNInput(); return; }
  if (e.key === 'Enter') {
    e.stopPropagation(); e.preventDefault();
    const field = document.getElementById('np-tn-field');
    if (!field) return;
    const deg = parseNorthAngle(field.value.trim());
    if (deg !== null) { applyGlobalNorth(deg); hideTNInput(); }
    else {
      field.classList.add('np-dn-invalid');
      setTimeout(() => field.classList.remove('np-dn-invalid'), 600);
    }
  }
}

function _onClickOutsideTN(e) {
  const inp  = document.getElementById('np-tn-input');
  const npEl = _getNpEl?.();
  if (inp && !inp.contains(e.target) && (!npEl || !npEl.contains(e.target))) hideTNInput();
}
