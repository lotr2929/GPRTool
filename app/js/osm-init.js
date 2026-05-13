import { setRealWorldAnchor, wgs84ToUTM } from './real-world.js';
import { state } from './state.js';
import { appendLayerToPanel } from './cadmapper-import.js';
import { startLocationPick, stopLocationPick, startIdentifyPick, stopIdentifyPick, getCesiumViewer } from './cesium-viewer.js';
import { addTerrainToGPR, getActiveGPRBlob } from './gpr-file.js';
import { writeBlobToHandle } from './local-folder.js';
import { setPipelineStatus } from './ui.js';
import { LAYER_CONFIG, ROAD_WIDTHS } from './osm-layer-config.js';
import { buildOverpassQuery, fetchOverpass, _bboxKey, _getCached, _setCached } from './osm-overpass.js';
import { buildLayerGroups, classifyWay, osmToGeoJSON, latLngToBbox } from './osm-build.js';
import { buildTerrainFromWorkerMsg } from './osm-terrain.js';
import { MODAL_HTML, closeModal } from './osm-modal.js';

let _callbacks = null;
let THREE = null;
let _openedFromStage2 = false;

export function initOSMImport(callbacks) {
  _callbacks = callbacks;
  THREE = callbacks.THREE;
  document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
  document.getElementById('importOSMBtn').addEventListener('click', openModal);
  document.getElementById('osm-close-a').addEventListener('click', closeModal);
  document.getElementById('osm-close-b').addEventListener('click', closeModal);
  document.getElementById('osm-back-btn').addEventListener('click', _backToPhaseA);
  document.getElementById('osm-import-btn').addEventListener('click', runImport);
  document.getElementById('osm-search-btn').addEventListener('click', searchAddress);
  document.getElementById('osm-identify-btn').addEventListener('click', _toggleIdentify);
  initPhaseA_LocationPick();
}

function openModal() {
  document.getElementById('osm-overlay').style.display = 'block';
  document.getElementById('osm-phase-a').style.display = 'block';
  document.getElementById('osm-phase-b').style.display = 'none';
  document.getElementById('osm-address').focus();
  setStatusA('');
  startLocationPick(_phaseAOnPick);
  _resetIdentify();
}

function initPhaseA_LocationPick() {
  startLocationPick(_phaseAOnPick);
}

let _phaseAOnPick = (pt) => {
  document.getElementById('osm-lat').value = pt.lat.toFixed(7);
  document.getElementById('osm-lng').value = pt.lng.toFixed(7);
  _promoteToPhaseB(pt.lat, pt.lng);
  const label = `Picked: ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`;
  state.siteCenter = { lat: pt.lat, lng: pt.lng, label };
  window.dispatchEvent(new CustomEvent('site:located', { detail: { lat: pt.lat, lng: pt.lng, label } }));
};

function _promoteToPhaseB(lat, lng) {
  document.getElementById('osm-phase-a').style.display = 'none';
  document.getElementById('osm-phase-b').style.display = 'block';
  document.getElementById('osm-coords-display').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  stopLocationPick();
}

function _backToPhaseA() {
  document.getElementById('osm-phase-b').style.display = 'none';
  document.getElementById('osm-phase-a').style.display = 'block';
  startLocationPick(_phaseAOnPick);
}

function setStatusA(msg, isError = false) {
  const el = document.getElementById('osm-status-a');
  if (el) { el.textContent = msg; el.style.color = isError ? '#e06060' : 'var(--accent-mid,#4a8a4a)'; }
}

function setStatusB(msg, isError = false) {
  const el = document.getElementById('osm-status-b');
  if (el) { el.textContent = msg; el.style.color = isError ? '#e06060' : 'var(--accent-mid,#4a8a4a)'; }
}

