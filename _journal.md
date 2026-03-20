# GPRTool Development Journal

**Project**: GPRTool-Demo
**Collaborators**: Boon (domain expert) + Claude (development partner)
**Live URL**: https://gprtool-demo.vercel.app
**Repository**: https://github.com/lotr2929/GPRTool-Demo.git
**Local path**: `C:\Users\263350F\_myProjects\GPRTool-Demo`

---

## How to use this journal

- **Planned** — decisions made, not yet started
- **In Progress** — actively being worked on
- **Done** — completed and deployed or committed
- Each entry dated. Most recent at top.

---

## Session Log

### 2026-03-20 (Session 4 — Phase 2a: Plant Library + GPR Calculation Engine)

#### What was done

**`plants_free.json` — created** (`frontend/plants_free.json`)
- 56 species free-tier plant library, bundled as static JSON (no backend required)
- 24 species from Singapore field measurements (Boon & Tan 2009) — primary source, urban-measured
- 12 species from ORNL/TRY with explicit urban calibration warning in source field
- 14 common urban species from literature (turf, sedum, ivy, buxus, bamboos etc.)
- Each entry: `{ id, common, scientific, lai, category, surface_types[], source }`
- `surface_types[]` field controls which surface types the species is compatible with
- **Bamboo group**: 6 species — *B. multiplex*, *B. vulgaris*, *B. oldhamii*, *B. textilis var. gracilis*, *Phyllostachys aurea*, *P. edulis* (Moso) — LAI range 5.50–8.10

**Plant Library modal — built** (in `index.html`)
- Triggered by "Plant Library…" button (left panel) or "Add Plant…" button (surface schedule)
- Search by common name, scientific name, or category
- Surface type filter: All / Ground / Roof / Wall / Sloped / **Bamboo** (category filter)
- Species sorted: compatible species first (by LAI desc), then incompatible (dimmed to 40%)
- Source badges: Field (green) / ORNL (amber) / Lit (blue) — provenance visible at a glance
- LAI badge displayed prominently for every species
- "Add to Surface" button — adds species instance to selected surface's plant schedule

**Data model refactored — multi-instance per surface**
- Old model: `surface.plantId` — one species per surface
- New model: `surface.plants = [{ instanceId, speciesId, canopyArea }]`
- Each surface can have any number of plant instances of any species
- Each instance has its own canopy area (m²), editable in the schedule
- `_instanceCounter` — monotonically increasing ID, no collisions on remove/re-add

**GPR formula corrected**
- Old (wrong): `Σ(surface.area × LAI) / site_area`
- New (correct): `Σ(instance.canopyArea × species.LAI) / site_area`
- Canopy area is the plan area of each individual plant's canopy, not the whole surface
- Default canopy area on add = full surface area (user trims down in schedule)
- Numerator `Σ(canopy×LAI)` shown as a breakdown row below GPR value

**Plant schedule panel — built** (right panel, surface section)
- Appears below surface properties when a surface is selected
- Lists all plant instances on the surface: species name | LAI badge | canopy area input | m² | × remove
- Canopy area is an editable number input — changing it triggers immediate GPR recalc
- × remove button removes that instance only
- Empty state message prompts user to click "Add Plant…"
- "Add Plant…" button at bottom of schedule opens modal pre-filtered to surface type

**Surface list badges**
- Left panel surface list items now show a green badge: "1 plant" / "N plants" per surface

**`body.html` updated**
- Removed old `selection-section` (`sel-plant`, `sel-lai` fields)
- Added `plant-schedule-section` with `surf-plant-list` div and `addPlantBtn`
- Added `gpr-breakdown-row` to GPR panel (shows numerator)
- Removed `Plant Schedule` toggle (replaced by always-visible schedule panel)

#### Architecture note — module split deferred to Phase 3
- `index.html` is ~80KB and growing
- Recommended split at Phase 3 start: `js/state.js`, `js/plants.js`, `js/gpr.js`, `js/scene.js`, `js/surfaces.js`, `js/geo.js`
- Rationale: mid-build refactor carries risk; shared state wiring is a half-day job
- Do this before terrain/Phase 3 work begins — not during Phase 2

