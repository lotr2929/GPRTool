/*
 * cadmapper-import.js — Import from CADMapper command
 *
 * Needs: callbacks.THREE, callbacks.onLayersLoaded(groups)
 * Exposes: initCADMapperImport(callbacks)
 *
 * Flow:
 *   1. User clicks "Import from CADMapper…"
 *   2. Modal: file picker + optional UTM origin fields + layer checkboxes
 *   3. parseCadmapperDXF() builds Three.js geometry per layer
 *   4. callbacks.onLayersLoaded(layerGroups) → index.html adds to scene
 *
 * DXF structure (CADMapper AutoCAD format, all in metres):
 *   MESH entities  → topography (1), buildings (many), roads/paths (many)
 *   LWPOLYLINE     → contours (many)
 *   POLYLINE+VERTEX → parks, water, railways
 *
 * Axis mapping: DXF X → Three X,  DXF Y → Three Z,  DXF Z → Three Y
 *
 * UTM conversion utility exported for OSM↔DXF alignment in calling code.
 */

// ── Layer display config ───────────────────────────────────────────────────
const LAYER_CONFIG = {
  topography:  { label: 'Terrain',     color: 0xc8b890, opacity: 1.0, wire: false },
  buildings:   { label: 'Buildings',   color: 0xd4d0c8, opacity: 0.85, wire: false },
  highways:    { label: 'Highways',    color: 0x808078, opacity: 1.0, wire: false },
  major_roads: { label: 'Major Roads', color: 0x989890, opacity: 1.0, wire: false },
  minor_roads: { label: 'Minor Roads', color: 0xa8a8a0, opacity: 1.0, wire: false },
  paths:       { label: 'Paths',       color: 0xb8b8a8, opacity: 1.0, wire: false },
  parks:       { label: 'Parks',       color: 0x70b850, opacity: 1.0, line: true  },
  water:       { label: 'Water',       color: 0x5888c0, opacity: 1.0, line: true  },
  railways:    { label: 'Railways',    color: 0x585048, opacity: 1.0, line: true  },
  contours:    { label: 'Contours',    color: 0xa08860, opacity: 0.7, line: true  },
};

