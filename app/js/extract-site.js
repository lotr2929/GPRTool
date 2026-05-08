// extract-site.js — Stage 3 of the GPRTool pipeline
// Clips buildings to the user-drawn rectangle, detects the road-enclosed site
// boundary around the design origin, and generates 1-metre contour lines.
//
// Called from app.js:
//   const { buildingCount, contourLevelCount, contourGroup, boundaryGroup } =
//       await extractSite(bounds, state.THREE);
//
// bounds : { xMin, xMax, zMin, zMax }  — scene space metres

import * as THREE from 'three';
import { hasRealWorldAnchor } from './real-world.js';
import { getSiteTerrainElevation } from './terrain.js';
import { state } from './state.js';
import { buildExtractDXF } from './dxf-writer.js';
import { addRawFileToGPR } from './gpr-file.js';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run road boundary detection on the current scene using the design origin
 * (or scene centre as fallback). Adds the boundary group to the scene.
 * Returns the boundary group or null.
 */
export function detectAndShowSiteBoundary() {
  if (!state.cadmapperGroup) return null;
  const T = state.THREE ?? THREE;

  // Use design origin or scene centre
  const origin = state.designOrigin ?? new T.Vector3(0, 0, 0);

  // Use full cadmapper extent as bbox
  const box = new T.Box3().setFromObject(state.cadmapperGroup);
  const boundary = _buildRoadBoundary(T, origin, box.min.x, box.max.x, box.min.z, box.max.z);

  if (boundary) {
    // Remove previous boundary if any
    const prev = state.cadmapperGroup.getObjectByName('site-boundary-group');
    if (prev) state.cadmapperGroup.remove(prev);
    state.cadmapperGroup.add(boundary);
  }
  return boundary;
}

export async function extractSite(bounds, _THREE) {
    // bounds = { xMin, xMax, zMin, zMax } in scene space (metres)
    const T = _THREE ?? THREE;

    if (!hasRealWorldAnchor()) {
        return { buildingCount: 0, contourLevelCount: 0, contourGroup: null };
    }

    const { xMin, xMax, zMin, zMax } = bounds;

    // 1. Count buildings whose centre falls inside the bounds
    let buildingCount = 0;
    const buildingsLayer = state.cadmapperGroup?.children.find(
        c => c.name === 'buildings'
    );
    if (buildingsLayer) {
        const box3 = new T.Box3();
        buildingsLayer.traverse(child => {
            if (!child.isMesh) return;
            box3.setFromObject(child);
            const cx = (box3.min.x + box3.max.x) * 0.5;
            const cz = (box3.min.z + box3.max.z) * 0.5;
            if (cx >= xMin && cx <= xMax && cz >= zMin && cz <= zMax) {
                buildingCount++;
            }
        });
    }

    // 3. Generate 1-metre contour lines from the terrain elevation model
    const { group: contourGroup, levelCount: contourLevelCount } =
        _buildContours(T, xMin, xMax, zMin, zMax);

    // 4. Detect road-enclosed site boundary around the design origin
    const origin = state.designOrigin ?? new T.Vector3(
        (xMin + xMax) * 0.5, 0, (zMin + zMax) * 0.5
    );
    const boundaryGroup = _buildRoadBoundary(T, origin, xMin, xMax, zMin, zMax);

    // 5. Build DXF and save to .gpr
    try {
        const dxfContent = buildExtractDXF(
            state.cadmapperGroup, contourGroup, xMin, xMax, zMin, zMax
        );
        await addRawFileToGPR('extract/site.dxf', dxfContent, 'extract/site.dxf');
        console.log('[Extract] DXF saved to .gpr');
    } catch (e) {
        console.warn('[Extract] DXF save failed:', e.message);
    }

    return { buildingCount, contourLevelCount, contourGroup, boundaryGroup };
}

// ── Contour generation ────────────────────────────────────────────────────────
// Uses marching squares on a grid sampled from getSiteTerrainElevation.
// Returns null contourGroup if no terrain data is available.

const GRID_N = 50; // 50×50 cells — ~2% of site span per sample

let _matContour = null;
function _contourMat() {
    if (!_matContour) {
        _matContour = new THREE.LineBasicMaterial({ color: 0x8b6414, linewidth: 1 });
    }
    return _matContour;
}

