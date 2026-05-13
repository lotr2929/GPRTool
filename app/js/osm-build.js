import { wgs84ToScene } from './real-world.js';
import { LAYER_CONFIG, ROAD_WIDTHS } from './osm-layer-config.js';

export function buildContourLines(points, intervalM, THREE) {
  if (!points?.length) return null;
  const xs = [...new Set(points.map(p => Math.round(p.x * 10) / 10))].sort((a,b) => a-b);
  const zs = [...new Set(points.map(p => Math.round(p.z * 10) / 10))].sort((a,b) => a-b);
  const grid = new Map();
  for (const p of points) grid.set(`${Math.round(p.x*10)/10},${Math.round(p.z*10)/10}`, p.y);
  const minE = Math.floor(Math.min(...points.map(p => p.y)) / intervalM) * intervalM;
  const maxE = Math.ceil(Math.max(...points.map(p => p.y)) / intervalM) * intervalM;
  const cfg = LAYER_CONFIG.contours;
  const group = new THREE.Group(); group.name = 'contours';
  if (cfg.yOffset) group.position.y = cfg.yOffset;
  for (let elev = minE; elev <= maxE; elev += intervalM) {
    const segments = [];
    for (let iz = 0; iz < zs.length - 1; iz++) {
      for (let ix = 0; ix < xs.length - 1; ix++) {
        const v00 = grid.get(`${xs[ix]},${zs[iz]}`), v10 = grid.get(`${xs[ix+1]},${zs[iz]}`);
        const v01 = grid.get(`${xs[ix]},${zs[iz+1]}`), v11 = grid.get(`${xs[ix+1]},${zs[iz+1]}`);
        if (v00===undefined||v10===undefined||v01===undefined||v11===undefined) continue;
        const lerp = (a, b, va, vb) => a + (b-a) * (elev-va)/(vb-va);
        const pts = [];
        if ((v00<elev) !== (v10<elev)) pts.push({ x: lerp(xs[ix],xs[ix+1],v00,v10), z: zs[iz] });
        if ((v10<elev) !== (v11<elev)) pts.push({ x: xs[ix+1], z: lerp(zs[iz],zs[iz+1],v10,v11) });
        if ((v01<elev) !== (v11<elev)) pts.push({ x: lerp(xs[ix],xs[ix+1],v01,v11), z: zs[iz+1] });
        if ((v00<elev) !== (v01<elev)) pts.push({ x: xs[ix], z: lerp(zs[iz],zs[iz+1],v00,v01) });
        if (pts.length >= 2) segments.push(pts[0], pts[1]);
      }
    }
    if (!segments.length) continue;
    const verts = new Float32Array(segments.length * 3);
    segments.forEach((p, i) => { verts[i*3]=p.x; verts[i*3+1]=elev; verts[i*3+2]=p.z; });
    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    group.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: true })));
  }
  return group.children.length ? group : null;
}

function buildBuilding(ring, height, THREE) {
  if (ring.length < 3) return null;
  const pts2D = ring.map(ll => { const sc = wgs84ToScene(ll.lat, ll.lng); return sc ? new THREE.Vector2(sc.x, -sc.z) : null; }).filter(Boolean);
  if (pts2D.length < 3) return null;
  const shape = new THREE.Shape(pts2D);
  const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);
  return geom;
}

function buildRoadPolygon(ring, halfWidth, THREE) {
  if (ring.length < 2) return null;
  const pts = ring.map(ll => { const sc = wgs84ToScene(ll.lat, ll.lng); return sc ? { x: sc.x, z: sc.z } : null; }).filter(Boolean);
  if (pts.length < 2) return null;
  const leftSide = [], rightSide = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i-1)], next = pts[Math.min(pts.length-1, i+1)];
    const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz) || 1;
    const nx = -dz/len, nz = dx/len;
    leftSide.push({ x: pts[i].x + nx * halfWidth, z: pts[i].z + nz * halfWidth });
    rightSide.push({ x: pts[i].x - nx * halfWidth, z: pts[i].z - nz * halfWidth });
  }
  return buildFlatPolygon([...leftSide, ...rightSide.reverse()], THREE);
}

