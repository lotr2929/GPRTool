# GPRTool Vision & Long-Range Architecture
_Read this at the start of every GPRTool session, before touching any code._
_Updated: 18 Apr 2026_

---

## What GPRTool is

A single unified platform for calculating Green Plot Ratio (GPR) across all
scales — building site to city. Scale is a zoom level, not a mode switch.

GPR measures three-dimensional urban greenery using Leaf Area Index (LAI).
Origin: Ong, B.L. (2003), Landscape and Urban Planning, 63(4), 197–211.

**Current state: approximately 20% complete. This is a Proof of Concept**
to gather interest and funding. All architectural decisions must keep the
full vision in mind, even while building incrementally.

---

## The business model (keep in mind — never code against it)

- GPRTool is free to use with full functionality
- No downloading without a subscription (or per-project payment)
- Free users: screen capture is their only extraction path
- Subscribed users can download: .gpr project file, GPR Report, landscaped DXF model, exports
- All projects saved server-side (Supabase) — users can resume work across sessions
- The subscription gate is the download gate — NOT a feature gate
- The GPR Report and .gpr file are the primary subscription value propositions
- Future: Landgate SLIP and authority overlays are a professional/commercial tier

Do NOT implement accounts, subscriptions, or download gates yet.
Do NOT let this delay or complicate the PoC build.
Do keep every architectural decision compatible with this model.

---

## The .gpr file format (do not implement yet — design only)

A .gpr file is a ZIP renamed to .gpr. GPRTool includes a built-in reader/writer.
Users never interact with the ZIP directly. The file is served from the server.

### Internal structure
```
site.gpr  (zip)
├── manifest.json        ← format_version, tool_version, date, site_name, gpr_score_summary
├── reference.json       ← UTM anchor, scene offset, WGS84 origin  [REAL WORLD]
├── boundary.geojson     ← lot boundary polygon in WGS84            [REAL WORLD]
├── context.geojson      ← CADMapper / OSM site context in WGS84    [REAL WORLD]
├── design.json          ← designNorthAngle, Design Grid settings    [DESIGN WORLD]
├── model/
│   ├── buildings.json   ← building volumes, heights, footprints
│   ├── landscape.json   ← planting areas, substrates, green roof types
│   └── plants.json      ← individual plant placements, species, LAI values
├── results/
│   ├── gpr_score.json   ← final GPR: per-layer breakdown, total score
│   └── gpr_report.html  ← self-contained HTML report (printable, shareable)
└── assets/
    └── (images referenced by the report)
```

### The two anchors
Every .gpr file has exactly two required files. All others are optional.

- **`manifest.json`** — identity and inventory. Read first, always. Declares
  format version, tool version, which sections are present. Without a valid
  manifest, GPRTool will not open the file.

- **`reference.json`** — coordinate anchor. Every piece of geometry in the
  project hangs off this single UTM/WGS84 point. Never changes once set.
  Allows GPRTool to zoom from a single tree to a city choropleth without
  losing its position in the real world.

The manifest tells GPRTool *what exists* in the file.
The reference tells GPRTool *where everything is* in the world.
Everything else is optional, additive, and scale-dependent.

### Key rules
- REAL WORLD data (reference, boundary, context) always in WGS84 GeoJSON
- DESIGN WORLD data (design.json) never contains geographic coordinates
- manifest.json carries format_version — reader must handle old versions gracefully
- gpr_report.html is self-contained — readable in any browser without GPRTool
- model/ and results/ folders only exist after design work is done
- A freshly created .gpr (from CADMapper or OSM import) has only manifest + reference + boundary + context + design
- **reference.json is the one immutable anchor** — all scene coordinates hang off it.
  Changing it is a deliberate re-anchoring operation, not a routine edit.
  If reference.json changes, everything in model/ must be regenerated.
- **Each file is independent** — GPRTool loads, edits, and saves any one file
  without touching the others. Building-scale work never contaminates site-scale
  data. City-scale zoom reads reference.json + boundary.geojson only — model/
  and results/ are ignored entirely at that scale.

