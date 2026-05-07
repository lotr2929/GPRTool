#!/usr/bin/env node
/**
 * _assist.mjs — GPRTool session assistant
 *
 * Commands:
 *   node _assist.mjs health     — check Supabase, env vars, last deployment
 *   node _assist.mjs status     — print current status from journal
 *   node _assist.mjs audit      — scan codebase for known issues
 *   node _assist.mjs refresh    — regenerate _map.md from actual file structure
 *
 * Run at the start of every session BEFORE any code work.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEV  = path.join(ROOT, '_dev');
const APP  = path.join(ROOT, 'app', 'js');
const API  = path.join(ROOT, 'api');

// ── Helpers ───────────────────────────────────────────────────────────────

function readEnv() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8').split('\n')
      .map(l => l.match(/^([^#=\s][^=]*)=["']?([^"'\n]*)["']?$/))
      .filter(Boolean).map(m => [m[1].trim(), m[2].trim()])
  );
}

function readFile(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function bold(s)  { return `\x1b[1m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }
function red(s)   { return `\x1b[31m${s}\x1b[0m`; }
function yellow(s){ return `\x1b[33m${s}\x1b[0m`; }
function cyan(s)  { return `\x1b[36m${s}\x1b[0m`; }

// ── HEALTH ────────────────────────────────────────────────────────────────

async function cmdHealth() {
  console.log(bold('\n── GPRTool Health Check ─────────────────────────────'));

  const env = readEnv();

  // 1. Env vars
  const required = {
    GPRTOOL_SUPABASE_URL:              env.GPRTOOL_SUPABASE_URL,
    GPRTOOL_SUPABASE_PUBLISHABLE_KEY:  env.GPRTOOL_SUPABASE_PUBLISHABLE_KEY,
    GOOGLE_MAPS_API_KEY:               env.GOOGLE_MAPS_API_KEY,
  };
  let envOk = true;
  for (const [k, v] of Object.entries(required)) {
    if (v) {
      console.log(green(`  ✓ ${k}`));
    } else {
      console.log(red(`  ✗ ${k} — MISSING`));
      envOk = false;
    }
  }

  // 2. Supabase ping
  console.log(bold('\n  Supabase'));
  const sbUrl = env.GPRTOOL_SUPABASE_URL;
  const sbKey = env.GPRTOOL_SUPABASE_PUBLISHABLE_KEY;
  if (!sbUrl || !sbKey) {
    console.log(red('  ✗ Cannot check — env vars missing'));
  } else {
    try {
      const res = await fetch(
        `${sbUrl}/rest/v1/gpr_projects?select=id&limit=1`,
        { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
      );
      const text = await res.text();
      if (res.ok) {
        let count = '?';
        try { count = JSON.parse(text).length; } catch {}
        console.log(green(`  ✓ Active — gpr_projects accessible (${count} row sample)`));
      } else if (res.status === 503 || text.includes('pause') || text.includes('suspend')) {
        console.log(red(`  ✗ PROJECT PAUSED — resume at supabase.com/dashboard`));
      } else if (res.status === 401 || res.status === 403) {
        console.log(red(`  ✗ Auth error ${res.status} — check anon key + RLS policies`));
        console.log(yellow(`    Detail: ${text.slice(0, 200)}`));
      } else if (res.status === 404) {
        console.log(red(`  ✗ 404 — gpr_projects table not found`));
      } else {
        console.log(yellow(`  ? HTTP ${res.status}: ${text.slice(0, 150)}`));
      }
    } catch (err) {
      console.log(red(`  ✗ Network error — ${err.message}`));
    }
  }

  // 3. Vercel — check via API
  console.log(bold('\n  Vercel'));
  const token     = env.VERCEL_TOKEN || readEnv().VERCEL_TOKEN;
  const projectId = 'prj_oioZB5jSKFHb99IZcSxZutIcjufi';
  const teamId    = 'team_HOoYAXfWxiVyXa3jQ6ieKaGE';
  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      const d = data.deployments?.[0];
      if (d) {
        const state = d.state === 'READY' ? green('READY') : yellow(d.state);
        console.log(`  ✓ Last deployment: ${state} — ${d.url} (${new Date(d.createdAt).toLocaleString()})`);
      }
    } else {
      console.log(yellow(`  ? Vercel API returned ${res.status} — check token`));
    }
  } catch (err) {
    console.log(yellow(`  ? Cannot reach Vercel API — ${err.message}`));
  }

  // 4. package.json / vercel.json sanity
  console.log(bold('\n  Config files'));
  const pkg = readFile(path.join(ROOT, 'package.json'));
  if (pkg) {
    const p = JSON.parse(pkg);
    if (p.type === 'module') {
      console.log(red('  ✗ package.json has "type":"module" — REMOVE IT (breaks Vercel CJS functions)'));
    } else {
      console.log(green(`  ✓ package.json — ${JSON.stringify(p)}`));
    }
  } else {
    console.log(yellow('  ? No package.json'));
  }

  // 5. API files CJS check
  console.log(bold('\n  API files (CJS check)'));
  for (const f of fs.readdirSync(API).filter(f => f.endsWith('.js'))) {
    const src = readFile(path.join(API, f));
    if (src?.includes('export default')) {
      console.log(red(`  ✗ ${f} — uses "export default" (ESM) — must use module.exports =`));
    } else if (src?.includes('module.exports')) {
      console.log(green(`  ✓ ${f} — CJS`));
    } else {
      console.log(yellow(`  ? ${f} — no handler export found`));
    }
  }

  console.log('');
}

// ── STATUS ────────────────────────────────────────────────────────────────

function cmdStatus() {
  const journal = readFile(path.join(DEV, '_journal.md'));
  if (!journal) { console.log(red('No _journal.md found')); return; }

  // Find last ## Session block
  const sessions = journal.split(/^## Session/m);
  const last = '## Session' + sessions[sessions.length - 1];

  // Extract status section
  const statusMatch = last.match(/### Status([\s\S]*?)(?=###|$)/);
  const pendingMatch = last.match(/### (?:Next session priorities|Pending)([\s\S]*?)(?=###|$)/);
  const titleMatch   = last.match(/^## Session[^\n]*\n\*\*Date:\*\* ([^\n]+)/m) ||
                       last.match(/^## Session — ([^\n]+)/m);

  console.log(bold('\n── GPRTool Session Status ───────────────────────────'));
  if (titleMatch) console.log(cyan(`  Last session: ${titleMatch[1]}`));

  if (statusMatch) {
    console.log(bold('\n  Current status:'));
    console.log(statusMatch[1].trim().split('\n').map(l => '  ' + l).join('\n'));
  }
  if (pendingMatch) {
    console.log(bold('\n  Pending for next session:'));
    console.log(pendingMatch[1].trim().split('\n').map(l => '  ' + l).join('\n'));
  }
  console.log('');
}

// ── AUDIT ─────────────────────────────────────────────────────────────────

function cmdAudit() {
  console.log(bold('\n── GPRTool Feature Audit ────────────────────────────'));

  const appJs = readFile(path.join(APP, 'app.js')) || '';

  // Find "coming soon" actions
  const comingSoon = [];
  const wired      = [];
  const handlers   = appJs.match(/else if \(action === '([^']+)'\)[^\n]+/g) || [];
  for (const h of handlers) {
    const action = h.match(/'([^']+)'/)?.[1];
    if (!action) continue;
    if (h.includes('coming soon')) comingSoon.push(action);
    else wired.push(action);
  }

  console.log(bold('\n  Wired menu actions:'));
  for (const a of wired) console.log(green(`  ✓ ${a}`));

  console.log(bold('\n  "Coming soon" / unimplemented:'));
  for (const a of comingSoon) console.log(red(`  ✗ ${a}`));

  // Scan for TODO/stub patterns
  const todos = [];
  for (const f of fs.readdirSync(APP).filter(f => f.endsWith('.js'))) {
    const src = readFile(path.join(APP, f)) || '';
    const lines = src.split('\n');
    lines.forEach((l, i) => {
      if (/TODO|FIXME|coming soon|stub|placeholder|not yet|unimplemented/i.test(l)) {
        todos.push(`${f}:${i + 1}  ${l.trim()}`);
      }
    });
  }
  if (todos.length) {
    console.log(bold(`\n  TODOs / stubs in source (${todos.length}):`));
    for (const t of todos.slice(0, 30)) console.log(yellow(`  ${t}`));
    if (todos.length > 30) console.log(yellow(`  ... and ${todos.length - 30} more`));
  }
  console.log('');
}

// ── REFRESH ───────────────────────────────────────────────────────────────

async function cmdRefresh() {
  console.log(bold('\n── Refreshing reference files ───────────────────────'));

  // Regenerate ref_.slim file index from actual directory
  const jsFiles = fs.readdirSync(path.join(ROOT, 'app', 'js'))
    .filter(f => f.endsWith('.js'))
    .sort();
  const apiFiles = fs.readdirSync(path.join(ROOT, 'api'))
    .filter(f => f.endsWith('.js'))
    .sort();

  const jsLines  = jsFiles.map(f  => `app/js/${f}`).join('\n');
  const apiLines = apiFiles.map(f => `api/${f}`).join('\n');

  // Read first line of each JS module to get a brief description
  const describe = (f) => {
    const src = readFile(f) || '';
    const m = src.match(/\/\*\*?\s*\n?\s*\*?\s*([^\n*]{10,80})/);
    return m ? m[1].trim().slice(0, 60) : '';
  };

  const jsTable = jsFiles.map(f => {
    const desc = describe(path.join(ROOT, 'app', 'js', f));
    return `app/js/${f.padEnd(28)} ← ${desc}`;
  }).join('\n');

  console.log(green(`  ✓ Found ${jsFiles.length} app/js/ files, ${apiFiles.length} api/ files`));

  // Update timestamp in _map.md
  let map = readFile(path.join(DEV, '_map.md')) || '';
  map = map.replace(/\*\*Last updated:\*\* [\d\-]+.*/, `**Last updated:** ${new Date().toISOString().slice(0,10)} (auto-regenerated by _assist refresh)`);
  fs.writeFileSync(path.join(DEV, '_map.md'), map);
  console.log(green('  ✓ _map.md timestamp updated'));

  console.log(yellow('  ℹ  Full _map.md and ref_.funcs regeneration: run manually when module list changes significantly'));
  console.log('');
}

// ── DISPATCH ─────────────────────────────────────────────────────────────

const cmd = process.argv[2] ?? 'help';
if      (cmd === 'health')  await cmdHealth();
else if (cmd === 'status')  cmdStatus();
else if (cmd === 'audit')   cmdAudit();
else if (cmd === 'refresh') cmdRefresh();
else {
  console.log(`
GPRTool _Assist — session tool

  node _assist.mjs health    check Supabase, env vars, Vercel, API files
  node _assist.mjs status    show current status from journal
  node _assist.mjs audit     scan codebase for unimplemented features
  node _assist.mjs refresh   regenerate _map.md (stub)
`);
}
