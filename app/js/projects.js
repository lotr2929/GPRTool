/*
 * projects.js — GPRTool project file management (local folder)
 *
 * Provides:
 *   initProjects()               — create modal DOM (call once at app init)
 *   showProjectsModal(onOpen)    — show Open Project modal
 *   showSaveProjectDialog(opts)  — show Save As dialog
 *
 * All files read from / written to the local folder set via local-folder.js.
 * No Supabase. No IndexedDB project data.
 */

import { state } from './state.js';
import { getActiveGPRBlob, saveViewState } from './gpr-file.js';
import { setPipelineStatus, showFeedback }  from './ui.js';
import {
  isLocalFolderSupported,
  getProjectFolder,
  listGPRFiles,
  getAutosaveHandle,
  inspectGPRContents,
  formatGPRContents,
  writeProjectFile,
  deleteProjectFile,
  writeBlobToHandle,
} from './local-folder.js';

// ── Open Project Modal ────────────────────────────────────────────────────

const MODAL_ID = 'recent-projects-overlay';
let _onOpenCallback = null;

export function initProjects() {
  if (document.getElementById(MODAL_ID)) return; // already created

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.style.cssText = `
    display:none; position:fixed; inset:0; z-index:1300;
    background:rgba(0,0,0,0.4);
    align-items:center; justify-content:center;`;

  overlay.innerHTML = `
    <div style="
      background:var(--chrome-panel); border:1px solid var(--chrome-border);
      border-radius:6px; width:680px; max-width:95vw; max-height:82vh;
      box-shadow:0 8px 32px rgba(0,0,0,0.22); display:flex; flex-direction:column;
      font-family:var(--font,'Outfit',sans-serif); color:var(--text-primary); overflow:hidden;">

      <!-- Header -->
      <div style="padding:12px 16px; border-bottom:1px solid var(--chrome-border);
                  display:flex; align-items:center; gap:10px;
                  background:var(--chrome-dark,#1e3d1e); flex-shrink:0;">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
             stroke="#fff" stroke-width="1.4">
          <path d="M2 3.5h4l1.5 2H14V13H2V3.5z"/>
        </svg>
        <h3 style="margin:0;font-size:13px;font-weight:600;flex:1;color:#fff;">
          Open Project</h3>
        <button id="rp-close" style="background:none;border:none;color:rgba(255,255,255,0.6);
          cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;">&#x2715;</button>
      </div>

      <!-- Folder indicator -->
      <div id="rp-folder-bar" style="padding:6px 14px;font-size:11px;
        color:var(--text-secondary);border-bottom:1px solid var(--chrome-border);
        display:flex;align-items:center;gap:8px;flex-shrink:0;background:var(--chrome-panel-alt,#f5f5f0);">
        <span id="rp-folder-label">Loading folder…</span>
        <button id="rp-change-folder" style="background:none;border:1px solid var(--chrome-border);
          border-radius:3px;font-size:10px;padding:2px 6px;cursor:pointer;
          color:var(--text-secondary);">Change folder</button>
      </div>

      <!-- File list -->
      <div id="rp-list" style="flex:1;overflow-y:auto;padding:6px 0;min-height:120px;">
        <div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:12px;">
          Loading…</div>
      </div>

      <!-- Footer -->
      <div style="padding:8px 14px;border-top:1px solid var(--chrome-border);
                  display:flex;justify-content:space-between;align-items:center;
                  flex-shrink:0;font-size:11px;color:var(--text-secondary);">
        <span id="rp-count"></span>
        <button id="rp-refresh" style="background:none;border:1px solid var(--chrome-border);
          border-radius:4px;color:var(--text-secondary);font-size:11px;
          padding:4px 10px;cursor:pointer;">&#8635; Refresh</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) _hideModal(); });
  document.getElementById('rp-close').addEventListener('click', _hideModal);
  document.getElementById('rp-refresh').addEventListener('click', () => _loadFileList());
  document.getElementById('rp-change-folder').addEventListener('click', async () => {
    const { pickProjectFolder } = await import('./local-folder.js');
    const h = await pickProjectFolder();
    if (h) _loadFileList();
  });
}

function _hideModal() {
  const el = document.getElementById(MODAL_ID);
  if (el) el.style.display = 'none';
}

export function showProjectsModal(onOpen) {
  _onOpenCallback = onOpen;
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay) { initProjects(); }
  document.getElementById(MODAL_ID).style.display = 'flex';
  _loadFileList();
}

async function _loadFileList() {
  const listEl  = document.getElementById('rp-list');
  const countEl = document.getElementById('rp-count');
  const labelEl = document.getElementById('rp-folder-label');

  listEl.innerHTML = `<div style="padding:20px;text-align:center;
    color:var(--text-secondary);font-size:12px;">Loading…</div>`;

  // Check folder
  const { getProjectFolder } = await import('./local-folder.js');
  const folder = await getProjectFolder();
  if (!folder) {
    labelEl.textContent = 'No folder set';
    listEl.innerHTML = `<div style="padding:24px;text-align:center;font-size:12px;
      color:var(--text-secondary);">
      <div style="margin-bottom:10px;">No project folder selected.</div>
      <button id="rp-pick-folder" style="background:var(--accent-dark,#1e3d1e);
        color:var(--accent-light,#7fc47f);border:none;border-radius:4px;
        padding:7px 16px;cursor:pointer;font-size:12px;">Choose Project Folder…</button>
    </div>`;
    document.getElementById('rp-pick-folder')?.addEventListener('click', async () => {
      const { pickProjectFolder } = await import('./local-folder.js');
      const h = await pickProjectFolder();
      if (h) _loadFileList();
    });
    return;
  }

  // Show folder path (handle.name = folder name)
  labelEl.textContent = `📁 ${folder.name}`;

  try {
    const files = await listGPRFiles();
    countEl.textContent = `${files.length} project${files.length !== 1 ? 's' : ''}`;

    if (!files.length) {
      listEl.innerHTML = `<div style="padding:24px;text-align:center;font-size:12px;
        color:var(--text-secondary);">No .gpr projects found in this folder.</div>`;
      return;
    }

    listEl.innerHTML = '';
    for (const f of files) {
      _appendFileRow(listEl, f);
    }
  } catch (err) {
    listEl.innerHTML = `<div style="padding:20px;text-align:center;
      color:#e06060;font-size:12px;">Failed to read folder: ${err.message}</div>`;
  }
}

