import * as state from './cesium-state.js';

export function pickSurface(windowPos) {
  if (!state._viewer) return null;
  const pos = state._pickCartesian(windowPos);
  if (!pos) return null;
  const carto = Cesium.Cartographic.fromCartesian(pos);
  return { lat: Cesium.Math.toDegrees(carto.latitude), lng: Cesium.Math.toDegrees(carto.longitude), alt: carto.height };
}

let _locationPickHandler = null;
let _locationMarker = null;

export function startLocationPick(callback) {
  if (!state._viewer) return;
  stopLocationPick();
  stopIdentifyPick();
  state._viewer.container.style.cursor = 'crosshair';
  _locationPickHandler = new Cesium.ScreenSpaceEventHandler(state._viewer.scene.canvas);
  _locationPickHandler.setInputAction(e => {
    const pos = state._pickCartesian(e.position);
    if (!pos) return;
    const carto = Cesium.Cartographic.fromCartesian(pos);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lng = Cesium.Math.toDegrees(carto.longitude);
    if (_locationMarker) state._viewer.entities.remove(_locationMarker);
    _locationMarker = state._viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat),
      point: { pixelSize: 12, color: Cesium.Color.fromCssColorString('#4a8a4a'), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND },
    });
    state._autoRotating = false;
    state._siteLocated = true;
    state._showViewToggle();
    callback({ lat, lng });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

export function stopLocationPick() {
  if (_locationPickHandler) { _locationPickHandler.destroy(); _locationPickHandler = null; }
  if (state._viewer) state._viewer.container.style.cursor = '';
  if (_locationMarker) { state._viewer.entities.remove(_locationMarker); _locationMarker = null; }
}

let _identifyPickHandler = null;

export function startIdentifyPick(callback) {
  if (!state._viewer) return;
  stopLocationPick();
  stopIdentifyPick();
  state._viewer.container.style.cursor = 'help';
  _identifyPickHandler = new Cesium.ScreenSpaceEventHandler(state._viewer.scene.canvas);
  _identifyPickHandler.setInputAction(e => {
    const pos = state._pickCartesian(e.position);
    if (!pos) return;
    const carto = Cesium.Cartographic.fromCartesian(pos);
    callback({ lat: Cesium.Math.toDegrees(carto.latitude), lng: Cesium.Math.toDegrees(carto.longitude) });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

export function stopIdentifyPick() {
  if (_identifyPickHandler) { _identifyPickHandler.destroy(); _identifyPickHandler = null; }
  if (state._viewer) state._viewer.container.style.cursor = '';
}

let _rectHandler = null;
let _rectEntity = null;
let _rectStart = null;

function _cleanupRect() {
  if (_rectHandler) { _rectHandler.destroy(); _rectHandler = null; }
  if (_rectEntity) { state._viewer.entities.remove(_rectEntity); _rectEntity = null; }
  _rectStart = null;
  if (state._viewer) state._viewer.container.style.cursor = '';
}

export function startRectPick(onComplete) {
  if (!state._viewer) return;
  cancelRectPick();
  state._viewer.container.style.cursor = 'crosshair';
  _rectHandler = new Cesium.ScreenSpaceEventHandler(state._viewer.scene.canvas);
  let _rectCurrent = null;
  _rectHandler.setInputAction(e => {
    const carto = state._cartoFromScreen(e.position);
    if (!carto) return;
    _rectStart = carto;
    _rectEntity = state._viewer.entities.add({
      rectangle: { coordinates: new Cesium.CallbackProperty(() => { if (!_rectStart || !_rectCurrent) return null; const b = state._bbox(_rectStart, _rectCurrent); return Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north); }, false), material: Cesium.Color.YELLOW.withAlpha(0.15), outline: true, outlineColor: Cesium.Color.YELLOW, outlineWidth: 2 },
    });
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
  _rectHandler.setInputAction(e => { if (_rectStart) _rectCurrent = state._cartoFromScreen(e.endPosition) || _rectCurrent; }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  _rectHandler.setInputAction(e => {
    if (!_rectStart) return;
    const end = state._cartoFromScreen(e.position);
    if (end) { const bbox = state._bbox(_rectStart, end); _cleanupRect(); onComplete(bbox); }
    else _cleanupRect();
  }, Cesium.ScreenSpaceEventType.LEFT_UP);
}

export function cancelRectPick() { _cleanupRect(); }
