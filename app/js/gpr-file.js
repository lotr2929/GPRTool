/*
 * gpr-file.js — .gpr project file writer and reader for GPRTool
 *
 * A .gpr file is a ZIP archive containing:
 *   manifest.json       — identity, format version, sections present
 *   reference.json      — UTM anchor + WGS84 + scene offset  [REAL WORLD]
 *   design.json         — designNorthAngle, grid settings     [DESIGN WORLD]
 *   boundary.geojson    — lot boundary polygon (optional)
 *   context.geojson     — OSM GeoJSON FeatureCollection (OSM projects)
 *   context/cadmapper.dxf — original DXF (CADMapper projects)
 *   terrain.json        — terrain elevation payload (optional)
 *   view.json           — last camera position (optional)
 *
 * Storage: in-memory JSZip object (_activeZip). No IndexedDB.
 * Persistence to disk is handled by local-folder.js.
 * Requires: window.JSZip (loaded via CDN <script> tag before this module).
 *
 * ── REAL WORLD RULE ───────────────────────────────────────────────────────
 * reference.json and boundary.geojson contain geographic data.
 * design.json contains only design parameters — no coordinates.
 * They are NEVER mixed.
 */

import { state } from './state.js';

const FORMAT_VERSION = 1;
const TOOL_VERSION   = '0.1.0';

// ── Active project state ──────────────────────────────────────────────────

let _activeZip = null;   // JSZip instance of the open project

function _markDirty() {
  state._isDirty = true;
}

export function getActiveProjectId() {
  // Returns null — local file identity is in state._activeFileName
  return null;
}

/**
 * Get the current active .gpr as a Blob.
 * Returns null if no active project.
 */
