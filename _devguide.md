# GPRTool — Development Guide

**Last Updated**: 2026-03-18
**Project Type**: Browser-based GPR Calculation Tool with 3D CAD Interface
**Architecture**: Static PWA (Vercel) + Supabase (protected LAI database) + Three.js frontend
**Status**: ✅ Live on Vercel | ✅ UI Redesign Complete | ⏳ Terrain layer next

---

## 📑 TABLE OF CONTENTS

1. [Quick Start](#quick-start)
2. [Project Vision](#project-vision)
3. [Architecture](#architecture)
4. [UI Architecture](#ui-architecture)
5. [Deployment](#deployment)
6. [LAI Database Strategy](#lai-database-strategy)
7. [Feature Roadmap](#feature-roadmap)
8. [File Registry](#file-registry)
9. [Development Workflows](#development-workflows)
10. [Debugging Guide](#debugging-guide)
11. [Additional Resources](#additional-resources)

---

## 🚀 QUICK START

### Current Status
- **Local Dev**: `http://localhost:8080/index.html`
- **Production**: `https://gprtool-demo.vercel.app` ✅ Live
- **Repository**: `https://github.com/lotr2929/GPRTool-Demo.git`
- **Local Path**: `C:\Users\263350F\_myProjects\GPRTool-Demo`

### Essential Commands (run from project root)
```batch
start.bat            # Start local dev (frontend + browser)
close.bat            # Stop local dev servers
github-publish.bat   # Push to GitHub → triggers Vercel auto-deploy
```

### Local Dev Stack
- **Frontend**: Three.js, served by `frontend/server.py` on port 8080
- **Backend**: FastAPI retired — architecture is now fully client-side static
- **Deployment**: Vercel (static site, root directory = `frontend/`)

---

## 🎯 PROJECT VISION

### What GPRTool Is
GPRTool is a **GIS-first, browser-based tool** for calculating Green Plot Ratio (GPR) — a planning metric that quantifies three-dimensional urban greenery based on Leaf Area Index (LAI). It was invented by Boon Lay Ong, who is also GPRTool's domain authority and developer.

**The CAD visualiser is the delivery mechanism. The LAI database is the product.**

GPRTool sits between GIS and BIM — lightweight enough for a solo practitioner, compatible with GIS workflows that planners and councils already use. No existing GPR calculator does terrain-aware, site-accurate 3D calculation. That is the gap GPRTool fills.

### What GPRTool Is Not
- Not a BIM tool — buildings are simple extruded forms, not detailed models
- Not a general-purpose CAD tool — purpose-built for GPR calculation only
- Not a landscape design tool — geometry serves calculation, not presentation
- Not a full CAD suite — drawing tools exist only to support GPR input

### The Core Scientific Problem
All existing LAI databases (ORNL, TRY) were compiled for ecological/forestry research — natural forests and plantations, not urban conditions. Urban greenery is fundamentally different due to root restriction, substrate depth, light levels, wind, pruning, and installation type. GPRTool aims to be the first open, auditable **urban-context LAI database** with a transparent calculation framework. That is publishable IP.

### Commercial Model (Planned)
**Free tier**
- Public lite plant library (~50 common species, public-source LAI)
- Full CAD and GPR calculation functionality
- No registration required

**Registered/subscribed tier**
- Full curated plant library (700+ species with urban adjustment factors)
- Encrypted species bundles for offline/field use
- API key authentication (Google Maps-style long key)
- Subscription revenue unlocked once urban-context LAI layer is scientifically defensible

---

## 🏗️ ARCHITECTURE

### Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER BROWSER                         │
│    Three.js CAD | GPR Engine | GIS Viewer               │
│         (all calculation client-side)                   │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
               │ Static assets            │ LAI lookup (API key, future)
               ▼                          ▼
┌──────────────────────┐    ┌─────────────────────────────┐
│   Vercel (free)      │    │   Supabase (future)         │
│   Static PWA host    │    │   Protected LAI database    │
│   Edge Functions     │    │   Row Level Security        │
└──────────────────────┘    └─────────────────────────────┘
               │
               │ Terrain + elevation (future)
               ▼
┌────────────────────────────────────────────────────────┐
│   OpenTopography SRTM / Mapbox Terrain                 │
│   Site elevation mesh                                  │
└────────────────────────────────────────────────────────┘
```

### Key Technology Decisions
- **No backend** — fully static, all logic in the browser
- **Three.js** — 3D scene, geometry, rendering
- **GeoJSON** — site boundary input format (lat/lon → local metres via equirectangular projection)
- **Outfit font** — loaded from Google Fonts
- **No build step** — vanilla JS with importmap resolving `"three"` to local file
- **`.gpr` format** — planned native session format (JSON schema, TBD)

---

## 🖥️ UI ARCHITECTURE

### Layout
```
┌─────────────────────────────────────────────────────┐
│  HEADER: [↩↪] [File][Edit][Navigation][View][Help]  │
│                    GPRTool Logo                      │
├──────────┬──────────────────────────┬───────────────┤
│  TOOLS   │                          │  PROPERTIES   │
│          │       VIEWPORT           │               │
│  Site    │    (Three.js canvas)     │  Site info    │
│  Building│                          │  Selection    │
│  Landscape    [2D|3D toggle]        │  GPR summary  │
│  Plants  │                          │               │
├──────────┴──────────────────────────┴───────────────┤
│  STATUS BAR: [2D] | message                         │
└─────────────────────────────────────────────────────┘
```

### Menu Structure

**FILE**
```
New                    Ctrl+N    (.gpr)
Open…                  Ctrl+O    (.gpr)
Save                   Ctrl+S    (.gpr)
Save As…               Ctrl+Shift+S  (.gpr)
─────
Import…                (DXF, DWG — CAD formats only)
Export…                (DXF, DWG — CAD formats only)
─────
Preferences…
```

**EDIT**
```
Undo                   Ctrl+Z
Redo                   Ctrl+Shift+Z
─────
Select / Move          V
Select All             Ctrl+A
Deselect All           Esc
Delete                 Del
─────
Construction Line      (infinite reference line, non-printing)
Construction Point     (snap reference point, non-printing)
Offset Guide           (parallel to edge at set distance)
Dimension              (right-click line = length / click 2+ points = distance polyline)
─────
Clear Guides
```

**NAVIGATION**
```
Fit to Site            Ctrl+F
Zoom                   (click → drag in/out, or scroll)
Pan                    (click → drag; 2-finger shortcut)
Orbit                  (3D only — click → drag; 1-finger shortcut)
```

**VIEW**
```
Toggle Grid            Ctrl+G
Toggle Axes            Ctrl+T
North Pointer          (toggle — draggable in viewport)
─────
Isometric              Ctrl+I     (right-click to save as default)
Top
Front
─────
Show Hidden…
```

**HELP**
```
About Green Plot Ratio
About GPRTool
─────
Documentation
```

### Left Panel — Four Collapsible Sections

**SITE**
- Import GeoJSON
- Import Site Image
- Set Scale (for non-georeferenced images)
- Set North (manual orientation override)
- Clear Site

**BUILDING — 2D tools**
- Rectangle (Shift = square)
- Ellipse (Shift = circle)
- Polygon (prompts sides → click+drag to size)
- Line
- 3-Point Arc
- Tangent Arc
- Offset
- Edit Points (click edge to add vertex, drag to reshape)
- Dimension (right-click line for length / click points for distance polyline)

**BUILDING — 3D tools**
- Extrude (Push/Pull)
- Subtract (boolean cut)

**LANDSCAPE**
- Planting Bed
- Wall
- Component Library… (V2 — pergola, seat, water feature, etc.)

**PLANTS**
- Plant Library… (select → click to place / drag to fill area)
- Clear All Plants

### Right Panel — Properties (collapsible)
- Empty state until site loaded
- Site info: Area, Perimeter, Boundary points
- Selected object: Type, Dimensions, Position, Plant species, LAI, Water retention (future)
- GPR section: Overlay toggle, Plant Schedule toggle, Target GPR input, Current GPR result
- Generate GPR Report button (only here — nowhere else)

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z |
| Select All | Ctrl+A |
| Select / Move | V |
| Delete | Del |
| Fit to Site | Ctrl+F |
| Toggle Grid | Ctrl+G |
| Toggle Axes | Ctrl+T |
| Isometric | Ctrl+I |
| Cancel / Deselect | Esc |

### 2D/3D Toggle
- Square icon = 2D plan view (orthographic top-down)
- Cube icon = 3D perspective view
- Located top-right of viewport, always visible
- Active mode shown in status bar

### Touchpad Navigation
| Gesture | Action |
|---------|--------|
| 1-finger drag | Rotate (3D) / Pan (2D) |
| 2-finger drag | Pan (3D) |
| Pinch | Zoom in/out |
| Scroll | Zoom in/out |

---

## 🚢 DEPLOYMENT

### Production
- **URL**: https://gprtool-demo.vercel.app
- **Platform**: Vercel Hobby (free)
- **Root directory**: `frontend/`
- **Build command**: none (static site)
- **Auto-deploy**: every push to `main`

### GitHub
```
origin: https://github.com/lotr2929/GPRTool-Demo.git
branch: main
```

### Deploy sequence
```batch
github-publish.bat
# Enter commit message when prompted
# Vercel auto-deploys within ~30 seconds
```

---

## 🌿 LAI DATABASE STRATEGY

*Full strategy: `GPR - LAI Values/LAI_DATABASE_STRATEGY.md`*

### Primary Source — Field Measurements
`GreenPlotRatio_LAI Values.csv` — 37 species measured by Boon Lay Ong and Dr Tan in Singapore. These are **primary source urban-context measurements** and take precedence over all other sources.

### Secondary Sources — ORNL / TRY
760 species from ORNL Global LAI and TRY Database. **Important caveat**: all values measured in open/ideal conditions, not urban. Urban LAI calibration is a future research priority — values should not be treated as urban-validated until adjusted.

### Current Processed Data
| File | Contents |
|------|----------|
| `GreenPlotRatio_LAI Values.csv` | 37 species, field-measured Singapore (primary) |
| `LAI_combined_clean.csv` | All unique species from ORNL + TRY |
| `LAI_tropical_subset.csv` | Tropical/subtropical flagged species |
| `LAI_categorised.csv` | 760 species with category assignments |
| `Material Library.csv` | Working GPRTool species library |

### Category Counts
| Category | Count |
|----------|-------|
| Tree | 248 |
| Multi-Species | 323 |
| REVIEW | 55 |
| Generic-Benchmark | 38 |
| Shrub | 29 |
| Groundcover | 25 |
| Grass | 22 |
| Mangrove | 10 |
| Bamboo | 9 |
| Palm | 1 |
| **TOTAL** | **760** |

### Pending Database Work
- [ ] Merge Singapore field measurements into LAI_categorised.csv
- [ ] Resolve duplicates in GreenPlotRatio_LAI Values.csv (Anthoxanthum odoratum × 2, Calamagrostis epigejos × 2)
- [ ] Manually categorise 55 REVIEW species
- [ ] Extract Tan & Sia 2009 PDF species list and urban LAI values
- [ ] Assess AusTraits for Australian species coverage
- [ ] Define urban adjustment factor schema (installation type × substrate × light)
- [ ] Build curated 50–100 species free-tier library

### GPR Overlay Scale
- Range: 0–10 LAI units
- Display: graduated green shading per zone
- Maximum field-measured: 8.40 (Agrostis capillaris, Singapore)
- Urban maximum practical: ~10

---

## 🗺️ FEATURE ROADMAP

### MVP — Current Sprint
- [x] Vercel deployment — live at gprtool-demo.vercel.app
- [x] Renamed to GPRTool-Demo (GitHub, Vercel, local)
- [x] GeoJSON site boundary import → 2D/3D view
- [x] Site area and perimeter calculation (Shoelace formula)
- [x] Dynamic grid and axes scaled to site
- [x] Professional UI redesign (SketchUp/PD:Site reference)
- [x] Dark green header, collapsible panels, SVG tool icons
- [x] 2D/3D toggle with square/cube icons
- [x] Full menu architecture defined and implemented
- [x] Keyboard shortcuts: Ctrl+F, Ctrl+G, Ctrl+Z, Ctrl+Shift+Z, Esc
- [x] Touchpad navigation (1-finger rotate, 2-finger pan, pinch zoom)
- [ ] Push current changes to GitHub / Vercel
- [ ] Terrain layer — OpenTopography SRTM elevation mesh
- [ ] Free-tier plant library (50 species, bundled JSON)
- [ ] GPR calculation engine

### V2 — GIS Integration
- [ ] Terrain elevation mesh (OpenTopography SRTM)
- [ ] North Pointer (draggable SVG overlay)
- [ ] Image underlay with scale calibration
- [ ] Slope-aware GPR calculation
- [ ] Supabase LAI lookup (registered tier)
- [ ] API key authentication

### V3 — Drawing Tools
- [ ] Rectangle, Ellipse, Polygon drawing
- [ ] 3-Point Arc, Tangent Arc
- [ ] Offset tool
- [ ] Edit Points (vertex editing)
- [ ] Dimension tool (line length + point-to-point polyline)
- [ ] Construction lines and guides
- [ ] Extrude (Push/Pull)
- [ ] Subtract (boolean)

### V4 — Import/Export
- [ ] DXF import/export
- [ ] GPR Report PDF (browser print)
- [ ] `.gpr` session format (save/open)
- [ ] Encrypted species bundle download

### V5 — Commercial
- [ ] Subscription management
- [ ] Mobius Factory Urban Greenery Knowledge Layer
- [ ] Urban adjustment factor schema
- [ ] Component library (pergola, seat, water feature)

---

## 📂 FILE REGISTRY

### Project Root
| File | Purpose |
|------|---------|
| `start.bat` | Start local dev (frontend + browser) |
| `close.bat` | Stop local dev servers |
| `github-publish.bat` | Push to GitHub → Vercel auto-deploy |
| `_devguide.md` | This file |
| `_devguide-summary.md` | Guide structure reference |
| `_journal.md` | Session log |

### Frontend (`frontend/`)
| File | Purpose |
|------|---------|
| `index.html` | Main entry point — all JS lives here |
| `header.html` | Header bar (menu, undo/redo, logo, clock) |
| `body.html` | Left panel, viewport, right panel, status bar |
| `styles.css` | Complete design system |
| `server.py` | Local dev HTTP server (port 8080, no-cache) |
| `js/three.module.js` | Three.js library |
| `js/OrbitControls.js` | Camera orbit/pan/zoom controls |
| `images/gpr-logo.png` | App logo |
| `textures/plywood.webp` | Placeholder texture (to be retired) |

### LAI Data (`GPR - LAI Values/`)
| File | Purpose |
|------|---------|
| `GreenPlotRatio_LAI Values.csv` | Primary — field-measured Singapore |
| `LAI_categorised.csv` | 760 species, categorised |
| `LAI_combined_clean.csv` | ORNL + TRY combined |
| `LAI_tropical_subset.csv` | Tropical/subtropical subset |
| `LAI_DATABASE_STRATEGY.md` | Full database strategy |
| `Tan, Sia - 2009...pdf` | Foundational GPR/LAI reference |

### Python Scripts (Root)
| File | Purpose |
|------|---------|
| `lai_explorer.py` | ORNL + TRY → combined clean CSV |
| `lai_categorise.py` | Genus-based auto-categoriser |
| `lai_count.py` | Species type counter |
| `accdb_export.py` | Access DB export (DB confirmed empty) |

---

## 🔄 DEVELOPMENT WORKFLOWS

### Deploying
```batch
github-publish.bat
# Enter commit message
# Vercel deploys automatically from main branch
```

### Local dev (frontend only — no backend needed)
```batch
start.bat
# Opens http://localhost:8080/index.html
```

### Updating the LAI Database
1. Edit `GPR - LAI Values/LAI_categorised.csv`
2. Run `lai_categorise.py` to regenerate
3. When ready for Supabase: upload via dashboard → Table Editor

---

## 🐛 DEBUGGING GUIDE

### Frontend not updating after edit
Hard refresh: **Ctrl+Shift+R** (bypasses cache)

### Port 8080 in use
```batch
netstat -ano | findstr :8080
taskkill /PID <pid> /F
```

### GeoJSON not loading
- Check browser console (F12) for errors
- Verify file is valid GeoJSON with a Polygon or MultiPolygon geometry
- Test at https://geojson.io — paste file contents

### 2D/3D toggle not appearing
- Toggle is now hardcoded in `body.html` — not created by JS
- Check `#viewport` has `position: relative` and `isolation: isolate`

---

## 📚 ADDITIONAL RESOURCES

- **Three.js docs**: https://threejs.org/docs/
- **OpenTopography SRTM**: https://opentopography.org/
- **Overpass Turbo**: https://overpass-turbo.eu (GeoJSON extraction)
- **geojson.io**: https://geojson.io (draw/test GeoJSON)
- **AusTraits**: https://austraits.org/
- **NParks Flora & Fauna Web**: https://www.nparks.gov.sg/florafaunaweb
- **FloraBase WA**: https://florabase.dpaw.wa.gov.au/
- **GitHub repo**: https://github.com/lotr2929/GPRTool-Demo
- **Vercel dashboard**: https://vercel.com/dashboard
- **Supabase dashboard**: https://supabase.com/dashboard

---

*Last updated: 2026-03-18 — Vercel live, UI redesign complete, menu architecture finalised, terrain layer next.*