// ── Modal HTML ─────────────────────────────────────────────────────────────
const MODAL_HTML = `
<div id="cadmapper-overlay" style="
  display:none; position:fixed; inset:0;
  background:rgba(0,0,0,0.55); z-index:1100;
  align-items:center; justify-content:center;">
  <div id="cadmapper-modal" style="
    background:var(--chrome-bg,#2c2c2c);
    border:1px solid var(--chrome-border,#444);
    border-radius:6px; width:440px; max-width:95vw;
    box-shadow:0 8px 32px rgba(0,0,0,0.55);
    color:var(--text-primary,#e8e8e8);
    font-family:var(--font-ui,'Outfit',sans-serif);
    overflow:hidden;">

    <div style="padding:12px 16px; border-bottom:1px solid var(--chrome-border,#444);
                display:flex; align-items:center; gap:10px;">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
           stroke="currentColor" stroke-width="1.4">
        <path d="M3 12h10M8 3v7M5 7l3 3 3-3"/>
        <rect x="1.5" y="11" width="13" height="2.5" rx="0.5"/>
      </svg>
      <h3 style="margin:0; font-size:13px; font-weight:600; flex:1;">Import from CADMapper</h3>
      <button id="cadmapper-close" style="
        background:none; border:none; color:var(--text-secondary,#888);
        cursor:pointer; font-size:18px; line-height:1; padding:2px 6px;">&#x2715;</button>
    </div>

    <div style="padding:14px 16px; border-bottom:1px solid var(--chrome-border,#444);">
      <label style="font-size:11px;color:var(--text-secondary,#888);display:block;margin-bottom:6px;">
        DXF File (from cadmapper.com)
      </label>
      <div style="display:flex;gap:8px;align-items:center;">
        <span id="cadmapper-filename" style="
          flex:1;font-size:12px;color:var(--text-secondary,#888);
          background:var(--chrome-input,#1a1a1a);border:1px solid var(--chrome-border,#444);
          border-radius:4px;padding:6px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          No file selected
        </span>
        <button id="cadmapper-file-btn" style="
          background:var(--chrome-border,#444);color:var(--text-primary,#e8e8e8);
          border:none;border-radius:4px;font-size:12px;padding:6px 12px;cursor:pointer;
          white-space:nowrap;">Browse&#8230;</button>
        <input type="file" id="cadmapper-file-input" accept=".dxf" style="display:none">
      </div>
    </div>

    <div style="padding:14px 16px; border-bottom:1px solid var(--chrome-border,#444);">
      <label style="font-size:11px;color:var(--text-secondary,#888);display:block;margin-bottom:6px;">
        UTM Origin &mdash; from CADMapper download page
        <span style="color:var(--text-secondary,#555);"> (optional, for OSM alignment)</span>
      </label>
      <div style="display:flex;gap:8px;">
        <div style="flex:1;">
          <div style="font-size:10px;color:var(--text-secondary,#666);margin-bottom:3px;">Easting (m)</div>
          <input id="cadmapper-easting" type="number" placeholder="e.g. 388500"
            style="width:100%;box-sizing:border-box;background:var(--chrome-input,#1a1a1a);
                   border:1px solid var(--chrome-border,#444);border-radius:4px;
                   color:var(--text-primary,#e8e8e8);font-size:12px;padding:5px 8px;outline:none;">
        </div>
        <div style="flex:1;">
          <div style="font-size:10px;color:var(--text-secondary,#666);margin-bottom:3px;">Northing (m)</div>
          <input id="cadmapper-northing" type="number" placeholder="e.g. 6461800"
            style="width:100%;box-sizing:border-box;background:var(--chrome-input,#1a1a1a);
                   border:1px solid var(--chrome-border,#444);border-radius:4px;
                   color:var(--text-primary,#e8e8e8);font-size:12px;padding:5px 8px;outline:none;">
        </div>
        <div style="width:80px;">
          <div style="font-size:10px;color:var(--text-secondary,#666);margin-bottom:3px;">Zone</div>
          <input id="cadmapper-zone" type="text" placeholder="50S"
            style="width:100%;box-sizing:border-box;background:var(--chrome-input,#1a1a1a);
                   border:1px solid var(--chrome-border,#444);border-radius:4px;
                   color:var(--text-primary,#e8e8e8);font-size:12px;padding:5px 8px;outline:none;">
        </div>
      </div>
    </div>

    <div style="padding:12px 16px; border-bottom:1px solid var(--chrome-border,#444);">
      <div style="font-size:11px;color:var(--text-secondary,#888);margin-bottom:8px;">Layers to import</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px 14px;">
        ${Object.entries(LAYER_CONFIG).map(([k, v]) =>
          `<label style="font-size:11px;display:flex;align-items:center;gap:5px;cursor:pointer;">
            <input type="checkbox" class="cadmapper-layer-cb" data-layer="${k}" checked
              style="accent-color:var(--accent-mid,#4a8a4a);">${v.label}
          </label>`).join('')}
      </div>
    </div>

    <div style="padding:10px 16px; display:flex; align-items:center; gap:8px;">
      <span id="cadmapper-status" style="flex:1;font-size:11px;color:var(--text-secondary,#888);">
        Select a DXF file to import.
      </span>
      <button id="cadmapper-import-btn" disabled style="
        background:var(--accent-mid,#4a8a4a);color:#fff;
        border:none;border-radius:4px;font-size:12px;
        padding:6px 14px;cursor:pointer;opacity:0.5;white-space:nowrap;">
        Import
      </button>
    </div>
  </div>
</div>`;

// ── Module state ───────────────────────────────────────────────────────────
let _callbacks = null;
let _dxfFile   = null;

