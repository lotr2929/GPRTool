/*
 * local-folder.js — local .gpr persistence via File System Access API
 *
 * Provides:
 *   isLocalFolderSupported()       → boolean (browser capability check)
 *   pickLocalSaveFile(name)        → FileSystemFileHandle | null (must be in user-gesture)
 *   writeBlobToHandle(handle,blob) → void (run in background)
 *
 * Design:
 *   • pickLocalSaveFile MUST be called synchronously after a user click.
 *     Opens native Save-As at the last-used folder (or Documents on first call).
 *   • The chosen FileSystemFileHandle is persisted in IndexedDB so the next
 *     showSaveFilePicker can resolve startIn to the same folder.
 *   • writeBlobToHandle runs the actual disk write — can take seconds for
 *     large projects, runs after dialog has closed in the background IIFE.
 *
 * Browser support: Chromium-based browsers only (Edge ✓, Chrome ✓, Firefox ✗,
 *   Safari ✗). Use isLocalFolderSupported() to detect.
 */

const IDB_NAME = 'gprtool_local_folder';
const STORE    = 'handles';
const KEY_LAST = 'lastFileHandle';

// ── IDB helpers ───────────────────────────────────────────────────────────
function _idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function _idbGet(key) {
  const db = await _idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
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

// ── Public API ────────────────────────────────────────────────────────────

/** Is showSaveFilePicker available in this browser? */
export function isLocalFolderSupported() {
  return typeof window.showSaveFilePicker === 'function';
}

/**
 * Open Save-As dialog in user-gesture context. Returns a FileSystemFileHandle
 * the caller can write to later, or null if the user cancelled / API
 * unsupported.
 *
 * Throws on unexpected errors (permission denied, etc.); callers should
 * try/catch and treat thrown errors as "abort save".
 */
export async function pickLocalSaveFile(suggestedName) {
  if (!isLocalFolderSupported()) return null;

  let startIn;
  try {
    const last = await _idbGet(KEY_LAST);
    startIn = last || 'documents';
  } catch {
    startIn = 'documents';
  }

  const finalName = suggestedName.endsWith('.gpr') ? suggestedName : `${suggestedName}.gpr`;

  let handle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: finalName,
      types: [{
        description: 'GPRTool Project',
        accept: { 'application/zip': ['.gpr'] }
      }],
      startIn,
    });
  } catch (e) {
    if (e.name === 'AbortError') return null; // user cancelled
    throw e;
  }

  // Remember chosen file — next showSaveFilePicker uses its parent as startIn.
  try {
    await _idbPut(KEY_LAST, handle);
  } catch (e) {
    console.warn('[local-folder] could not persist handle:', e);
  }

  return handle;
}

/**
 * Write a Blob to a previously-picked FileSystemFileHandle.
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