function _formatDate(ms) {
  return new Date(ms).toLocaleString('en-GB', {
    day:'numeric', month:'short', year:'2-digit',
    hour:'2-digit', minute:'2-digit',
  });
}

function _appendFileRow(listEl, f) {
  const row = document.createElement('div');
  row.style.cssText = `border-bottom:1px solid var(--chrome-border);`;

  // Main row
  const main = document.createElement('div');
  main.style.cssText = `display:flex;align-items:center;gap:10px;padding:9px 14px;
    cursor:pointer;`;
  main.addEventListener('mouseover', () => main.style.background = 'var(--chrome-hover,#e8e8e4)');
  main.addEventListener('mouseout',  () => main.style.background = '');

  const autosaveBadge = f.hasAutosave
    ? `<span style="font-size:9px;background:#c06020;color:#fff;border-radius:3px;
        padding:1px 4px;margin-left:5px;vertical-align:middle;">AUTOSAVE</span>`
    : '';

  main.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 28 28" fill="none"
      stroke="var(--accent-mid,#4a8a4a)" stroke-width="1.4" style="flex-shrink:0;opacity:0.7;">
      <path d="M4 6h8l3 4h9v14H4V6z"/>
    </svg>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;
        text-overflow:ellipsis;">${f.name}${autosaveBadge}</div>
      <div style="font-size:11px;color:var(--text-secondary);margin-top:1px;">
        ${_formatDate(f.modified)} &middot; ${f.sizeKB} KB</div>
    </div>
    <button class="rp-inspect-btn" title="Show contents" style="background:none;border:none;
      color:var(--text-secondary);cursor:pointer;font-size:12px;padding:4px 6px;
      flex-shrink:0;">&#9660;</button>`;

  // Contents panel
  const contentsPanel = document.createElement('div');
  contentsPanel.style.cssText = `display:none;padding:5px 14px 7px 46px;
    font-size:11px;color:var(--text-secondary);
    background:var(--chrome-panel-alt,#f5f5f0);`;

  // Open on click (excluding inspect button)
  main.addEventListener('click', async (e) => {
    if (e.target.closest('.rp-inspect-btn')) return;
    _hideModal();
    if (_onOpenCallback) {
      // Check for autosave
      if (f.hasAutosave) {
        const autosaveHandle = await getAutosaveHandle(f.name);
        if (autosaveHandle) {
          const autosaveFile = await autosaveHandle.getFile();
          if (autosaveFile.lastModified > f.modified) {
            const mins = Math.round((autosaveFile.lastModified - f.modified) / 60000);
            const restore = confirm(
              `Autosave found (${mins} minute${mins !== 1 ? 's' : ''} newer than last save).\n\nRestore autosave? Cancel = open last saved version.`
            );
            if (restore) {
              // Delete autosave after restoring so it doesn't prompt again
              _onOpenCallback(autosaveFile, { fileName: f.name, handle: f.handle, fromAutosave: true });
              return;
            }
          }
        }
      }
      const file = await f.handle.getFile();
      _onOpenCallback(file, { fileName: f.name, handle: f.handle });
    }
  });

  // Inspect button
  main.querySelector('.rp-inspect-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn    = e.currentTarget;
    const isOpen = contentsPanel.style.display !== 'none';
    contentsPanel.style.display = isOpen ? 'none' : 'block';
    btn.innerHTML = isOpen ? '&#9660;' : '&#9650;';
    if (!isOpen && !contentsPanel.dataset.loaded) {
      contentsPanel.textContent = 'Reading…';
      const entries = await inspectGPRContents(f.handle);
      contentsPanel.textContent = entries ? formatGPRContents(entries) : 'Could not read file';
      contentsPanel.dataset.loaded = '1';
    }
  });

  row.appendChild(main);
  row.appendChild(contentsPanel);
  listEl.appendChild(row);
}

