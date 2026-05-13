const _IDB_NAME = 'gprtool_overpass_cache';
const _IDB_STORE = 'queries';
const _CACHE_TTL = 24 * 60 * 60 * 1000;

function _openCacheDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(_IDB_STORE, { keyPath: 'key' });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function _bboxKey(bbox, radius) {
  return `${bbox.south.toFixed(4)},${bbox.west.toFixed(4)},${bbox.north.toFixed(4)},${bbox.east.toFixed(4)},${radius}`;
}

async function _getCached(key) {
  try {
    const db = await _openCacheDB();
    const req = db.transaction(_IDB_STORE).objectStore(_IDB_STORE).get(key);
    return await new Promise((res, rej) => {
      req.onsuccess = e => { const r = e.target.result; if (r && r.expires > Date.now()) res(r.data); else res(null); };
      req.onerror = e => rej(e.target.error);
    });
  } catch { return null; }
}

async function _setCached(key, data) {
  try {
    const db = await _openCacheDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(_IDB_STORE, 'readwrite');
      tx.objectStore(_IDB_STORE).put({ key, data, expires: Date.now() + _CACHE_TTL });
      tx.oncomplete = res;
      tx.onerror    = e => rej(e.target.error);
    });
  } catch {}
}

export function buildOverpassQuery(bbox) {
  const { south, west, north, east } = bbox;
  return `[out:json][timeout:45];(way["building"](${south},${west},${north},${east});way["highway"](${south},${west},${north},${east});way["landuse"="grass"||"forest"||"park"||"meadow"||"orchard"||"vineyard"](${south},${west},${north},${east});way["leisure"="park"||"garden"||"pitch"||"playground"||"golf_course"](${south},${west},${north},${east});way["natural"="water"||"wood"||"scrub"||"grassland"||"heath"](${south},${west},${north},${east});way["waterway"="river"||"stream"||"canal"](${south},${west},${north},${east});way["railway"](${south},${west},${north},${east}););out geom;`;
}

export async function fetchOverpass(query) {
  const url = `/api/overpass?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Overpass API error ${res.status}`);
  const data = await res.json();
  if (!data?.elements?.length) throw new Error('No OSM data returned');
  return data;
}

export { _bboxKey, _getCached, _setCached };
