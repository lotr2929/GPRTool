import { state } from './state.js';
import { appendLayerToPanel } from './cadmapper-panel.js';

export async function rebuildTerrainFromPayload(payload) {
  if (!payload?.points || !payload?.contourSegments) return;
  await _buildTerrainFromWorker({ terrainPoints: payload.points, contourSegments: payload.contourSegments, gridWidth: Infinity, gridHeight: Infinity, tilesX: 1, tilesY: 1 });
  state.terrainStatus = 'ready';
  state.terrainPayload = payload;
  window.dispatchEvent(new CustomEvent('terrain:status', { detail: { status: 'ready' } }));
}

export async function buildTerrainFromWorkerMsg(msg) {
  const { terrainPoints: points, contourSegments, gridWidth = 0, gridHeight = 0, tilesX = 1, tilesY = 1 } = msg;
  if (!points?.length || !gridWidth || !gridHeight) return;
  const yieldFrame = () => new Promise(r => requestAnimationFrame(r));
  const TILE_GRID = Math.round(gridWidth / tilesX);
  function ptAt(globalIy, globalIx) {
    const tileIy = Math.floor(globalIy / TILE_GRID), tileIx = Math.floor(globalIx / TILE_GRID);
    const tileIdx = tileIx * tilesY + tileIy;
    const localPy = globalIy % TILE_GRID, localPx = globalIx % TILE_GRID;
    return points[tileIdx * TILE_GRID * TILE_GRID + localPy * TILE_GRID + localPx] || null;
  }
  const centerPt = ptAt(Math.floor(gridHeight / 2), Math.floor(gridWidth / 2));
  const refEle = centerPt?.ele ?? 0;
  const verts = []; const idxMap = new Map(); let vi = 0;
  for (let giy = 0; giy < gridHeight; giy++) {
    for (let gix = 0; gix < gridWidth; gix++) {
      const pt = ptAt(giy, gix);
      if (!pt) continue;
      verts.push(pt.x, pt.ele - refEle, -pt.y);
      idxMap.set(giy * gridWidth + gix, vi++);
    }
  }
  await yieldFrame();
  const indices = [];
  for (let giy = 0; giy < gridHeight - 1; giy++) {
    for (let gix = 0; gix < gridWidth - 1; gix++) {
      const a = idxMap.get(giy * gridWidth + gix), b = idxMap.get(giy * gridWidth + gix + 1);
      const c = idxMap.get((giy + 1) * gridWidth + gix), d = idxMap.get((giy + 1) * gridWidth + gix + 1);
      if (a == null || b == null || c == null || d == null) continue;
      indices.push(a, b, c, b, d, c);
    }
  }
  await yieldFrame();
  if (indices.length) {
    const T = window.THREE || (await import('three')).default;
    const geom = new T.BufferGeometry(); geom.setAttribute('position', new T.BufferAttribute(new Float32Array(verts), 3));
    geom.setIndex(indices); geom.computeVertexNormals();
    const mesh = new T.Mesh(geom, new T.MeshBasicMaterial({ color: 0xc8b890, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 1 }));
    const terrainGroup = new T.Group(); terrainGroup.name = 'topography'; terrainGroup.add(mesh);
    state.cadmapperGroup.add(terrainGroup);
    appendLayerToPanel('topography', terrainGroup);
  }
  await yieldFrame();
  if (contourSegments?.length >= 6) {
    const T = window.THREE || (await import('three')).default;
    const vBuf = new Float32Array(contourSegments.length);
    for (let i = 0; i < contourSegments.length; i += 6) {
      vBuf[i] = contourSegments[i]; vBuf[i+1] = contourSegments[i+2] - refEle; vBuf[i+2] = -contourSegments[i+1];
      vBuf[i+3] = contourSegments[i+3]; vBuf[i+4] = contourSegments[i+5] - refEle; vBuf[i+5] = -contourSegments[i+4];
    }
    await yieldFrame();
    const geom = new T.BufferGeometry(); geom.setAttribute('position', new T.BufferAttribute(vBuf, 3));
    const contourGroup = new T.Group(); contourGroup.name = 'contours'; contourGroup.position.y = 0.015;
    contourGroup.add(new T.LineSegments(geom, new T.LineBasicMaterial({ color: 0xa08860, opacity: 0.7, transparent: true })));
    state.cadmapperGroup.add(contourGroup);
    appendLayerToPanel('contours', contourGroup);
  }
}

const _buildTerrainFromWorker = buildTerrainFromWorkerMsg;
