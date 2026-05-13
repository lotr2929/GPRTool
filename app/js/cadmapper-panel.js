import { LAYER_CONFIG } from './cadmapper-layer-config.js';

export function buildLayerPanel(layerGroups, container) {
  const existing = document.getElementById('cadmapper-layer-section');
  if (existing) existing.remove();
  const section = document.createElement('div');
  section.id = 'cadmapper-layer-section';
  section.innerHTML = '<div class="section-header" style="font-size:11px;font-weight:600;padding:8px 10px;border-bottom:1px solid var(--chrome-border,#3a3a3a);display:flex;align-items:center;gap:6px"><span style="opacity:0.5">\u25b8</span> Layers <span class="layer-count" style="font-weight:400;font-size:10px;color:var(--text-secondary,#888)"></span></div><div class="layer-list" style="padding:2px 0"></div>';
  const listEl = section.querySelector('.layer-list');
  const countEl = section.querySelector('.layer-count');
  let total = 0;
  for (const [name, group] of Object.entries(layerGroups)) {
    const cfg = LAYER_CONFIG[name];
    if (!cfg) continue;
    appendLayerToPanel(name, group, listEl);
    total += group.children.length || 1;
  }
  if (countEl) countEl.textContent = `(${total} objects)`;
  const target = container ? document.getElementById(container) : document.getElementById('right-panel');
  if (target) target.appendChild(section);
}

export function appendLayerToPanel(name, group, listEl) {
  const cfg = LAYER_CONFIG[name];
  const row = document.createElement('label');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:11px;cursor:pointer';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = true;
  cb.style.cssText = 'accent-color:var(--accent-mid,#4a8a4a);flex-shrink:0';
  cb.addEventListener('change', () => { group.visible = cb.checked; });
  const swatch = document.createElement('span');
  swatch.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;background:#${cfg.color.toString(16).padStart(6,'0')};flex-shrink:0`;
  const label = document.createElement('span');
  label.textContent = cfg.label;
  label.style.cssText = 'flex:1;color:var(--text-primary,#e8e8e8)';
  row.append(cb, swatch, label);
  if (listEl) listEl.appendChild(row);
  else {
    const section = document.getElementById('cadmapper-layer-section');
    if (section) section.querySelector('.layer-list')?.appendChild(row);
  }
}

export { LAYER_CONFIG };
