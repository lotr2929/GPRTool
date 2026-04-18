/*
 * projects.js — GPRTool project repository client
 *
 * Manages saving and loading .gpr projects from the server-side Supabase store.
 * The user never handles .gpr files directly — GPRTool keeps all projects server-side.
 * Downloading a .gpr is subscription-gated (future).
 *
 * API:
 *   saveProject(gprBlob, meta)  → saves to server, returns project record
 *   listProjects()              → returns array of project summaries
 *   loadProject(id)             → returns { manifest, reference, design, boundary, hasDXF, zip }
 *   deleteProject(id)           → deletes from server
 *   showProjectsModal()         → opens Recent Projects UI
 */

const API = '/api/projects';

// ── Blob ↔ base64 helpers ─────────────────────────────────────────────────

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type = 'application/octet-stream') {
  const bytes = atob(b64);
  const arr   = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type });
}

// ── Save ──────────────────────────────────────────────────────────────────

/**
 * Save the active .gpr project to the server.
 * Called automatically after CADMapper import and after boundary is drawn.
 *
 * @param {Blob}   gprBlob  - The .gpr zip blob
 * @param {Object} meta     - { id?, site_name, dxf_filename, has_boundary, wgs84_lat, wgs84_lng }
 * @returns {Promise<{id, site_name, ...}>} saved project record
 */
export async function saveProject(gprBlob, meta) {
  const gpr_data = await blobToBase64(gprBlob);
  const res = await fetch(`${API}?action=save`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      ...meta,
      gpr_data,
      file_size_bytes: gprBlob.size,
    }),
  });
  if (!res.ok) throw new Error('Failed to save project: ' + (await res.text()));
  const { project } = await res.json();
  return project;
}

// ── List ──────────────────────────────────────────────────────────────────

export async function listProjects() {
  const res = await fetch(`${API}?action=list`);
  if (!res.ok) throw new Error('Failed to list projects');
  const { projects } = await res.json();
  return projects ?? [];
}

// ── Load ──────────────────────────────────────────────────────────────────

/**
 * Load a project from the server and parse it as a .gpr file.
 * @param {string} id - UUID of the project
 * @returns parsed .gpr contents (same as gpr-file.js openGPR)
 */
export async function loadProject(id) {
  const res = await fetch(`${API}?action=load&id=${id}`);
  if (!res.ok) throw new Error('Project not found');
  const { project } = await res.json();

  const blob = base64ToBlob(project.gpr_data);
  const file = new File([blob], project.dxf_filename ?? 'project.gpr');
  return file;
}

// ── Delete ────────────────────────────────────────────────────────────────

