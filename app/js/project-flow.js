import * as THREE from 'three';
import { state } from './state.js';

export function initProjectFlow(deps) {
  const {
    openGPR, getActiveGPRBlob, saveViewState, captureViewState,
    setRealWorldAnchor, setSceneOffset, hasRealWorldAnchor, sceneToWGS84,
    parseCadmapperDXF, buildLayerPanel, buildBoundaryPanel,
    updateSceneHelpers, renderLotBoundary, showSaveProjectDialog,
    showThreeJSView, switchMode, fit3DCamera, restoreViewState,
    writeBlobToHandle, writeProjectFile, deleteProjectFile, showFeedback, setStage,
  } = deps;

  async function openGPRFile(file, meta = {}) {
    document.getElementById('clearSiteBtn')?.click();
    state._activeFileName = meta.fileName ?? null; state.activeFileHandle = meta.handle ?? null; state._isDirty = false;
    const { manifest, reference, design, boundary, terrain, osmContext, view, hasDXF, zip } = await openGPR(file);
    setRealWorldAnchor(reference.utm_zone, reference.utm_easting, reference.utm_northing);
    setSceneOffset(reference.scene_offset_x ?? 0, reference.scene_offset_z ?? 0);
    state.siteAreaM2 = reference.site_area_m2 || (reference.site_span_m ? reference.site_span_m * reference.site_span_m : 0);
    if (hasDXF) {
      const dxfBytes = await zip.file('context/cadmapper.dxf').async('arraybuffer');
      const layerGroups = parseCadmapperDXF(await new File([dxfBytes], 'cadmapper.dxf').text(), new Set(['topography','buildings','highways','major_roads','minor_roads','paths','parks','water','railways','contours']), THREE);
      if (layerGroups) {
        state.cadmapperGroup = new THREE.Group(); state.cadmapperGroup.name = 'cadmapper-context';
        const vals = Object.values(layerGroups); if (vals.length) vals.forEach(g => state.cadmapperGroup.add(g));
        const offX = reference.scene_offset_x ?? 0, offZ = reference.scene_offset_z ?? 0;
        state.cadmapperGroup.children.forEach(child => { child.position.x -= offX; child.position.z -= offZ; });
        const floorBox = new THREE.Box3().setFromObject(state.cadmapperGroup);
        state.cadmapperGroup.children.forEach(child => { child.position.y -= floorBox.min.y; });
        state.scene.add(state.cadmapperGroup);
        const size = new THREE.Vector3(); new THREE.Box3().setFromObject(state.cadmapperGroup).getSize(size);
        updateSceneHelpers(Math.max(size.x, size.z));
        deps.designGridManager.initHorizontal(design?.grid_spacing_m ?? 100, design?.minor_divisions ?? 0, 5000, new THREE.Vector3(0, 0, 0));
        if (design?.surface_grids) deps.designGridManager.deserialise(design.surface_grids);
        if (design?.design_origin) {
          state.designOrigin = new THREE.Vector3(design.design_origin.x, 0, design.design_origin.z);
          if (state.axesHelper) state.axesHelper.position.set(design.design_origin.x, 0.1, design.design_origin.z);
          if (state.axesYLine) state.axesYLine.position.set(design.design_origin.x, 0.1, design.design_origin.z);
        }
        showThreeJSView();
        if (view) restoreViewState(view); else { fit3DCamera(new THREE.Box3().setFromObject(state.cadmapperGroup)); switchMode('3d'); }
        buildLayerPanel(layerGroups);
      }
    }
    if (!hasDXF && osmContext) {
      const { buildLayerGroupsFromGeoJSON } = await import('./osm-import.js');
      const layerGroups = buildLayerGroupsFromGeoJSON(osmContext, THREE);
      if (layerGroups) {
        state.cadmapperGroup = new THREE.Group(); state.cadmapperGroup.name = 'cadmapper-context';
        const vals = Object.values(layerGroups); if (vals.length) vals.forEach(g => state.cadmapperGroup.add(g));
        state.scene.add(state.cadmapperGroup);
        const size = new THREE.Vector3(); new THREE.Box3().setFromObject(state.cadmapperGroup).getSize(size);
        updateSceneHelpers(Math.max(size.x, size.z));
        deps.designGridManager.initHorizontal(design?.grid_spacing_m ?? 100, design?.minor_divisions ?? 0, 5000, new THREE.Vector3(0, 0, 0));
        showThreeJSView();
        if (view) restoreViewState(view); else { fit3DCamera(new THREE.Box3().setFromObject(state.cadmapperGroup)); switchMode('3d'); }
        buildLayerPanel(layerGroups);
      }
    }
    if (boundary) renderLotBoundary(boundary);
    if (terrain && state.cadmapperGroup) { const { rebuildTerrainFromPayload } = await import('./osm-import.js'); rebuildTerrainFromPayload(terrain); }
    document.getElementById('empty-props').style.display = 'none';
    document.getElementById('clearSiteBtn').style.display = 'block';
    document.getElementById('left-panel').classList.add('site-imported');
    setStage('locate', 'done', `\u2713 ${manifest.site_name ?? file.name}`);
    setStage('import', 'done', '\u2713 Opened'); setStage('extract', 'pending', 'Draw rectangle to extract');
    const span = reference.site_span_m;
    buildBoundaryPanel(hasRealWorldAnchor() && span ? { sw: sceneToWGS84(-span / 2, -span / 2), ne: sceneToWGS84(span / 2, span / 2) } : null, !!boundary);
    if (meta.fromAutosave && meta.fileName) await deleteProjectFile(meta.fileName, true).catch(() => {});
    showFeedback(`Opened: ${manifest.site_name ?? file.name}`);
    window.dispatchEvent(new CustomEvent('gprtool:folderSet'));
  }

  async function _newProject() {
    if (state._isDirty) { const answer = confirm('Save project before starting a new one?'); if (answer) { await _saveCurrentProject(); if (state._isDirty) return; } }
    document.getElementById('clearSiteBtn')?.click();
    state._activeFileName = null; state.activeFileHandle = null; state._isDirty = false;
  }

  async function _saveCurrentProject() {
    const blob = await getActiveGPRBlob().catch(() => null);
    if (!blob) { await _saveAsProject(); return; }
    if (!state.activeFileHandle) { await _saveAsProject(); return; }
    try {
      await saveViewState(captureViewState()).catch(() => {});
      await writeBlobToHandle(state.activeFileHandle, await getActiveGPRBlob());
      if (state._activeFileName) await deleteProjectFile(state._activeFileName, true).catch(() => {});
      state._isDirty = false; showFeedback('Saved.');
    } catch (e) { showFeedback('Save failed: ' + e.message); }
  }

  async function _saveAsProject() { await showSaveProjectDialog({ defaultName: state._activeFileName ?? 'Untitled Site' }); }

  async function _autosave() {
    if (!state._isDirty || !state._activeFileName) return;
    const blob = await getActiveGPRBlob().catch(() => null);
    if (!blob) return;
    try { await saveViewState(captureViewState()).catch(() => {}); await writeProjectFile(state._activeFileName, await getActiveGPRBlob(), true); } catch (e) { console.warn('[GPR] Autosave failed:', e.message); }
  }

  return { openGPRFile, _newProject, _saveCurrentProject, _saveAsProject, _autosave };
}
