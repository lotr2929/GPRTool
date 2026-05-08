/*
 * dxf-writer.js — DXF R12 export for GPRTool Extract Site
 *
 * Writes a DXF R12 file from the extracted site geometry.
 * Exports building footprints (POLYLINE), roads (POLYLINE), contours (POLYLINE)
 * and terrain lines — all clipped to the site bbox.
 *
 * DXF coordinate convention vs Three.js:
 *   DXF X  = Three.js +X  (East)
 *   DXF Y  = Three.js -Z  (North  — Three.js Z = -North)
 *   DXF Z  = Three.js +Y  (Up)
 *
 * All POLYLINE entities use 64 (3D polyline) flag.
 * Layer names come from cadmapperGroup child names.
 */

// ── Constants ─────────────────────────────────────────────────────────────────
const DXF_COLOURS = {
  buildings:   7,   // white
  roads:        3,   // green
  major_roads:  5,   // blue
  minor_roads:  4,   // cyan
  paths:        2,   // yellow
  parks:        2,   // yellow
  water:        5,   // blue
  railways:     6,   // magenta
  contours:     1,   // red
  default:      7,
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build a DXF R12 string from cadmapperGroup geometry clipped to bbox.
 *
 * @param {THREE.Group} cadmapperGroup
 * @param {THREE.Group|null} contourGroup  — optional, from extractSite
 * @param {number} xMin  Scene-space X min
 * @param {number} xMax  Scene-space X max
 * @param {number} zMin  Scene-space Z min
 * @param {number} zMax  Scene-space Z max
 * @returns {string}  Complete DXF R12 content
 */
export function buildExtractDXF(cadmapperGroup, contourGroup, xMin, xMax, zMin, zMax) {
  const lines = [];

  _header(lines);
  _tablesSection(lines, cadmapperGroup, contourGroup);
  _entitiesSection(lines, cadmapperGroup, contourGroup, xMin, xMax, zMin, zMax);
  lines.push('0\nEOF');

  return lines.join('\n');
}

// ── DXF sections ──────────────────────────────────────────────────────────────

function _header(out) {
  out.push(
    '0\nSECTION',
    '2\nHEADER',
    '9\n$ACADVER', '1\nAC1009',
    '9\n$INSBASE', '10\n0.0', '20\n0.0', '30\n0.0',
    '9\n$EXTMIN', '10\n-5000.0', '20\n-5000.0', '30\n0.0',
    '9\n$EXTMAX', '10\n5000.0',  '20\n5000.0',  '30\n100.0',
    '9\n$LUNITS', '70\n2',   // decimal
    '9\n$LUPREC', '70\n3',
    '0\nENDSEC',
  );
}

function _tablesSection(out, cadmapperGroup, contourGroup) {
  out.push('0\nSECTION', '2\nTABLES');

  // LAYER table
  out.push('0\nTABLE', '2\nLAYER', '70\n100');

  const layers = _collectLayerNames(cadmapperGroup, contourGroup);
  for (const name of layers) {
    const col = DXF_COLOURS[_normName(name)] ?? DXF_COLOURS.default;
    out.push('0\nLAYER', '2\n' + name, '70\n0', '62\n' + col, '6\nCONTINUOUS');
  }

  out.push('0\nENDTAB', '0\nENDSEC');
}

function _entitiesSection(out, cadmapperGroup, contourGroup, xMin, xMax, zMin, zMax) {
  out.push('0\nSECTION', '2\nENTITIES');

  // Buildings — export as 3DFACE (one per mesh triangle) clipped to bbox
  if (cadmapperGroup) {
    for (const layer of cadmapperGroup.children) {
      const layerName = layer.name || 'default';
      layer.traverse(obj => {
        if (obj.isMesh) {
          _meshTo3DFaces(out, obj, layerName, xMin, xMax, zMin, zMax);
        } else if (obj.isLine || obj.isLineSegments) {
          _lineToPolyline(out, obj, layerName, xMin, xMax, zMin, zMax);
        }
      });
    }
  }

  // Contour lines
  if (contourGroup) {
    contourGroup.traverse(obj => {
      if (obj.isLine || obj.isLineSegments) {
        _lineToPolyline(out, obj, 'contours', xMin, xMax, zMin, zMax);
      }
    });
  }

  out.push('0\nENDSEC');
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Write mesh triangles within bbox as 3DFACE entities. */
function _meshTo3DFaces(out, mesh, layer, xMin, xMax, zMin, zMax) {
  const pos = mesh.geometry?.attributes?.position;
  if (!pos) return;
  const idx = mesh.geometry.index;
  const mat = mesh.matrixWorld;
  const v   = new Array(3).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));

  const applyMat = (i, target) => {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Manual matrix multiplication (avoid Three.js import)
    target.x = mat.elements[0]*x + mat.elements[4]*y + mat.elements[8]*z  + mat.elements[12];
    target.y = mat.elements[1]*x + mat.elements[5]*y + mat.elements[9]*z  + mat.elements[13];
    target.z = mat.elements[2]*x + mat.elements[6]*y + mat.elements[10]*z + mat.elements[14];
  };

  const count = idx ? idx.count : pos.count;
  for (let i = 0; i + 2 < count; i += 3) {
    const i0 = idx ? idx.getX(i)   : i;
    const i1 = idx ? idx.getX(i+1) : i+1;
    const i2 = idx ? idx.getX(i+2) : i+2;
    applyMat(i0, v[0]); applyMat(i1, v[1]); applyMat(i2, v[2]);

    // Clip: skip triangles entirely outside bbox
    if (v.every(p => p.x < xMin || p.x > xMax || p.z < zMin || p.z > zMax)) continue;

    // Convert Three.js coords → DXF coords: DXF(x,y,z) = Three(x,-z,y)
    out.push('0\n3DFACE', '8\n' + layer);
    for (let j = 0; j < 3; j++) {
      out.push(
        `1${j}\n${v[j].x.toFixed(3)}`,
        `2${j}\n${(-v[j].z).toFixed(3)}`,
        `3${j}\n${v[j].y.toFixed(3)}`,
      );
    }
    // 4th point = 3rd for triangles
    out.push(
      `13\n${v[2].x.toFixed(3)}`,
      `23\n${(-v[2].z).toFixed(3)}`,
      `33\n${v[2].y.toFixed(3)}`,
    );
  }
}

