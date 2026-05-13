import * as THREE from 'three';
import {
  setRealWorldAnchor, getRealWorldAnchor, hasRealWorldAnchor,
  setSceneOffset, sceneToWGS84,
} from './real-world.js';
import {
  createInitialGPR, addBoundaryToGPR, openGPR, getActiveGPRBlob, saveViewState,
} from './gpr-file.js';
import { initProjects, showProjectsModal, showSaveProjectDialog } from './projects.js';
import { writeProjectFile, deleteProjectFile, writeBlobToHandle } from './local-folder.js';
import { initSiteSelection } from './site-selection.js';
import { initCADMapperImport, buildLayerPanel, parseCadmapperDXF } from './cadmapper-import.js';
import { initOSMImport, openImportModal } from './osm-import.js';
import { clearSiteTerrain, projectGroupOntoTerrain, initTerrainBVH } from './terrain.js';
import { DesignGridManager } from './design-grid.js';
import {
  initNorthPoint2D, updateNorthRotation, toggleNorthPoint, resetNorthPos,
} from './north-point-2d.js';
import {
  initNorthPoint3D, renderCompassGizmo, toggleGizmo3D, isGizmo3DVisible,
} from './north-point-3d.js';
import {
  initDesignGridTool, startSetDesignGrid, startSetDesignNorth,
  isDesignToolActive, handleDesignToolDblClick, handleDesignToolClick,
  handleDesignToolMouseMove, cancelDesignTool,
} from './design-grid-tool.js';
import { state } from './state.js';
import {
  drawSiteBoundary, buildBoundaryPanel, clearLotBoundary, renderLotBoundary,
  showSitePin, updateSitePinDOM,
  handleBoundaryClick, handleBoundaryDblClick, confirmBoundaryDraw,
  cancelBoundaryDraw, handleBoundaryMouseMove,
} from './site.js';
import {
  update2DCamera, fit2DCamera, fit3DCamera,
  drawSurfaceCanvasOutline, clearSurfaceCanvasOutline, fitSurfaceCamera,
  switchMode, resizeToContainer, toggleAxes, updateGridVisibility,
  setGridVisible, captureViewState, restoreViewState,
} from './viewport.js';
import {
  recalcGPR, updateSurfaceListTag, renderSurfacePlantSchedule,
  renderPlantList, openPlantModal, closePlantModal,
  startPlacement, cancelPlacement, clearPreview,
  showCirclePreview, showPolygonPreview, commitCirclePlacement,
  commitPolygonPlacement, canvasNDC, raycastSurface, worldToSurfaceUV,
  radiusLimits, substrateCapLabel, removeProxyForInstance, clearAllProxies,
} from './plants.js';
import {
  selectSurface, deselectSurface, hoverSurface, unhoverSurface,
  allSurfaceMeshes, getPointerNDC, initSurfaces,
} from './surfaces.js';
import { updateSceneHelpers, showGridSpacingPopup } from './grid.js';
import { clearMapTiles } from './geo.js';
import { initUI, showFeedback, setPipelineStatus, setStage } from './ui.js';
import {
  initCesiumViewer, showLotBoundary, showCesiumView, showThreeJSView,
  startBoundaryPick, getCameraPosition,
} from './cesium-viewer.js';
import { extractSite, detectAndShowSiteBoundary } from './extract-site.js';
import { startRect2D, cancelRect2D } from './rect-pick-2d.js';
import {
  startConstructionLine, startRadialLines, startRectangle, startCircle, startLine,
  handleBuildingClick, handleBuildingMove, cancelBuildingDraw, isBuildingDrawActive,
  clearConstructionLines,
} from './build-draw.js';
import {
  startExtrude, startSubtract, handleBuild3DClick, handleBuild3DMove,
  isBuild3DActive, cancelBuild3D,
} from './build-3d.js';
import { initScene } from './scene-setup.js';
import { initViewportControls } from './viewport-controls.js';
import { initSurfacePicking } from './surface-picking.js';
import { initViewCommands } from './view-commands.js';
import { initMenuHandlers } from './ui-menu.js';
import { initPlantEngine } from './plant-engine.js';
import { initPipeline } from './pipeline-init.js';
import { initProjectFlow } from './project-flow.js';
import { initSceneLoader } from './scene-loader.js';

const header = await fetch('header.html').then(r => r.text());
document.getElementById('header-container').innerHTML = header;
const bodyHTML = await fetch('body.html').then(r => r.text());
document.getElementById('body-container').innerHTML = bodyHTML;
initUI();

initScene();
initViewportControls({ update2DCamera, handleBoundaryMouseMove, handleDesignToolDblClick, handleBoundaryDblClick, showGridSpacingPopup });
initSurfacePicking({ getPointerNDC, allSurfaceMeshes, hoverSurface, unhoverSurface, selectSurface, deselectSurface, isDesignToolActive, isBuildingDrawActive, isBuild3DActive, handleBuildingMove, handleBuild3DMove, handleDesignToolClick, handleDesignToolMouseMove, handleBoundaryClick, handleBuildingClick, handleBuild3DClick });
initCesiumViewer('cesium-container').then(showCesiumView).catch(err => console.warn('[Cesium init]', err));

