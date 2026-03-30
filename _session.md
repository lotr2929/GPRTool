# GPRTool — Session Status

**Last updated:** 2026-03-29 (Session 6)
**Live:** https://gprtool-demo.vercel.app

---

## What was done this session

### Infrastructure
- Created `_dev_guide.md` — developer rules for AI and human contributors covering module structure, tool architecture, CSS/DOM/Three.js conventions, localStorage registry, extraction procedure
- `_map.md` updated to reference `_dev_guide.md`
- `_dev_guide.md` Section 2 clarified: defers to `_map.md` for current state, defines target structure only

### North Point 2D — extracted to module
- `frontend/js/north-point-2d.js` created — self-contained ES module
- `body.html` updated: `#north-point` → `#np-container` + `#np-rotator` split (container/rotator pattern)
- `styles.css` updated: NP CSS replaced with clean container/rotator rules, CSS variables removed, `#np-ctx-menu` moved here
- `index.html` updated: inline NP CSS removed, import added, old element declarations removed, ~330 lines of NP JS replaced with single `initNorthPoint2D(...)` call

### Design North feature
- Right-click NP → "Set Design North…" → inline input field
- Accepts: `7`, `-7`, `7W`, `7E`, `7.4`, `7°22'`, `7°22'W` etc.
- Green arrow inside circle points to design north angle
- Angle text outside circle, dark green, aligned away from N letter (right-aligned for W, left-aligned for E)
- "Clear Design North" menu item (visible only when DN is set)
- State persisted in localStorage `gprtool-np2d-state` with `dn` field
- Invalid input shakes red, stays open

### deploy.bat
- Commit message now auto-generated — no prompt
- Format: `2026-03-29 14:32 - north-point-2d.js, styles.css, body.html`
- Uses PowerShell temp file approach to avoid cmd quoting issues

---

## Current state

- All changes deployed to Vercel
- North point: drag, resize, rotate, Design North all working
- 2D viewport rotation (middle mouse) and N key: **coded but NOT yet deployed** — was discussed and coded during session but deployment was skipped pending further discussion on True North / Design North architecture

---

## Pending — next session

### 2D viewport rotation (already coded in index.html, needs deploy + test)
- Middle mouse drag = rotate 2D view
- N key = snap back to north-up
- Pan is rotation-aware
- `rotate2D` passed to `initNorthPoint2D` via getState callback

### True North architecture (agreed design, not yet coded)
Three angles:
1. `trueNorthAngle` — geographic north vs world -Z. Auto = 0 for GeoJSON. User-set for OBJ/GLB.
2. `designNorthAngle` — site orientation reference, independent of true north (already implemented as DN arrow)
3. `rotate2D` — viewport rotation, independent of both

NP icon shows: `trueNorthAngle - rotate2D` (currently assumes trueNorthAngle = 0)

Setting methods:
- Method A: Enter degrees (primary)
- Method B: Pick two points on screen (future)

"Set True North" to be added to NP context menu (same UX as Set Design North)

### lib/ subfolder
- `frontend/js/lib/` subfolder for Three.js files not yet created (target structure in `_dev_guide.md`)

### localStorage key cleanup
- Old keys `gprtool-north-pos-v3` and `gprtool-north-scale-v1` no longer used — can be cleaned up
