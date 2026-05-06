/*
 * north-angle.js — Angle parsing and formatting utilities
 *
 * Pure functions only. No DOM, no Three.js, no state.
 * Imported by north-state.js, north-input.js, and design-grid-tool.js.
 *
 * Accepts:  7  -7  +7  7W  7E  7.4  7.4W  7°22'  7°22'W  7d22'E
 * Returns:  decimal degrees (+ve = east / clockwise) or null on error.
 */

export function parseNorthAngle(str) {
  if (!str) return null;
  str = str.trim();

  let sign = 1;
  let s    = str.toUpperCase();

  if (s.endsWith('W'))      { sign = -1; s = s.slice(0, -1).trim(); }
  else if (s.endsWith('E')) { sign =  1; s = s.slice(0, -1).trim(); }

  if (s.startsWith('-'))      { sign = -1; s = s.slice(1).trim(); }
  else if (s.startsWith('+')) { sign =  1; s = s.slice(1).trim(); }

  // deg°min' or deg d min — e.g. "7°22'" or "7d22"
  const dmMatch = s.match(/^(\d+(?:\.\d+)?)[°d]\s*(\d+(?:\.\d+)?)'?\s*$/);
  if (dmMatch) {
    const d = parseFloat(dmMatch[1]);
    const m = parseFloat(dmMatch[2]);
    if (!isNaN(d) && !isNaN(m) && m < 60) return sign * (d + m / 60);
    return null;
  }

  const num = parseFloat(s);
  if (!isNaN(num) && s.match(/^[\d.]+$/)) return sign * num;

  return null;
}

// Spaced format for input fields — e.g. "7°22' W"
export function formatNorthAngle(deg) {
  if (deg === 0 || deg === null) return '0°';
  const abs      = Math.abs(deg);
  const dir      = deg > 0 ? 'E' : 'W';
  const wholeDeg = Math.floor(abs);
  const minFrac  = (abs - wholeDeg) * 60;
  const wholeMin = Math.round(minFrac);

  if (wholeMin === 0)  return `${wholeDeg}° ${dir}`;
  if (wholeMin === 60) return `${wholeDeg + 1}° ${dir}`;
  return `${wholeDeg}°${wholeMin}' ${dir}`;
}

// Compact format for compass label — e.g. "7°22'W"
export function formatNorthAngleCompact(deg) {
  if (deg === 0 || deg === null) return '0°';
  const abs      = Math.abs(deg);
  const dir      = deg > 0 ? 'E' : 'W';
  const wholeDeg = Math.floor(abs);
  const minFrac  = (abs - wholeDeg) * 60;
  const wholeMin = Math.round(minFrac);

  if (wholeMin === 0)  return `${wholeDeg}°${dir}`;
  if (wholeMin === 60) return `${wholeDeg + 1}°${dir}`;
  return `${wholeDeg}°${wholeMin}'${dir}`;
}
