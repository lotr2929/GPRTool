# GPRTool — Repository Map

**Last updated:** 2026-04-16 (Session — Site Selection + CADMapper Import commands)
**Live URL:** https://gprtool.vercel.app
**Local path:** `C:\Users\263350F\_myProjects\GPRTool`
**GitHub:** https://github.com/lotr2929/GPRTool.git

> Update this file at the start of every session after any structural changes.

---

## Architecture Overview

GPRTool is a **browser-only PWA** — no backend, no server-side logic.
All application code runs in the browser via a single HTML file served statically.
Deployed on Vercel as a static site with the root set to `app/`.

```
User browser
    └── app/index.html           ← entire app (HTML + inline <script type="module">)
            ├── fetches header.html, body.html at runtime
            ├── imports three.module.js, OrbitControls.js (local)
            ├── imports north-point-2d.js (local)
            ├── imports north-point-3d.js (local)
            ├── imports OBJLoader, GLTFLoader from CDN (jsdelivr)
            └── fetches plants_free.json at runtime
```

---

## Directory Structure

```
GPRTool/
│
├── CLAUDE.md                   ← AI session instructions — read first
│
├── app/                        ← ROOT FOR VERCEL DEPLOYMENT
│   ├── index.html              ← MAIN APP FILE (~124 KB) — all logic is here
│   ├── body.html               ← Left panel, viewport, right panel markup
│   ├── header.html             ← Top bar, menus, clock
│   ├── styles.css              ← All styles
│   ├── plants_free.json        ← 56-species plant library (runtime fetch)
│   ├── favicon.ico
│   ├── js/
│   │   ├── lib/                ← Third-party libraries — NEVER edit
│   │   │   ├── three.module.js     ← Three.js r160 (local copy, 1.2 MB)
│   │   │   └── OrbitControls.js    ← Three.js orbit controls (local copy)
│   │   ├── north-point-2d.js   ← 2D DOM compass widget (extracted 2026-03-29)
│   │   └── north-point-3d.js   ← 3D HUD compass
│   ├── textures/
│   │   └── plywood.webp        ← Texture for placeholder cube
│   └── images/
│       └── gpr-logo.png        ← GPR logo (829 KB — consider optimising)
│
├── lai/                        ← LAI RESEARCH PIPELINE — not deployed. Core IP.
│   ├── lai_categorise.py       ← Processes combined CSV → LAI_categorised.csv
│   ├── lai_explorer.py         ← Explores ORNL/TRY raw data → LAI_combined_clean.csv
│   ├── merge_singapore_lai.py  ← Merges Singapore field data into LAI_categorised.csv
│   ├── GreenPlotRatio_LAI Values.csv  ← FIELD DATA (37 species, Ong & Tan 2009) — PRIMARY SOURCE
│   ├── LAI_categorised.csv     ← Processed LAI database (760 species)
│   ├── LAI_combined_clean.csv  ← Cleaned combined dataset
│   ├── LAI_tropical_subset.csv ← Tropical species subset
│   ├── LAI_DATABASE_STRATEGY.md
│   ├── LAI_category_report.txt
│   ├── LAI_explorer_report.txt
│   ├── LAI Database1.accdb     ← Original MS Access DB (15 MB)
│   ├── LAI Database - ONRL.csv
│   ├── LAI Database - TRY.csv
│   ├── LAI Database (Combined).xlsx
│   ├── LAI (ORNL DAAC_...).csv/.xlsx   ← ORNL source data (raw, uncalibrated)
│   ├── LAI (TRY Database)*.xlsx        ← TRY source data (raw, uncalibrated)
│   ├── Journal Papers - LAI and GPP for GPR.zip
│   ├── Tan, Sia - 2009 - LAI of tropical plants....pdf  ← KEY REFERENCE
│   ├── accdb_export/           ← Output from accdb_export.py
│   ├── ORNL DAAC-Global Database.../   ← Raw ORNL data folder
│   └── TRY Database/           ← Raw TRY data folder
│
├── projects/                   ← Working files — demo site, test geometry, reports
│   ├── README.md
│   ├── 30_beaufort_street_parcel.geojson     ← PRIMARY DEMO SITE (Landgate SLIP)
│   ├── test_site_contours.geojson
│   ├── test_cube.obj / .dxf
│   ├── test-tower.obj / test-tower-clean.obj
│   ├── test_8storey_site.obj
│   ├── test_building_import.dxf
│   ├── 30_Beaufort_Street_Site_Analysis.docx
│   ├── 30_Beaufort_Street_GPR_Recommendations.docx
│   └── GPR Recommendations #1-6.pdf
│
├── _dev/                       ← Dev documentation — not deployed
│   ├── _dev_guide.md           ← Coding standards and architecture rules
│   ├── _map.md                 ← THIS FILE
│   ├── _journal.md             ← Development journal (all sessions)
│   ├── _session.md             ← Last session status
│   ├── _design.md              ← Design decisions and UI spec
│   └── repomix-output.xml      ← Repo snapshot for AI handoff (generated, never edit)
│
├── _archive/                   ← Dead files retained for reference
│
├── deploy.bat                  ← Git commit + push → triggers Vercel auto-deploy
├── deploy.env                  ← Vercel credentials (not committed)
├── start.bat                   ← Start local dev server + open browser (port 8000)
├── poll_vercel.ps1             ← Called by deploy.bat to poll deployment status
│
├── .env.local                  ← Local environment variables (not committed)
├── .gitignore
├── .vercel/
├── .git/
└── .venv/                      ← Python virtual environment (for lai/ scripts)
```