#### Phase 2a status: ✅ Complete
- Plant library loaded from JSON ✅
- Multi-instance plant model ✅
- Correct GPR formula ✅
- Editable canopy area per instance ✅
- Plant schedule in right panel ✅
- Bamboo group (6 species) ✅
- Bamboo filter in modal ✅

#### Pending — Phase 2b onwards
- [ ] Deploy to Vercel (run `deploy.bat` with message "Phase 2a: plant library + GPR engine")
- [ ] LAI database merge — Singapore CSV → `LAI_categorised.csv` (duplicates unresolved)
- [ ] Terrain layer — OpenTopography SRTM or Mapbox elevation mesh
- [ ] Image underlay with scale calibration
- [ ] DXF import per surface canvas
- [ ] GPR report (PDF export)
- [ ] Module split (`js/state.js` etc.) — do before Phase 3

---

### 2026-03-19 (Session 3 — Design paradigm + MVP Phase 1 build)

#### What was done

**Design paradigm finalised**
- Defined GPRTool as a landscape design and GPR calculation tool
- The 3D model (imported or built) is a surface host — it defines where landscape can be placed
- Building tools are surface-creation tools only, not architectural CAD
- Defined the two entry paths: import from architect (Path A) or build massing in GPRTool (Path B)
- Defined per-surface DXF import workflow — equivalent to attaching a floor plan or elevation
- Established GPRTool's interoperability role: not a standalone tool
- Consolidated all documentation into `_design.md` and `_journal.md`
- Retired: `_devguide.md`, `_devguide-summary.md`, `_devstartup.md`, `GPR_Documentation.md`, `Next Steps.md`

**MVP Phase 1 — built**

*`index.html`*
- Added `three/addons/` CDN importmap entry (jsdelivr, three@0.160)
- Imported `OBJLoader` and `GLTFLoader` from CDN
- `loadOBJ(file)` — OBJLoader, progress feedback, error handling
- `loadGLTF(file)` — GLTFLoader, handles both .gltf and .glb
- `loadIFC(file)` — stub, shows "coming in next build"
- `onModelLoaded(group, filename, format)` — common handler: centres model at origin, sits it on Y=0, adds to scene, runs surface detection, fits 3D camera, switches to 3D mode, populates UI
- `detectSurfaces(group)` — traverses all mesh children, computes world-space average normal per submesh, classifies as ground/roof/wall/sloped by normal direction and elevation, estimates area and elevation, assigns colour-coded material
- `populateSurfacePanel()` — builds surface list in left panel grouped by type with dot indicators and area labels; populates right panel model summary (surface count, ground/roof/wall counts)
- `hoverSurface(s)` / `unhoverSurface(s)` — yellow highlight material on hover, list item highlight
- `selectSurface(s)` — green highlight material on click, list item selected state, right panel surface details (type, area, elevation, normal angle)
- `deselectSurface()` — clears selection on Esc or click-empty
- Raycaster on `pointermove` — hover detection in 3D mode
- Raycaster on `click` — surface selection in 3D mode
- `modelFileInput` file picker — routes to correct loader by extension
- `import3DModelBtn` wires to file picker
- `clearSiteBtn` — now also removes imported model and clears surfaces array
- `fitSiteBtn` — now uses importedModel if present, falls back to siteBoundaryLine
- Menu `import-model` action wired to button
- Surfaces panel (`section-surfaces`) shown/hidden by model load/clear
- `switchMode('3d')` — status bar now says "click a surface to select it"
- `MAT` object — colour-coded materials: model (grey), ground (green), roof (amber), wall (blue), sloped (grey), hover (yellow), selected (bright green)

