import * as THREE from 'three';
import { state } from './state.js';

export function initViewCommands(deps) {
  const { update2DCamera, fit2DCamera, fit3DCamera, setGridVisible, showFeedback } = deps;

  document.getElementById('fitSiteBtn').addEventListener('click', () => {
    const buildings = state.cadmapperGroup?.children.find(c => c.name === 'buildings');
    const target = state.importedModel || state.siteBoundaryLine || buildings || state.cadmapperGroup;
    if (!target) { showFeedback('No model or site loaded'); return; }
    const box = new THREE.Box3().setFromObject(target);
    if (state.currentMode === '2d') fit2DCamera(box); else fit3DCamera(box);
    showFeedback('Fitted to model');
  });

  document.getElementById('resetCameraBtn').addEventListener('click', () => {
    if (state.currentMode === '2d') {
      state.pan2D.x = 0; state.pan2D.z = 0; state.zoom2D = 1;
      update2DCamera();
    } else {
      state.camera3D.position.set(100, 100, 100);
      state.camera3D.lookAt(0, 0, 0);
      state.controls3D.target.set(0, 0, 0);
      state.controls3D.update();
    }
    showFeedback('Camera reset');
  });

  document.getElementById('toggleGridBtn').addEventListener('click', () => {
    if (state.gridHelper) {
      const next = !state.gridHelper.visible;
      setGridVisible(next);
      showFeedback('Grid ' + (next ? 'on' : 'off'));
    }
  });

  document.getElementById('mapOverlayToggle')?.addEventListener('change', e => {
    if (state.mapTileGroup) state.mapTileGroup.visible = e.target.checked;
  });

  document.getElementById('componentLibraryBtn')?.addEventListener('click', () => showFeedback('Component Library \u2014 coming soon'));
  document.getElementById('generateReportBtn')?.addEventListener('click',   () => showFeedback('GPR Report \u2014 coming soon'));

  document.querySelectorAll('.tool-btn').forEach(btn =>
    btn.addEventListener('click', () => showFeedback(`Tool: ${btn.dataset.action} \u2014 coming soon`)));
}
