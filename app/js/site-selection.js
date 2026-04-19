/*
 * site-selection.js — Select Site command
 *
 * Needs: drawSiteBoundary (from index.html, passed in via initSiteSelection)
 * Exposes: initSiteSelection(drawSiteBoundaryFn)
 *
 * Flow:
 *   1. User clicks "Select Site…"
 *   2. Modal opens with address search box
 *   3. Nominatim geocodes address → lat/lng
 *   4. Overpass API fetches nearest landuse/building polygon
 *   5. GeoJSON result passed to drawSiteBoundaryFn
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const GEOCODE_PROXY = '/api/geocode'; // Vercel serverless — Google Maps key stays server-side

// ── Modal HTML — uses GPRTool light theme CSS variables ───────────────────
const MODAL_HTML = `
<div id="site-select-overlay" style="
  display:none; position:fixed; inset:0;
  background:rgba(0,0,0,0.4); z-index:1100;
  align-items:center; justify-content:center;">
  <div id="site-select-modal" style="
    background:var(--chrome-panel,#f0efed);
    border:1px solid var(--chrome-border,#d0cec9);
    border-radius:6px; width:480px; max-width:95vw;
    box-shadow:0 8px 32px rgba(0,0,0,0.18);
    color:var(--text-primary,#1a1a1a);
    font-family:var(--font,'Outfit',sans-serif);
    overflow:hidden;">

    <!-- Header -->
    <div style="padding:12px 16px; border-bottom:1px solid var(--chrome-border,#d0cec9);
                display:flex; align-items:center; gap:10px;
                background:var(--chrome-dark,#1e3d1e);">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
           stroke="#ffffff" stroke-width="1.4">
        <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z"/>
        <circle cx="8" cy="6" r="1.5"/>
      </svg>
      <h3 style="margin:0; font-size:13px; font-weight:600; flex:1;
                 color:#ffffff;">Select Site</h3>
      <button id="site-select-close" style="
        background:none; border:none; color:rgba(255,255,255,0.7);
        cursor:pointer; font-size:18px; line-height:1; padding:2px 6px;">&#x2715;</button>
    </div>

    <!-- Search row -->
    <div style="padding:12px 16px; border-bottom:1px solid var(--chrome-border,#d0cec9);
                display:flex; gap:8px;">
      <input id="site-address-input" type="text"
        placeholder="Enter address (e.g. 30 Beaufort Street Perth WA)&#x2026;"
        autocomplete="off"
        style="flex:1; background:var(--chrome-input,#fafaf9);
               border:1px solid var(--chrome-border,#d0cec9); border-radius:4px;
               color:var(--text-primary,#1a1a1a); font-size:12px;
               padding:6px 10px; outline:none;
               font-family:var(--font,'Outfit',sans-serif);">
      <button id="site-search-btn" style="
        background:var(--accent,#4a7c3f); color:#fff;
        border:none; border-radius:4px; font-size:12px;
        padding:6px 14px; cursor:pointer; white-space:nowrap;">Search</button>
    </div>

    <!-- Results list -->
    <div id="site-results-list" style="
      max-height:220px; overflow-y:auto; padding:6px 8px; min-height:40px;
      background:var(--chrome-panel,#f0efed);">
      <p id="site-results-hint" style="
        font-size:11px; color:var(--text-secondary,#5a5a5a);
        padding:8px; margin:0;">
        Type an address and click Search.
      </p>
    </div>

    <!-- Status / action row -->
    <div style="padding:10px 16px; border-top:1px solid var(--chrome-border,#d0cec9);
                display:flex; align-items:center; gap:8px;
                background:var(--chrome-panel-alt,#e8e7e4);">
      <span id="site-select-status" style="
        flex:1; font-size:11px; color:var(--text-secondary,#5a5a5a);">
        &nbsp;
      </span>
      <button id="site-load-btn" disabled style="
        background:var(--accent,#4a7c3f); color:#fff;
        border:none; border-radius:4px; font-size:12px;
        padding:6px 14px; cursor:pointer; opacity:0.4;">Load Site</button>
    </div>

    <!-- Data note -->
    <div style="padding:6px 16px 10px; font-size:10px;
                color:var(--text-muted,#8a8a8a);">
      Parcel data: OpenStreetMap. For survey-accurate WA boundaries, use SLIP (coming soon).
    </div>
  </div>
</div>`;

// ── Module state ───────────────────────────────────────────────────────────
let _drawSiteBoundary = null;
let _onSiteSelected   = null;
let _selectedResult   = null;  // { display_name, lat, lng }
let _pinLat           = null;  // exact geocoded lat for pin placement
let _pinLng           = null;  // exact geocoded lng for pin placement

// ── Init ───────────────────────────────────────────────────────────────────
export function initSiteSelection({ drawSiteBoundary, onSiteSelected }) {
  _drawSiteBoundary = drawSiteBoundary;
  _onSiteSelected   = onSiteSelected || null;

  document.body.insertAdjacentHTML('beforeend', MODAL_HTML);

  document.getElementById('selectSiteBtn')
    ?.addEventListener('click', openModal);
  document.getElementById('site-select-close')
    .addEventListener('click', closeModal);
  document.getElementById('site-select-overlay')
    .addEventListener('click', e => {
      if (e.target === document.getElementById('site-select-overlay')) closeModal();
    });
  document.getElementById('site-search-btn')
    .addEventListener('click', runSearch);
  document.getElementById('site-address-input')
    .addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
  document.getElementById('site-load-btn')
    .addEventListener('click', loadSelected);
}

// ── Modal open / close ─────────────────────────────────────────────────────
function openModal() {
  const overlay = document.getElementById('site-select-overlay');
  overlay.style.display = 'flex';
  document.getElementById('site-address-input').focus();
  _selectedResult = null;
  setStatus('\u00a0');
  document.getElementById('site-load-btn').disabled = true;
  document.getElementById('site-load-btn').style.opacity = '0.4';
}

function closeModal() {
  document.getElementById('site-select-overlay').style.display = 'none';
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('site-select-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--danger,#b03a2e)' : 'var(--text-secondary,#5a5a5a)';
}

// ── Geocode with Nominatim ─────────────────────────────────────────────────
async function runSearch() {
  const query = document.getElementById('site-address-input').value.trim();
  if (!query) return;

  setStatus('Searching\u2026');
  document.getElementById('site-results-list').innerHTML =
    '<p style="font-size:11px;color:var(--text-secondary,#5a5a5a);padding:8px;margin:0;">Searching\u2026</p>';
  _selectedResult = null;
  document.getElementById('site-load-btn').disabled = true;
  document.getElementById('site-load-btn').style.opacity = '0.4';

  try {
    // Try Google Maps Geocoding via Vercel proxy (precise house-level results)
    let results = await geocodeGoogle(query);

    // Fall back to Nominatim if proxy not available (local dev without key)
    if (!results.length) {
      results = await geocodeNominatim(query);
    }

    if (!results.length) {
      setStatus('No results found. Try a more specific address.', true);
      document.getElementById('site-results-list').innerHTML =
        '<p style="font-size:11px;color:var(--text-secondary,#5a5a5a);padding:8px;margin:0;">No results found.</p>';
      return;
    }

    renderResults(results);
    setStatus(`${results.length} result${results.length > 1 ? 's' : ''} \u2014 select one below`);
  } catch (err) {
    setStatus('Search failed: ' + err.message, true);
    console.error('GPRTool site-selection: search error', err);
  }
}

// Google Maps via Vercel proxy — precise, house-level results
async function geocodeGoogle(query) {
  try {
    const res = await fetch(`${GEOCODE_PROXY}?address=${encodeURIComponent(query)}`);
    if (res.status === 500) return []; // key not configured — fall back silently
    if (!res.ok) return [];
    const data = await res.json();
    // Sort: precise (house/building) results first
    return (data.results || []).sort((a, b) => (b.precise ? 1 : 0) - (a.precise ? 1 : 0));
  } catch {
    return []; // network error — fall back to Nominatim
  }
}

// Nominatim fallback
async function geocodeNominatim(query) {
  const results = await nominatimSearch(
    `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
  );
  return results.sort((a, b) => {
    const aHouse = a.address?.house_number ? 0 : 1;
    const bHouse = b.address?.house_number ? 0 : 1;
    if (aHouse !== bHouse) return aHouse - bHouse;
    return bboxArea(a) - bboxArea(b);
  });
}

function bboxArea(r) {
  if (!r.boundingbox) return 9999;
  const [s, n, w, e] = r.boundingbox.map(Number);
  return (n - s) * (e - w);
}

async function nominatimSearch(url) {
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'GPRTool/1.0' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Render geocode results ─────────────────────────────────────────────────
function renderResults(results) {
  const list = document.getElementById('site-results-list');
  list.innerHTML = '';

  results.forEach(r => {
    const item = document.createElement('div');
    item.style.cssText = `
      padding:8px 10px; border-radius:4px; cursor:pointer;
      font-size:12px; display:flex; align-items:flex-start; gap:8px;
      border:1px solid transparent; margin-bottom:2px;
      color:var(--text-primary,#1a1a1a);`;
    item.innerHTML = `
      <svg style="flex-shrink:0;margin-top:2px;color:var(--accent,#4a7c3f)"
           width="12" height="12" viewBox="0 0 16 16" fill="none"
           stroke="currentColor" stroke-width="1.5">
        <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z"/>
        <circle cx="8" cy="6" r="1.5"/>
      </svg>
      <span style="flex:1;line-height:1.4">${r.display_name}</span>`;

    item.addEventListener('mouseenter', () => {
      if (_selectedResult?.display_name !== r.display_name) {
        item.style.background = 'var(--chrome-hover,#dce8d8)';
      }
    });
    item.addEventListener('mouseleave', () => {
      if (_selectedResult?.display_name !== r.display_name) {
        item.style.background = '';
      }
    });
    item.addEventListener('click', () => {
      list.querySelectorAll('div').forEach(el => {
        el.style.background = '';
        el.style.border = '1px solid transparent';
      });
      item.style.background = 'var(--accent-subtle,#e8f0e5)';
      item.style.border = '1px solid var(--accent,#4a7c3f)';

      _selectedResult = {
        display_name: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon)
      };
      document.getElementById('site-load-btn').disabled = false;
      document.getElementById('site-load-btn').style.opacity = '1';
      setStatus(`Selected: ${r.display_name.split(',').slice(0, 2).join(',')}`);
    });
    list.appendChild(item);
  });
}

// ── Fetch parcel from Overpass — with one retry on 5xx ────────────────────
// Uses is_in(lat,lon) to find polygons that actually CONTAIN the point,
// not just polygons nearby. This ensures the geocoded address is inside
// the returned parcel, not at its edge.
async function fetchParcel(lat, lng) {
  const query = `
[out:json][timeout:15];
(
  way["landuse"](around:150,${lat},${lng});
  way["building"](around:150,${lat},${lng});
  way["amenity"](around:150,${lat},${lng});
)->.candidates;
.candidates out geom;`;

  const body = 'data=' + encodeURIComponent(query);
  const opts  = {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  };

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  let lastErr = null;
  for (const url of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(timer);
      if (res.status >= 500) { lastErr = new Error(`Overpass HTTP ${res.status}`); continue; }
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

      const data = await res.json();
      if (!data.elements?.length) return null;

      // Build candidates list
      const candidates = data.elements
        .filter(el => el.type === 'way' && el.geometry?.length >= 3)
        .map(el => {
          const coords = el.geometry.map(n => [n.lon, n.lat]);
          if (coords[0][0] !== coords[coords.length - 1][0] ||
              coords[0][1] !== coords[coords.length - 1][1]) coords.push(coords[0]);
          const areaDeg = polygonAreaDeg(coords);
          const areaM2  = areaDeg * 111320 * 111320 * Math.cos(lat * Math.PI / 180);
          return {
            el, coords, areaM2,
            contains:   pointInPolygon(lat, lng, coords),
            isLanduse:  !!el.tags?.landuse,
            isBuilding: !!el.tags?.building,
          };
        })
        .filter(c => c.areaM2 >= 50 && c.areaM2 <= 50000);

      if (!candidates.length) return null;

      // Priority: polygons that CONTAIN the origin, smallest first (parcel beats block)
      // Fall back to nearest polygon if none contain the origin.
      const containing = candidates.filter(c => c.contains).sort((a, b) => a.areaM2 - b.areaM2);
      const nearby     = candidates.sort((a, b) => a.areaM2 - b.areaM2);
      const pool       = containing.length ? containing : nearby;

      // Within the pool: prefer landuse, then building, then other
      const best =
        pool.find(c => c.isLanduse)  ||
        pool.find(c => c.isBuilding) ||
        pool[0];

      if (!best) return null;
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [best.coords] },
        properties: { ...best.el.tags, _areaM2: Math.round(best.areaM2) }
      };
    } catch (err) {
      clearTimeout(timer);
      lastErr = err.name === 'AbortError' ? new Error(`Overpass timeout (${url})`) : err;
    }
  }
  throw lastErr || new Error('All Overpass endpoints failed');
}

// ── Point-in-polygon test (ray casting, [lon,lat] coords) ────────────────
function pointInPolygon(lat, lng, coords) {
  // coords = [[lon,lat], ...] closed ring
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1];
    const xj = coords[j][0], yj = coords[j][1];
    const intersect = ((yi > lat) !== (yj > lat))
      && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── Rough polygon area in degrees² (for sorting only) ─────────────────────
function polygonAreaDeg(coords) {
  let area = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    area += (coords[j][0] + coords[i][0]) * (coords[j][1] - coords[i][1]);
  }
  return Math.abs(area / 2);
}

// ── Load selected result ───────────────────────────────────────────────────
async function loadSelected() {
  if (!_selectedResult) return;
  const { lat, lng, display_name } = _selectedResult;

  setStatus('Fetching parcel boundary\u2026');
  document.getElementById('site-load-btn').disabled = true;
  document.getElementById('site-load-btn').style.opacity = '0.4';

  try {
    const geojson = await fetchParcel(lat, lng);

    if (!geojson) {
      // Fallback: ~50m × 50m box around the geocoded point
      setStatus('No parcel found \u2014 using approximate boundary', true);
      const d = 0.0005; // ~50m at Perth latitude
      _drawSiteBoundary([
        [lng - d, lat - d], [lng + d, lat - d],
        [lng + d, lat + d], [lng - d, lat + d],
        [lng - d, lat - d]
      ], { originLat: lat, originLng: lng });
      if (_onSiteSelected) _onSiteSelected(lat, lng);
      closeModal();
      return;
    }

    const coords = geojson.geometry.coordinates[0];
    _drawSiteBoundary(coords, { originLat: lat, originLng: lng });
    if (_onSiteSelected) _onSiteSelected(lat, lng);
    closeModal();
    console.log(`GPRTool site-selection: loaded ${areaM2} m² parcel (${coords.length - 1} points)`);
  } catch (err) {
    // Overpass failed — offer the fallback box so user isn't stuck
    setStatus('Parcel fetch failed \u2014 loading approximate boundary instead', true);
    console.warn('GPRTool site-selection: Overpass error, using fallback', err);
    const d = 0.0005;
    _drawSiteBoundary([
      [lng - d, lat - d], [lng + d, lat - d],
      [lng + d, lat + d], [lng - d, lat + d],
      [lng - d, lat - d]
    ], { originLat: lat, originLng: lng });
    if (_onSiteSelected) _onSiteSelected(lat, lng);
    setTimeout(closeModal, 1500);
  }
}
