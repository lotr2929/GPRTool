export function initMenuHandlers(deps) {
  const {
    fitSiteBtn, toggleGridBtn, toggleAxes, toggleNorthPoint, toggleGizmo3D,
    resetNorthPos, startSetDesignGrid, startSetDesignNorth, showGridSpacingPopup,
    showProjectsModal, openGPRFile, newProject, saveCurrentProject, saveAsProject,
    showFeedback,
  } = deps;

  document.querySelectorAll('.dropdown-menu a').forEach(a =>
    a.addEventListener('click', e => {
      e.preventDefault();
      const action = a.dataset.action;
      if      (action === 'fit-site')        fitSiteBtn?.click();
      else if (action === 'toggle-grid')     toggleGridBtn?.click();
      else if (action === 'toggle-axes')     toggleAxes();
      else if (action === 'north-pointer')   { toggleNorthPoint(); toggleGizmo3D(); }
      else if (action === 'north-reset')     resetNorthPos();
      else if (action === 'set-design-grid') startSetDesignGrid();
      else if (action === 'set-design-north')startSetDesignNorth();
      else if (action === 'grid-spacing')    showGridSpacingPopup(window.innerWidth / 2, window.innerHeight / 2);
      else if (action === 'open-project')    showProjectsModal(async (file, meta) => {
        try { await openGPRFile(file, meta); } catch(e) { showFeedback('Failed to open: ' + e.message); }
      });
      else if (action === 'new-project')     newProject();
      else if (action === 'save')            saveCurrentProject();
      else if (action === 'save-as')         saveAsProject();
      else if (action === 'import-osm')      document.getElementById('importOSMBtn')?.click();
      else if (action === 'import-cesium')   document.getElementById('importCesiumBtn')?.click();
      else if (action === 'import-cadmapper')document.getElementById('importCADMapperBtn')?.click();
      else if (action === 'import-model')    document.getElementById('import3DModelBtn')?.click();
      else if (action === 'download-report') showFeedback('Download GPR Report \u2014 coming soon');
      else                                   showFeedback(`${action} \u2014 coming soon`);
    })
  );
}
