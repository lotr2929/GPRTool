/*
 * api/overpass.js — Server-side Overpass API proxy
 *
 * Proxies Overpass queries through Vercel's server IP, avoiding browser-level
 * rate limits (HTTP 403). In-memory cache avoids redundant fetches for the
 * same bounding box within a warm lambda instance.
 *
 * POST /api/overpass   body: { query: string }
 */

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const _cache    = new Map();
const TTL_MS    = 60 * 60 * 1000; // 1 hour
const HEADERS   = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent':   'GPRTool/1.0 (green-plot-ratio; contact@gprtool.app)',
  'Accept':       'application/json',
};

function hashQuery(q) {
  let h = 0;
  for (let i = 0; i < q.length; i++) h = (Math.imul(31, h) + q.charCodeAt(i)) | 0;
  return h.toString(36);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { query } = req.body || {};
  if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Missing query' });

  const key    = hashQuery(query);
  const cached = _cache.get(key);
  if (cached && cached.expires > Date.now()) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached.data);
  }

  let lastErr = null;
  for (const url of ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
        const upstream = await fetch(url, {
          method:  'POST',
          headers: HEADERS,
          body:    'data=' + encodeURIComponent(query),
          signal:  AbortSignal.timeout(55000),
        });
        if (!upstream.ok) { lastErr = new Error(`${url} → ${upstream.status}`); continue; }
        const data = await upstream.json();
        _cache.set(key, { data, expires: Date.now() + TTL_MS });
        res.setHeader('X-Cache', 'MISS');
        return res.status(200).json(data);
      } catch (err) {
        lastErr = err;
      }
    }
  }

  return res.status(502).json({ error: 'All Overpass endpoints failed', detail: lastErr?.message });
}
