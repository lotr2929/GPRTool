# GPRTool Development Journal

**Project**: GPRToolDemo  
**Collaborators**: Boon (domain expert) + Claude (development partner)  
**Live URL**: https://gprtooldemo.onrender.com/  
**Repository**: https://github.com/lotr2929/GPRToolDemo.git  
**Local path**: C:\GPRToolDemo  

---

## How to use this journal

- **Planned** — decisions made, not yet started
- **In Progress** — actively being worked on
- **Done** — completed and deployed or committed
- Each entry dated. Most recent at top.

---

## What GPR Is — The Foundation

*This section exists so the purpose of this project is never lost in the implementation details.*

**Green Plot Ratio (GPR)** measures how much green leaf area a development provides relative to the site area it occupies. It answers one question: *how much nature did this building give back?*

Urban development replaces permeable, biodiverse land with hard surfaces. GPR is the mechanism for quantifying and requiring compensation — not just ground coverage, but the full three-dimensional green volume a site generates. A building with a green roof, vertical gardens, and a landscaped podium can exceed the green value of the undeveloped site it replaced. That is the ambition.

### Environmental impacts GPR quantifies
- **Urban heat island** — leaf area drives evapotranspiration and shading
- **Biodiversity** — canopy structure and species richness
- **Stormwater** — interception and absorption
- **Carbon sequestration** — directly tied to leaf area and biomass
- **Air quality** — particulate capture, oxygen production
- **Human wellbeing** — the evidence base connecting green exposure to health outcomes

### Why the calculation is hard
Most green metrics count area — square metres of grass, number of trees. GPR counts *leaf area*, which is a proxy for all the ecological functions above. A mature *Ficus* tree and a lawn of the same footprint are not ecologically equivalent. GPR captures that difference. But only if the LAI values feeding the calculation are valid for the actual urban conditions — which is exactly the gap this tool fills.

### What GPRTool is — and is not
**GPRTool is a living, urban-context LAI database with a CAD delivery layer.**

The 3D visualiser, input forms, calculation engine, and web interface are scaffolding — they exist to make GPR accessible to architects and planners who need to demonstrate compliance or optimise a design. That scaffolding is important but replaceable.

The LAI database and the urban adjustment methodology are not replaceable. That is where the years of research live. That is the IP.

---

## Core Vision (clarified 2026-03-17)

### The scientific gap GPRTool fills
Existing LAI databases (ORNL, TRY) were built for ecological and forestry research — open-ground, natural or plantation conditions. Urban greenery operates under fundamentally different constraints:
- **Root volume restriction** reduces LAI in street trees by 30–50% vs open-ground
- **Substrate depth** determines species choice and mature LAI for rooftop gardens
- **Light levels** in atriums and north-facing walls alter leaf morphology and density
- **Wind exposure** on rooftops stresses plants and reduces canopy density
- **Vertical greenery** requires LAI measured per unit wall area — a different metric entirely
- **Podium gardens** — structural loading constrains substrate depth and species

None of the 760 species in our current database were measured in these urban conditions. Every value carries a hidden assumption: natural or plantation setting.

**The gap:** Urban-context LAI values, with adjustment factors or direct urban measurements, organised by installation type (rooftop, vertical, atrium, street tree, podium) and climate zone. This does not yet exist as an open, auditable resource.

### The Tan & Sia 2009 connection
The PDF in the GPR - LAI Values folder is one of very few sources that addresses urban LAI specifically for GPR calculation in a tropical context. It is the foundational reference. Its species list and values must be cross-referenced against the current database and given priority weighting.

---

## Mobius Factory Integration (planned)

A **Urban Greenery & LAI Knowledge Layer** is a natural Mobius Factory module.

### What the Factory crawls
- Peer-reviewed urban LAI measurements — rooftop gardens, vertical greenery, street trees, podium planting
- Singapore NParks and BCA technical guidelines on GPR
- Hong Kong BEAM Plus green coverage studies
- Urban heat island studies with embedded LAI data
- European and Australian urban greening standards
- Living wall manufacturer plant performance data
- Papers citing Tan & Sia 2009 and related GPR literature

### What comes back
Not just LAI values — but urban context metadata:
- Substrate depth, light level/aspect, installation type, climate zone
- Measurement methodology and source citation

### Architecture
- Factory crawls and evaluates → stores structured findings in Supabase
- `Module: Urban Greenery` command in Mobius pulls live knowledge base
- GPRTool's `lai_data.py` periodically updated from Factory output
- The database becomes self-improving and citable