function _buildContours(T, xMin, xMax, zMin, zMax) {
    const dx = (xMax - xMin) / GRID_N;
    const dz = (zMax - zMin) / GRID_N;

    // Sample elevation on a (GRID_N+1) × (GRID_N+1) grid.
    // elev[iz][ix] = scene Y (metres); NaN when terrain unavailable.
    const elev = [];
    let eMin = Infinity, eMax = -Infinity, validCount = 0;

    for (let iz = 0; iz <= GRID_N; iz++) {
        const row = new Float32Array(GRID_N + 1);
        for (let ix = 0; ix <= GRID_N; ix++) {
            const e = getSiteTerrainElevation(xMin + ix * dx, zMin + iz * dz, null);
            if (e !== null && isFinite(e)) {
                row[ix] = e;
                if (e < eMin) eMin = e;
                if (e > eMax) eMax = e;
                validCount++;
            } else {
                row[ix] = NaN;
            }
        }
        elev.push(row);
    }

    if (validCount === 0 || !isFinite(eMin) || eMin === eMax) {
        return { group: null, levelCount: 0 };
    }

    const group      = new T.Group();
    group.name       = 'site-contours';
    let   levelCount = 0;

    const levelStart = Math.ceil(eMin);
    const levelEnd   = Math.floor(eMax);

    for (let level = levelStart; level <= levelEnd; level++) {
        const pts = _marchingSquares(elev, GRID_N, xMin, zMin, dx, dz, level);
        if (pts.length === 0) continue;

        const pos = new Float32Array(pts.length * 3);
        for (let i = 0; i < pts.length; i++) {
            pos[i * 3]     = pts[i].x;
            pos[i * 3 + 1] = level;
            pos[i * 3 + 2] = pts[i].z;
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        group.add(new THREE.LineSegments(geom, _contourMat()));
        levelCount++;
    }

    return { group: levelCount > 0 ? group : null, levelCount };
}

// ── Marching squares ─────────────────────────────────────────────────────────
// Returns a flat array of {x,z} points; every consecutive pair is a segment.
//
// Cell corners (iz=row/north→south, ix=col/west→east):
//   TL = elev[iz  ][ix  ]   TR = elev[iz  ][ix+1]
//   BL = elev[iz+1][ix  ]   BR = elev[iz+1][ix+1]
//
// Index = b0|(b1<<1)|(b2<<2)|(b3<<3)
//   b0 = TL >= level,  b1 = TR >= level,
//   b2 = BL >= level,  b3 = BR >= level
//
// Interpolated edge-crossing points:
//   ET (top)    z = iz*dz,     x interpolated along TL→TR
//   ER (right)  x = (ix+1)*dx, z interpolated along TR→BR
//   EB (bottom) z = (iz+1)*dz, x interpolated along BL→BR
//   EL (left)   x = ix*dx,     z interpolated along TL→BL
//
// By design, EL is only called when TL and BL have opposite above/below status,
// and similarly for the other edges — no division-by-zero risk.

function _marchingSquares(elev, N, xMin, zMin, dx, dz, level) {
    const pts = [];

    for (let iz = 0; iz < N; iz++) {
        for (let ix = 0; ix < N; ix++) {
            const eTL = elev[iz    ][ix    ];
            const eTR = elev[iz    ][ix + 1];
            const eBL = elev[iz + 1][ix    ];
            const eBR = elev[iz + 1][ix + 1];

            if (!isFinite(eTL) || !isFinite(eTR) || !isFinite(eBL) || !isFinite(eBR)) continue;

            const b0 = eTL >= level ? 1 : 0;
            const b1 = eTR >= level ? 1 : 0;
            const b2 = eBL >= level ? 1 : 0;
            const b3 = eBR >= level ? 1 : 0;
            const idx = b0 | (b1 << 1) | (b2 << 2) | (b3 << 3);

            if (idx === 0 || idx === 15) continue;

            const x0 = xMin +  ix      * dx;
            const x1 = xMin + (ix + 1) * dx;
            const z0 = zMin +  iz      * dz;
            const z1 = zMin + (iz + 1) * dz;

            // Lazy edge-crossing point factories
            const ET = () => ({ x: x0 + (level - eTL) / (eTR - eTL) * dx, z: z0 });
            const ER = () => ({ x: x1, z: z0 + (level - eTR) / (eBR - eTR) * dz });
            const EB = () => ({ x: x0 + (level - eBL) / (eBR - eBL) * dx, z: z1 });
            const EL = () => ({ x: x0, z: z0 + (level - eTL) / (eBL - eTL) * dz });

            switch (idx) {
                case  1: { const a=EL(),b=ET(); pts.push(a,b); break; } // TL only
                case  2: { const a=ET(),b=ER(); pts.push(a,b); break; } // TR only
                case  3: { const a=EL(),b=ER(); pts.push(a,b); break; } // TL+TR
                case  4: { const a=EL(),b=EB(); pts.push(a,b); break; } // BL only
                case  5: { const a=ET(),b=EB(); pts.push(a,b); break; } // TL+BL  (saddle→vertical)
                case  6: { const a=EL(),b=ER(); pts.push(a,b); break; } // TR+BL  (saddle→horizontal)
                case  7: { const a=ER(),b=EB(); pts.push(a,b); break; } // TL+TR+BL
                case  8: { const a=ER(),b=EB(); pts.push(a,b); break; } // BR only
                case  9: {                                               // TL+BR  (saddle→two segs)
                    const a=EL(),b=ET(); pts.push(a,b);
                    const c=ER(),d=EB(); pts.push(c,d);
                    break;
                }
                case 10: { const a=ET(),b=EB(); pts.push(a,b); break; } // TR+BR
                case 11: { const a=EL(),b=EB(); pts.push(a,b); break; } // TL+TR+BR (BL below)
                case 12: { const a=EL(),b=ER(); pts.push(a,b); break; } // BL+BR
                case 13: { const a=ET(),b=ER(); pts.push(a,b); break; } // TL+BL+BR (TR below)
                case 14: { const a=EL(),b=ET(); pts.push(a,b); break; } // TR+BL+BR (TL below)
            }
        }
    }
    return pts;
}

// ── Road boundary detection ───────────────────────────────────────────────────
// Casts rays from the design origin in 4 cardinal directions to find the first
// road segment in each direction. Builds a boundary polyline from the 4 hit
// points. Falls back to the bbox boundary if no roads are found.
//
// Roads are identified by traversing state.cadmapperGroup layers with
// highway-like names: 'roads', 'paths', 'highways', 'major roads', 'minor roads'.

const ROAD_LAYER_NAMES = ['roads', 'paths', 'highways', 'major roads', 'minor roads',
                          'major_roads', 'minor_roads'];

let _matBoundary = null;
function _boundaryMat() {
    if (!_matBoundary) _matBoundary = new THREE.LineBasicMaterial({
        color: 0xcc44cc, linewidth: 2, depthTest: false,  // magenta — distinct from red extract rect
    });
    return _matBoundary;
}

function _buildRoadBoundary(T, origin, xMin, xMax, zMin, zMax) {
    // Collect all road mesh edges within bbox
    const segs = _collectRoadSegments(xMin, xMax, zMin, zMax);

    // Cast rays from origin in ±X and ±Z to find enclosing boundary
    const N = _rayHit(origin, 0, -1, segs) ?? { x: (xMin + xMax) * 0.5, z: zMin };
    const S = _rayHit(origin, 0,  1, segs) ?? { x: (xMin + xMax) * 0.5, z: zMax };
    const E = _rayHit(origin,  1, 0, segs) ?? { x: xMax, z: (zMin + zMax) * 0.5 };
    const W = _rayHit(origin, -1, 0, segs) ?? { x: xMin, z: (zMin + zMax) * 0.5 };

    // Build closed polygon: NW → NE → SE → SW → NW
    const pts = [
        new T.Vector3(W.x, 0.15, N.z),
        new T.Vector3(E.x, 0.15, N.z),
        new T.Vector3(E.x, 0.15, S.z),
        new T.Vector3(W.x, 0.15, S.z),
        new T.Vector3(W.x, 0.15, N.z),   // close
    ];

    const geom = new T.BufferGeometry().setFromPoints(pts);
    const line = new T.Line(geom, _boundaryMat());
    line.name        = 'site-boundary';
    line.renderOrder = 995;

    const group = new T.Group();
    group.name = 'site-boundary-group';
    group.add(line);
    return group;
}

function _collectRoadSegments(xMin, xMax, zMin, zMax) {
    const segs = [];
    if (!state.cadmapperGroup) return segs;
    for (const layer of state.cadmapperGroup.children) {
        const name = (layer.name ?? '').toLowerCase();
        if (!ROAD_LAYER_NAMES.some(n => name.includes(n))) continue;
        layer.traverse(obj => {
            if (!obj.isLine && !obj.isLineSegments) return;
            const pos = obj.geometry?.attributes?.position;
            if (!pos) return;
            for (let i = 0; i < pos.count - 1; i++) {
                const ax = pos.getX(i), az = pos.getZ(i);
                const bx = pos.getX(i + 1), bz = pos.getZ(i + 1);
                // Only keep segments within or near the bbox
                if (Math.min(ax, bx) > xMax || Math.max(ax, bx) < xMin) continue;
                if (Math.min(az, bz) > zMax || Math.max(az, bz) < zMin) continue;
                segs.push({ ax, az, bx, bz });
            }
        });
    }
    return segs;
}

/** Cast a ray from origin in direction (dx, dz). Returns first intersection. */
function _rayHit(origin, dx, dz, segs) {
    const ox = origin.x, oz = origin.z;
    let best = null, bestDist = Infinity;

    for (const { ax, az, bx, bz } of segs) {
        // Ray: P = origin + t*(dx,dz)
        // Segment: Q = A + s*(B-A)
        const rx = bx - ax, rz = bz - az;
        const denom = dx * rz - dz * rx;
        if (Math.abs(denom) < 1e-9) continue;   // parallel

        const t = ((ax - ox) * rz - (az - oz) * rx) / denom;
        const s = ((ax - ox) * dz - (az - oz) * dx) / denom;

        if (t < 0.5 || s < 0 || s > 1) continue;  // t<0.5 = behind / too close
        if (t < bestDist) { bestDist = t; best = { x: ox + t * dx, z: oz + t * dz }; }
    }
    return best;
}
