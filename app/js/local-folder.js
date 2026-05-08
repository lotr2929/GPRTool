/*
 * local-folder.js — Project folder management via File System Access API
 *
 * Manages a designated project folder on the local filesystem.
 * All .gpr files are read from and written to this folder.
 * Autosave files are named {name}.autosave.gpr and excluded from the main list.
 *
 * IDB store: 'handles' in 'gprtool_local_folder' DB
 *   KEY_FOLDER  → FileSystemDirectoryHandle for the project folder
 *   KEY_LAST    → last individual file handle (legacy, kept for terrain bg-attach)
 *
 * Browser support: Chromium only (Edge ✓, Chrome ✓). Always check
 * isLocalFolderSupported() before calling any picker function.
 */

const IDB_NAME    = 'gprtool_local_folder';
const STORE       = 'handles';
const KEY_FOLDER  = 'folderHandle';
const KEY_LAST    = 'lastFileHandle';

// ── IDB helpers ───────────────────────────────────────────────────────────

function _idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function _idbGet(key) {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

async function _idbPut(key, value) {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Capability check ──────────────────────────────────────────────────────

/** True if File System Access API is available (Chromium only). */
export function isLocalFolderSupported() {
  return typeof window.showDirectoryPicker === 'function';
}

// ── Folder handle ─────────────────────────────────────────────────────────

/**
 * Show directory picker. Must be called inside a user gesture.
 * Stores the chosen handle in IDB.
 * Returns the DirectoryHandle, or null if cancelled.
 */
export async function pickProjectFolder() {
  if (!isLocalFolderSupported()) return null;
  let handle;
  try {
    handle = await window.showDirectoryPicker({
      id:      'gprtool-projects',
      mode:    'readwrite',
      startIn: 'documents',
    });
  } catch (e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }
  await _idbPut(KEY_FOLDER, handle);
  window.dispatchEvent(new CustomEvent('gprtool:folderSet'));
  return handle;
}

/**
 * Load the saved project folder handle and request readwrite permission.
 * Returns the DirectoryHandle, or null if not set / permission denied.
 * Does NOT show a picker — call pickProjectFolder() for that.
 */
export async function getProjectFolder() {
  let handle;
  try { handle = await _idbGet(KEY_FOLDER); } catch { return null; }
  if (!handle) return null;
  try {
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm === 'denied') return null;
    return handle;
  } catch {
    return null;
  }
}

/**
 * Ensure a folder is available. If not set, shows picker (must be in user gesture).
 * Returns DirectoryHandle or null.
 */
export async function ensureProjectFolder() {
  const existing = await getProjectFolder();
  if (existing) return existing;
  return pickProjectFolder();
}

// ── File listing ──────────────────────────────────────────────────────────

/**
 * List all .gpr files in the project folder (excluding .autosave.gpr).
 * Returns [{name, fileName, handle, sizeKB, modified, hasAutosave}]
 * sorted by modified date descending.
 */
export async function listGPRFiles() {
  const folder = await getProjectFolder();
  if (!folder) return [];

  // First pass: collect all filenames to detect autosaves
  const allNames = new Set();
  for await (const [name] of folder) allNames.add(name);

  const files = [];
  for await (const [name, handle] of folder) {
    if (handle.kind !== 'file')      continue;
    if (!name.endsWith('.gpr'))      continue;
    if (name.endsWith('.autosave.gpr')) continue;

    const baseName    = name.slice(0, -4);          // strip .gpr
    const autosaveName = baseName + '.autosave.gpr';
    let file;
    try { file = await handle.getFile(); } catch { continue; }

    files.push({
      name:        baseName,
      fileName:    name,
      handle,
      sizeKB:      +(file.size / 1024).toFixed(1),
      modified:    file.lastModified,
      hasAutosave: allNames.has(autosaveName),
    });
  }
  return files.sort((a, b) => b.modified - a.modified);
}

/**
 * Get the autosave handle for a given base name, or null if none exists.
 */
export async function getAutosaveHandle(baseName) {
  const folder = await getProjectFolder();
  if (!folder) return null;
  try {
    return await folder.getFileHandle(baseName + '.autosave.gpr');
  } catch { return null; }
}

// ── ZIP contents inspection ───────────────────────────────────────────────

const FILE_DESCRIPTIONS = {
  'manifest.json':          'Identity',
  'reference.json':         'Coordinates',
  'design.json':            'Design settings',
  'context.geojson':        'OSM layers',
  'boundary.geojson':       'Lot boundary',
  'terrain.json':           'Terrain elevation',
  'view.json':              'Camera position',
  'context/cadmapper.dxf':  'CADMapper DXF',
};

/**
 * Read ZIP local file headers without decompression.
 * Returns [{name, sizeKB, description}] or null on error.
 */
export async function inspectGPRContents(fileHandle) {
  try {
    const file   = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    const view   = new DataView(buffer);
    const entries = [];
    let offset = 0;

    while (offset < buffer.byteLength - 30) {
      if (view.getUint32(offset, true) !== 0x04034b50) break;  // PK\x03\x04
      const compSize   = view.getUint32(offset + 18, true);
      const uncompSize = view.getUint32(offset + 22, true);
      const nameLen    = view.getUint16(offset + 26, true);
      const extraLen   = view.getUint16(offset + 28, true);
      const name       = new TextDecoder().decode(
        new Uint8Array(buffer, offset + 30, nameLen)
      );
      if (!name.endsWith('/')) {
        entries.push({
          name,
          sizeKB:      +(uncompSize / 1024).toFixed(1),
          description: FILE_DESCRIPTIONS[name] ?? '',
        });
      }
      offset += 30 + nameLen + extraLen + compSize;
    }
    return entries.length ? entries : null;
  } catch { return null; }
}

/**
 * Format ZIP contents as a compact single-line string for display.
 * Groups small metadata files, lists data files with sizes.
 * e.g. "manifest · reference · design · context.geojson 1.4MB · terrain 410KB"
 */
export function formatGPRContents(entries) {
  if (!entries?.length) return 'Empty';
  const META = new Set(['manifest.json', 'reference.json', 'design.json']);
  const meta  = entries.filter(e => META.has(e.name)).map(e => e.name.replace('.json',''));
  const data  = entries.filter(e => !META.has(e.name));
  const parts = [];
  if (meta.length)  parts.push(meta.join(' · '));
  for (const d of data) {
    const label = d.name.replace('.json','').replace('.geojson','').replace('context/','');
    const size  = d.sizeKB >= 1024
      ? `${(d.sizeKB / 1024).toFixed(1)}MB`
      : `${d.sizeKB}KB`;
    parts.push(`${label} ${size}`);
  }
  return parts.join(' · ');
}

// ── Read / Write / Delete ─────────────────────────────────────────────────

/**
 * Read a .gpr file from the project folder by base name (no extension).
 * Returns a File object, or throws if not found.
 */
export async function readGPRFile(baseName) {
  const folder = await getProjectFolder();
  if (!folder) throw new Error('No project folder set');
  const handle = await folder.getFileHandle(baseName + '.gpr');
  return handle.getFile();
}

/**
 * Write a .gpr blob to the project folder.
 * Creates the file if it doesn't exist, overwrites if it does.
 * Returns the FileSystemFileHandle.
 */
export async function writeProjectFile(baseName, blob, autosave = false) {
  const folder = await getProjectFolder();
  if (!folder) throw new Error('No project folder set');
  const fileName = autosave ? `${baseName}.autosave.gpr` : `${baseName}.gpr`;
  const handle   = await folder.getFileHandle(fileName, { create: true });
  await writeBlobToHandle(handle, blob);
  return handle;
}

/**
 * Delete a .gpr file from the project folder by base name.
 * Silently ignores if not found.
 */
export async function deleteProjectFile(baseName, autosave = false) {
  const folder = await getProjectFolder();
  if (!folder) return;
  const fileName = autosave ? `${baseName}.autosave.gpr` : `${baseName}.gpr`;
  try { await folder.removeEntry(fileName); } catch { /* not found — ok */ }
}

/**
 * Write a Blob to a FileSystemFileHandle.
 * Used for direct handle writes (terrain background attach, etc.).
 * Throws on permission/IO errors.
 */
export async function writeBlobToHandle(handle, blob) {
  if (!handle) throw new Error('No file handle');
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (e) {
    try { await writable.abort(); } catch {}
    throw e;
  }
}

// ── Legacy: individual file picker (kept for any remaining callers) ───────

/** @deprecated Use writeProjectFile instead. */
export async function pickLocalSaveFile(suggestedName) {
  if (typeof window.showSaveFilePicker !== 'function') return null;
  let startIn;
  try { startIn = await _idbGet(KEY_LAST) || 'documents'; } catch { startIn = 'documents'; }
  const finalName = suggestedName.endsWith('.gpr') ? suggestedName : `${suggestedName}.gpr`;
  let handle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: finalName,
      types: [{ description: 'GPRTool Project', accept: { 'application/zip': ['.gpr'] } }],
      startIn,
    });
  } catch (e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }
  try { await _idbPut(KEY_LAST, handle); } catch {}
  return handle;
}