// ── Init ───────────────────────────────────────────────────────────────────
export function initCADMapperImport(callbacks) {
  _callbacks = callbacks;
  document.body.insertAdjacentHTML('beforeend', MODAL_HTML);

  document.getElementById('importCADMapperBtn').addEventListener('click', openModal);
  document.getElementById('cadmapper-close').addEventListener('click', closeModal);
  document.getElementById('cadmapper-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('cadmapper-overlay')) closeModal();
  });
  document.getElementById('cadmapper-file-btn').addEventListener('click', () =>
    document.getElementById('cadmapper-file-input').click());
  document.getElementById('cadmapper-file-input').addEventListener('change', onFileSelected);
  document.getElementById('cadmapper-import-btn').addEventListener('click', runImport);
}

function openModal()  { document.getElementById('cadmapper-overlay').style.display = 'flex'; }
function closeModal() { document.getElementById('cadmapper-overlay').style.display = 'none'; }

function setStatus(msg, isError = false) {
  const el = document.getElementById('cadmapper-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#e06060' : 'var(--text-secondary,#888)';
}

function onFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  _dxfFile = file;
  document.getElementById('cadmapper-filename').textContent = file.name;
  document.getElementById('cadmapper-filename').style.color = 'var(--text-primary,#e8e8e8)';
  document.getElementById('cadmapper-import-btn').disabled = false;
  document.getElementById('cadmapper-import-btn').style.opacity = '1';
  setStatus(`Ready: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
  e.target.value = '';
}

async function runImport() {
  if (!_dxfFile) return;

  // Store UTM origin if provided
  const easting  = parseFloat(document.getElementById('cadmapper-easting').value);
  const northing = parseFloat(document.getElementById('cadmapper-northing').value);
  const zoneStr  = document.getElementById('cadmapper-zone').value.trim().toUpperCase();
  if (!isNaN(easting) && !isNaN(northing) && zoneStr) {
    window.siteUTMOrigin = {
      easting, northing,
      zone: parseInt(zoneStr),
      hemisphere: zoneStr.endsWith('N') ? 'N' : 'S'
    };
  } else {
    window.siteUTMOrigin = null;
  }

  const selectedLayers = new Set(
    [...document.querySelectorAll('.cadmapper-layer-cb:checked')].map(cb => cb.dataset.layer)
  );

  setStatus('Reading DXF\u2026');
  document.getElementById('cadmapper-import-btn').disabled = true;
  document.getElementById('cadmapper-import-btn').style.opacity = '0.5';

  try {
    const text = await _dxfFile.text();
    const layerGroups = parseCadmapperDXF(text, selectedLayers, _callbacks.THREE);
    if (!layerGroups || !Object.keys(layerGroups).length) {
      throw new Error('No geometry found in selected layers');
    }
    closeModal();
    _callbacks.onLayersLoaded(layerGroups);
  } catch (err) {
    setStatus('Import failed: ' + err.message, true);
    document.getElementById('cadmapper-import-btn').disabled = false;
    document.getElementById('cadmapper-import-btn').style.opacity = '1';
    console.error('GPRTool cadmapper-import:', err);
  }
}

// ── DXF parser ─────────────────────────────────────────────────────────────
function parseCadmapperDXF(text, selectedLayers, THREE) {
  // ── Step 1: Parse all code/value pairs ─────────────────────────
  // Handle both LF and CRLF line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const val  = lines[i + 1].trim();
    if (!isNaN(code)) pairs.push({ code, val });
  }

  // ── Step 2: Find ENTITIES section ──────────────────────────────
  let start = 0;
  for (; start < pairs.length; start++) {
    if (pairs[start].code === 2 && pairs[start].val === 'ENTITIES') break;
  }
  let end = start;
  for (; end < pairs.length; end++) {
    if (pairs[end].code === 0 && pairs[end].val === 'ENDSEC' && end > start) break;
  }

  if (start >= pairs.length) throw new Error('No ENTITIES section found — not a valid DXF');

  // ── Step 3: Collect entity blocks ──────────────────────────────
  // Each block: { type, layer, pairs[] }
  // VERTEX blocks are merged into their parent POLYLINE block
  const blocks = [];
  let i = start + 1;
  let currentBlock = null;

  while (i < end) {
    const p = pairs[i];
    if (p.code === 0) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { type: p.val, layer: null, pairs: [] };
    } else if (currentBlock) {
      if (p.code === 8 && currentBlock.layer === null) currentBlock.layer = p.val;
      currentBlock.pairs.push(p);
    }
    i++;
  }
  if (currentBlock) blocks.push(currentBlock);

  // ── Step 4: Merge POLYLINE + VERTEX + SEQEND ───────────────────
  // After a POLYLINE block, collect all following VERTEX blocks until SEQEND
  const merged = [];
  let bi = 0;
  while (bi < blocks.length) {
    const b = blocks[bi];
    if (b.type === 'POLYLINE') {
      // Collect vertex positions from following VERTEX entities
      const vertices = [];
      bi++;
      while (bi < blocks.length && blocks[bi].type !== 'SEQEND') {
        if (blocks[bi].type === 'VERTEX') {
          const vp = blocks[bi].pairs;
          let vx = 0, vy = 0, vz = 0;
          for (const p of vp) {
            if (p.code === 10) vx = parseFloat(p.val);
            else if (p.code === 20) vy = parseFloat(p.val);
            else if (p.code === 30) vz = parseFloat(p.val);
          }
          vertices.push({ x: vx, y: vy, z: vz });
        }
        bi++;
      }
      bi++; // skip SEQEND
      merged.push({ type: 'POLYLINE', layer: b.layer, vertices, pairs: b.pairs });
    } else if (b.type === 'VERTEX' || b.type === 'SEQEND') {
      bi++; // orphaned — skip
    } else {
      merged.push(b);
      bi++;
    }
  }

  // ── Step 5: Build geometry per layer ───────────────────────────
  const layerData = {}; // layer → { meshParts: [], lineParts: [] }

  for (const block of merged) {
    const layer = block.layer;
    if (!layer || !selectedLayers.has(layer)) continue;
    if (!layerData[layer]) layerData[layer] = { meshParts: [], lineParts: [] };

    if (block.type === 'MESH') {
      const geom = parseMeshBlock(block.pairs, THREE);
      if (geom) layerData[layer].meshParts.push(geom);

    } else if (block.type === 'LWPOLYLINE') {
      const pts = parseLWPolylineBlock(block.pairs);
      if (pts && pts.length >= 2) layerData[layer].lineParts.push(pts);

    } else if (block.type === 'POLYLINE') {
      if (block.vertices && block.vertices.length >= 2) {
        layerData[layer].lineParts.push(block.vertices);
      }
    }
  }

  // ── Step 6: Build Three.js groups ──────────────────────────────
  const layerGroups = {};

  for (const [layer, data] of Object.entries(layerData)) {
    const cfg     = LAYER_CONFIG[layer] || { color: 0xaaaaaa, opacity: 1.0 };
    const group   = new THREE.Group();
    group.name    = layer;

    // Mesh parts (MESH entities)
    for (const geom of data.meshParts) {
      const mat = new THREE.MeshBasicMaterial({
        color:       cfg.color,
        opacity:     cfg.opacity,
        transparent: cfg.opacity < 1.0,
        side:        THREE.DoubleSide,
        polygonOffset:      true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits:  1,
      });
      const mesh = new THREE.Mesh(geom, mat);
      group.add(mesh);

      // Edge overlay for buildings and terrain
      if (layer === 'buildings' || layer === 'topography') {
        const edges    = new THREE.EdgesGeometry(geom, 15); // 15° threshold
        const edgeMat  = new THREE.LineBasicMaterial({
          color:   layer === 'buildings' ? 0x888888 : 0xa09070,
          opacity: 0.4, transparent: true
        });
        const edgeMesh = new THREE.LineSegments(edges, edgeMat);
        edgeMesh.renderOrder = 1;
        group.add(edgeMesh);
      }
    }

    // Line parts (LWPOLYLINE / POLYLINE)
    for (const pts of data.lineParts) {
      const closed = pts.length > 2 && isClosed(pts);
      const threePts = pts.map(p => new THREE.Vector3(p.x, p.z, p.y));

      const geom = new THREE.BufferGeometry().setFromPoints(
        closed ? [...threePts, threePts[0]] : threePts
      );
      const mat  = new THREE.LineBasicMaterial({
        color:       cfg.color,
        opacity:     cfg.opacity,
        transparent: cfg.opacity < 1.0,
      });
      const line = new THREE.Line(geom, mat);
      group.add(line);
    }

    if (group.children.length) layerGroups[layer] = group;
  }

  return layerGroups;
}

// ── Parse a MESH entity block into BufferGeometry ─────────────────────────
function parseMeshBlock(pairs, THREE) {
  // Find vertex count (code 92)
  let pi = 0;
  while (pi < pairs.length && pairs[pi].code !== 92) pi++;
  if (pi >= pairs.length) return null;
  const vertCount = parseInt(pairs[pi].val, 10);
  pi++;

  // Read vertices — codes 10/20/30 appear in groups of 3
  const vx = new Float32Array(vertCount);
  const vy = new Float32Array(vertCount);
  const vz = new Float32Array(vertCount);
  let vi = 0;
  let xSet = false, ySet = false;
  let tmpX = 0, tmpY = 0;

  while (pi < pairs.length && vi < vertCount) {
    const { code, val } = pairs[pi];
    if (code === 10) { tmpX = parseFloat(val); xSet = true; }
    else if (code === 20) { tmpY = parseFloat(val); ySet = true; }
    else if (code === 30) {
      vx[vi] = tmpX;
      vy[vi] = tmpY;
      vz[vi] = parseFloat(val);
      vi++;
      xSet = false; ySet = false;
    }
    // Stop when we hit code 93 (face list count)
    else if (code === 93) break;
    pi++;
  }

  if (vi < vertCount) return null; // incomplete

  // Find face list count (code 93)
  while (pi < pairs.length && pairs[pi].code !== 93) pi++;
  if (pi >= pairs.length) return null;
  const faceListCount = parseInt(pairs[pi].val, 10);
  pi++;

  // Read face list (all code 90 values)
  const faceList = new Int32Array(faceListCount);
  let fi = 0;
  while (pi < pairs.length && fi < faceListCount) {
    if (pairs[pi].code === 90) faceList[fi++] = parseInt(pairs[pi].val, 10);
    pi++;
  }

  // Build positions — axis map: DXF X→Three X, DXF Y→Three Z, DXF Z→Three Y
  const positions = new Float32Array(vertCount * 3);
  for (let j = 0; j < vertCount; j++) {
    positions[j * 3]     = vx[j];  // Three X
    positions[j * 3 + 1] = vz[j];  // Three Y (elevation)
    positions[j * 3 + 2] = vy[j];  // Three Z
  }

  // Build triangle indices from face list
  const indices = [];
  let fli = 0;
  while (fli < faceListCount) {
    const n = faceList[fli++];
    if (n === 3) {
      indices.push(faceList[fli], faceList[fli + 1], faceList[fli + 2]);
      fli += 3;
    } else if (n === 4) {
      // Fan-triangulate quad
      indices.push(faceList[fli], faceList[fli + 1], faceList[fli + 2]);
      indices.push(faceList[fli], faceList[fli + 2], faceList[fli + 3]);
      fli += 4;
    } else {
      fli += n; // unsupported face type — skip
    }
  }

  if (!indices.length) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// ── Parse a LWPOLYLINE entity block into vertex list ──────────────────────
function parseLWPolylineBlock(pairs) {
  let elevation = 0;
  const pts = [];
  let tmpX = null;

  for (const { code, val } of pairs) {
    if (code === 38) elevation = parseFloat(val);
    else if (code === 10) tmpX = parseFloat(val);
    else if (code === 20 && tmpX !== null) {
      // Axis map: DXF X→x, DXF Y→y, elevation→z
      pts.push({ x: tmpX, y: parseFloat(val), z: elevation });
      tmpX = null;
    }
  }
  return pts;
}

// ── Check if a polyline is closed (first ≈ last vertex) ───────────────────
function isClosed(pts) {
  const first = pts[0], last = pts[pts.length - 1];
  return Math.abs(first.x - last.x) < 0.01 && Math.abs(first.y - last.y) < 0.01;
}

// ── Layer visibility panel (injected into right panel after load) ──────────
export function buildLayerPanel(layerGroups, container) {
  // Remove existing panel if present
  const existing = document.getElementById('cadmapper-layer-section');
  if (existing) existing.remove();

  const section = document.createElement('div');
  section.id = 'cadmapper-layer-section';
  section.className = 'property-section';
  section.innerHTML = '<h4>Site Context</h4>';

  for (const [layer, group] of Object.entries(layerGroups)) {
    const cfg   = LAYER_CONFIG[layer] || { label: layer };
    const count = group.children.length;

    const row = document.createElement('div');
    row.className = 'info-row';
    row.style.cssText = 'cursor:pointer;';

    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;width:100%;';

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.checked = true;
    cb.style.cssText = 'accent-color:var(--accent-mid,#4a8a4a);';
    cb.addEventListener('change', () => { group.visible = cb.checked; });

    const dot = document.createElement('span');
    dot.style.cssText = `
      width:8px;height:8px;border-radius:50%;flex-shrink:0;
      background:#${(LAYER_CONFIG[layer]?.color ?? 0xaaaaaa).toString(16).padStart(6,'0')};`;

    const name = document.createElement('span');
    name.style.cssText = 'flex:1;font-size:12px;';
    name.textContent   = cfg.label;

    const cnt = document.createElement('span');
    cnt.style.cssText = 'font-size:10px;color:var(--text-secondary,#888);';
    cnt.textContent   = count;

    label.append(cb, dot, name, cnt);
    row.appendChild(label);
    section.appendChild(row);
  }

  // Insert before the view-actions section, or append
  const viewActions = document.getElementById('view-actions-section');
  const panelContent = container || document.querySelector('#right-panel .panel-content');
  if (viewActions && panelContent) {
    panelContent.insertBefore(section, viewActions);
  } else if (panelContent) {
    panelContent.appendChild(section);
  }

  return section;
}

// ── UTM ↔ WGS84 (compact, no external library) ────────────────────────────
// Accurate to ~1mm for urban-scale sites.
export function wgs84ToUTM(lat, lng, zone) {
  const a  = 6378137.0;
  const f  = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = 2 * f - f * f;
  const n2 = e2 / (1 - e2);
  const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const phi  = lat * Math.PI / 180;
  const lam  = lng * Math.PI / 180 - lon0;

  const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi), tanPhi = Math.tan(phi);
  const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = n2 * cosPhi * cosPhi;
  const A = cosPhi * lam;

  const M = a * (
    (1 - e2 / 4 - 3 * e2 * e2 / 64) * phi
    - (3 * e2 / 8 + 3 * e2 * e2 / 32) * Math.sin(2 * phi)
    + (15 * e2 * e2 / 256) * Math.sin(4 * phi)
  );

  const easting = k0 * N * (
    A + (1 - T + C) * A * A * A / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * n2) * A * A * A * A * A / 120
  ) + 500000;

  const northing = k0 * (
    M + N * tanPhi * (
      A * A / 2
      + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * n2) * A * A * A * A * A * A / 720
    )
  ) + (lat < 0 ? 10000000 : 0);

  return { easting, northing };
}