export async function deleteProject(id) {
  const res = await fetch(`${API}?action=delete`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Failed to delete project');
}

// ── Recent Projects Modal ─────────────────────────────────────────────────

const MODAL_ID = 'recent-projects-overlay';

export function initProjects() {
  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.style.cssText = `
    display:none; position:fixed; inset:0; z-index:1300;
    background:rgba(0,0,0,0.4);
    align-items:center; justify-content:center;`;

  overlay.innerHTML = `
    <div style="
      background:var(--chrome-panel); border:1px solid var(--chrome-border);
      border-radius:6px; width:560px; max-width:95vw; max-height:80vh;
      box-shadow:0 8px 32px rgba(0,0,0,0.22); display:flex; flex-direction:column;
      font-family:var(--font,'Outfit',sans-serif); color:var(--text-primary); overflow:hidden;">

      <div style="padding:12px 16px; border-bottom:1px solid var(--chrome-border);
                  display:flex; align-items:center; gap:10px;
                  background:var(--chrome-dark,#1e3d1e); flex-shrink:0;">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"
             stroke="#fff" stroke-width="1.4">
          <path d="M2 3.5h4l1.5 2H14V13H2V3.5z"/>
        </svg>
        <h3 style="margin:0;font-size:13px;font-weight:600;flex:1;color:#fff;">
          Recent Projects</h3>
        <button id="rp-close" style="background:none;border:none;color:rgba(255,255,255,0.6);
          cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;">&#x2715;</button>
      </div>

      <div id="rp-list" style="flex:1;overflow-y:auto;padding:8px 0;min-height:100px;">
        <div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:12px;">
          Loading projects\u2026</div>
      </div>

      <div style="padding:10px 16px;border-top:1px solid var(--chrome-border);
                  display:flex;justify-content:space-between;align-items:center;
                  flex-shrink:0;font-size:11px;color:var(--text-secondary);">
        <span id="rp-count"></span>
        <button id="rp-refresh" style="background:none;border:1px solid var(--chrome-border);
          border-radius:4px;color:var(--text-secondary);font-size:11px;
          padding:4px 10px;cursor:pointer;">&#8635; Refresh</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) hideProjectsModal();
  });
  document.getElementById('rp-close').addEventListener('click', hideProjectsModal);
  document.getElementById('rp-refresh').addEventListener('click', () => loadProjectList());
}

export function showProjectsModal(onOpen) {
  _onOpenCallback = onOpen;
  document.getElementById(MODAL_ID).style.display = 'flex';
  loadProjectList();
}

function hideProjectsModal() {
  document.getElementById(MODAL_ID).style.display = 'none';
}

let _onOpenCallback = null;

async function loadProjectList() {
  const listEl = document.getElementById('rp-list');
  const countEl = document.getElementById('rp-count');
  listEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:12px;">
    Loading\u2026</div>`;

  try {
    const projects = await listProjects();
    countEl.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;

    if (!projects.length) {
      listEl.innerHTML = `<div style="padding:24px;text-align:center;
        color:var(--text-secondary);font-size:12px;">
        No saved projects yet.<br>Import a CADMapper DXF to create your first project.</div>`;
      return;
    }

    listEl.innerHTML = '';
    for (const p of projects) {
      const row = document.createElement('div');
      row.style.cssText = `
        display:flex;align-items:center;gap:12px;padding:10px 16px;
        border-bottom:1px solid var(--chrome-border);cursor:pointer;`;
      row.addEventListener('mouseover', () => row.style.background = 'var(--chrome-hover)');
      row.addEventListener('mouseout',  () => row.style.background = '');

      const date = new Date(p.updated_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
      const size = p.file_size_bytes
        ? (p.file_size_bytes < 1024*1024
            ? `${(p.file_size_bytes/1024).toFixed(0)} KB`
            : `${(p.file_size_bytes/1024/1024).toFixed(1)} MB`)
        : '';
      const boundary = p.has_boundary
        ? `<span style="font-size:10px;background:var(--accent-dark,#1e3d1e);
             color:var(--accent-light,#7fc47f);border-radius:3px;padding:1px 5px;
             margin-left:4px;">Boundary</span>`
        : '';

      row.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none"
             stroke="var(--accent-mid,#4a8a4a)" stroke-width="1.4"
             style="flex-shrink:0;opacity:0.7;">
          <path d="M4 6h8l3 4h9v14H4V6z"/>
        </svg>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:500;white-space:nowrap;
               overflow:hidden;text-overflow:ellipsis;">
            ${p.site_name}${boundary}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">
            ${p.dxf_filename ?? ''} &nbsp;&middot;&nbsp; ${date}
            ${size ? `&nbsp;&middot;&nbsp; ${size}` : ''}</div>
        </div>
        <button class="rp-delete-btn" data-id="${p.id}"
          style="background:none;border:none;color:var(--text-secondary);
          cursor:pointer;font-size:15px;padding:4px 6px;flex-shrink:0;"
          title="Delete project">&#x1F5D1;</button>`;

      // Open on row click (but not delete button)
      row.addEventListener('click', async (e) => {
        if (e.target.closest('.rp-delete-btn')) return;
        hideProjectsModal();
        if (_onOpenCallback) {
          const file = await loadProject(p.id);
          _onOpenCallback(file);
        }
      });

      listEl.appendChild(row);
    }

    // Wire delete buttons
    listEl.querySelectorAll('.rp-delete-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Delete "${btn.closest('div').querySelector('div').textContent.trim()}"?`)) return;
        await deleteProject(btn.dataset.id);
        loadProjectList();
      });
    });

  } catch (err) {
    listEl.innerHTML = `<div style="padding:20px;text-align:center;
      color:#e06060;font-size:12px;">Failed to load projects: ${err.message}</div>`;
  }
}
