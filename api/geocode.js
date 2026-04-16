/*
 * api/geocode.js — Vercel serverless proxy for Google Maps Geocoding API
 *
 * GET /api/geocode?address=30+Beaufort+Street+Perth+WA
 *
 * Returns:
 *   { results: [{ display_name, lat, lng, precise, types }] }
 *
 * Env var required:  GOOGLE_MAPS_API_KEY  (set in Vercel project settings)
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address parameter required' });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json`
      + `?address=${encodeURIComponent(address)}&key=${key}`;

    const upstream = await fetch(url);
    const data     = await upstream.json();

    if (data.status === 'REQUEST_DENIED') {
      return res.status(403).json({ error: 'API key invalid or quota exceeded' });
    }
    if (data.status !== 'OK' || !data.results?.length) {
      return res.status(404).json({ results: [], status: data.status });
    }

    const results = data.results.map(r => ({
      display_name: r.formatted_address,
      lat:     r.geometry.location.lat,
      lng:     r.geometry.location.lng,
      // precise = true when Google resolved to house/building level
      precise: r.types?.some(t =>
        ['street_address', 'premise', 'subpremise', 'establishment'].includes(t)
      ) ?? false,
      types: r.types,
    }));

    return res.status(200).json({ results });
  } catch (err) {
    console.error('geocode proxy error:', err);
    return res.status(502).json({ error: 'upstream fetch failed: ' + err.message });
  }
}