initPipeline({
  startConstructionLine, startRadialLines, startRectangle, startCircle, startLine,
  handleBuildingClick, handleBuildingMove, cancelBuildingDraw, isBuildingDrawActive,
  clearConstructionLines, startExtrude, startSubtract, handleBuild3DClick,
  handleBuild3DMove, isBuild3DActive, cancelBuild3D,
  showThreeJSView, switchMode, showFeedback, setStage, setPipelineStatus,
  startRect2D, cancelRect2D, extractSite, startSetDesignGrid, startSetDesignNorth,
  getCameraPosition, openImportModal,
  detectAndShowSiteBoundary, toggleAxes, cancelBoundaryDraw,
  confirmBoundaryDraw, deselectSurface, update2DCamera,
  isDesignToolActive, cancelDesignTool,
});

initViewCommands({ update2DCamera, fit2DCamera, fit3DCamera, setGridVisible, showFeedback });

initPlantEngine({
  openPlantModal, closePlantModal, renderPlantList, startPlacement,
  cancelPlacement, clearPreview, showCirclePreview, showPolygonPreview,
  commitCirclePlacement, commitPolygonPlacement, canvasNDC,
  raycastSurface, worldToSurfaceUV, radiusLimits, substrateCapLabel,
  recalcGPR, updateSurfaceListTag, renderSurfacePlantSchedule,
  removeProxyForInstance, clearAllProxies, showFeedback,
});

const { openGPRFile, _newProject, _saveCurrentProject, _saveAsProject, _autosave } = initProjectFlow({
  openGPR, getActiveGPRBlob, saveViewState, captureViewState,
  setRealWorldAnchor, setSceneOffset, hasRealWorldAnchor, sceneToWGS84,
  parseCadmapperDXF, buildLayerPanel, buildBoundaryPanel,
  updateSceneHelpers, renderLotBoundary, showSaveProjectDialog,
  showThreeJSView, switchMode, fit3DCamera, restoreViewState,
  writeBlobToHandle, writeProjectFile, deleteProjectFile, showFeedback, setStage,
  designGridManager: null,
});

const designGridManager = new DesignGridManager(THREE, state.scene);
state.designGridManager = designGridManager;

const onLayersLoaded = initSceneLoader({
  setSceneOffset, hasRealWorldAnchor, sceneToWGS84, getRealWorldAnchor,
  updateSceneHelpers, setStage, showFeedback,
  clearLotBoundary, clearSiteTerrain, cancelBoundaryDraw,
  buildLayerPanel, initTerrainBVH, projectGroupOntoTerrain,
  createInitialGPR, addBoundaryToGPR, buildBoundaryPanel, showSaveProjectDialog,
  showThreeJSView, switchMode, fit3DCamera, showLotBoundary, startBoundaryPick,
  designGridManager, _autosave,
});

initMenuHandlers({
  fitSiteBtn: document.getElementById('fitSiteBtn'), toggleGridBtn: document.getElementById('toggleGridBtn'),
  toggleAxes, toggleNorthPoint, toggleGizmo3D, resetNorthPos,
  startSetDesignGrid, startSetDesignNorth, showGridSpacingPopup,
  showProjectsModal, openGPRFile,
  newProject: _newProject, saveCurrentProject: _saveCurrentProject, saveAsProject: _saveAsProject,
  showFeedback,
});

initNorthPoint2D(() => ({ currentMode: state.currentMode, camera2D: state.camera2D, camera3D: state.camera3D, controls3D: state.controls3D, pan2D: state.pan2D, rotate2D: state.rotate2D }));
initNorthPoint3D(() => ({ renderer: state.renderer, camera3D: state.camera3D, container: state.container, currentMode: state.currentMode, showFeedback }));
initSiteSelection({ drawSiteBoundary, onSiteSelected: (lat, lng) => showSitePin(lat, lng) });
initProjects();
initDesignGridTool();
initCADMapperImport({ THREE, onLayersLoaded });
initOSMImport({ THREE, onLayersLoaded, getRealWorldAnchor });
state._captureViewState = captureViewState;
setInterval(_autosave, 2 * 60 * 1000);

(function animate() {
  state.controls.update();
  updateNorthRotation();
  const g = (state.designGridAngle ?? 0) * Math.PI / 180;
  if (state.axesHelper) state.axesHelper.rotation.y = -g;
  if (state.designGridManager) state.designGridManager.setHorizontalRotation(-g);
  updateGridVisibility();
  state.renderer.render(state.scene, state.camera);
  updateSitePinDOM();
  if (state.currentMode === '3d' && isGizmo3DVisible()) { state.renderer._compassMainScene = state.scene; renderCompassGizmo(); }
  requestAnimationFrame(animate);
})();

initSurfaces({ fitSurfaceCamera, drawSurfaceCanvasOutline, clearSurfaceCanvasOutline });
switchMode('2d');
update2DCamera();
new ResizeObserver(resizeToContainer).observe(state.container);
requestAnimationFrame(() => requestAnimationFrame(resizeToContainer));
showFeedback('GPRTool ready', 2000);
