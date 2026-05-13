import * as THREE from 'three';
import { LAYER_CONFIG } from './cadmapper-layer-config.js';

export function parseCadmapperDXF(text, selectedLayers, THREE) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    const val  = lines[i + 1].trim();
    if (!isNaN(code)) pairs.push({ code, val });
  }
  let start = 0;
  for (; start < pairs.length; start++) { if (pairs[start].code === 2 && pairs[start].val === 'ENTITIES') break; }
  let end = start;
  for (; end < pairs.length; end++) { if (pairs[end].code === 0 && pairs[end].val === 'ENDSEC' && end > start) break; }
  if (start >= pairs.length) throw new Error('No ENTITIES section found');
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
  const merged = [];
  let bi = 0;
  while (bi < blocks.length) {
    const b = blocks[bi];
    if (b.type === 'POLYLINE') {
      const vertices = []; bi++;
      while (bi < blocks.length && blocks[bi].type !== 'SEQEND') {
        if (blocks[bi].type === 'VERTEX') {
          let vx = 0, vy = 0, vz = 0;
          for (const p of blocks[bi].pairs) {
            if (p.code === 10) vx = parseFloat(p.val);
            else if (p.code === 20) vy = parseFloat(p.val);
            else if (p.code === 30) vz = parseFloat(p.val);
          }
          vertices.push({ x: vx, y: vy, z: vz });
        }
        bi++;
      }
      bi++;
      merged.push({ type: 'POLYLINE', layer: b.layer, vertices, pairs: b.pairs });
    } else if (b.type === 'VERTEX' || b.type === 'SEQEND') { bi++; }
    else { merged.push(b); bi++; }
  }
  const layerData = {};
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
      if (block.vertices && block.vertices.length >= 2) layerData[layer].lineParts.push(block.vertices);
    }
  }
  const layerGroups = {};
  for (const [layer, data] of Object.entries(layerData)) {
    const cfg = LAYER_CONFIG[layer] || { color: 0xaaaaaa, opacity: 1.0 };
    const group = new THREE.Group();
    group.name = layer;
    if (cfg.yOffset) group.position.y = cfg.yOffset;
    for (const geom of data.meshParts) {
      const mat = new THREE.MeshBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: cfg.opacity < 1.0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      group.add(new THREE.Mesh(geom, mat));
      if (layer === 'buildings' || layer === 'topography') {
        const edges = new THREE.EdgesGeometry(geom, 15);
        const edgeMat = new THREE.LineBasicMaterial({ color: layer === 'buildings' ? 0x888888 : 0xa09070, opacity: 0.4, transparent: true });
        const edgeMesh = new THREE.LineSegments(edges, edgeMat);
        edgeMesh.renderOrder = 1;
        group.add(edgeMesh);
      }
    }
    for (const pts of data.lineParts) {
      const closed = pts.length > 2 && isClosed(pts);
      const threePts = pts.map(p => new THREE.Vector3(p.x, p.z, -p.y));
      const geom = new THREE.BufferGeometry().setFromPoints(closed ? [...threePts, threePts[0]] : threePts);
      group.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: cfg.opacity < 1.0 })));
    }
    if (group.children.length) layerGroups[layer] = group;
  }
  return layerGroups;
}

function parseMeshBlock(pairs, THREE) {
  let pi = 0;
  while (pi < pairs.length && pairs[pi].code !== 92) pi++;
  if (pi >= pairs.length) return null;
  const vertCount = parseInt(pairs[pi].val, 10); pi++;
  const vx = new Float32Array(vertCount);
  const vy = new Float32Array(vertCount);
  const vz = new Float32Array(vertCount);
  let vi = 0, tmpX = 0, tmpY = 0;
  while (pi < pairs.length && vi < vertCount) {
    const { code, val } = pairs[pi];
    if      (code === 10) { tmpX = parseFloat(val); }
    else if (code === 20) { tmpY = parseFloat(val); }
    else if (code === 30) { vx[vi] = tmpX; vy[vi] = tmpY; vz[vi] = parseFloat(val); vi++; }
    else if (code === 93) break;
    pi++;
  }
  if (vi < vertCount) return null;
  while (pi < pairs.length && pairs[pi].code !== 93) pi++;
  if (pi >= pairs.length) return null;
  const faceListCount = parseInt(pairs[pi].val, 10); pi++;
  const faceList = new Int32Array(faceListCount);
  let fi = 0;
  while (pi < pairs.length && fi < faceListCount) {
    if (pairs[pi].code === 90) faceList[fi++] = parseInt(pairs[pi].val, 10);
    pi++;
  }
  const positions = new Float32Array(vertCount * 3);
  for (let j = 0; j < vertCount; j++) {
    positions[j * 3] = vx[j]; positions[j * 3 + 1] = vz[j]; positions[j * 3 + 2] = -vy[j];
  }
  const indices = [];
  let fli = 0;
  while (fli < faceListCount) {
    const n = faceList[fli++];
    if      (n === 3) { indices.push(faceList[fli], faceList[fli+1], faceList[fli+2]); fli += 3; }
    else if (n === 4) { indices.push(faceList[fli], faceList[fli+1], faceList[fli+2]); indices.push(faceList[fli], faceList[fli+2], faceList[fli+3]); fli += 4; }
    else { fli += n; }
  }
  if (!indices.length) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function parseLWPolylineBlock(pairs) {
  let elevation = 0;
  const pts = [];
  let tmpX = null;
  for (const { code, val } of pairs) {
    if      (code === 38) elevation = parseFloat(val);
    else if (code === 10) tmpX = parseFloat(val);
    else if (code === 20 && tmpX !== null) { pts.push({ x: tmpX, y: parseFloat(val), z: elevation }); tmpX = null; }
  }
  return pts;
}

function isClosed(pts) {
  const a = pts[0], b = pts[pts.length - 1];
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}
