export let _viewer = null;
export let _tileset = null;
export let _ready = false;
export let _siteLocated = false;
export let _autoRotating = true;
export let _viewMode = '3d';
export let _lotBoundaryEntity = null;
export let _boundaryPoints = [];
export let _boundaryPolyline = null;
export let _boundaryPickActive = false;
export let _onBoundaryPoint = null;
export let _onBoundaryDone = null;
export let _pickHandler = null;

export function _pickCartesian(windowPos) {
  if (!_viewer) return null;
  const pickedPos = _viewer.scene.pickPosition(windowPos);
  if (pickedPos && Cesium.defined(pickedPos)) return pickedPos;
  const ray = _viewer.camera.getPickRay(windowPos);
  return _viewer.scene.globe.pick(ray, _viewer.scene) ?? null;
}

export function _cartoFromScreen(pos) {
  if (!_viewer) return null;
  const ray = _viewer.scene.camera.getPickRay(pos);
  const cartesian = _viewer.scene.globe.pick(ray, _viewer.scene);
  return cartesian ? Cesium.Cartographic.fromCartesian(cartesian) : null;
}

export function _bbox(a, b) {
  return { north: Cesium.Math.toDegrees(Math.max(a.latitude, b.latitude)), south: Cesium.Math.toDegrees(Math.min(a.latitude, b.latitude)), east: Cesium.Math.toDegrees(Math.max(a.longitude, b.longitude)), west: Cesium.Math.toDegrees(Math.min(a.longitude, b.longitude)) };
}

export function _syncViewToggleActive() {
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', (btn.dataset.mode || '').toLowerCase() === _viewMode));
  const sm = document.getElementById('status-mode');
  if (sm) sm.textContent = _viewMode.toUpperCase();
}

export function _showViewToggle() {
  const el = document.querySelector('.mode-toggle-container');
  if (el) el.style.display = 'flex';
  _syncViewToggleActive();
}

export function _hideViewToggle() {
  document.querySelector('.mode-toggle-container').style.display = 'none';
  _viewMode = '3d';
}
