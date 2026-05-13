import { state } from './state.js';

export function recalcGPR() {
  const gprEl     = document.getElementById('gpr-value');
  const numEl     = document.getElementById('gpr-numerator');
  const breakRow  = document.getElementById('gpr-breakdown-row');
  const targetEl  = document.getElementById('gpr-target');
  const resultRow = document.querySelector('.gpr-result');
  if (!gprEl) return;
  let numerator = 0;
  state.surfaces.forEach(s => {
    (s.plants || []).forEach(inst => {
      const sp = state.plantDb.find(p => p.id === inst.speciesId);
      if (sp && inst.canopyArea > 0) numerator += inst.canopyArea * sp.lai;
    });
  });
  let denom = state.siteAreaM2;
  if (!denom) denom = state.surfaces.filter(s => s.type === 'ground').reduce((acc, s) => acc + s.area, 0);
  if (denom <= 0 || numerator === 0) {
    gprEl.textContent = '\u2014';
    if (numEl)    numEl.textContent = '\u2014';
    if (breakRow) breakRow.style.display = 'none';
    if (resultRow) resultRow.classList.remove('over-target', 'under-target');
    updateClearBtn();
    return;
  }
  const gpr = numerator / denom;
  gprEl.textContent = gpr.toFixed(2);
  if (numEl)    numEl.textContent = numerator.toFixed(1) + ' m\u00b2';
  if (breakRow) breakRow.style.display = '';
  const target = parseFloat(targetEl?.value);
  if (!isNaN(target) && target > 0 && resultRow) {
    resultRow.classList.toggle('over-target', gpr >= target);
    resultRow.classList.toggle('under-target', gpr < target);
  }
  updateClearBtn();
}

export function updateClearBtn() {
  const anyPlanted = state.surfaces.some(s => (s.plants || []).length > 0);
  const clearBtn = document.getElementById('clearPlantsBtn');
  if (clearBtn) clearBtn.disabled = !anyPlanted;
}