// ── Save As Dialog ────────────────────────────────────────────────────────

/**
 * Show the Save As dialog.
 * @param {Object} opts
 * @param {string}   opts.defaultName   — pre-filled filename (no extension)
 * @param {Function} [opts.onSaved]     — called after successful save
 * @returns {Promise<{fileName, handle} | null>}
 */
export function showSaveProjectDialog({ defaultName = 'Untitled Site', onSaved } = {}) {
  return new Promise(async (resolve) => {

    // Try to get the folder — do NOT call pickProjectFolder() here (may not be in user gesture)
    const folder = await getProjectFolder().catch(() => null);
    if (!folder) {
      // Show a simple inline prompt instead of silently failing
      const msg = document.createElement('div');
      msg.style.cssText = `position:fixed;inset:0;z-index:1400;background:rgba(0,0,0,0.45);
        display:flex;align-items:center;justify-content:center;`;
      msg.innerHTML = `<div style="background:var(--chrome-panel);border:1px solid var(--chrome-border);
        border-radius:6px;padding:24px 28px;max-width:380px;text-align:center;
        font-family:var(--font,'Outfit',sans-serif);font-size:13px;color:var(--text-primary);
        box-shadow:0 8px 32px rgba(0,0,0,0.25);">
        <div style="font-size:15px;font-weight:600;margin-bottom:10px;">No Project Folder Set</div>
        <div style="color:var(--text-secondary);font-size:12px;margin-bottom:16px;">
          Choose a folder on your computer to store .gpr project files.</div>
        <button id="spd-pick" style="background:var(--accent-dark,#1e3d1e);color:var(--accent-light,#7fc47f);
          border:none;border-radius:4px;font-size:12px;font-weight:600;
          padding:8px 20px;cursor:pointer;margin-right:8px;">Choose Folder…</button>
        <button id="spd-skip2" style="background:var(--chrome-panel-alt,#e8e8e4);
          border:1px solid var(--chrome-border);border-radius:4px;font-size:12px;
          padding:8px 14px;cursor:pointer;color:var(--text-primary);">Cancel</button>
      </div>`;
      document.body.appendChild(msg);
      msg.querySelector('#spd-skip2').addEventListener('click', () => {
        document.body.removeChild(msg); resolve(null);
      });
      msg.querySelector('#spd-pick').addEventListener('click', async () => {
        const { pickProjectFolder } = await import('./local-folder.js');
        const h = await pickProjectFolder().catch(() => null);
        document.body.removeChild(msg);
        if (!h) { resolve(null); return; }
        // Folder now set — re-open Save As
        resolve(await showSaveProjectDialog({ defaultName, onSaved }));
      });
      return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:1400;
      background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;`;

    let existing = [];
    let selectedName = null;

    overlay.innerHTML = `
      <div style="background:var(--chrome-panel);border:1px solid var(--chrome-border);
        border-radius:6px;width:460px;max-width:95vw;max-height:82vh;
        display:flex;flex-direction:column;
        box-shadow:0 8px 32px rgba(0,0,0,0.25);
        font-family:var(--font,'Outfit',sans-serif);color:var(--text-primary);overflow:hidden;">

        <div style="padding:11px 16px;background:var(--chrome-dark,#1e3d1e);
          display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.4">
            <path d="M2 3.5h4l1.5 2H14V13H2V3.5z"/>
          </svg>
          <span style="font-size:13px;font-weight:600;color:#fff;flex:1;">Save Project</span>
          <button id="spd-close" style="background:none;border:none;color:rgba(255,255,255,0.5);
            cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;">&#x2715;</button>
        </div>

        <!-- Existing file list -->
        <div id="spd-list" style="flex:1;overflow-y:auto;min-height:100px;max-height:240px;
          border-bottom:1px solid var(--chrome-border);">
          <div id="spd-loading" style="padding:14px;text-align:center;font-size:12px;
            color:var(--text-secondary);">Loading…</div>
        </div>

        <!-- Name field + buttons -->
        <div style="padding:12px 14px;display:flex;flex-direction:column;gap:10px;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:11px;color:var(--text-secondary);white-space:nowrap;">
              File name:</label>
            <input id="spd-name" type="text" value="${defaultName.replace(/"/g, '&quot;')}"
              style="flex:1;background:var(--chrome-input);border:1px solid var(--chrome-border);
              border-radius:4px;color:var(--text-primary);font-size:12px;
              padding:5px 8px;outline:none;"/>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button id="spd-cancel" style="background:var(--chrome-panel-alt,#e8e8e4);
              border:1px solid var(--chrome-border);border-radius:4px;
              font-size:12px;padding:5px 14px;cursor:pointer;
              color:var(--text-primary);">Cancel</button>
            <button id="spd-save" style="background:var(--accent-dark,#1e3d1e);
              color:var(--accent-light,#7fc47f);border:none;border-radius:4px;
              font-size:12px;padding:5px 14px;cursor:pointer;font-weight:600;">Save</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector('#spd-name');
    const listEl    = overlay.querySelector('#spd-list');

    // Load existing files async
    listGPRFiles().then(files => {
      existing = files;
      if (!files.length) {
        listEl.innerHTML = `<div style="padding:14px;text-align:center;font-size:11px;
          color:var(--text-secondary);">No existing projects</div>`;
        return;
      }
      listEl.innerHTML = '';
      for (const f of files) {
        const row = document.createElement('div');
        row.style.cssText = `padding:7px 14px;cursor:pointer;font-size:12px;
          border-bottom:1px solid var(--chrome-border);
          display:flex;align-items:center;justify-content:space-between;`;
        row.addEventListener('mouseover', () => row.style.background = 'var(--chrome-hover,#e8e8e4)');
        row.addEventListener('mouseout',  () => {
          row.style.background = selectedName === f.name ? 'var(--accent-dark,#1e3d1e)' : '';
          row.style.color      = selectedName === f.name ? 'var(--accent-light,#7fc47f)' : '';
        });
        row.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>
          <span style="font-size:10px;opacity:0.6;flex-shrink:0;margin-left:8px;">${f.sizeKB} KB</span>`;
        row.addEventListener('click', () => {
          selectedName = f.name;
          nameInput.value = f.name;
          // Highlight selected
          listEl.querySelectorAll('div').forEach(r => {
            r.style.background = '';
            r.style.color = '';
          });
          row.style.background = 'var(--accent-dark,#1e3d1e)';
          row.style.color      = 'var(--accent-light,#7fc47f)';
        });
        listEl.appendChild(row);
      }
    }).catch(() => {
      listEl.innerHTML = `<div style="padding:14px;text-align:center;font-size:11px;
        color:var(--text-secondary);">Could not read folder</div>`;
    });

    const close = (result) => {
      document.body.removeChild(overlay);
      resolve(result);
    };

    overlay.querySelector('#spd-close').addEventListener('click',  () => close(null));
    overlay.querySelector('#spd-cancel').addEventListener('click', () => close(null));

    overlay.querySelector('#spd-save').addEventListener('click', async () => {
      const name = nameInput.value.trim() || defaultName;
      if (!name) { nameInput.focus(); return; }

      // Check if overwriting an existing file
      const isOverwrite = existing.some(
        f => f.name.toLowerCase() === name.toLowerCase()
      );
      if (isOverwrite) {
        if (!confirm(`Overwrite "${name}"?`)) return;
      }

      close(null); // close dialog before async work
      setPipelineStatus('Saving…', 'busy');
      try {
        const blob = await getActiveGPRBlob();
        if (!blob) throw new Error('Nothing to save — import a site first');

        const handle = await writeProjectFile(name, blob);
        state.activeFileHandle = handle;
        state._activeFileName  = name;
        state._isDirty         = false;

        // Delete autosave if one exists
        await deleteProjectFile(name, true).catch(() => {});

        await saveViewState(_captureViewState()).catch(() => {});

        setPipelineStatus('✓ Saved', 'done');
        showFeedback(`Saved: ${name}.gpr`);
        onSaved?.();
        resolve({ fileName: name, handle });
      } catch (e) {
        setPipelineStatus('✗ Save failed', 'error');
        showFeedback('Save failed: ' + e.message, 6000);
        resolve(null);
      }
    });

    // Enter key saves
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') overlay.querySelector('#spd-save').click();
      if (e.key === 'Escape') close(null);
    });

    nameInput.focus();
    nameInput.select();
  });
}

// ── Capture view state (called here to avoid circular import) ─────────────
// Thin wrapper — app.js passes captureViewState into state or we call it here.

function _captureViewState() {
  // Delegate to viewport.js via state if available
  if (typeof state._captureViewState === 'function') return state._captureViewState();
  return null;
}