### API endpoints (future — do not implement yet)
- POST /api/project/save     — serialise state → create/update .gpr in Supabase storage
- GET  /api/project/load/:id — read .gpr → return project state to browser
- GET  /api/project/download/:id — SUBSCRIPTION GATED — return .gpr as file download
- GET  /api/project/report/:id   — SUBSCRIPTION GATED — return HTML report

---

## The two data worlds (CAST IN STONE — already implemented)

### Real World
- All geographic data: CADMapper DXF, OSM, lot boundary, Landgate SLIP
- Always stored as WGS84 GeoJSON or UTM with explicit zone
- Never moves, rotates, or gets reinterpreted
- Single source of truth: real-world.js
- The coordinate anchor bridges Real World ↔ Three.js scene space

### Design World
- Overlays only: Design Grid, designNorthAngle, grid spacing
- Managed by design-grid.js and north-point-2d.js
- Never stores geographic coordinates
- Never imports from real-world.js

These two worlds must never collide. real-world.js is the gatekeeper.

---

## The three data sources (all produce identical .gpr structure)

| Source | Command | Context data | Notes |
|---|---|---|---|
| CADMapper DXF | Import from CADMapper | context.geojson from DXF | Requires free CADMapper account |
| OSM / Overpass | Select Map | context.geojson from OSM | Fully free, no account |
| Manual | (future) | User-drawn context | For sites not in OSM or CADMapper |

A CADMapper .gpr and an OSM .gpr for the same site should be structurally identical.
The rest of GPRTool (GPR calculation, planting, reporting) never knows which source was used.

---

## The scale model

GPRTool operates at three scales. Scale is a MapLibre zoom level, not a mode switch.
Three.js is a MapLibre custom layer — always present.

| Scale | Data | Purpose |
|---|---|---|
| Building / site | CADMapper DXF + Three.js + lot boundary | Design, plant placement, GPR calculation |
| Precinct | OSM building footprints + MapLibre + Turf.js | Precinct GPR choropleth |
| City | OSM + LAI lookup + MapLibre choropleth | City-scale GPR mapping |

At city scale, .gpr reference.json + boundary.geojson are the only data needed.
Buildings and plants are irrelevant at city scale.

---

## Platform stack (locked)

| Layer | Role | Cost |
|---|---|---|
| MapLibre + Mapbox | Primary GIS canvas, all zoom levels | Free tier |
| Three.js (MapLibre custom layer) | 3D design + GPR calculation | Free |
| OSM / Overpass | City-scale building footprints, green cover | Free forever |
| Turf.js | GIS calculations — polygon intersection, area | Free |
| CADMapper DXF | Site context geometry | Free up to 1 km² |
| Google Maps JS API | Site boundary picker panel ONLY | Free tier |
| proj4 / real-world.js | UTM ↔ WGS84 conversions | Built-in |
| Supabase | Project storage, user accounts (future) | Free tier |
| SLIP / cadastral APIs | Authority overlay, professional tier | Paid, future |

Google Maps is a convenience layer for the boundary picker only.
It does NOT replace MapLibre. The moment professional accuracy is needed,
SLIP or equivalent authority APIs replace the Google Maps boundary picker.

---

## What is NOT built yet (do not forget)

- [ ] .gpr file writer and reader
- [ ] Lot boundary picker (Google Maps + proj4 + DrawingManager)
- [ ] OSM Select Map command (Overpass → context.geojson → .gpr)
- [ ] Building tool (building volumes, heights, footprints)
- [ ] Landscape tool (planting areas, substrates)
- [ ] Plant placement tool (individual plants, LAI lookup)
- [ ] GPR calculation engine
- [ ] GPR Report generator
- [ ] MapLibre integration (Three.js as custom layer)
- [ ] City-scale precinct GPR choropleth
- [ ] User accounts and authentication
- [ ] Subscription / download gate
- [ ] Server-side .gpr storage (Supabase)
- [ ] NPoint "Set Design North" wired to Design Grid rotation
- [ ] Y-axis naming for Design Grid UI (unresolved, do not code yet)
- [ ] .gpr session save/load (DXF + UTM + layer state + Design North angle)