function buildFlatPolygon(pts, THREE) {
  if (pts.length < 3) return null;
  const pts2D = pts.map(p => new THREE.Vector2(p.x, -p.z));
  const shape = new THREE.Shape(pts2D);
  const geom = new THREE.ShapeGeometry(shape);
  geom.rotateX(-Math.PI / 2);
  return geom;
}

function buildLine(ring, THREE) {
  const pts = ring.map(ll => { const sc = wgs84ToScene(ll.lat, ll.lng); return sc ? new THREE.Vector3(sc.x, 0, sc.z) : null; }).filter(Boolean);
  if (pts.length < 2) return null;
  return new THREE.BufferGeometry().setFromPoints(pts);
}

export function classifyWay(tags) {
  if (tags.building || tags['building:part']) return 'buildings';
  const hw = tags.highway;
  if (hw) {
    if (['motorway','trunk'].includes(hw)) return 'highways';
    if (['primary','secondary'].includes(hw)) return 'major_roads';
    if (['tertiary','residential','service','living_street','pedestrian'].includes(hw)) return 'minor_roads';
    if (['footway','cycleway','path','steps'].includes(hw)) return 'paths';
    return 'minor_roads';
  }
  if (tags.railway) return 'railways';
  const nat = tags.natural, wu = tags.waterway;
  if (nat === 'water' || nat === 'coastline' || wu) return 'water';
  const lu = tags.landuse, ls = tags.leisure;
  if (lu === 'forest' || lu === 'grass' || lu === 'meadow' || lu === 'park' || lu === 'recreation_ground' ||
      ls === 'park' || ls === 'garden' || ls === 'pitch' || ls === 'playground' || ls === 'nature_reserve') return 'parks';
  return null;
}

export function wayToLatLngs(el) {
  return el.geometry ? el.geometry.map(n => ({ lat: n.lat, lng: n.lon })) : [];
}

export function buildLayerGroups(osmData, THREE) {
  const groups = {};
  const getGroup = (key) => {
    if (!groups[key]) {
      const cfg = LAYER_CONFIG[key] || { color: 0xaaaaaa, opacity: 1.0, yOffset: 0 };
      groups[key] = new THREE.Group();
      groups[key].name = key;
      if (cfg.yOffset) groups[key].position.y = cfg.yOffset;
    }
    return groups[key];
  };
  for (const el of osmData.elements) {
    if (el.type !== 'way' && el.type !== 'relation') continue;
    const tags = el.tags || {};
    const layer = classifyWay(tags);
    if (!layer) continue;
    const ring = wayToLatLngs(el);
    if (ring.length < 2) continue;
    const cfg = LAYER_CONFIG[layer] || {};
    const grp = getGroup(layer);
    if (layer === 'buildings') {
      const rawH = parseFloat(tags.height) || (parseFloat(tags['building:levels']) * 3.5) || 6;
      const geom = buildBuilding(ring, rawH, THREE);
      if (geom) {
        grp.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: cfg.opacity < 1, side: THREE.DoubleSide })));
        grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom, 15), new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.4, transparent: true })));
      }
    } else if (['highways','major_roads','minor_roads','paths'].includes(layer)) {
      const w = (ROAD_WIDTHS[tags.highway || 'residential'] || 8) / 2;
      const geom = buildRoadPolygon(ring, w, THREE);
      if (geom) grp.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: cfg.opacity < 1, side: THREE.DoubleSide, depthWrite: false })));
    } else if (['parks','water'].includes(layer)) {
      const closed = ring.length > 2 && Math.abs(ring[0].lat - ring[ring.length-1].lat) < 0.000001;
      if (closed) {
        const pts = ring.map(ll => { const sc = wgs84ToScene(ll.lat, ll.lng); return sc ? { x: sc.x, z: sc.z } : null; }).filter(Boolean);
        const geom = buildFlatPolygon(pts, THREE);
        if (geom) grp.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: cfg.opacity < 1, side: THREE.DoubleSide, depthWrite: false })));
      } else {
        const geom = buildLine(ring, THREE);
        if (geom) grp.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color: cfg.color })));
      }
    } else {
      const geom = buildLine(ring, THREE);
      if (geom) grp.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: true })));
    }
  }
  return groups;
}

