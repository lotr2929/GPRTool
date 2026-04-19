/*
 * api/maps-key.js — serve Google Maps API key to the browser
 * Used by the OSM import site picker (Google Maps click-to-locate).
 * GET /api/maps-key → { key: string }
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });
  return res.status(200).json({ key });
}
