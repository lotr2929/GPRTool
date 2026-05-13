import * as THREE from 'three';
import { state } from './state.js';

export function initPipeline(deps) {
  const {
    startConstructionLine, startRadialLines, startRectangle, startCircle, startLine,
    handleBuildingClick, handleBuildingMove, cancelBuildingDraw, isBuildingDrawActive,
    clearConstructionLines, startExtrude, startSubtract, handleBuild3DClick,
    handleBuild3DMove, isBuild3DActive, cancelBuild3D,
    showThreeJSView, switchMode, showFeedback, setStage, setPipelineStatus,
    startRect2D, cancelRect2D, extractSite, startSetDesignGrid, startSetDesignNorth,
    getCameraPosition, openImportModal, detectAndShowSiteBoundary,
    toggleAxes, cancelBoundaryDraw, confirmBoundaryDraw, deselectSurface,
    update2DCamera, isDesignToolActive, cancelDesignTool,
  } = deps;

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (isBuildingDrawActive()) cancelBuildingDraw();
    if (isBuild3DActive()) cancelBuild3D();
    const ACTIONS = {
      'construction-line': () => startConstructionLine(),
      'radial-lines': () => startRadialLines(),
      'rectangle': () => { showThreeJSView(); switchMode('2d'); startRectangle(); },
      'ellipse': () => { showThreeJSView(); switchMode('2d'); startCircle(); },
      'polygon': () => showFeedback('Polygon: use Line tool to draw vertices, close with first point'),
      'line': () => { showThreeJSView(); switchMode('2d'); startLine(); },
      'arc-3point': () => showFeedback('3-Point Arc \u2014 coming in next session'),
      'arc-tangent': () => showFeedback('Tangent Arc \u2014 coming in next session'),
      'offset': () => showFeedback('Offset \u2014 coming in next session'),
      'edit-points': () => showFeedback('Edit Points \u2014 coming in next session'),
      'dimension': () => showFeedback('Dimension \u2014 coming in next session'),
      'extrude': () => { showThreeJSView(); startExtrude(); },
      'subtract': () => { showThreeJSView(); startSubtract(); },
      'clear-guides': () => clearConstructionLines(),
      'construction-point': () => showFeedback('Construction Point \u2014 click anywhere to place'),
      'offset-guide': () => showFeedback('Offset Guide \u2014 coming in next session'),
      'set-design-grid': () => startSetDesignGrid(),
      'set-design-north': () => startSetDesignNorth(),
    };
    if (ACTIONS[action]) { e.preventDefault(); e.stopPropagation(); ACTIONS[action](); }
  });

  document.getElementById('advanced-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('advanced-body');
    const arrow = document.getElementById('advanced-arrow');
    const open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    arrow.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
  });

  document.getElementById('importCesiumBtn')?.addEventListener('click', async () => {
    const pos = getCameraPosition();
    if (!pos) { showFeedback('Cesium not ready yet', 2000); return; }
    const lat = pos.lat, lng = pos.lng;
    showFeedback('Using Cesium view as site \u2014 fetching OSM context\u2026', 0);
    document.getElementById('osm-overlay').style.display = 'block';
    document.getElementById('osm-lat').value = lat.toFixed(7);
    document.getElementById('osm-lng').value = lng.toFixed(7);
    document.getElementById('osm-address').value = `Cesium view (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    setTimeout(() => document.getElementById('osm-import-btn')?.click(), 600);
  });

  document.getElementById('extractSiteBtn')?.addEventListener('click', () => {
    showThreeJSView(); switchMode('2d');
    setStage('extract', 'active', 'Drag a rectangle on the map');
    setPipelineStatus('Draw site rectangle\u2026', 'busy');
    showFeedback('Drag to draw site rectangle on the 2D map \u2014 release to confirm. Esc = cancel', 0);
    const onEsc = (e) => { if (e.key !== 'Escape') return; cancelRect2D(); window.removeEventListener('keydown', onEsc); };
    window.addEventListener('keydown', onEsc);
    startRect2D(async ({ corners, bounds }) => {
      window.removeEventListener('keydown', onEsc);
      setStage('extract', 'active', 'Extracting\u2026');
      setPipelineStatus('Extracting site\u2026', 'busy');
      try {
        const rectPts = [...corners, corners[0]].map(c => new THREE.Vector3(c.x, 0.2, c.z));
        const rectLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(rectPts), new THREE.LineBasicMaterial({ color: 0xff2222, depthTest: false, transparent: true, opacity: 0.9 }));
        rectLine.name = 'extract-rect'; rectLine.renderOrder = 996;
        const prev = state.scene.getObjectByName('extract-rect');
        if (prev) state.scene.remove(prev);
        state.scene.add(rectLine);
        const { buildingCount, contourLevelCount, contourGroup, dxfContent } = await extractSite({ corners, bounds }, THREE);
        if (contourGroup && state.cadmapperGroup) state.cadmapperGroup.add(contourGroup);
        document.getElementById('section-site')?.classList.add('collapsed');
        document.getElementById('section-building')?.classList.remove('collapsed');
        const summary = `\u2713 ${buildingCount} bldg${buildingCount !== 1 ? 's' : ''}, ${contourLevelCount} contour levels`;
        setStage('extract', 'done', summary); setPipelineStatus('', 'idle');
        showFeedback(`Site extracted \u2014 ${summary.slice(2)}`, 3000);
        if (dxfContent) {
          const suggested = (state._activeFileName?.replace(/\.gpr$/i, '') || 'site') + '_site.dxf';
          try {
            const fh = await showSaveFilePicker({ suggestedName: suggested, types: [{ description: 'DXF file', accept: { 'application/dxf': ['.dxf'] } }] });
            const writable = await fh.createWritable(); await writable.write(dxfContent); await writable.close();
            showFeedback('DXF saved \u2713');
          } catch (e) { if (e.name !== 'AbortError') showFeedback('DXF save failed: ' + e.message, 4000); }
        }
      } catch (e) {
        console.error('[Extract Site]', e);
        setStage('extract', 'pending', 'Draw rectangle to extract');
        setPipelineStatus('', 'idle');
        showFeedback('Extract failed: ' + e.message, 4000);
      }
    }, () => {
      window.removeEventListener('keydown', onEsc);
      setStage('extract', 'pending', 'Draw rectangle to extract');
      setPipelineStatus('', 'idle');
      showFeedback('Extraction cancelled', 2000);
    });
  });

  document.getElementById('importSiteBtn')?.addEventListener('click', () => { if (state.siteCenter) openImportModal(); });
  document.getElementById('detectSiteBoundaryBtn')?.addEventListener('click', () => {
    showThreeJSView(); switchMode('2d');
    showFeedback(detectAndShowSiteBoundary() ? 'Site boundary detected from road edges \u2014 shown in green' : 'No road geometry found. Set Design Origin first (Design \u2192 Set Design Grid), then retry.');
  });
  window.addEventListener('site:located', ({ detail }) => {
    setStage('locate', 'done', detail.label ? `\u2713 ${detail.label.slice(0, 30)}` : '\u2713 Located');
    setStage('import', 'pending', 'Click to import OSM context');
  });

  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && !e.shiftKey && e.key === 'f') { e.preventDefault(); document.getElementById('fitSiteBtn')?.click(); }
    if (ctrl && !e.shiftKey && e.key === 'g') { e.preventDefault(); document.getElementById('toggleGridBtn')?.click(); }
    if (ctrl && !e.shiftKey && e.key === 't') { e.preventDefault(); toggleAxes(); }
    if (ctrl && !e.shiftKey && e.key === 'z') { e.preventDefault(); showFeedback('Undo \u2014 coming soon'); }
    if (ctrl && e.shiftKey && e.key === 'Z') { e.preventDefault(); showFeedback('Redo \u2014 coming soon'); }
    if (e.key === 'Escape') {
      if (isDesignToolActive()) { cancelDesignTool(); return; }
      if (isBuildingDrawActive()) { cancelBuildingDraw(); return; }
      if (isBuild3DActive()) { cancelBuild3D(); return; }
      if (state.boundaryDrawMode) { cancelBoundaryDraw(); showFeedback('Boundary draw cancelled'); return; }
      if (state.zoomRectMode) { state.zoomRectMode = false; state.canvas.style.cursor = ''; showFeedback('Ready'); return; }
      deselectSurface(); showFeedback('Ready');
    }
    if (e.key === 'Enter' && state.boundaryDrawMode) { e.preventDefault(); confirmBoundaryDraw(); }
    if ((e.key === 'n' || e.key === 'N') && !ctrl && state.currentMode === '2d') { state.rotate2D = 0; update2DCamera(); showFeedback('View oriented to North'); }
    if ((e.key === 'z' || e.key === 'Z') && !ctrl && state.currentMode === '2d') {
      state.zoomRectMode = !state.zoomRectMode;
      state.canvas.style.cursor = state.zoomRectMode ? 'crosshair' : '';
      showFeedback(state.zoomRectMode ? 'Zoom rect active \u2014 drag to zoom, Z or Escape to cancel' : 'Ready');
    }
  });
}
