import * as THREE from 'three';
import { state } from './state.js';

export function initSceneLoader(deps) {
  const {
    setSceneOffset, hasRealWorldAnchor, sceneToWGS84, getRealWorldAnchor,
    updateSceneHelpers, setStage, showFeedback,
    clearLotBoundary, clearSiteTerrain, cancelBoundaryDraw,
    buildLayerPanel, initTerrainBVH, projectGroupOntoTerrain,
    createInitialGPR, addBoundaryToGPR, buildBoundaryPanel, showSaveProjectDialog,
    showThreeJSView, switchMode, fit3DCamera, showLotBoundary, startBoundaryPick,
    designGridManager, _autosave,
  } = deps;

  async function _startCesiumBoundaryDraw() {
    showFeedback('Click the 3D scene to place boundary vertices \u2014 double-click to finish', 0);
    startBoundaryPick(
      pt => showFeedback(`Point placed (${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}) \u2014 continue or double-click to finish`, 0),
      async pts => {
        if (pts.length < 3) { showFeedback('Need at least 3 points'); return; }
        const coords = pts.map(p => [p.lng, p.lat]); coords.push(coords[0]);
        const geojson = { type: 'Feature', properties: { source: 'gprtool_cesium', drawn_at: new Date().toISOString() }, geometry: { type: 'Polygon', coordinates: [coords] } };
        showLotBoundary(geojson);
        showFeedback('Lot boundary drawn \u2014 saving\u2026', 0);
        try {
          await addBoundaryToGPR(geojson); state._isDirty = true; await _autosave();
          const btn = document.getElementById('draw-boundary-btn');
          if (btn) { btn.textContent = '\u2713 Lot Boundary \u2014 Re-draw\u2026'; btn.style.background = 'var(--accent-dark,#2d6b2d)'; }
          showFeedback('Lot boundary saved');
        } catch (err) { showFeedback('Boundary drawn but save failed: ' + err.message); }
      }
    );
  }

  const onLayersLoaded = async (layerGroups, dxfFile, osmAddress = null, osmGeoJSON = null) => {
    if (state.cadmapperGroup) { state.scene.remove(state.cadmapperGroup); state.cadmapperGroup.traverse(c => { c.geometry?.dispose(); c.material?.dispose(); }); state.cadmapperGroup = null; }
    clearLotBoundary(); clearSiteTerrain(); cancelBoundaryDraw();
    state.cadmapperGroup = new THREE.Group(); state.cadmapperGroup.name = 'cadmapper-context';
    Object.values(layerGroups).forEach(g => state.cadmapperGroup.add(g));
    const box = new THREE.Box3().setFromObject(state.cadmapperGroup);
    const centre = new THREE.Vector3(); box.getCenter(centre);
    if (dxfFile) {
      state.cadmapperGroup.children.forEach(child => { child.position.x -= centre.x; child.position.z -= centre.z; });
      const box2 = new THREE.Box3().setFromObject(state.cadmapperGroup);
      state.cadmapperGroup.children.forEach(child => { child.position.y -= box2.min.y; });
      setSceneOffset(centre.x, centre.z);
    } else { centre.set(0, 0, 0); setSceneOffset(0, 0); }
    state.scene.add(state.cadmapperGroup);
    const finalBox = new THREE.Box3().setFromObject(state.cadmapperGroup);
    const wgs84Bounds = hasRealWorldAnchor() ? { sw: sceneToWGS84(finalBox.min.x, finalBox.min.z), ne: sceneToWGS84(finalBox.max.x, finalBox.max.z) } : null;
    const size = new THREE.Vector3(); new THREE.Box3().setFromObject(state.cadmapperGroup).getSize(size);
    const siteSpan = Math.max(size.x, size.z); updateSceneHelpers(siteSpan);
    const modelCentre = new THREE.Vector3(); new THREE.Box3().setFromObject(state.cadmapperGroup).getCenter(modelCentre);
    if (state.axesHelper) state.axesHelper.position.set((state.designOrigin ?? modelCentre).x, 0.1, (state.designOrigin ?? modelCentre).z);
    const cellSize = state.manualGridSpacing ? state.manualGridSpacing : ((siteSpan / 10) < 50 ? 50 : (siteSpan / 10) < 100 ? 100 : (siteSpan / 10) < 250 ? 250 : 500);
    if (state.dgSpacing === null) state.dgSpacing = cellSize;
    if (state.dgMinorDivisions === null) state.dgMinorDivisions = 10;
    designGridManager.initHorizontal(state.dgSpacing, state.dgMinorDivisions, 5000, new THREE.Vector3(0, 0, 0));
    fit3DCamera(new THREE.Box3().setFromObject(state.cadmapperGroup));
    showThreeJSView(); switchMode('3d');
    document.getElementById('empty-props').style.display = 'none';
    document.getElementById('clearSiteBtn').style.display = 'block';
    document.getElementById('left-panel').classList.add('site-imported');
    buildLayerPanel(layerGroups);
    if (dxfFile) {
      setTimeout(() => {
        const topoGroup = state.cadmapperGroup?.children.find(c => c.name === 'topography');
        if (topoGroup) { let m = null; topoGroup.traverse(c => { if (c.isMesh && !m) m = c; }); if (m) { deps.initTerrainBVH(m); ['buildings','highways','major_roads','minor_roads','paths','railways','parks','water'].forEach(l => { const g = state.cadmapperGroup?.children.find(c => c.name === l); if (g) deps.projectGroupOntoTerrain(g); }); } }
      }, 500);
    }
    if (hasRealWorldAnchor()) {
      const anchor = getRealWorldAnchor();
      const siteName = dxfFile ? dxfFile.name.replace(/\.dxf$/i, '') : osmAddress ? `OSM \u2014 ${osmAddress}` : 'Untitled Site';
      await createInitialGPR({ siteName, reference: { utm_zone: anchor.zone, utm_easting: anchor.easting, utm_northing: anchor.northing, utm_hemisphere: anchor.hemisphere, wgs84_lat: anchor.lat, wgs84_lng: anchor.lng, scene_offset_x: centre.x, scene_offset_z: centre.z, site_span_m: siteSpan, site_area_m2: state.siteAreaM2 || siteSpan * siteSpan }, design: { design_north_angle: 0, grid_spacing_m: cellSize, minor_divisions: 10 }, dxfFile, osmGeoJSON: state.osmGeoJSON ?? osmGeoJSON });
      state._isDirty = true;
      const onTerrainReady = async (e) => { if (e.detail?.status !== 'ready') return; state._isDirty = true; await _autosave(); window.removeEventListener('terrain:status', onTerrainReady); };
      window.addEventListener('terrain:status', onTerrainReady);
      if (!state.activeFileHandle) showSaveProjectDialog({ defaultName: siteName });
      buildBoundaryPanel(wgs84Bounds, false, !dxfFile ? _startCesiumBoundaryDraw : null);
      setStage('locate', 'done', `\u2713 ${siteName}`); setStage('import', 'done', '\u2713 Imported');
      setStage('extract', 'pending', 'Draw rectangle to extract');
      showFeedback('Site loaded \u2014 Extract Segment when ready');
    } else showFeedback(`Context loaded \u2014 ${Object.keys(layerGroups ?? {}).length} layers`);
  };

  return onLayersLoaded;
}
