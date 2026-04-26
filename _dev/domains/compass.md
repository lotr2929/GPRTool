# Compass (NPoint)

**System:** compass **Status:** active — modules marked "DO NOT MODIFY" in `_dev/_architecture.md`**Modules:** `app/js/north-point-2d.js`, `app/js/north-point-3d.js`**Last updated:** 2026-04-25 by Claude (full sweep of `_dev/`, `_context/`, journal + archive)

---

## 1. Intent

A compass widget showing the relationship between Design North (the user's chosen project north) and True North (geographic north). Visible only inside the Three.js viewport (never in the Cesium globe). Two forms:

- **2D widget** — DOM/SVG, visible in both Three.js 2D and 3D modes.
- **3D HUD gizmo** — WebGL mesh, visible in Three.js 3D mode only.

Together they make the angular relationship between TN and DN legible at all times during design, and let the user redefine either angle without leaving the viewport.

## 2. Architecture

**2D widget** (`north-point-2d.js`):

- DOM: `#np-container` (fixed wrapper, draggable/resizable) → `#np-rotator` (rotates as camera turns) → SVG (`viewBox 0 0 64 72`, circle centre at `SVG_CX=32, SVG_CY=40`).
- Injected children: `dnGroupEl` (green DN arrow + angle label, `#np-n-label`), `tnNeedleEl` (TN needle group from SVG).
- State persisted in `localStorage` under `gprtool-np2d-state`: `{right, bottom, w, visible, dn}`.
- Driven by `getState()` callback returning `{currentMode, camera2D, camera3D, controls3D, pan2D}`. Updated every animation frame via `updateNorthRotation()`.
- Resize: width-only, height derived from `NP_BASE_W : NP_BASE_H` (77 : 86). Clamps `MIN_W=38`, `MAX_W=231`.
- DN label repositioning is per-frame: default at top (`y=14`); when N is within ±40° of top, label shifts left or right to avoid overlap.

**3D gizmo** (`north-point-3d.js`):

- Compass mesh = `THREE.Mesh(PlaneGeometry(3,3), MeshBasicMaterial)` with a 512×512 `CanvasTexture` redrawn only when DN/TN angles change (`_lastDrawnDnDeg`, `_lastDrawnGnDeg` sentinels).
- Lives in the **main scene**, rendered by the **main camera**. No separate gizmo scene or camera.
- Each frame: raycast from a fixed NDC corner (currently `(0.82, -0.82)`) through `camera3D` onto the Y=0 ground plane; place mesh there; scale by `pixelsPerUnit = ch / (2 * dist * tan(fov/2))` so it stays a constant pixel size regardless of zoom.
- `mesh.rotation.x = -Math.PI / 2` (lays the plane flat on the ground). `scale.x = -1` un-mirrors the canvas texture horizontally.
- Reads angles from 2D module via `getDesignNorthAngle()` / `getGlobalNorthAngle()`.

**Coordinate frame** (locked, see `_dev/_architecture.md`):

- **East = +X, Up = +Y, North = -Z**. Three.js default Y-up. Forever.
- `wgs84ToScene(lat, lng) → {x, z}` with `z < 0` north of anchor. Lives only in `real-world.js`.

**Visibility coupling with viewport switch:**

- `showThreeJSView()` does **NOT** touch NPoint visibility — the modules manage their own state (N-59).
- Only `showCesiumView()` explicitly hides both, to clear the Cesium viewport.

## 3. Constraints

*Read before any proposal. This is the guardrail core.*

### LOCKED decisions

| Decision | Locked because | Reversal cost |
|----------|----------------|---------------|
| **Two independent angle variables.** `designNorthAngle` (rotates Design Grid). `globalNorthAngle` (rotates TN needle only). Rotating TN does NOT rotate the grid. Setting DN DOES. | N-43. Conflating them caused grid misalignment + compass tilt errors across multiple sessions. | High — every `applyGlobalNorth` / `applyDesignNorth` callsite would need re-auditing. |
| **3D compass is a real 3D mesh in the main scene, rendered by the main camera.** No separate gizmo camera, no orthographic overlay, no scissor render. | N-35, N-41. The "perspective distortion" of the compass is the **correct** visual signal that the 3D viewport is tilted — not a bug to hide. A separate camera can never match the main camera's perspective. | High — would re-introduce scissor + secondary scene plumbing already removed. |
| **2D compass: `#np-container` is the fixed positional wrapper; only the inner `#np-rotator` rotates.** | Drag offset and resize anchor maths assume the container is axis-aligned. | Medium. |
| **`globalNorthAngle` is set ONLY via "Rotate N Point" (TN input or TN needle drag in rotate mode). `designNorthAngle` is set ONLY via "Set Design North".** | N-43 + bug history (`np-ctx-rotate-np` once wrongly called `showDNInput`; `handleDrag` once mixed `rotateStartDN` with `applyGlobalNorth`). | Medium. |
| **Coordinate frame: East=+X, Up=+Y, North=−Z. Y-up, Three.js default.** | `_dev/_architecture.md` lists this as cast in stone. All compass maths assume it. | Project-wide. |
| **NPoint modules are marked "DO NOT MODIFY" in `_dev/_architecture.md`.** | Both modules are stable and load-bearing for the design workflow. Any edit needs an explicit, narrowly scoped reason. | Per-edit — every change is a deliberate exception. |
| **`showThreeJSView()` must never touch NPoint visibility.** | N-59. Modules manage their own visibility; external toggling races with module state. | Low — but easy to regress. |

### Anti-patterns

| Pattern | Why it breaks |
|---------|---------------|
| Separate orthographic/perspective `gizmoCamera` with a duplicated compass mesh + scissor render. | N-35, N-41: cannot match main camera tilt/zoom; visually decouples from the scene. |
| `gizmoCamera.quaternion.copy(camera3D.quaternion)` (copies pitch). | Apr 12 brief benchmark: caused "back-face / oblique view" bug where E/W axes appeared swapped. Superseded entirely by N-35 (mesh in main scene), so the patch is moot — but the *anti-pattern* is recorded. |
| Rotating `#np-container` instead of `#np-rotator`. | Drag offset and resize anchor maths assume the container is axis-aligned. |
| `np-ctx-rotate-np` handler calling `showDNInput`. | Rotates the design grid when the user only wanted to nudge True North. |
| Reading `designNorthAngle` from a global instead of via `getDesignNorthAngle()` from `north-point-2d.js`. | Source of truth lives in the 2D module; globals drift. |
| Mixing `rotateStartDN` with `applyGlobalNorth` (or vice versa) inside `handleDrag` while `isRotating`. | The N-43 conflation. Fixed Apr 8/9 archive. |
| Dragging the N letter on the compass to enter rotate mode. | Repeatedly fragile. Replaced by right-click "Rotate N Point…" command (`_session.md`). |
| Hiding the compass with `visibility:hidden`. | N-58: events still fire. Use `display:none`. |
| Leaving orphaned code outside any function after a partial replacement. | N-60: `SyntaxError: Unexpected token '}'` → blank screen. Always verify after replacement. |

### Exhausted approaches

| Approach | Tried when | Why it failed |
|----------|------------|---------------|
| Separate gizmo scene + `OrthographicCamera` + scissor rendering. | Pre-N-35 (sessions ~#18–#19). | Could not match main camera perspective; tilt looked wrong on every orbit. |
| Yaw-only Euler fix (`Euler(PI/2, euler.y, 0, 'YXZ')`) on `gizmoCamera`. | 12 Apr 2026 benchmark. | Patched the back-face symptom but kept the wrong architecture. Superseded by N-35. |
| Fixed-rect scissor for the gizmo. | Around N-39. | Once compass became a real 3D mesh, its projected bounding box changes with the camera; fixed rect clipped the corners. |
| `renderer.autoClear = true` while drawing a secondary HUD scene. | N-40. | Wipes the main scene; HUD must use `autoClear=false`. (Now moot — no secondary scene.) |
| Drag-the-N-letter to enter rotate mode. | Multiple early sessions. | Drag detection vs click detection kept conflicting; right-click context menu replaced it. |
| `localStorage` keys `gprtool-north-pos-v3`, `gprtool-north-scale-v1`. | Pre-Apr 2026. | Replaced by single `gprtool-np2d-state`. Old keys can be deleted on sight. |

## 4. Solution patterns

*Recipes that have worked. Read when proposing fixes.*

| When | Do | Because |
|------|-----|---------|
| Read the current Design North angle outside `north-point-2d.js`. | `import { getDesignNorthAngle } from './north-point-2d.js'`. | Single source of truth. |
| Set Design North from a typed string. | `parseNorthAngle(str)` — accepts `7`, `-7`, `+7`, `7W`, `7E`, `7.4`, `7°22'`, `7°22'W`, `7d22'E`. Returns decimal degrees, +ve = east/clockwise, or `null`. | Already battle-tested. |
| Add a new compass action via context menu. | New `np-ctx-*` element + handler that calls **either** `showDNInput` **or** `showTNInput` — never both. | Preserves N-43 separation. |
| Compass should appear at a fixed screen corner in 3D mode. | Raycast NDC corner (e.g. `0.82, -0.82`) → Y=0 plane → place mesh there → scale by `pixelsPerUnit`. | N-35 / N-41. |
| Compass canvas texture appears blurry. | `CanvasTexture` with `generateMipmaps=false`, `minFilter=THREE.LinearFilter`. | Already set in `_buildCompassMesh()`. |
| Resize the 2D compass. | Width is the single dimension; height tracks via `NP_BASE_W : NP_BASE_H`. Clamp `[MIN_W, MAX_W]`. | Constants in module. |
| Persist 2D compass state across reloads. | Write `{right, bottom, w, visible, dn}` to `localStorage[gprtool-np2d-state]`. | Existing convention. |
| User wants to enter "Rotate N Point" mode. | Right-click `#np-container` → context menu → "Rotate N Point…" → opens TN input panel + sets `rotateMode=true`. Drag handler routes to rotate logic instead of move. Capture-phase keydown intercepts Enter (commit) / Escape (exit). Click outside both panel and NP icon's green outline also exits. | Reliable entry point after N-drag was abandoned. |
| Switching viewports (Cesium ↔ Three.js). | Call `showCesiumView()` / `showThreeJSView()` only. Never reach into NPoint visibility from outside its modules. | N-59. |

## 5. Known issues

*Currently open. What is broken or weak right now.*

| Issue | Impact | Workaround |
|-------|--------|------------|
| Pending three-angle architecture (`trueNorthAngle`, `designNorthAngle`, `rotate2D`) — not yet coded. NP icon currently shows `trueNorthAngle - rotate2D` assuming `trueNorthAngle = 0`. | OBJ/GLB imports without geographic anchor display TN incorrectly. | Designed in `_dev/_session.md` "Pending — next session"; implementation deferred. |
| <!-- ADD any current bug here on next edit --> |  |  |

## 6. History

*Chronological log. Read on demand only, not at session start.*

| Date | Change | Outcome |
|------|--------|---------|
| 2026-04-08 | Two-angle separation enforced: `np-ctx-rotate-np` → `showTNInput`; rotation drag path → `rotateStartGlobalNorth` + `applyGlobalNorth`. | Bugs B1/B2 fixed. |
| 2026-04-09 | N-35 — reverted from `gizmoCamera` + scissor approach to compass-mesh-in-main-scene. | Perspective now correct under all camera angles. |
| 2026-04-09 | N-39 / N-40 / N-41 codified: dynamic 4-corner scissor, `autoClear=false`, HUD-as-3D-mesh. | Final architecture. |
| 2026-04-09 | N-43 codified: two-angle-variables. | Locked. |
| 2026-04-12 | Brief benchmark for "back-face / oblique view" bug authored. Proposed Euler('YXZ') fix on `gizmoCamera`. | Superseded by N-35 — fix never applied; benchmark kept as eval reference. |
| 2026-04-18 (#23) | Resizable panels + right-click context menu rolled out. | Compass widget fits new chrome. |
| 2026-04-21 | `_dev/_architecture.md` written. NPoint modules formally marked "DO NOT MODIFY". Coordinate frame locked: East=+X, Up=+Y, North=−Z. | Architectural anchors. |
| 2026-04-25 | This domain doc seeded into PCM. | Stage 1 Step 5. |
