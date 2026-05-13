import * as THREE from 'three';
import { state } from './state.js';

export function initPlantEngine(deps) {
  const {
    openPlantModal, closePlantModal, renderPlantList, startPlacement,
    cancelPlacement, clearPreview, showCirclePreview, showPolygonPreview,
    commitCirclePlacement, commitPolygonPlacement, canvasNDC,
    raycastSurface, worldToSurfaceUV, radiusLimits, substrateCapLabel,
    recalcGPR, updateSurfaceListTag, renderSurfacePlantSchedule,
    removeProxyForInstance, clearAllProxies, showFeedback,
  } = deps;

  fetch('./plants_free.json')
    .then(r => r.json())
    .then(db => {
      state.plantDb = db.species || [];
      state._substrateCapTable = db.substrate_caps || null;
    })
    .catch(err => console.warn('Plant library not loaded:', err));

  document.getElementById('plant-modal-close').addEventListener('click', closePlantModal);
  document.getElementById('plant-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('plant-modal-overlay')) closePlantModal();
  });
  document.getElementById('plant-search').addEventListener('input', renderPlantList);
  document.getElementById('plant-filter').addEventListener('change', renderPlantList);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.plantModalOpen) { e.stopPropagation(); closePlantModal(); }
  }, true);

  document.getElementById('plantLibraryBtn')?.addEventListener('click', openPlantModal);
  document.getElementById('addPlantBtn')?.addEventListener('click', openPlantModal);
  document.getElementById('gpr-target')?.addEventListener('input', recalcGPR);

  document.getElementById('surf-substrate')?.addEventListener('change', e => {
    if (!state.selectedSurface) return;
    const v = parseInt(e.target.value);
    state.selectedSurface.substrate_mm = (!v || isNaN(v)) ? null : v;
    const capEl = document.getElementById('surf-substrate-cap');
    if (capEl) {
      const label = substrateCapLabel(state.selectedSurface.substrate_mm);
      if (label) { capEl.textContent = label; capEl.style.display = ''; }
      else { capEl.style.display = 'none'; }
    }
    if (state.plantModalOpen) renderPlantList();
  });

  state.plantProxyGroup = new THREE.Group();
  state.plantProxyGroup.renderOrder = 2;
  state.scene.add(state.plantProxyGroup);

  state.PROXY_MAT = {
    tree:       new THREE.MeshBasicMaterial({ color: 0x2d7a2d, side: THREE.DoubleSide }),
    shrub:      new THREE.MeshBasicMaterial({ color: 0x3a9a3a, side: THREE.DoubleSide }),
    bamboo:     new THREE.MeshBasicMaterial({ color: 0x4ab040, side: THREE.DoubleSide }),
    groundcover:new THREE.MeshBasicMaterial({ color: 0x7ac050, opacity: 0.75, transparent: true, side: THREE.DoubleSide }),
    polygon:    new THREE.MeshBasicMaterial({ color: 0x5ab848, opacity: 0.65, transparent: true, side: THREE.DoubleSide }),
    preview:    new THREE.MeshBasicMaterial({ color: 0x44cc44, opacity: 0.45, transparent: true, side: THREE.DoubleSide }),
    previewLine:new THREE.LineBasicMaterial({ color: 0x44cc44 }),
    trunk:      new THREE.MeshBasicMaterial({ color: 0x8b6040 }),
  };

  state.renderer.domElement.addEventListener('click', e => {
    if (state.currentMode !== '2d' || !state.selectedSurface) return;
    if (state.placementMode === 'idle') return;
    const ndc  = canvasNDC(e);
    const wPt  = raycastSurface(ndc, state.selectedSurface);
    if (!wPt) return;
    const uv  = worldToSurfaceUV(wPt, state.selectedSurface);
    if (state.placementMode === 'placing_circle') {
      if (state.circlePhase === 'none') {
        state.circleCentre = { u: uv.u, v: uv.v };
        state.circlePhase  = 'centre_set';
        showFeedback('Centre set \u2014 click again to set canopy radius', 0);
      } else {
        const limits = radiusLimits(state.placingSpecies, state.selectedSurface);
        const raw    = Math.hypot(uv.u - state.circleCentre.u, uv.v - state.circleCentre.v);
        const radius = Math.min(limits.max, Math.max(limits.min, raw));
        const area   = Math.round(Math.PI * radius * radius * 10) / 10;
        const inst   = commitCirclePlacement(state.selectedSurface, state.placingSpecies, state.circleCentre, radius, area);
        state.circleCentre = null;
        state.circlePhase  = 'none';
        state.placingSpecies = null;
        state.placementMode  = 'idle';
        clearPreview();
        state.renderer.domElement.style.cursor = '';
        showFeedback(`${inst.placement ? 'Placed' : 'Added'} plant \u2014 canopy ${area} m\u00b2`);
      }
      return;
    }
    if (state.placementMode === 'placing_polygon') {
      state.placingPoly.push({ u: uv.u, v: uv.v });
      showPolygonPreview(state.placingPoly, null, state.selectedSurface);
      showFeedback(`${state.placingPoly.length} vertices \u2014 double-click or Enter to close`, 0);
    }
  });

  state.renderer.domElement.addEventListener('dblclick', e => {
    if (state.currentMode !== '2d' || state.placementMode !== 'placing_polygon') return;
    if (state.placingPoly.length < 3) { showFeedback('Need at least 3 points to close a polygon'); return; }
    commitPolygonPlacement(state.selectedSurface, state.placingSpecies, [...state.placingPoly]);
    state.placingPoly    = [];
    state.placingSpecies = null;
    state.placementMode  = 'idle';
    clearPreview();
    state.renderer.domElement.style.cursor = '';
  });

  state.renderer.domElement.addEventListener('mousemove', e => {
    if (state.currentMode !== '2d' || !state.selectedSurface) return;
    const ndc = canvasNDC(e);
    const wPt = raycastSurface(ndc, state.selectedSurface);
    if (!wPt) return;
    const uv  = worldToSurfaceUV(wPt, state.selectedSurface);
    if (state.placementMode === 'placing_circle' && state.circlePhase === 'centre_set') {
      const limits = radiusLimits(state.placingSpecies, state.selectedSurface);
      const raw    = Math.hypot(uv.u - state.circleCentre.u, uv.v - state.circleCentre.v);
      const radius = Math.min(limits.max, Math.max(limits.min, raw || limits.def));
      showCirclePreview(state.circleCentre.u, state.circleCentre.v, radius, state.selectedSurface);
    }
    if (state.placementMode === 'placing_polygon' && state.placingPoly.length >= 1) {
      showPolygonPreview(state.placingPoly, uv, state.selectedSurface);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && state.placementMode === 'placing_polygon') {
      if (state.placingPoly.length >= 3) {
        commitPolygonPlacement(state.selectedSurface, state.placingSpecies, [...state.placingPoly]);
        state.placingPoly = []; state.placingSpecies = null; state.placementMode = 'idle'; clearPreview();
        state.renderer.domElement.style.cursor = '';
      } else { showFeedback('Need at least 3 points'); }
    }
    if (e.key === 'Escape' && state.placementMode !== 'idle') { cancelPlacement(); }
  });

  document.getElementById('clearPlantsBtn')?.addEventListener('click', () => {
    const total = state.surfaces.reduce((acc, s) => acc + (s.plants || []).length, 0);
    if (!total) { showFeedback('No plants assigned'); return; }
    state.surfaces.forEach(s => {
      (s.plants || []).forEach(inst => removeProxyForInstance(inst));
      s.plants = [];
      updateSurfaceListTag(s);
    });
    if (state.selectedSurface) renderSurfacePlantSchedule(state.selectedSurface);
    recalcGPR();
    showFeedback(`Cleared ${total} plant instance${total > 1 ? 's' : ''}`);
  });

  const _origClearSite = document.getElementById('clearSiteBtn');
  if (_origClearSite) {
    _origClearSite.addEventListener('click', () => { clearAllProxies(); cancelPlacement(); });
  }

  document.getElementById('plant-assign-btn')?.addEventListener('click', () => {
    if (!state.selectedSurface || !state.selectedPlant) return;
    const sp = state.selectedPlant;
    closePlantModal();
    startPlacement(sp);
  });
}