export function buildLayerGroupsFromGeoJSON(featureCollection, THREE) {
  if (!featureCollection?.features?.length) return {};
  const groups = {};
  const getGroup = (key) => {
    if (!groups[key]) {
      const cfg = LAYER_CONFIG[key] || { color: 0xaaaaaa, opacity: 1.0, yOffset: 0 };
      groups[key] = new THREE.Group(); groups[key].name = key;
      if (cfg.yOffset) groups[key].position.y = cfg.yOffset;
    }
    return groups[key];
  };
  for (const feat of featureCollection.features) {
    if (!feat?.geometry?.coordinates?.length) continue;
    const tags = feat.properties || {};
    const layer = tags._gprLayer || classifyWay(tags);
    if (!layer) continue;
    const rawCoords = feat.geometry.type === 'Polygon' ? feat.geometry.coordinates[0] : feat.geometry.coordinates;
    if (!rawCoords || rawCoords.length < 2) continue;
    const ring = rawCoords.map(([lng, lat]) => ({ lat, lng }));
    const cfg = LAYER_CONFIG[layer] || {}; const grp = getGroup(layer);
    if (layer === 'buildings') {
      const rawH = parseFloat(tags.height) || (parseFloat(tags['building:levels']) * 3.5) || 6;
      const geom = buildBuilding(ring, rawH, THREE);
      if (geom) { grp.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: cfg.opacity < 1, side: THREE.DoubleSide }))); grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom, 15), new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.4, transparent: true }))); }
    } else if (['highways','major_roads','minor_roads','paths'].includes(layer)) {
      const w = (ROAD_WIDTHS[tags.highway || 'residential'] || 8) / 2;
      const geom = buildRoadPolygon(ring, w, THREE);
      if (geom) grp.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: cfg.opacity < 1, side: THREE.DoubleSide, depthWrite: false })));
    } else if (['parks','water'].includes(layer)) {
      if (feat.geometry.type === 'Polygon') {
        const pts = ring.map(ll => { const sc = wgs84ToScene(ll.lat, ll.lng); return sc ? { x: sc.x, z: sc.z } : null; }).filter(Boolean);
        const geom = buildFlatPolygon(pts, THREE);
        if (geom) grp.add(new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: cfg.opacity < 1, side: THREE.DoubleSide, depthWrite: false })));
      } else {
        const geom = buildLine(ring, THREE); if (geom) grp.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color: cfg.color })));
      }
    } else {
      const geom = buildLine(ring, THREE); if (geom) grp.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: true })));
    }
  }
  return groups;
}

export function osmToGeoJSON(osmData) {
  const features = [];
  for (const el of osmData.elements) {
    if (el.type !== 'way') continue;
    const coords = (el.geometry || []).map(n => [n.lon, n.lat]);
    if (coords.length < 2) continue;
    const tags = el.tags || {};
    const layer = classifyWay(tags);
    const isClosed = coords.length >= 4 && Math.abs(coords[0][0] - coords[coords.length-1][0]) < 0.000001 && Math.abs(coords[0][1] - coords[coords.length-1][1]) < 0.000001;
    const geometry = isClosed ? { type: 'Polygon', coordinates: [coords] } : { type: 'LineString', coordinates: coords };
    features.push({ type: 'Feature', properties: { ...tags, _osmId: el.id, _osmType: el.type, _gprLayer: layer }, geometry });
  }
  return { type: 'FeatureCollection', features };
}

export function latLngToBbox(lat, lng, radiusM) {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}
