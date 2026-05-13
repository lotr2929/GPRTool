import * as THREE from 'three';
import { state } from './state.js';
import { showFeedback } from './ui.js';
import {
  placementTypeForCategory, radiusLimits, surfaceUVToWorld, getSurfaceCentre,
  canvasNDC, raycastSurface, worldToSurfaceUV, polygonArea,
} from './plants-utils.js';
import { clearPreview, showCirclePreview, showPolygonPreview } from './plants-preview.js';
import { buildCircleProxy, buildPolygonProxy } from './plants-proxy.js';
import { recalcGPR, updateClearBtn } from './plants-gpr.js';

export function addPlantInstance(surface, species, canopyArea) {
  if (!surface.plants) surface.plants = [];
  const inst = { instanceId: ++state._instanceCounter, speciesId: species.id, canopyArea };
  surface.plants.push(inst);
  updateSurfaceListTag(surface);
  renderSurfacePlantSchedule(surface);
  recalcGPR();
  showFeedback(`Added ${species.common} \u2014 ${canopyArea} m\u00b2, LAI ${species.lai}`);
}

export function removePlantInstance(surface, instanceId) {
  if (!surface.plants) return;
  surface.plants = surface.plants.filter(i => i.instanceId !== instanceId);
  updateSurfaceListTag(surface);
  renderSurfacePlantSchedule(surface);
  recalcGPR();
}

export function updateInstanceCanopyArea(surface, instanceId, newArea) {
  const inst = (surface.plants || []).find(i => i.instanceId === instanceId);
  if (inst) { inst.canopyArea = newArea; recalcGPR(); }
}

export function updateSurfaceListTag(surface) {
  const item = document.querySelector(`.surface-item[data-surface-id="${surface.id}"]`);
  if (!item) return;
  item.querySelector('.surface-plant-tag')?.remove();
  const count = (surface.plants || []).length;
  if (count > 0) {
    const tag = document.createElement('span');
    tag.className = 'surface-plant-tag';
    tag.textContent = count + (count === 1 ? ' plant' : ' plants');
    item.appendChild(tag);
  }
}

export function renderSurfacePlantSchedule(surface) {
  const schedSection = document.getElementById('plant-schedule-section');
  const listEl = document.getElementById('surf-plant-list');
  const countEl = document.getElementById('surf-plant-count');
  if (!schedSection || !listEl) return;
  if (!surface) { schedSection.style.display = 'none'; return; }
  schedSection.style.display = 'block';
  const plants = surface.plants || [];
  if (countEl) countEl.textContent = plants.length ? `(${plants.length})` : '';
  listEl.innerHTML = '';
  if (!plants.length) {
    listEl.innerHTML = '<p style="font-size:11px;color:var(--text-secondary,#888);padding:4px 0">No plants on this surface. Click \u201cAdd Plant\u2026\u201d below.</p>';
    return;
  }
  plants.forEach(inst => {
    const sp = state.plantDb.find(p => p.id === inst.speciesId);
    if (!sp) return;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--chrome-border,#3a3a3a)';
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'flex:1;min-width:0;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    nameSpan.title = sp.scientific;
    nameSpan.textContent = sp.common;
    const laiSpan = document.createElement('span');
    laiSpan.style.cssText = 'font-size:10px;color:var(--accent-light,#7fc47f);flex-shrink:0';
    laiSpan.textContent = `LAI ${sp.lai}`;
    const areaInput = document.createElement('input');
    areaInput.type = 'number'; areaInput.value = inst.canopyArea; areaInput.min = '0'; areaInput.step = '0.1';
    areaInput.title = 'Canopy area (m\u00b2)';
    areaInput.style.cssText = 'width:52px;font-size:11px;background:var(--chrome-input,#1a1a1a);border:1px solid var(--chrome-border,#444);border-radius:3px;color:var(--text-primary,#e8e8e8);padding:2px 4px;text-align:right';
    areaInput.addEventListener('change', () => {
      const v = parseFloat(areaInput.value);
      if (!isNaN(v) && v >= 0) updateInstanceCanopyArea(surface, inst.instanceId, v);
    });
    const m2Label = document.createElement('span');
    m2Label.style.cssText = 'font-size:10px;color:var(--text-secondary,#888);flex-shrink:0';
    m2Label.textContent = 'm\u00b2';
    const removeBtn = document.createElement('button');
    removeBtn.title = 'Remove';
    removeBtn.style.cssText = 'background:none;border:none;color:var(--text-secondary,#888);cursor:pointer;font-size:14px;line-height:1;padding:0 2px;flex-shrink:0';
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', () => removePlantInstance(surface, inst.instanceId));
    removeBtn.addEventListener('mouseenter', () => removeBtn.style.color = '#cc4444');
    removeBtn.addEventListener('mouseleave', () => removeBtn.style.color = '');
    row.append(nameSpan, laiSpan, areaInput, m2Label, removeBtn);
    listEl.appendChild(row);
  });
}