export function openImportModal() {
  if (!state.siteCenter) return;
  const { lat, lng, label } = state.siteCenter;
  document.getElementById('osm-lat').value = lat.toFixed(7);
  document.getElementById('osm-lng').value = lng.toFixed(7);
  _openedFromStage2 = true;
  document.getElementById('osm-overlay').style.display = 'block';
  _showPhaseB();
  startLocationPick(_phaseBRepositionCallback);
  const display = document.getElementById('osm-coords-display');
  if (display) display.textContent = label ? `${label}  \u2022  ${lat.toFixed(5)}, ${lng.toFixed(5)}` : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function _showPhaseB() {
  document.getElementById('osm-phase-a').style.display = 'none';
  document.getElementById('osm-phase-b').style.display = 'block';
  stopLocationPick();
}

let _phaseBRepositionCallback = (pt) => {
  document.getElementById('osm-lat').value = pt.lat.toFixed(7);
  document.getElementById('osm-lng').value = pt.lng.toFixed(7);
  const display = document.getElementById('osm-coords-display');
  if (display) display.textContent = `${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`;
};

async function searchAddress() {
  const q = document.getElementById('osm-address').value.trim();
  if (!q) return;
  setStatusA('Searching\u2026');
  try {
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok || !data.results?.length) { setStatusA('Address not found' + (data.status ? ` (${data.status})` : '') + '.'); return; }
    const { lat, lng, display_name, precise } = data.results[0];
    document.getElementById('osm-lat').value = lat.toFixed(7);
    document.getElementById('osm-lng').value = lng.toFixed(7);
    const { flyToSite } = await import('./cesium-viewer.js');
    await flyToSite(lat, lng, 350, true);
    const label = display_name.slice(0, 70);
    state.siteCenter = { lat, lng, label };
    window.dispatchEvent(new CustomEvent('site:located', { detail: { lat, lng, label } }));
    _promoteToPhaseB(lat, lng);
  } catch (err) { setStatusA('Search failed: ' + err.message, true); }
}

let _identifyActive = false;
function _toggleIdentify() {
  _identifyActive = !_identifyActive;
  const btn = document.getElementById('osm-identify-btn');
  if (btn) btn.style.borderColor = _identifyActive ? '#90c890' : 'rgba(255,255,255,0.3)';
  if (_identifyActive) {
    startIdentifyPick(async ({ lat, lng }) => {
      try {
        const res = await fetch(`/api/geocode?latlng=${lat},${lng}`);
        const data = await res.json();
        if (res.ok && data.results?.length) {
          const r = data.results[0];
          const label = r.display_name?.slice(0, 80) || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          document.getElementById('osm-address').value = r.display_name || '';
          document.getElementById('osm-lat').value = lat.toFixed(7);
          document.getElementById('osm-lng').value = lng.toFixed(7);
          state.siteCenter = { lat, lng, label };
          window.dispatchEvent(new CustomEvent('site:located', { detail: { lat, lng, label } }));
          _promoteToPhaseB(lat, lng);
          _toggleIdentify();
        }
      } catch (err) { console.warn('Identify failed:', err); }
    });
  } else stopIdentifyPick();
}
async _resetIdentify() { _identifyActive = false; const btn = document.getElementById('osm-identify-btn'); if (btn) btn.style.borderColor = 'rgba(255,255,255,0.3)'; stopIdentifyPick(); }

function _startHoverTooltip() {
  const hintB = document.getElementById('osm-pick-hint-b');
  if (hintB) hintB.textContent = 'Click to reposition, then Import';
}

async function runImport() {
  const lat = parseFloat(document.getElementById('osm-lat').value);
  const lng = parseFloat(document.getElementById('osm-lng').value);
  const radius = parseInt(document.getElementById('osm-radius').value, 10);
  if (isNaN(lat) || isNaN(lng)) { setStatusB('Please enter latitude and longitude.', true); return; }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { setStatusB('Invalid coordinates.', true); return; }
  const zone = Math.floor((lng + 180) / 6) + 1;
  const { easting, northing } = wgs84ToUTM(lat, lng, zone);
  setRealWorldAnchor(zone, easting, northing);
  const bbox = latLngToBbox(lat, lng, radius);
  const cacheKey = _bboxKey(bbox, radius);
  const addressVal = state.siteCenter?.label || document.getElementById('osm-address')?.value?.trim() || null;
  const safeName = (addressVal || 'site').replace(/[^\w\s\-]/g, '').replace(/\s+/g, '_').slice(0, 40);
  if (window.showSaveFilePicker) {
    try {
      const handle = await showSaveFilePicker({ suggestedName: safeName + '.gpr', types: [{ description: 'GPR Project File', accept: { 'application/octet-stream': ['.gpr'] } }], excludeAcceptAllOption: false });
      state.activeFileHandle = handle;
      const savedFilename = handle.name.replace(/\.gpr$/i, '').replace(/_/g, ' ').trim();
      if (savedFilename) state.siteCenter = { ...(state.siteCenter || {}), label: savedFilename };
    } catch {}
  }
  _runTerrainWorker(bbox, zone);
  const btn = document.getElementById('osm-import-btn');
  btn.disabled = true; btn.style.opacity = '0.5';
  try {
    let osmData = await _getCached(cacheKey);
    if (osmData) setStatusB('Loaded from cache \u2014 building geometry\u2026');
    else { setStatusB('Fetching OSM data\u2026'); osmData = await fetchOverpass(buildOverpassQuery(bbox)); await _setCached(cacheKey, osmData); }
    setStatusB('Building geometry\u2026');
    const layerGroups = buildLayerGroups(osmData, THREE);
    if (!Object.keys(layerGroups).length) throw new Error('No data returned \u2014 check coordinates or try a larger radius');
    closeModal();
    const finalLabel = state.siteCenter?.label || addressVal;
    const osmGeoJSON = osmToGeoJSON(osmData);
    state.osmGeoJSON = osmGeoJSON;
    _callbacks.onLayersLoaded(layerGroups, null, finalLabel, osmGeoJSON);
  } catch (err) { setStatusB('Import failed: ' + err.message, true); console.error('[OSM import]', err); }
  finally { btn.disabled = false; btn.style.opacity = '1'; }
}

