export const MODAL_HTML = `<div id="osm-overlay" style="display:none;position:fixed;top:52px;left:0;right:0;z-index:1100;pointer-events:none;">
<div id="osm-phase-a" style="pointer-events:all;margin:0 auto;max-width:720px;background:var(--chrome-panel,#f0f0f0);border:1px solid var(--chrome-border,rgba(0,0,0,0.2));border-top:none;border-radius:0 0 8px 8px;box-shadow:0 6px 24px rgba(0,0,0,0.5);overflow:hidden;">
<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--chrome-dark,#1e3d1e);color:#fff;">
<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#90c890" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c-2 2-3 4-3 6s1 4 3 6M8 2c2 2 3 4 3 6s-1 4-3 6"/></svg>
<span style="font-size:12px;font-weight:600;">Locate Site</span><span id="osm-pick-hint-a" style="font-size:11px;color:#90c890;flex:1;">&#8595; Or click anywhere on the 3D map</span>
<button id="osm-identify-btn" type="button" title="Toggle: click to identify a building" style="background:none;border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:rgba(255,255,255,0.85);cursor:pointer;font-size:11px;padding:3px 9px;margin-right:6px;display:flex;align-items:center;gap:5px;"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4.5M8 4.5v0.01" stroke-linecap="round"/></svg>Identify</button>
<button id="osm-close-a" type="button" style="background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;font-size:18px;line-height:1;padding:0 4px;">&#x2715;</button></div>
<div style="padding:12px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
<input id="osm-address" type="text" placeholder="Search address\u2026" style="flex:2;min-width:160px;background:var(--chrome-input,#fff);border:1px solid var(--chrome-border,#ccc);border-radius:4px;color:var(--text-primary,#222);font-size:12px;padding:5px 10px;outline:none;" onkeydown="if(event.key==='Enter') document.getElementById('osm-search-btn').click()">
<button id="osm-search-btn" type="button" style="background:var(--accent-mid,#4a8a4a);color:#fff;border:none;border-radius:4px;font-size:11px;padding:5px 12px;cursor:pointer;white-space:nowrap;">Search</button>
<div style="display:flex;align-items:center;gap:5px;"><span style="font-size:10px;color:var(--text-secondary,#666);">Lat</span><input id="osm-lat" type="number" step="any" placeholder="-" style="width:100px;background:var(--chrome-input,#fff);border:1px solid var(--chrome-border,#ccc);border-radius:4px;color:var(--text-primary,#222);font-size:11px;padding:4px 8px;outline:none;"><span style="font-size:10px;color:var(--text-secondary,#666);">Lng</span><input id="osm-lng" type="number" step="any" placeholder="-" style="width:110px;background:var(--chrome-input,#fff);border:1px solid var(--chrome-border,#ccc);border-radius:4px;color:var(--text-primary,#222);font-size:11px;padding:4px 8px;outline:none;"></div>
<span id="osm-status-a" style="font-size:11px;color:var(--accent-mid,#4a8a4a);min-width:120px;"></span></div></div>
<div id="osm-phase-b" style="display:none;pointer-events:all;margin:0 auto;max-width:720px;background:var(--chrome-panel,#f0f0f0);border:1px solid var(--chrome-border,rgba(0,0,0,0.2));border-top:none;border-radius:0 0 8px 8px;box-shadow:0 6px 24px rgba(0,0,0,0.5);overflow:hidden;">
<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--chrome-dark,#1e3d1e);color:#fff;">
<button id="osm-back-btn" type="button" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.3);color:#fff;cursor:pointer;font-size:11px;padding:3px 10px;border-radius:3px;">&larr; Back</button>
<span style="font-size:12px;font-weight:600;">Import OSM Context</span><span id="osm-coords-display" style="font-size:11px;color:#90c890;flex:1;font-family:monospace;"></span>
<button id="osm-close-b" type="button" style="background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;font-size:18px;line-height:1;padding:0 4px;">&#x2715;</button></div>
<div style="padding:12px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
<span style="font-size:11px;color:var(--text-secondary,#666);">Radius:</span>
<select id="osm-radius" style="font-size:11px;background:var(--chrome-input,#fff);border:1px solid var(--chrome-border,#ccc);border-radius:4px;padding:4px 8px;color:var(--text-primary,#222);outline:none;"><option value="250">250 m</option><option value="500" selected>500 m</option><option value="750">750 m</option><option value="1000">1 km</option></select>
<span id="osm-pick-hint-b" style="font-size:11px;color:var(--text-secondary,#666);flex:1;">Click the map to reposition, then Import</span>
<span id="osm-status-b" style="font-size:11px;color:var(--accent-mid,#4a8a4a);min-width:120px;"></span>
<button id="osm-import-btn" type="button" style="background:var(--accent-mid,#4a8a4a);color:#fff;border:none;border-radius:4px;font-size:12px;padding:6px 18px;cursor:pointer;white-space:nowrap;">Import</button></div></div></div>`;

export function closeModal() {
  document.getElementById('osm-overlay').style.display = 'none';
  stopLocationPick();
  stopIdentifyPick();
}

import { stopLocationPick, stopIdentifyPick } from './cesium-viewer.js';