export function renderPlantList() {
  const listEl = document.getElementById('plant-list');
  const query = (document.getElementById('plant-search')?.value || '').toLowerCase();
  const filter = document.getElementById('plant-filter')?.value || 'all';
  const surfType = state.selectedSurface?.type || null;
  const matches = state.plantDb.filter(p => {
    const typeOk = filter === 'all' ? true : filter === 'bamboo' ? p.category === 'Bamboo' : p.surface_types.includes(filter);
    return typeOk && (!query || p.common.toLowerCase().includes(query) || p.scientific.toLowerCase().includes(query) || p.category.toLowerCase().includes(query));
  });
  if (surfType) matches.sort((a, b) => { const aOk = a.surface_types.includes(surfType) ? 0 : 1; const bOk = b.surface_types.includes(surfType) ? 0 : 1; return aOk !== bOk ? aOk - bOk : b.lai - a.lai; });
  else matches.sort((a, b) => b.lai - a.lai);
  listEl.innerHTML = '';
  if (!matches.length) {
    listEl.innerHTML = '<p style="text-align:center;color:var(--text-secondary,#888);padding:20px;font-size:12px">No species found</p>';
    refreshModalStatus();
    return;
  }
  matches.forEach(p => {
    const compatible = surfType ? p.surface_types.includes(surfType) : true;
    const srcClass = p.source.includes('Singapore') ? 'field' : p.source.includes('ORNL') ? 'ornl' : 'lit';
    const srcLabel = p.source.includes('Singapore') ? 'Field' : p.source.includes('ORNL') ? 'ORNL' : 'Lit';
    const isSelected = state.selectedPlant && state.selectedPlant.id === p.id;
    const div = document.createElement('div');
    div.className = 'plant-item' + (isSelected ? ' selected-plant' : '');
    div.style.opacity = (!surfType || compatible) ? '1' : '0.4';
    div.innerHTML = `<span class="plant-lai-badge">${p.lai.toFixed(1)}</span><span class="plant-names"><div class="plant-common">${p.common}</div><div class="plant-sci">${p.scientific}</div><div class="plant-cat">${p.category}</div></span><span class="plant-src-badge ${srcClass}">${srcLabel}</span>`;
    div.addEventListener('click', () => {
      state.selectedPlant = p;
      document.querySelectorAll('.plant-item').forEach(el => el.classList.remove('selected-plant'));
      div.classList.add('selected-plant');
      refreshModalStatus();
    });
    listEl.appendChild(div);
  });
  refreshModalStatus();
}

