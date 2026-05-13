import * as state from './cesium-state.js';

export function setCesium2D() {
  if (!state._viewer) return;
  const pos = state._viewer.camera.positionCartographic;
  state._viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, 800), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }, duration: 1.2 });
}

export function setCesium3D() {
  if (!state._viewer) return;
  const pos = state._viewer.camera.positionCartographic;
  state._viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, 800), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-35), roll: 0 }, duration: 1.2 });
}

export function setCesiumViewMode(mode) {
  if (!state._viewer) return;
  const m = (mode || '').toLowerCase();
  if (m !== '2d' && m !== '3d') return;
  if (m === '2d') setCesium2D(); else setCesium3D();
  state._viewMode = m;
  state._syncViewToggleActive();
}

export function isCesiumActive() {
  const el = document.getElementById('cesium-container');
  return !!el && getComputedStyle(el).display !== 'none';
}

export function setCesiumStreetLevel() {
  if (!state._viewer) return;
  const alt = document.getElementById('cesium-alt');
  if (alt) alt.textContent = 'Click to set street viewpoint\u2026';
  state._viewer.container.style.cursor = 'crosshair';
  const handler = new Cesium.ScreenSpaceEventHandler(state._viewer.scene.canvas);
  handler.setInputAction(e => {
    handler.destroy();
    state._viewer.container.style.cursor = '';
    const pos = state._pickCartesian(e.position);
    if (!pos) return;
    const carto = Cesium.Cartographic.fromCartesian(pos);
    state._viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height + 1.7), orientation: { heading: state._viewer.camera.heading, pitch: Cesium.Math.toRadians(-5), roll: 0 }, duration: 1.5 });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

export function getCameraPosition() {
  if (!state._viewer) return null;
  const pos = state._viewer.camera.positionCartographic;
  return { lat: Cesium.Math.toDegrees(pos.latitude), lng: Cesium.Math.toDegrees(pos.longitude), alt: pos.height };
}

export function getCameraHeading() {
  if (!state._viewer) return 0;
  return Cesium.Math.toDegrees(state._viewer.camera.heading);
}

export function onCameraChange(callback) {
  if (!state._viewer) return;
  state._viewer.scene.postRender.addEventListener(() => callback(getCameraHeading()));
}

export async function flyToSite(lat, lng, alt = 500, topDown = false) {
  if (!state._viewer) return;
  state._autoRotating = false;
  state._siteLocated = true;
  state._showViewToggle();
  const carto = Cesium.Cartographic.fromDegrees(lng, lat);
  let groundHeight = 0;
  try {
    const sampled = await state._viewer.scene.sampleHeightMostDetailed([carto]);
    if (sampled && sampled[0] && Number.isFinite(sampled[0].height)) groundHeight = sampled[0].height;
  } catch (err) { console.warn('[CesiumViewer] sampleHeightMostDetailed failed', err); }
  state._viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lng, lat, groundHeight + alt),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(topDown ? -75 : -50), roll: 0 },
    duration: 2.0,
  });
}
