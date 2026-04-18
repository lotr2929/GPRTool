/*
 * api/projects.js — GPRTool project repository
 *
 * Routes:
 *   POST /api/projects?action=save   — save or update a .gpr project
 *   GET  /api/projects?action=list   — list all projects (name, date, size, has_boundary)
 *   GET  /api/projects?action=load&id=UUID — load full .gpr data for a project
 *   POST /api/projects?action=delete — delete a project by id
 *
 * Storage: Supabase table `gpr_projects`
 * Env vars: GPRTOOL_SUPABASE_URL, GPRTOOL_SUPABASE_KEY
 */

const SB_URL = process.env.GPRTOOL_SUPABASE_URL;
const SB_KEY = process.env.GPRTOOL_SUPABASE_KEY;

function sbHeaders() {
  return {
    'apikey':        SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };
}

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...sbHeaders(), ...(opts.headers || {}) },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const action = req.query.action;

  // ── LIST ────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'list') {
    const { ok, data, status } = await sbFetch(
      'gpr_projects?select=id,site_name,dxf_filename,file_size_bytes,has_boundary,wgs84_lat,wgs84_lng,created_at,updated_at&order=updated_at.desc'
    );
    if (!ok) return res.status(status).json({ error: 'Failed to list projects', detail: data });
    return res.status(200).json({ projects: data });
  }

  // ── LOAD ─────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'load') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { ok, data, status } = await sbFetch(`gpr_projects?id=eq.${id}&select=*`);
    if (!ok || !data?.length) return res.status(404).json({ error: 'Project not found' });
    return res.status(200).json({ project: data[0] });
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'save') {
    const { id, site_name, dxf_filename, gpr_data, file_size_bytes,
            has_boundary, wgs84_lat, wgs84_lng } = req.body;

    if (!site_name || !gpr_data) return res.status(400).json({ error: 'site_name and gpr_data required' });

    const payload = {
      site_name, dxf_filename, gpr_data, file_size_bytes,
      has_boundary: !!has_boundary, wgs84_lat, wgs84_lng,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      // Update existing
      result = await sbFetch(`gpr_projects?id=eq.${id}`, {
        method: 'PATCH', body: JSON.stringify(payload),
      });
    } else {
      // Insert new
      result = await sbFetch('gpr_projects', {
        method: 'POST', body: JSON.stringify(payload),
      });
    }
    if (!result.ok) return res.status(result.status).json({ error: 'Save failed', detail: result.data });
    const saved = Array.isArray(result.data) ? result.data[0] : result.data;
    return res.status(200).json({ project: saved });
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'delete') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { ok, status } = await sbFetch(`gpr_projects?id=eq.${id}`, { method: 'DELETE' });
    if (!ok) return res.status(status).json({ error: 'Delete failed' });
    return res.status(200).json({ deleted: id });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