*`body.html`*
- Added `import3DModelBtn` and `modelFileInput` to Site panel
- Renamed `importGeoJSONBtn` label to "Import Site Boundary…"
- Added `section-surfaces` collapsible section (hidden until model loads)
- `surfaces-list` div for dynamically injected surface items
- Added note to Building panel: "Surface creation tools — not full architectural CAD"
- Right panel: added `model-info-section` (filename, format, surface count breakdown)
- Right panel: added `surface-section` (type, area, elevation, normal angle)
- Empty state message updated to "Import a 3D model or site boundary to begin"
- Status bar message updated

*`header.html`*
- File menu: replaced generic Import/Export with specific items:
  - Import 3D Model…
  - Import Site Boundary…
  - Import Site Image…
  - Import Landscape DXF… (stub)
  - Export GPR Annotations… (stub)
  - Export GPR Report… (stub)

*`styles.css`*
- Added `--chrome-hover` and `--accent-mid` CSS variables
- Added `.surface-item`, `.surface-dot`, `.surface-label`, `.surface-area` rules
- Added `.tool-group-note` rule
- Surface dot colours: ground #7ab648, roof #e8a020, wall #5b9bd5, sloped #a0a0a0

#### Surface classification logic
- Face normal Y > 0.7 → horizontal → ground if elevation < 0.5m, else roof
- Face normal |Y| < 0.3 → wall
- Face normal Y < -0.5 → underside → skipped
- Otherwise → sloped
- Area: horizontal surfaces use XZ footprint; wall/sloped use two largest dimensions

#### Known limitations (to address in next session)
- Surface detection is per submesh (OBJ group/object), not per face — a single submesh with mixed faces gets classified by average normal. This is sufficient for typical massing models but may misclassify complex geometry.
- IFC import is a stub — no geometry loaded yet
- No UV unwrapping yet — that is Phase 2

#### Pending
- [ ] Push to GitHub / Vercel
- [ ] IFC import (web-ifc WASM) — deferred to after Phase 2
- [ ] Phase 2: per-surface landscape design tools

---

### 2026-03-19 (Session 3 continued — Phase 1 polish + Phase 2 prep)

#### What was done

**Surface 2D canvas — built (Phase 1 completion)**
- `drawSurfaceCanvasOutline(surface)` — draws green boundary rectangle on selected surface in 2D view; horizontal surfaces get XZ rectangle, walls get vertical rectangle facing their normal
- `clearSurfaceCanvasOutline()` — removes outline, called on deselect, mode switch to 3D, and Clear Site
- `fitSurfaceCamera(surface)` — configures orthographic camera to look directly at selected surface; horizontal → top-down at surface elevation; wall → front-on elevation; frustum sized to surface bounding box; stores surfaceCentre/surfaceNormal/surfaceUp on camera.userData for pan
- `switchMode('2d')` — now branches on `selectedSurface`: if selected → surface canvas; if not → top-down plan view
- Status bar shows surface type and area when in canvas mode (persistent, no timeout)

**Four pre-Phase-2 fixes applied**
- Pan in surface canvas mode: moves along surface U/V axes (cross product of up × normal) not world X/Z
- Zoom in surface canvas mode: scales orthographic frustum directly, not via zoom2D
- `deselectSurface()`: if in 2D surface canvas, switches to 3D model view so user can select the next surface
- `clearSiteBtn`: calls `clearSurfaceCanvasOutline()` so outline is never orphaned

**Visual refinements**
- All surfaces render as flat white (`MeshBasicMaterial`) — professional massing model style
- Edge overlay: dark grey (`#444444`) lines via `EdgesGeometry`, `renderOrder=1`, faces pushed back with `polygonOffset`
- Viewport background: light grey (`#e8e8e8`) so white model is readable
- Hover: neutral grey (`#d8d8d8`); Selected: pale sage green (`#c8e8c8`)

#### Phase 1 status: ✅ Complete
All Phase 1 deliverables met:
- OBJ import ✅
- glTF/GLB import ✅
- Surface detection from face normals ✅
- Surface selection (click + panel list) ✅
- 2D surface canvas with correct camera orientation ✅
- Surface canvas outline ✅
- Pan/zoom in surface canvas mode ✅