### Why this is publishable IP
Every LAI value traceable to source, methodology, and urban context. Defensible in planning submissions. Referenceable in academic papers. The first open, auditable, urban-context LAI database with a transparent calculation framework.

---

## Current Status

**As of 2026-03-17**

GPRTool is a working demo. Core loop functional: dimensions in → 3D box generated → OBJ downloadable. The LAI database pipeline is built. The urban-context science layer is the next frontier.

---

## What Has Been Done ✅

- Basic 3D box generation, OBJ export, Three.js visualisation
- Production deployment to Render, local dev environment, Git setup
- Comprehensive dev guide (_devguide.md)
- Full LAI database pipeline built and run (4 scripts)
- 760 species processed, categorised, tropical-flagged

### LAI Database — Final Category Counts
| Category          | Count | Notes |
|-------------------|-------|-------|
| Tree              | 248   | Core species library |
| Multi-Species     | 323   | Planning-level benchmarks |
| REVIEW            |  55   | Boon to categorise manually |
| Generic-Benchmark |  38   | Forest/community-level presets |
| Shrub             |  29   | |
| Groundcover       |  25   | |
| Grass             |  22   | |
| Mangrove          |  10   | |
| Bamboo            |   9   | |
| Palm              |   1   | |
| **TOTAL**         | **760** | |

---

## What We Plan To Do

### Phase 0 — LAI Database Completion (recovery homework)
- [ ] Boon to manually categorise 55 REVIEW species in LAI_categorised.csv
- [ ] Boon to annotate LAI_tropical_subset.csv for Perth/Singapore relevance
- [ ] Extract and cross-reference Tan & Sia 2009 PDF species list and urban LAI values
- [ ] Define urban context metadata fields
- [ ] Draft Mobius Factory brief for Urban Greenery Knowledge Layer

### Phase 1 — Housekeeping
- [ ] Fix close.bat, investigate frontend/server.py, add error handling, add loading indicator

### Phase 2 — GPR Core
- [ ] Build backend/lai_data.py from finalised CSV (with genus/category fallbacks)
- [ ] Define GPR formula with Boon → build backend/gpr.py
- [ ] New API endpoint: POST /api/gpr
- [ ] Planting input form, GPR score display, 3D green element visualisation

### Phase 3 — Urban Context Layer
- [ ] Add urban_context metadata to lai_data.py
- [ ] Launch Mobius Factory Urban Greenery module
- [ ] UI flags: urban-measured / field-measured (adjusted) / estimated

### Phase 4 — Polish & Long-term
- [ ] Camera reset, screenshot, input validation, multiple building shapes
- [ ] Save/load projects, shareable URLs, mobile/PWA

---

## Key Decisions & Notes

- **GPR is the point.** Everything else is scaffolding.
- **The database is the product.** The CAD visualiser is the delivery layer.
- **Urban context is the scientific gap.** Existing databases assume open-ground.
- **Tan & Sia 2009** is the foundational reference — must be fully extracted.
- **Mobius Factory** builds the Urban Greenery Knowledge Layer.
- **409 multi/community entries** are valid planning-level presets.
- **Collaboration model**: Boon directs domain logic and approves all changes. Claude proposes, explains, waits for "go ahead". Deploy only via github-publish.bat.

### Scripts in C:\GPRToolDemo
- `lai_explorer.py` — database processing pipeline
- `accdb_export.py` — Access DB exporter (DB confirmed empty)
- `lai_count.py` — species type counter
- `lai_categorise.py` — genus-based auto-categoriser

---

## Session Log

### 2026-03-18 (Session 2 — UI redesign + Vercel migration)

**Duration**: Full day session
**Boon's status**: Post knee surgery day 1 — working from home

#### What was done

**Vercel migration — completed**
- Renamed project from GPRToolDemo → GPRTool-Demo (GitHub, Vercel, local folder, all code references)
- Deleted Render service (was already gone)
- Deployed to Vercel: https://gprtool-demo.vercel.app ✅
- Git remote updated to new repo name
- Root directory set to `frontend/` in Vercel
- Auto-deploy from GitHub main confirmed working

**GeoJSON site import — working**
- Import GeoJSON button → file picker → draws orange site boundary in 2D view
- Equirectangular projection: lat/lon → local metres (accurate to ~1% at site scale)
- Site area (Shoelace formula) and perimeter calculated and displayed
- Camera fits to site boundary on import
- Grid and axes scale dynamically to match site dimensions
- Clear Site button removes boundary and resets properties panel
- Fixed: event listeners attached after body.html loads (timing issue)

