import * as state from './cesium-state.js';

const ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMDA1LTQyMjctODc4OS1lMTY4NWY4YWY3MDIiLCJpZCI6MjYxMzMsInNjb3BlcyI6WyJhc3IiXSwiaWF0IjoxNTg2NDI3NDQ0fQ.bFb2CiDXLMlxJFgRkjX8NOvXCHYLBi5oEdqSEH4gUTY';

export async function initCesiumViewer(containerId) {
  if (typeof Cesium === 'undefined') throw new Error('CesiumJS not loaded');
  Cesium.Ion.defaultAccessToken = ION_TOKEN;
  state._viewer = new Cesium.Viewer(containerId, {
    imageryProvider: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false, animation: false, timeline: false,
    fullscreenButton: false, vrButton: false, infoBox: false, selectionIndicator: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
  });
  state._viewer.scene.globe.show = false;
  state._viewer.scene.skyAtmosphere.show = false;
  state._viewer.scene.skyBox.show = false;
  state._viewer.scene.backgroundColor = new Cesium.Color(0.06, 0.06, 0.06, 1.0);
  try {
    const res = await fetch('/api/maps-key');
    if (!res.ok) throw new Error('maps-key ' + res.status);
    const { key } = await res.json();
    state._tileset = await Cesium.Cesium3DTileset.fromUrl(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${key}`, { maximumScreenSpaceError: 8 });
    state._viewer.scene.primitives.add(state._tileset);
    state._ready = true;
  } catch (err) { console.error('[CesiumViewer] Google 3D Tiles failed:', err); }
  window.addEventListener('resize', () => state._viewer?.resize());
  state._viewer.scene.postRender.addEventListener(_updateAltitude);
  _startAutoRotate();
  _injectHUD();
  state._viewer.scene.canvas.addEventListener('mousedown', () => { state._autoRotating = false; }, { once: false });
  state._viewer.scene.canvas.addEventListener('wheel', () => { state._autoRotating = false; }, { once: false });
  return state._viewer;
}

export function stopAutoRotate() { state._autoRotating = false; }

function _startAutoRotate() {
  if (!state._viewer) return;
  state._viewer.clock.shouldAnimate = true;
  state._viewer.scene.postRender.addEventListener(() => { if (state._autoRotating) state._viewer.camera.rotateRight(0.0008); });
}

function _updateAltitude() {
  const el = document.getElementById('cesium-alt');
  if (!el || !state._viewer) return;
  const pos = state._viewer.camera.positionCartographic;
  if (!pos) return;
  const alt = pos.height;
  el.textContent = alt < 1000 ? `Alt ${alt.toFixed(0)} m` : `Alt ${(alt / 1000).toFixed(2)} km`;
}

function _injectHUD() {
  if (document.getElementById('cesium-hud')) return;
  const hud = document.createElement('div');
  hud.id = 'cesium-hud';
  hud.style.cssText = 'position:absolute;bottom:12px;right:16px;z-index:10;display:flex;gap:6px;align-items:center;pointer-events:none;font:11px/1.4 "Segoe UI",sans-serif;color:rgba(255,255,255,0.6);';
  hud.innerHTML = '<span id="cesium-alt"></span>';
  document.getElementById('cesium-container')?.appendChild(hud);
}

export const getCesiumViewer = () => state._viewer;
export const isCesiumReady = () => state._ready;

export function showCesiumView() {
  const cesiumEl = document.getElementById('cesium-container');
  const canvas = document.getElementById('three-canvas');
  const np = document.getElementById('np-container');
  const gizmo = document.getElementById('gizmo3d-overlay');
  if (cesiumEl) cesiumEl.style.display = 'block';
  if (canvas) canvas.style.display = 'none';
  if (np) np.style.display = 'none';
  if (gizmo) gizmo.style.display = 'none';
  const toggle = document.querySelector('.mode-toggle-container');
  if (toggle) {
    if (state._siteLocated) { toggle.style.display = 'flex'; state._syncViewToggleActive(); }
    else toggle.style.display = 'none';
  }
}

export function showThreeJSView() {
  const cesiumEl = document.getElementById('cesium-container');
  const canvas = document.getElementById('three-canvas');
  const toggle = document.querySelector('.mode-toggle-container');
  if (cesiumEl) cesiumEl.style.display = 'none';
  if (canvas) { canvas.style.display = 'block'; window.dispatchEvent(new Event('resize')); }
  if (toggle) toggle.style.display = 'flex';
}

export function resetCesiumView() {
  if (state._locationPickHandler) { state._locationPickHandler.destroy(); state._locationPickHandler = null; }
  if (state._locationMarker) { state._viewer.entities.remove(state._locationMarker); state._locationMarker = null; }
  if (state._viewer) state._viewer.container.style.cursor = '';
  if (state._lotBoundaryEntity) { state._viewer.entities.remove(state._lotBoundaryEntity); state._lotBoundaryEntity = null; }
  state._autoRotating = true;
  state._siteLocated = false;
  state._hideViewToggle();
  if (state._viewer) state._viewer.camera.flyHome(1.5);
}
