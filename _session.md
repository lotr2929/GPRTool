# GPRTool-Demo — Session Status

> **Update this file at the end of every session.**
> Keep it short — just enough for Claude or Boon to resume without re-reading the whole journal.

---

## Session 5 — 2026-03-26 ✅ COMPLETE

### Summary
Repo cleanup, site research, import format decisions, documentation.
App confirmed in order. Deployed to Vercel end of session.

### What was done
- Repo cleaned — dead files moved to `_archive/`
- `_map.md` created — full repo structure reference
- `_session.md` created — this file
- `start.bat` rewritten — simple, no backend
- 30 Beaufort Street researched — planning, sustainability, GPR
- `test-data/30_Beaufort_Street_Site_Analysis.docx` created
- `test-data/30_Beaufort_Street_GPR_Recommendations.docx` created
- `test-data/30_beaufort_street_parcel.geojson` downloaded from Landgate SLIP
- Import format decisions: GeoJSON (done), DXF (next), OBJ (done), IFC (later)
- Deployed to Vercel: https://gprtool-demo.vercel.app

### App state at end of session
**Works:**
- ✅ GeoJSON site boundary import → orange outline + cream fill, area/perimeter in right panel
- ✅ OBJ import (unit auto-detection mm/cm/m)
- ✅ glTF/GLB import
- ✅ Surface detection: coplanar patches, normal classification (ground/roof/wall/sloped)
- ✅ Surface hover + selection (raycaster 3D, list click)
- ✅ 2D surface canvas (orthographic, Ortho/Surface modes)
- ✅ Plant library modal (56 species, search, filter, LAI badges, source badges)
- ✅ Multi-instance plant model per surface, editable canopy area
- ✅ GPR calculation: Σ(canopyArea × LAI) / siteAreaM2
- ✅ 2D/3D mode toggle, keyboard shortcuts, collapsible panels
- ✅ Edge overlay on imported models

**Stubbed (not yet built):**
- ❌ IFC import
- ❌ DXF import
- ❌ Image underlay + scale calibration
- ❌ All Building panel drawing tools (Rectangle, Polygon, Extrude etc.)
- ❌ Landscape panel tools (Planting Bed, Wall, Component Library)
- ❌ GPR Report PDF export
- ❌ Terrain layer (OpenTopography SRTM)
- ❌ Landgate SLIP address lookup
- ❌ .gpr session save/load
- ❌ Module split (index.html is 115 KB monolith — deferred to Phase 3)

---

## Next Session — Where to Start

1. **Verify Vercel deploy** — open https://gprtool-demo.vercel.app, confirm app loads
2. **Test GeoJSON import** — import `test-data/30_beaufort_street_parcel.geojson`
   - Expected: site boundary renders in 2D view
   - Expected area: ~9,579 m²
   - Expected perimeter: ~390 m
   - Expected vertices: 19
3. **Review GeoJSON visual** — Boon was previously unhappy with appearance; agree on desired style
4. **DXF import** — implement DXF site boundary parser (next feature priority)

---

## Key Reference

| Item | Value |
|---|---|
| Live URL | https://gprtool-demo.vercel.app |
| Local dev | `start.bat` → http://localhost:8000 |
| Demo site | 30 Beaufort Street, Perth WA 6000 |
| Site GeoJSON | `test-data/30_beaufort_street_parcel.geojson` |
| Landgate land_id | 1818174 |
| GitHub | https://github.com/lotr2929/GPRTool-Demo.git |
| Three.js | r160 (local copy in `frontend/js/`) |
| Deploy | run `deploy.bat` from project root |