function _runTerrainWorker(bbox, zone) {
  if (typeof Worker === 'undefined') { state.terrainStatus = 'unavailable'; window.dispatchEvent(new CustomEvent('terrain:status', { detail: { status: 'unavailable' } })); return; }
  const { getRealWorldAnchor } = _callbacks;
  const anchor = typeof getRealWorldAnchor === 'function' ? getRealWorldAnchor() : null;
  const anchorX = anchor?.easting ?? 0, anchorY = anchor?.northing ?? 0;
  state.terrainStatus = 'fetching';
  window.dispatchEvent(new CustomEvent('terrain:status', { detail: { status: 'fetching' } }));
  const worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
  const intervalM = 5;
  const startMs = Date.now();
  worker.postMessage({ bbox, zoom: 14, intervalM, zone, anchorX, anchorY });
  let timerInterval = setInterval(() => { if (state.terrainStatus === 'fetching') { const s = Math.round((Date.now() - startMs) / 1000); setPipelineStatus(`Terrain: downloading\u2026 ${s}s`, 'busy'); } }, 1000);
  worker.onmessage = async ({ data: msg }) => {
    if (msg.type === 'progress') {
      if (msg.stage && typeof msg.done === 'number' && typeof msg.total === 'number') {
        const pct = Math.round((msg.done / Math.max(1, msg.total)) * 100);
        const elapsed = Math.round((Date.now() - startMs) / 1000);
        setPipelineStatus(msg.stage === 'tiles' ? `Terrain: tiles ${msg.done}/${msg.total} (${pct}%) \u2014 ${elapsed}s` : `Terrain: contours ${pct}% \u2014 ${elapsed}s`, 'busy');
        window.dispatchEvent(new CustomEvent('terrain:progress', { detail: { stage: msg.stage, done: msg.done, total: msg.total, pct } }));
      }
    } else if (msg.type === 'done') {
      clearInterval(timerInterval);
      const totalSec = ((Date.now() - startMs) / 1000).toFixed(1);
      const payload = { source: 'aws-terrarium', zoom: 14, intervalM, anchorX, anchorY, points: msg.terrainPoints, contourSegments: Array.from(msg.contourSegments) };
      buildTerrainFromWorkerMsg(msg).then(async () => {
        state.terrainStatus = 'ready'; state.terrainPayload = payload;
        window.dispatchEvent(new CustomEvent('terrain:status', { detail: { status: 'ready' } }));
        worker.terminate();
        try {
          await addTerrainToGPR(payload);
          if (state.activeFileHandle) { try { const blob = await getActiveGPRBlob(); await writeBlobToHandle(state.activeFileHandle, blob); setPipelineStatus(`\u2713 Terrain attached \u2014 ${totalSec}s`, 'done'); } catch (e) { setPipelineStatus(`Terrain saved (cloud only) \u2014 ${totalSec}s`, 'done'); } }
          else setPipelineStatus(`\u2713 Terrain ready \u2014 ${totalSec}s`, 'done');
        } catch (e) { setPipelineStatus(`\u2713 Terrain ready \u2014 ${totalSec}s`, 'done'); }
        setTimeout(() => setPipelineStatus('Ready', 'idle'), 3000);
      });
    } else if (msg.type === 'error') {
      clearInterval(timerInterval);
      console.warn('[terrain worker]', msg.message);
      state.terrainStatus = 'error';
      window.dispatchEvent(new CustomEvent('terrain:status', { detail: { status: 'error', message: msg.message } }));
      setPipelineStatus('Terrain unavailable', 'error');
      setTimeout(() => setPipelineStatus('Ready', 'idle'), 3000);
      worker.terminate();
    }
  };
  worker.onerror = e => { clearInterval(timerInterval); console.warn('[terrain worker error]', e); state.terrainStatus = 'error'; window.dispatchEvent(new CustomEvent('terrain:status', { detail: { status: 'error', message: e.message } })); worker.terminate(); };
}
