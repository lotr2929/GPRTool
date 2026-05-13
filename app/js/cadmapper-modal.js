import { setRealWorldAnchor } from './real-world.js';
import { LAYER_CONFIG } from './cadmapper-layer-config.js';
import { parseCadmapperDXF } from './cadmapper-dxf.js';

const MODAL_HTML = `<div id="cadmapper-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:1100;align-items:center;justify-content:center;">
<div id="cadmapper-modal" style="background:var(--chrome-panel);border:1px solid var(--chrome-border);border-radius:6px;width:460px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,0.22);color:var(--text-primary);font-family:var(--font,'Outfit',sans-serif);overflow:hidden;">
<div style="padding:12px 16px;border-bottom:1px solid var(--chrome-border);display:flex;align-items:center;gap:10px;background:var(--chrome-dark,#1e3d1e);">
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.4"><path d="M3 12h10M8 3v7M5 7l3 3 3-3"/><rect x="1.5" y="11" width="13" height="2.5" rx="0.5"/></svg>
<h3 style="margin:0;font-size:13px;font-weight:600;flex:1;color:#fff;">Import from CADMapper</h3>
<span id="cadmapper-step-label" style="font-size:10px;color:rgba(255,255,255,0.5);margin-right:4px;">Step 1 of 2</span>
<button id="cadmapper-close" style="background:none;border:none;color:rgba(255,255,255,0.6);cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;">&#x2715;</button></div>
<div id="cadmapper-step1"><div style="padding:16px 18px 14px;border-bottom:1px solid var(--chrome-border);">
<p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:var(--text-secondary,#aaa);"><strong style="color:var(--text-primary);">CADMapper</strong> converts OpenStreetMap and NASA terrain data into layered DXF files. Download is <strong style="color:var(--accent-light,#90c890);">free up to 1 km&sup2;</strong> but requires a free account.</p>
<a href="https://cadmapper.com" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:var(--accent-mid,#4a8a4a);color:#fff;text-decoration:none;border-radius:4px;font-size:11px;font-weight:600;padding:5px 12px;">&#8599;&nbsp;Sign up at cadmapper.com</a></div>
<div style="padding:14px 18px 16px;font-size:12px;line-height:1.75;">${[1,2,3,4].map(n => `<div style="margin-bottom:11px;display:flex;gap:11px;align-items:flex-start;"><span style="min-width:20px;height:20px;border-radius:50%;flex-shrink:0;margin-top:1px;background:var(--accent-mid,#4a8a4a);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${n}</span><span>${['Sign up at cadmapper.com (free account required).','Select your site area, choose <strong>AutoCAD DXF</strong> format, and click Download.','On the download confirmation page, note your <strong>Spatial Reference System</strong>: copy the <strong>UTM Zone</strong>, <strong>Easting</strong>, and <strong>Northing</strong> values in that order.','Extract the downloaded <strong>.zip</strong> to get your <strong>.dxf</strong> file.'][n-1]}</span></div>`).join('')}</div>
<div style="padding:8px 18px 14px;border-top:1px solid var(--chrome-border);margin-top:2px;background:var(--accent-subtle,#eef4eb);font-size:10px;line-height:1.6;color:var(--text-secondary);"><strong style="color:var(--text-primary);font-size:10px;">Road widths (Austroads)</strong><br>Highways &amp; freeways: 3.5 m/lane (dual carriageway, ~20-30 m total) &nbsp;&middot;&nbsp; Major roads: 3.5 m/lane (~14-20 m) &nbsp;&middot;&nbsp; Minor roads: 3.0-3.5 m/lane (~10-14 m) &nbsp;&middot;&nbsp; Paths: footpath 1.5-2.0 m, shared 2.5-3.5 m.</div>
<div style="padding:10px 16px 14px;display:flex;justify-content:flex-end;border-top:1px solid var(--chrome-border);"><button id="cadmapper-proceed-btn" style="background:var(--accent-mid,#4a8a4a);color:#fff;border:none;border-radius:4px;font-size:12px;padding:7px 18px;cursor:pointer;white-space:nowrap;">Proceed &#8594;</button></div></div>
<div id="cadmapper-step2" style="display:none;">
<div style="padding:14px 16px;border-bottom:1px solid var(--chrome-border);"><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:6px;">DXF File (from cadmapper.com)</label>
<div style="display:flex;gap:8px;align-items:center;"><span id="cadmapper-filename" style="flex:1;font-size:12px;color:var(--text-secondary);background:var(--chrome-input);border:1px solid var(--chrome-border);border-radius:4px;padding:6px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">No file selected</span>
<button id="cadmapper-file-btn" style="background:var(--chrome-panel-alt);color:var(--text-primary);border:1px solid var(--chrome-border);border-radius:4px;font-size:12px;padding:6px 12px;cursor:pointer;white-space:nowrap;">Browse&#8230;</button>
<input type="file" id="cadmapper-file-input" accept=".dxf" style="display:none"></div></div>
<div style="padding:14px 16px;border-bottom:1px solid var(--chrome-border);"><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:2px;">Spatial Reference System</label>
<div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">From your CADMapper download page</div>
<div style="display:flex;gap:8px;"><div style="width:80px;"><div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">UTM Zone</div><input id="cadmapper-zone" type="number" placeholder="e.g. 50" style="width:100%;box-sizing:border-box;background:var(--chrome-input);border:1px solid var(--chrome-border);border-radius:4px;color:var(--text-primary);font-size:12px;padding:5px 8px;outline:none;"></div>
<div style="flex:1;"><div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">Easting (m)</div><input id="cadmapper-easting" type="number" placeholder="e.g. 388500" style="width:100%;box-sizing:border-box;background:var(--chrome-input);border:1px solid var(--chrome-border);border-radius:4px;color:var(--text-primary);font-size:12px;padding:5px 8px;outline:none;"></div>
<div style="flex:1;"><div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">Northing (m)</div><input id="cadmapper-northing" type="number" placeholder="e.g. -3535933" style="width:100%;box-sizing:border-box;background:var(--chrome-input);border:1px solid var(--chrome-border);border-radius:4px;color:var(--text-primary);font-size:12px;padding:5px 8px;outline:none;"></div></div></div>
<div style="padding:12px 16px;border-bottom:1px solid var(--chrome-border);"><div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">Layers to import</div>
<div style="display:flex;flex-wrap:wrap;gap:6px 14px;">${Object.entries(LAYER_CONFIG).map(([k, v]) => `<label style="font-size:11px;display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="cadmapper-layer-cb" data-layer="${k}" checked style="accent-color:var(--accent-mid,#4a8a4a);">${v.label}</label>`).join('')}</div></div>
<div style="padding:10px 16px;display:flex;align-items:center;gap:8px;"><button id="cadmapper-back-btn" style="background:none;color:var(--text-secondary);border:1px solid var(--chrome-border);border-radius:4px;font-size:12px;padding:6px 12px;cursor:pointer;white-space:nowrap;">&#8592; Back</button>
<span id="cadmapper-status" style="flex:1;font-size:11px;color:var(--text-secondary);">Select a DXF file to import.</span>
<button id="cadmapper-import-btn" disabled style="background:var(--accent-mid,#4a8a4a);color:#fff;border:none;border-radius:4px;font-size:12px;padding:6px 14px;cursor:pointer;opacity:0.5;white-space:nowrap;">Import</button></div></div></div></div>`;

let _callbacks = null;
let _dxfFile = null;

export function initCADMapperImport(callbacks) {
  _callbacks = callbacks;
  document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
  document.getElementById('importCADMapperBtn').addEventListener('click', openModal);
  document.getElementById('cadmapper-close').addEventListener('click', closeModal);
  document.getElementById('cadmapper-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('cadmapper-overlay')) closeModal();
  });
  document.getElementById('cadmapper-proceed-btn').addEventListener('click', showStep2);
  document.getElementById('cadmapper-back-btn').addEventListener('click', showStep1);
  document.getElementById('cadmapper-file-btn').addEventListener('click', () => document.getElementById('cadmapper-file-input').click());
  document.getElementById('cadmapper-file-input').addEventListener('change', onFileSelected);
  document.getElementById('cadmapper-import-btn').addEventListener('click', runImport);
}

function openModal() { showStep1(); document.getElementById('cadmapper-overlay').style.display = 'flex'; }
function closeModal() { document.getElementById('cadmapper-overlay').style.display = 'none'; }
function showStep1() {
  document.getElementById('cadmapper-step1').style.display = 'block';
  document.getElementById('cadmapper-step2').style.display = 'none';
  document.getElementById('cadmapper-step-label').textContent = 'Step 1 of 2';
}
function showStep2() {
  document.getElementById('cadmapper-step1').style.display = 'none';
  document.getElementById('cadmapper-step2').style.display = 'block';
  document.getElementById('cadmapper-step-label').textContent = 'Step 2 of 2';
}
function setStatus(msg, isError = false) {
  const el = document.getElementById('cadmapper-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#e06060' : 'var(--text-secondary)';
}
function onFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  _dxfFile = file;
  document.getElementById('cadmapper-filename').textContent = file.name;
  document.getElementById('cadmapper-filename').style.color = 'var(--text-primary)';
  document.getElementById('cadmapper-import-btn').disabled = false;
  document.getElementById('cadmapper-import-btn').style.opacity = '1';
  setStatus(`Ready: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
  e.target.value = '';
}
async function runImport() {
  if (!_dxfFile) return;
  const easting  = parseFloat(document.getElementById('cadmapper-easting').value);
  const northing = parseFloat(document.getElementById('cadmapper-northing').value);
  const zoneNum  = parseInt(document.getElementById('cadmapper-zone').value.trim(), 10);
  if (!isNaN(easting) && !isNaN(northing) && zoneNum > 0) setRealWorldAnchor(zoneNum, easting, northing);
  const selectedLayers = new Set([...document.querySelectorAll('.cadmapper-layer-cb:checked')].map(cb => cb.dataset.layer));
  setStatus('Reading DXF\u2026');
  document.getElementById('cadmapper-import-btn').disabled = true;
  document.getElementById('cadmapper-import-btn').style.opacity = '0.5';
  try {
    const text = await _dxfFile.text();
    const layerGroups = parseCadmapperDXF(text, selectedLayers, _callbacks.THREE);
    if (!layerGroups || !Object.keys(layerGroups).length) throw new Error('No geometry found in selected layers');
    closeModal();
    _callbacks.onLayersLoaded(layerGroups, _dxfFile);
  } catch (err) {
    setStatus('Import failed: ' + err.message, true);
    document.getElementById('cadmapper-import-btn').disabled = false;
    document.getElementById('cadmapper-import-btn').style.opacity = '1';
    console.error('GPRTool cadmapper-import:', err);
  }
}