#### Pending
- [ ] Push all changes to GitHub / Vercel
- [ ] IFC import (deferred — after Phase 2)
- [ ] Begin Phase 2: landscape design on surface canvas

---

### 2026-03-19 (Session 3 continued — edge overlay + 2D canvas polish)

#### What was done

**Edge overlay — resolved**
- Root cause: OBJ has separate mesh objects per face with no shared vertices, so `EdgesGeometry` across merged geometry could not find shared edges
- Solution: two-part approach:
  1. Per-mesh `LineLoop` from unique vertices — draws each face perimeter
  2. OBJ `l` directives — explicit junction lines added to test model at every surface meeting point (podium base, podium top, tower base, tower top)
- Junction lines styled dark grey `0x444444` at `renderOrder 2` in `onModelLoaded`
- For real-world models (not test OBJ), code-based junction detection via edge hash map is in place

**2D canvas mode — right-click menu**
- Right-click 2D button → context menu with Ortho / Surface options
- Ortho: pure vertical top-down for ground/roof; snapped cardinal elevation for walls
- Surface: camera aligns exactly to surface normal
- Status bar shows `[Ortho]` or `[Surface]` label
- `canvasMode` state persists across surface selections

**Camera fixes**
- Ortho mode for horizontal surfaces: camera always placed exactly above at `(centre.x, centre.y + dist, centre.z)` — never follows surface normal slope
- This eliminates the double-line artefact caused by a 3° off-axis camera making wall edges appear to have thickness in plan view
- Wall ortho mode: camera snapped to nearest cardinal direction (N/S/E/W)
- Pan in surface canvas: moves along surface U/V axes, not world X/Z
- Zoom in surface canvas: scales orthographic frustum directly

**Deselect behaviour**
- `deselectSurface()` → always switches to 3D so user can select next surface

**Site outline fix**
- Edge overlay draws actual mesh vertices (not bounding box) so sloped/non-rectangular sites display correct outline shape

---

### 2026-03-18 (Session 2 — UI redesign + Vercel migration)

**Duration**: Full day session
**Boon's status**: Post knee surgery day 1 — working from home

#### What was done

**Vercel migration — completed**
- Renamed project from GPRToolDemo → GPRTool-Demo (GitHub, Vercel, local folder, all code references)
- Deleted Render service
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

**UI redesign — complete**
- Design reference: SketchUp + PD:Site Designer (Andrew Marsh)
- Font: Outfit (Google Fonts)
- Header: dark forest green #1e3d1e, 68px
- Panels: warm neutral grey #f0efed, 220px wide, collapsible
- Dropdown menus: light green #e8ece4 with dark green text
- Tool buttons: SketchUp-style left accent border on hover/active
- SVG line icons throughout
- 2D/3D toggle: hardcoded in body.html, z-index 500
- Status bar: dark green, mode badge, message
- GPR result block: dark green #2d5a24 with large white number

**Menu architecture — finalised** (see `_design.md` section 8)

**Keyboard shortcuts wired**: Ctrl+F, Ctrl+G, Ctrl+Z, Ctrl+Shift+Z, Esc

#### Decisions made
- No Vite/bundler — importmap resolves `"three"` to local file
- No Bézier/Spline in MVP
- Ctrl+A = Select All; Ctrl+Shift+S = Save As; Ctrl+Shift+Z = Redo
- `.gpr` = native session format (JSON, schema TBD)

---

### 2026-03-17 (Session 1 — ~90 mins before surgery)

- First joint review of codebase and all dev guide files
- Reviewed entire GPR - LAI Values folder; confirmed Access DB is empty
- Built full LAI processing pipeline; 760 species processed and categorised
- Clarified core vision: GPR is the point, database is the IP, CAD is scaffolding
- Identified urban context as the key scientific gap in all existing databases
- Identified Mobius Factory as mechanism for Urban Greenery Knowledge Layer
- Boon entered surgery — development paused

#### LAI Database — Final Category Counts
| Category | Count |
|---|---|
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
