import * as THREE from 'three';
import { state } from './state.js';

export function initViewportControls(deps) {
  const {
    update2DCamera, handleBoundaryMouseMove, handleDesignToolDblClick,
    handleBoundaryDblClick, showGridSpacingPopup,
  } = deps;

  state.renderer.domElement.addEventListener('pointerdown', e => {
    if (state.currentMode !== '2d') return;
    if ((e.button === 0 && state.zoomRectMode) || e.button === 2) {
      state.zoomRectStart = { x: e.clientX, y: e.clientY };
      state.zoomRectEl = document.createElement('div');
      state.zoomRectEl.style.cssText = 'position:absolute;border:2px dashed #4a8a4a;background:rgba(74,138,74,0.08);pointer-events:none;z-index:50;';
      document.getElementById('viewport').appendChild(state.zoomRectEl);
      state.renderer.domElement.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 1) {
      if (state.selectedSurface) return;
      e.preventDefault();
      state.rotate2DActive = true;
      state.rotate2DLast   = { x: e.clientX, y: e.clientY };
      state.renderer.domElement.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      if (state._rectPickActive) return;
      state.pan2DActive = true;
      state.pan2DLast   = { x: e.clientX, y: e.clientY };
      state.renderer.domElement.setPointerCapture(e.pointerId);
    }
  });

  state.renderer.domElement.addEventListener('pointermove', e => {
    if (state.currentMode !== '2d') return;
    if (state.boundaryDrawMode) handleBoundaryMouseMove(e.clientX, e.clientY);
    if (state.zoomRectMode && state.zoomRectStart && state.zoomRectEl) {
      const rect  = state.canvas.getBoundingClientRect();
      const x1    = Math.min(state.zoomRectStart.x, e.clientX) - rect.left;
      const y1    = Math.min(state.zoomRectStart.y, e.clientY) - rect.top;
      const w     = Math.abs(e.clientX - state.zoomRectStart.x);
      const h     = Math.abs(e.clientY - state.zoomRectStart.y);
      state.zoomRectEl.style.left   = x1 + 'px';
      state.zoomRectEl.style.top    = y1 + 'px';
      state.zoomRectEl.style.width  = w  + 'px';
      state.zoomRectEl.style.height = h  + 'px';
      return;
    }
    if (state.rotate2DActive) {
      const dx = e.clientX - state.rotate2DLast.x;
      state.rotate2DLast = { x: e.clientX, y: e.clientY };
      state.rotate2D += dx * (Math.PI / state.container.clientWidth);
      update2DCamera();
      return;
    }
    if (!state.pan2DActive) return;
    const dx = e.clientX - state.pan2DLast.x;
    const dy = e.clientY - state.pan2DLast.y;
    state.pan2DLast = { x: e.clientX, y: e.clientY };

    if (state.selectedSurface && state.camera2D.userData.surfaceCentre) {
      const frustumW = (state.camera2D.right - state.camera2D.left) / state.camera2D.zoom;
      const frustumH = (state.camera2D.top - state.camera2D.bottom) / state.camera2D.zoom;
      const scaleX   = frustumW / state.container.clientWidth;
      const scaleY   = frustumH / state.container.clientHeight;
      const n    = state.camera2D.userData.surfaceNormal.clone();
      const up   = state.camera2D.userData.surfaceUp.clone();
      const right = new THREE.Vector3().crossVectors(up, n).normalize();
      state.camera2D.position.addScaledVector(right,  dx * scaleX);
      state.camera2D.position.addScaledVector(up,     -dy * scaleY);
      state.camera2D.lookAt(
        state.camera2D.position.clone().addScaledVector(n, -state.camera2D.far * 0.5)
      );
      state.camera2D.updateProjectionMatrix();
    } else {
      const frustumW = (state.camera2D.right - state.camera2D.left) / state.camera2D.zoom;
      const frustumH = (state.camera2D.top - state.camera2D.bottom) / state.camera2D.zoom;
      const r   = state.rotate2D;
      const scX = frustumW / state.container.clientWidth;
      const scZ = frustumH / state.container.clientHeight;
      state.pan2D.x -= dx * scX * Math.cos(r) - dy * scZ * Math.sin(r);
      state.pan2D.z -= dx * scX * Math.sin(r) + dy * scZ * Math.cos(r);
      update2DCamera();
    }
  });

  state.renderer.domElement.addEventListener('pointerup', e => {
    if (state.currentMode !== '2d') return;
    if (state.zoomRectMode && state.zoomRectStart && state.zoomRectEl) {
      const rect  = state.canvas.getBoundingClientRect();
      const ndcX1 = ((Math.min(state.zoomRectStart.x, e.clientX) - rect.left) / rect.width)  * 2 - 1;
      const ndcX2 = ((Math.max(state.zoomRectStart.x, e.clientX) - rect.left) / rect.width)  * 2 - 1;
      const ndcY1 = 1 - ((Math.min(state.zoomRectStart.y, e.clientY) - rect.top) / rect.height) * 2;
      const ndcY2 = 1 - ((Math.max(state.zoomRectStart.y, e.clientY) - rect.top) / rect.height) * 2;
      if (Math.abs(ndcX2 - ndcX1) > 0.02 && Math.abs(ndcY1 - ndcY2) > 0.02) {
        const frustumW = (state.camera2D.right - state.camera2D.left) / state.camera2D.zoom;
        const frustumH = (state.camera2D.top - state.camera2D.bottom) / state.camera2D.zoom;
        const wx1 = state.pan2D.x + (ndcX1 * 0.5) * frustumW;
        const wx2 = state.pan2D.x + (ndcX2 * 0.5) * frustumW;
        const wz1 = state.pan2D.z + (-ndcY1 * 0.5) * frustumH;
        const wz2 = state.pan2D.z + (-ndcY2 * 0.5) * frustumH;
        const spanX = Math.abs(wx2 - wx1), spanZ = Math.abs(wz2 - wz1);
        state.pan2D.x = (wx1 + wx2) / 2;
        state.pan2D.z = (wz1 + wz2) / 2;
        const aspect  = rect.width / rect.height;
        const newHalfH = Math.max(spanX / aspect, spanZ) / 2;
        state.camera2D.left   = -newHalfH * aspect;
        state.camera2D.right  =  newHalfH * aspect;
        state.camera2D.top    =  newHalfH;
        state.camera2D.bottom = -newHalfH;
        state.zoom2D = 1;
        update2DCamera();
      }
      state.zoomRectEl.remove();
      state.zoomRectEl    = null;
      state.zoomRectStart = null;
      state.zoomRectMode  = false;
      state.canvas.style.cursor = '';
      state.renderer.domElement.releasePointerCapture(e.pointerId);
      return;
    }
    state.pan2DActive    = false;
    state.rotate2DActive = false;
    state.renderer.domElement.releasePointerCapture(e.pointerId);
  });

  state.renderer.domElement.addEventListener('dblclick', e => {
    e.preventDefault();
    if (handleDesignToolDblClick(e)) return;
    handleBoundaryDblClick();
  });

  state._vpCtx = document.createElement('div');
  state._vpCtx.id = 'vp-ctx-menu';
  state._vpCtx.style.cssText = `
    display:none; position:fixed; z-index:900;
    background:var(--chrome-panel); border:1px solid var(--chrome-border);
    border-radius:4px; box-shadow:0 4px 16px rgba(0,0,0,0.18);
    padding:3px 0; min-width:170px;
    font-family:var(--font,'Outfit',sans-serif); font-size:12px;`;
  const _ctxItem = (id, label) => {
    const d = document.createElement('div');
    d.id = id;
    d.textContent = label;
    d.style.cssText = 'padding:6px 14px; cursor:pointer; color:var(--text-primary); white-space:nowrap;';
    d.addEventListener('mouseover', () => d.style.background = 'var(--chrome-hover)');
    d.addEventListener('mouseout',  () => d.style.background = '');
    return d;
  };
  state._vpCtx.appendChild(_ctxItem('vp-ctx-grid', 'Grid Spacing\u2026'));
  state._vpCtx.appendChild(_ctxItem('vp-ctx-fit',  'Fit to Site'));
  state._vpCtx.appendChild(_ctxItem('vp-ctx-reset', 'Reset Camera'));
  state._vpCtx.appendChild(_ctxItem('vp-ctx-grid-toggle', 'Toggle Grid'));
  document.body.appendChild(state._vpCtx);
  state._vpCtxX = 0; state._vpCtxY = 0;

  state.renderer.domElement.addEventListener('contextmenu', e => {
    e.preventDefault();
    state._vpCtxX = e.clientX; state._vpCtxY = e.clientY;
    const w = 178, h = 120;
    state._vpCtx.style.left = Math.min(e.clientX, window.innerWidth - w - 4) + 'px';
    state._vpCtx.style.top  = Math.min(e.clientY, window.innerHeight - h - 4) + 'px';
    state._vpCtx.style.display = 'block';
  });
  document.addEventListener('pointerdown', e => {
    if (!state._vpCtx.contains(e.target)) state._vpCtx.style.display = 'none';
  });
  document.getElementById('vp-ctx-grid').addEventListener('click', () => {
    state._vpCtx.style.display = 'none';
    showGridSpacingPopup(state._vpCtxX, state._vpCtxY);
  });
  document.getElementById('vp-ctx-fit').addEventListener('click', () => {
    state._vpCtx.style.display = 'none';
    document.getElementById('fitSiteBtn')?.click();
  });
  document.getElementById('vp-ctx-reset').addEventListener('click', () => {
    state._vpCtx.style.display = 'none';
    document.getElementById('resetCameraBtn')?.click();
  });
  document.getElementById('vp-ctx-grid-toggle').addEventListener('click', () => {
    state._vpCtx.style.display = 'none';
    document.getElementById('toggleGridBtn')?.click();
  });

  document.querySelectorAll('.panel-resize').forEach(handle => {
    handle.addEventListener('pointerdown', e => {
      e.preventDefault();
      const panel  = document.getElementById(handle.dataset.target);
      if (!panel || panel.classList.contains('collapsed')) return;
      const isWest = handle.dataset.dir === 'w';
      const startX = e.clientX;
      const startW = panel.offsetWidth;
      panel.style.transition = 'none';
      handle.classList.add('active');
      handle.setPointerCapture(e.pointerId);
      const onMove = ev => {
        const dx   = ev.clientX - startX;
        const newW = isWest ? startW - dx : startW + dx;
        panel.style.width = Math.max(160, Math.min(460, newW)) + 'px';
      };
      const onUp = () => {
        panel.style.transition = '';
        handle.classList.remove('active');
        handle.releasePointerCapture(e.pointerId);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup',   onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup',   onUp);
    });
  });

  state.renderer.domElement.addEventListener('wheel', e => {
    if (state.currentMode !== '2d') return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    if (state.selectedSurface) {
      state.camera2D.left   *= factor;
      state.camera2D.right  *= factor;
      state.camera2D.top    *= factor;
      state.camera2D.bottom *= factor;
      state.camera2D.updateProjectionMatrix();
    } else {
      state.zoom2D = Math.max(0.002, Math.min(50, state.zoom2D * factor));
      update2DCamera();
    }
  }, { passive: false });
}
