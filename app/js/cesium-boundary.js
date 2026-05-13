import * as state from './cesium-state.js';

export function showLotBoundary(geojson) {
  if (!state._viewer) return;
  clearLotBoundary();
  const coords = geojson?.geometry?.coordinates?.[0] ?? geojson?.coordinates?.[0];
  if (!coords || coords.length < 3) return;
  const flat = coords.flatMap(([lng, lat]) => [lng, lat]);
  state._lotBoundaryEntity = state._viewer.entities.add({
    polyline: { positions: Cesium.Cartesian3.fromDegreesArray(flat), width: 3, material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#ff8c00')), clampToGround: true },
  });
}

export function clearLotBoundary() {
  if (state._viewer && state._lotBoundaryEntity) { state._viewer.entities.remove(state._lotBoundaryEntity); state._lotBoundaryEntity = null; }
}

export function startBoundaryPick(onPoint, onDone) {
  if (!state._viewer) return;
  cancelBoundaryPick();
  state._boundaryPickActive = true;
  state._onBoundaryPoint = onPoint;
  state._onBoundaryDone = onDone;
  state._boundaryPoints = [];
  state._viewer.container.style.cursor = 'crosshair';
  state._pickHandler = new Cesium.ScreenSpaceEventHandler(state._viewer.scene.canvas);
  state._pickHandler.setInputAction(e => {
    const pos = state._pickCartesian(e.position);
    if (!pos) return;
    const carto = Cesium.Cartographic.fromCartesian(pos);
    state._boundaryPoints.push(pos);
    if (state._onBoundaryPoint) state._onBoundaryPoint({ lat: Cesium.Math.toDegrees(carto.latitude), lng: Cesium.Math.toDegrees(carto.longitude) });
    _updateBoundaryPreview();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  state._pickHandler.setInputAction(() => {
    const pts = state._boundaryPoints.map(c => { const carto = Cesium.Cartographic.fromCartesian(c); return { lat: Cesium.Math.toDegrees(carto.latitude), lng: Cesium.Math.toDegrees(carto.longitude) }; });
    cancelBoundaryPick();
    if (state._onBoundaryDone) state._onBoundaryDone(pts);
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

export function cancelBoundaryPick() {
  state._boundaryPickActive = false;
  state._boundaryPoints = [];
  if (state._pickHandler) { state._pickHandler.destroy(); state._pickHandler = null; }
  if (state._viewer) state._viewer.container.style.cursor = '';
  if (state._boundaryPolyline) { state._viewer.entities.remove(state._boundaryPolyline); state._boundaryPolyline = null; }
}

function _updateBoundaryPreview() {
  if (!state._viewer || state._boundaryPoints.length < 2) return;
  if (state._boundaryPolyline) state._viewer.entities.remove(state._boundaryPolyline);
  state._boundaryPolyline = state._viewer.entities.add({
    polyline: { positions: [...state._boundaryPoints, state._boundaryPoints[0]], width: 2, material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#ff8c00').withAlpha(0.7)), clampToGround: true },
  });
}