/** Write a THREE.Line/LineSegments as DXF POLYLINE within bbox. */
function _lineToPolyline(out, line, layer, xMin, xMax, zMin, zMax) {
  const pos = line.geometry?.attributes?.position;
  if (!pos || pos.count < 2) return;
  const mat = line.matrixWorld;

  const pts = [];
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i), ly = pos.getY(i), lz = pos.getZ(i);
    const wx = mat.elements[0]*lx + mat.elements[4]*ly + mat.elements[8]*lz  + mat.elements[12];
    const wy = mat.elements[1]*lx + mat.elements[5]*ly + mat.elements[9]*lz  + mat.elements[13];
    const wz = mat.elements[2]*lx + mat.elements[6]*ly + mat.elements[10]*lz + mat.elements[14];
    // Quick bbox check
    if (wx < xMin - 1 || wx > xMax + 1 || wz < zMin - 1 || wz > zMax + 1) {
      if (pts.length >= 2) _flushPolyline(out, layer, pts);
      pts.length = 0;
      continue;
    }
    pts.push({ x: wx, y: -wz, z: wy });  // DXF coords
  }
  if (pts.length >= 2) _flushPolyline(out, layer, pts);
}

function _flushPolyline(out, layer, pts) {
  out.push('0\nPOLYLINE', '8\n' + layer, '66\n1', '70\n8');
  for (const p of pts) {
    out.push('0\nVERTEX', '8\n' + layer,
      `10\n${p.x.toFixed(3)}`, `20\n${p.y.toFixed(3)}`, `30\n${p.z.toFixed(3)}`
    );
  }
  out.push('0\nSEQEND');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _normName(n) {
  return (n ?? '').toLowerCase().replace(/[\s-]/g, '_');
}

function _collectLayerNames(cadmapperGroup, contourGroup) {
  const names = new Set();
  cadmapperGroup?.children.forEach(c => names.add(c.name || 'default'));
  if (contourGroup) names.add('contours');
  return [...names];
}