export function refreshModalStatus() {
  const statusEl = document.getElementById('plant-modal-status');
  const assignBtn = document.getElementById('plant-assign-btn');
  if (!statusEl) return;
  if (!state.selectedSurface) {
    statusEl.textContent = 'Select a surface first.';
    if (assignBtn) assignBtn.disabled = true;
    return;
  }
  const surfType = state.selectedSurface.type;
  const compatible = state.selectedPlant ? state.selectedPlant.surface_types.includes(surfType) : false;
  if (state.selectedPlant) {
    const subMm = state.selectedSurface.substrate_mm;
    const minSub = state.selectedPlant.size?.min_substrate_mm;
    const subWarn = subMm && minSub && subMm < minSub ? ` \u26a0 Needs \u2265${minSub}mm substrate (surface has ${subMm}mm)` : '';
    const limits = radiusLimits(state.selectedPlant, state.selectedSurface);
    const capWarn = limits.capLabel && !subWarn ? ` \u2014 capped at ${limits.max}m radius` : '';
    statusEl.textContent = compatible ? `Add ${state.selectedPlant.common} (LAI ${state.selectedPlant.lai}) to ${surfType}${subWarn || capWarn}` : `${state.selectedPlant.common} is not rated for ${surfType} surfaces`;
    statusEl.style.color = subWarn ? '#e8a040' : '';
    if (assignBtn) assignBtn.disabled = !compatible;
  } else {
    statusEl.textContent = `${surfType} surface \u2014 select a species above`;
    statusEl.style.color = '';
    if (assignBtn) assignBtn.disabled = true;
  }
}

export function openPlantModal() {
  if (!state.plantDb.length) { showFeedback('Plant library not loaded \u2014 check browser console'); return; }
  if (!state.selectedSurface) { showFeedback('Select a surface first, then click Add Plant'); return; }
  state.plantModalOpen = true;
  state.selectedPlant = null;
  document.getElementById('plant-modal-overlay').classList.add('open');
  document.getElementById('plant-search').value = '';
  const filterEl = document.getElementById('plant-filter');
  if (filterEl) filterEl.value = state.selectedSurface.type;
  renderPlantList();
  document.getElementById('plant-search').focus();
  showFeedback('Plant Library \u2014 select a species to add', 0);
}

export function closePlantModal() {
  state.plantModalOpen = false;
  state.selectedPlant = null;
  document.getElementById('plant-modal-overlay').classList.remove('open');
}

export function startPlacement(species) {
  state.placingSpecies = species;
  const pType = placementTypeForCategory(species.category);
  state.placementMode = pType === 'circle' ? 'placing_circle' : 'placing_polygon';
  state.placingCircle = null;
  state.placingPoly = [];
  clearPreview();
  const hint = pType === 'circle' ? 'Click to set centre, drag or click again to set radius' : 'Click to add vertices, double-click or Enter to close polygon';
  showFeedback(`Placing ${species.common} \u2014 ${hint}`, 0);
  state.renderer.domElement.style.cursor = 'crosshair';
}

export function cancelPlacement() {
  state.placementMode = 'idle';
  state.placingSpecies = null;
  state.placingCircle = null;
  state.placingPoly = [];
  state.editingInstance = null;
  clearPreview();
  state.renderer.domElement.style.cursor = '';
  showFeedback('Ready');
}

export function commitCirclePlacement(surface, species, centre, radius, area) {
  if (!surface.plants) surface.plants = [];
  const inst = { instanceId: ++state._instanceCounter, speciesId: species.id, canopyArea: area, placement: { type: 'circle', cx: centre.u, cz: centre.v, radius, mesh: null } };
  surface.plants.push(inst);
  inst.placement.mesh = buildCircleProxy(inst, surface, species);
  updateSurfaceListTag(surface);
  renderSurfacePlantSchedule(surface);
  recalcGPR();
  return inst;
}

export function commitPolygonPlacement(surface, species, polyPts) {
  const area = polygonArea(polyPts);
  if (!surface.plants) surface.plants = [];
  const inst = { instanceId: ++state._instanceCounter, speciesId: species.id, canopyArea: Math.round(area * 10) / 10, placement: { type: 'polygon', points: polyPts, mesh: null } };
  surface.plants.push(inst);
  inst.placement.mesh = buildPolygonProxy(inst, surface, species);
  updateSurfaceListTag(surface);
  renderSurfacePlantSchedule(surface);
  recalcGPR();
  showFeedback(`Placed ${species.common} \u2014 canopy ${inst.canopyArea} m\u00b2`);
  return inst;
}
