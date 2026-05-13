import * as THREE from 'three';
import { state } from './state.js';

export function initSurfacePicking(deps) {
  const { getPointerNDC, allSurfaceMeshes, hoverSurface, unhoverSurface,
          selectSurface, deselectSurface, handleDesignToolClick, handleDesignToolMouseMove,
          handleBoundaryClick, handleBuildingClick, handleBuild3DClick,
          isDesignToolActive, isBuildingDrawActive, isBuild3DActive, handleBuildingMove, handleBuild3DMove } = deps;

  state.renderer.domElement.addEventListener('pointermove', e => {
    if (isDesignToolActive()) { handleDesignToolMouseMove(e); return; }
    if (isBuildingDrawActive()) { handleBuildingMove(e); return; }
    if (isBuild3DActive())      { handleBuild3DMove(e);  return; }
    if (state.currentMode !== '3d' || !state.importedModel || state.pan2DActive) return;
    getPointerNDC(e);
    state.raycaster.setFromCamera(state.pointerNDC, state.camera3D);
    const meshMap = allSurfaceMeshes();
    const hits    = state.raycaster.intersectObjects([...meshMap.keys()], false);
    if (hits.length) {
      const hit = meshMap.get(hits[0].object);
      if (hit && hit !== state.hoveredSurface && hit !== state.selectedSurface) hoverSurface(hit);
    } else {
      if (state.hoveredSurface && state.hoveredSurface !== state.selectedSurface) unhoverSurface(state.hoveredSurface);
    }
  });

  state.renderer.domElement.addEventListener('click', e => {
    if (state.boundaryDrawMode && state.currentMode === '2d') {
      const rect = state.canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
      const ndcY = ((e.clientY - rect.top)  / rect.height) * -2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), state.camera2D);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const worldPt = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, worldPt);
      handleBoundaryClick(worldPt.x, worldPt.z);
      return;
    }
    if (state.placementMode && state.placementMode !== 'idle') return;
    if (handleDesignToolClick(e)) return;
    if (isBuildingDrawActive() && handleBuildingClick(e)) return;
    if (isBuild3DActive()      && handleBuild3DClick(e))  return;
    if (state.currentMode !== '3d' || !state.importedModel) return;
    getPointerNDC(e);
    state.raycaster.setFromCamera(state.pointerNDC, state.camera3D);
    const meshMap = allSurfaceMeshes();
    const hits    = state.raycaster.intersectObjects([...meshMap.keys()], false);
    if (hits.length) {
      const hit = meshMap.get(hits[0].object);
      if (hit) selectSurface(hit);
    } else {
      deselectSurface();
    }
  });
}