---

## Key Files — Quick Reference

| File | What it does | Edit when |
|---|---|---|
| `app/index.html` | App shell — Three.js scene, UI logic, GPR engine, plant library, import handlers | Every feature build |
| `app/js/north-point-2d.js` | 2D DOM north point compass — drag, resize, rotation, persist | North point changes only |
| `app/body.html` | Left panel buttons, viewport canvas, right panel sections | Adding new UI panels or buttons |
| `app/header.html` | Top bar, File/Edit menus, clock | Adding menu items |
| `app/styles.css` | All CSS variables, component styles | Visual changes |
| `app/plants_free.json` | Plant species library (56 species, LAI values, surface compatibility) | Adding/editing species |
| `projects/30_beaufort_street_parcel.geojson` | Primary demo site boundary | Rarely |
| `lai/LAI_categorised.csv` | Master LAI database used by the app | After running lai_categorise.py |
| `_dev/_journal.md` | Session log — what was built, decisions made, what's pending | Every session |
| `_dev/_session.md` | Current status snapshot | Every session |
| `_dev/_design.md` | Architecture decisions, UI spec, workflow definitions | Major design changes |
| `_dev/_dev_guide.md` | Developer rules — module structure, tool architecture, conventions | When new patterns are established |

---

## Data Flow

```
GeoJSON file (Landgate / local)
    → importGeoJSONBtn click
    → FileReader → JSON.parse
    → extractCoordinates()
    → drawSiteBoundary()          ← orange LineLoop + cream ShapeGeometry in Three.js scene
    → computePolygonArea()        ← Shoelace formula on projected coords
    → siteAreaM2                  ← GPR denominator

OBJ / glTF file
    → import3DModelBtn click
    → OBJLoader / GLTFLoader (CDN)
    → detectAndApplyUnitScale()   ← auto mm/cm/m detection
    → onModelLoaded()
    → detectSurfaces()            ← coplanar patch extraction, normal classification
    → surfaces[]                  ← ground / roof / wall / sloped registry

Plant assignment
    → Plant Library modal
    → addPlantInstance(surface, species, canopyArea)
    → surface.plants[]            ← [{instanceId, speciesId, canopyArea}]
    → recalcGPR()                 ← sum(canopyArea x LAI) / siteAreaM2

Deploy
    → deploy.bat
    → git commit + push to GitHub
    → Vercel auto-builds from app/
    → https://gprtool.vercel.app
```

---

## LAI Database Hierarchy

```
PRIMARY (field-measured, urban-calibrated):
    lai/GreenPlotRatio_LAI Values.csv   ← 37 species, Ong & Tan 2009, Singapore
    ↓ lai/merge_singapore_lai.py
    lai/LAI_categorised.csv             ← 760 species total (primary + ORNL/TRY)

SECONDARY (global databases, NOT urban-calibrated):
    lai/LAI Database - ONRL.csv         ← open-field/forest measurements
    lai/LAI Database - TRY.csv          ← plant trait database

CAUTION: ORNL/TRY values overestimate urban GPR by 30-60%.
Use only field-measured values for formal GPR calculations.
The 37 Singapore species are the gold standard.
```

---

## Environment

| Item | Detail |
|---|---|
| Local dev server | `start.bat` → `python -m http.server 8000` from `app/` |
| Local URL | http://localhost:8000 |
| Deployment | Vercel (auto-deploy from GitHub main, root: `app/`) |
| Three.js version | r160 (local copy in `app/js/lib/`) |
| CDN loaders | OBJLoader, GLTFLoader from jsdelivr (three@0.160) |
| Python | `.venv` at project root — used for `lai/` scripts only |
| Node.js | Not required (no bundler — importmap used instead) |