**Cube removed**
- Scene starts empty; cube was placeholder, now retired
- Plywood texture retained in files but not loaded

**Camera and navigation**
- 2D: orthographic top-down, pan only
- 3D: perspective, positions to show full site on mode switch
- Touchpad: 1-finger rotate (3D), 2-finger pan, pinch zoom
- maxDistance increased to 5000 for large sites
- screenSpacePanning enabled

**UI redesign — complete**
- Design reference: SketchUp + PD:Site Designer (Andrew Marsh)
- Font: Outfit (Google Fonts)
- Header: dark forest green #1e3d1e, 68px
- Logo: 50px, title: 40px
- Panels: warm neutral grey #f0efed, 220px wide, collapsible
- Dropdown menus: light green #e8ece4 with dark green text
- Tool buttons: SketchUp-style left accent border on hover/active
- SVG line icons throughout — no emoji, no colour fills
- 2D/3D toggle: hardcoded in body.html (not JS-created), z-index 500
- Undo/Redo: Lucide-style circular arrow icons, near-white #eef2ee
- Status bar: dark green, mode badge, message
- GPR result block: dark green #2d5a24 with large white number

**Menu architecture — finalised**
- File: New, Open, Save, Save As, Import (CAD only), Export (CAD only), Preferences
- Edit: Undo/Redo, Select/Move (V), Select All, Deselect, Delete, Construction tools, Dimension, Clear Guides
- Navigation: Fit to Site (Ctrl+F), Zoom, Pan, Orbit
- View: Toggle Grid (Ctrl+G), Toggle Axes (Ctrl+T), North Pointer, Isometric (Ctrl+I), Top, Front, Show Hidden
- Help: About GPR, About GPRTool, Documentation
- GeoJSON = Site panel only (not File menu)
- Import/Export = CAD formats only (DXF/DWG)
- GPR Report = right panel only

**Left panel — four collapsible sections**
- Site, Building (2D + 3D), Landscape, Plants
- All sections have SVG icons and section-header collapse toggle
- Building: Rectangle, Ellipse, Polygon, Line, 3-Point Arc, Tangent Arc, Offset, Edit Points, Dimension, Extrude, Subtract
- Landscape: Planting Bed, Wall, Component Library (V2)
- Plants: Plant Library, Clear All Plants
- Select/Move removed from left panel — moved to Edit menu

**Right panel**
- Empty state → Site info → Selection → GPR section
- GPR Overlay and Plant Schedule as toggle switches
- Target GPR input + Current GPR result block
- Generate GPR Report button (only here)

**Keyboard shortcuts wired**
- Ctrl+F (Fit to Site), Ctrl+G (Toggle Grid)
- Ctrl+Z (Undo), Ctrl+Shift+Z (Redo) — universal standard
- Esc (cancel/deselect)

#### Decisions made
- No Vite/bundler — importmap resolves `"three"` to local file, works on Vercel
- No Bézier/Spline in MVP — too hard to control, not widely used in site planning; offset tool is more useful
- No Paved Area tool — anything not planted is implicitly paved
- No Circle tool — Shift+Ellipse; no Square tool — Shift+Rectangle
- Polygon prompts for number of sides, then click+drag to size
- Dimension tool: right-click line = length; click points = distance polyline (continue clicking, Esc to end)
- Ctrl+A = Select All (not Save As — universal convention)
- Save As = Ctrl+Shift+S
- Redo = Ctrl+Shift+Z (universal, not Ctrl+Y which is Windows-only)
- `.gpr` = native session format (JSON, schema TBD)
- Terrain layer deferred to next session — need a good urban test site with topography

#### Pending — not yet done
- [ ] Push all current changes to GitHub (github-publish.bat)
- [ ] Terrain layer (OpenTopography SRTM elevation mesh)
- [ ] Free-tier plant library (50 species bundled JSON)
- [ ] GPR calculation engine
- [ ] North Pointer SVG overlay (draggable)
- [ ] Image underlay with scale line
- [ ] Find suitable urban test site with topography (Perth area)

---

### 2026-03-17 (Session 1 — ~90 mins before surgery)
- First joint review of codebase and all dev guide files
- Reviewed entire GPR - LAI Values folder; confirmed Access DB is empty
- Built full LAI processing pipeline; 760 species processed and categorised
- Clarified core vision: GPR is the point, database is the IP, CAD is scaffolding
- Identified urban context as the key scientific gap in all existing databases
- Identified Mobius Factory as mechanism for Urban Greenery Knowledge Layer
- Documented what GPR is and why it matters — permanently in this journal
- Boon entered surgery — development paused