export async function getActiveGPRBlob() {
  if (!_activeZip) return null;
  return _activeZip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

// ── Create a new .gpr from a CADMapper or OSM import ─────────────────────

/**
 * Create an initial .gpr file in memory from an import.
 * Sets the active ZIP. Call getActiveGPRBlob() to write to disk.
 *
 * @param {Object} params
 * @param {string}       params.siteName
 * @param {Object}       params.reference  — UTM + WGS84 + scene offset + site_span_m
 * @param {Object}       params.design     — design_north_angle, grid_spacing_m, minor_divisions
 * @param {File|null}    params.dxfFile
 * @param {Object|null}  params.osmGeoJSON
 */
export async function createInitialGPR({ siteName, reference, design, dxfFile = null, osmGeoJSON = null }) {
  if (!window.JSZip) throw new Error('JSZip not loaded');

  const now    = new Date().toISOString();
  const source = dxfFile ? 'cadmapper' : osmGeoJSON ? 'osm' : 'unknown';
  const sections = ['manifest', 'reference', 'design'];
  if (dxfFile)    sections.push('context/cadmapper.dxf');
  if (osmGeoJSON) sections.push('context.geojson');

  const manifest = {
    format_version: FORMAT_VERSION,
    tool_version:   TOOL_VERSION,
    created:        now,
    modified:       now,
    site_name:      siteName,
    source,
    sections,
  };

  const zip = new window.JSZip();
  zip.file('manifest.json',  JSON.stringify(manifest,  null, 2));
  zip.file('reference.json', JSON.stringify(reference, null, 2));
  zip.file('design.json',    JSON.stringify(design,    null, 2));

  if (dxfFile) {
    const dxfBytes = await dxfFile.arrayBuffer();
    zip.folder('context').file('cadmapper.dxf', dxfBytes);
  }
  if (osmGeoJSON) {
    zip.file('context.geojson', JSON.stringify(osmGeoJSON, null, 2));
  }

  _activeZip = zip;
  _markDirty();
  console.log(`[GPR] Project created in memory: ${siteName}`);
}

// ── Add or replace boundary.geojson ──────────────────────────────────────

export async function addBoundaryToGPR(geojson) {
  if (!_activeZip) throw new Error('No active project');

  _activeZip.file('boundary.geojson', JSON.stringify(geojson, null, 2));

  const manifestStr = await _activeZip.file('manifest.json').async('string');
  const manifest = JSON.parse(manifestStr);
  if (!manifest.sections.includes('boundary')) manifest.sections.push('boundary');
  manifest.modified = new Date().toISOString();
  _activeZip.file('manifest.json', JSON.stringify(manifest, null, 2));

  _markDirty();
  console.log('[GPR] Boundary added');
}

// ── Add or replace terrain.json ───────────────────────────────────────────

export async function addTerrainToGPR(payload) {
  if (!_activeZip) throw new Error('No active project');

  _activeZip.file('terrain.json', JSON.stringify(payload));

  const manifestStr = await _activeZip.file('manifest.json').async('string');
  const manifest = JSON.parse(manifestStr);
  if (!manifest.sections.includes('terrain')) manifest.sections.push('terrain');
  manifest.modified = new Date().toISOString();
  _activeZip.file('manifest.json', JSON.stringify(manifest, null, 2));

  _markDirty();
  const ptCount  = payload.points?.length ?? 0;
  const segCount = (payload.contourSegments?.length ?? 0) / 6;
  console.log(`[GPR] Terrain added (${ptCount} pts, ${segCount} contour segs)`);
}

export async function getTerrainFromGPR() {
  if (!_activeZip) return null;
  const entry = _activeZip.file('terrain.json');
  if (!entry) return null;
  try {
    return JSON.parse(await entry.async('string'));
  } catch (e) {
    console.warn('[GPR] terrain.json parse failed:', e);
    return null;
  }
}

// ── Add any raw file ──────────────────────────────────────────────────────

export async function addRawFileToGPR(zipPath, content, sectionName = null) {
  if (!_activeZip) throw new Error('No active project');

  _activeZip.file(zipPath, content);

  if (sectionName) {
    const manifestStr = await _activeZip.file('manifest.json').async('string');
    const manifest    = JSON.parse(manifestStr);
    if (!manifest.sections.includes(sectionName)) manifest.sections.push(sectionName);
    manifest.modified = new Date().toISOString();
    _activeZip.file('manifest.json', JSON.stringify(manifest, null, 2));
  }

  _markDirty();
  console.log(`[GPR] ${zipPath} added`);
}

// ── Update design.json ────────────────────────────────────────────────────

export async function updateDesignData(updates) {
  if (!_activeZip) return;
  try {
    const str  = await _activeZip.file('design.json').async('string');
    const data = Object.assign(JSON.parse(str), updates);
    _activeZip.file('design.json', JSON.stringify(data, null, 2));
    _markDirty();
  } catch (e) {
    console.warn('[GPR] updateDesignData failed:', e.message);
  }
}

// ── View state ────────────────────────────────────────────────────────────

export async function saveViewState(viewState) {
  if (!_activeZip) return;
  try {
    _activeZip.file('view.json', JSON.stringify(viewState, null, 2));
    // view state save does not mark dirty — it's cosmetic
  } catch (e) {
    console.warn('[GPR] saveViewState failed:', e.message);
  }
}

// ── Open a .gpr File object ───────────────────────────────────────────────

/**
 * Parse a .gpr File object. Sets the active ZIP.
 * Returns parsed contents.
 *
 * @param {File} file
 * @returns {Promise<{ manifest, reference, design, boundary, terrain, osmContext, view, hasDXF, zip }>}
 */
export async function openGPR(file) {
  if (!window.JSZip) throw new Error('JSZip not loaded');

  const zip = await window.JSZip.loadAsync(file);

  const manifest  = JSON.parse(await zip.file('manifest.json').async('string'));
  const reference = JSON.parse(await zip.file('reference.json').async('string'));
  const design    = JSON.parse(await zip.file('design.json').async('string'));

  const boundaryFile  = zip.file('boundary.geojson');
  const boundary      = boundaryFile ? JSON.parse(await boundaryFile.async('string')) : null;

  const terrainFile   = zip.file('terrain.json');
  const terrain       = terrainFile ? JSON.parse(await terrainFile.async('string')) : null;

  const osmContextFile = zip.file('context.geojson');
  const osmContext     = osmContextFile ? JSON.parse(await osmContextFile.async('string')) : null;

  const viewFile = zip.file('view.json');
  const view     = viewFile ? JSON.parse(await viewFile.async('string')) : null;

  const hasDXF = !!zip.file('context/cadmapper.dxf');

  _activeZip = zip;
  state._isDirty = false;  // just opened — nothing unsaved yet

  return { manifest, reference, design, boundary, terrain, osmContext, view, hasDXF, zip };
}

// ── Get DXF bytes from active project ────────────────────────────────────

export async function getDXFFromGPR() {
  if (!_activeZip) return null;
  const entry = _activeZip.file('context/cadmapper.dxf');
  if (!entry) return null;
  const bytes = await entry.async('arraybuffer');
  return new File([bytes], 'cadmapper.dxf', { type: 'application/octet-stream' });
}

// ── Download the active .gpr ──────────────────────────────────────────────

export async function downloadGPR(filename) {
  if (!_activeZip) throw new Error('No active project');
  const blob = await _activeZip.generateAsync({
    type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 },
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = (filename ?? 'project') + '.gpr';
  a.click();
  URL.revokeObjectURL(url);
}
