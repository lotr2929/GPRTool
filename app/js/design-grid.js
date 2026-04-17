/*
 * design-grid.js — Design Grid system for GPRTool
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURAL CONTEXT — READ BEFORE EDITING
 * ════════════════════════════════════════════════════════════════════════════
 *
 * GPRTool CAD Universe (permanent, never modified)
 * ─────────────────────────────────────────────────
 * Standard architectural / GIS coordinate convention:
 *   X = East   Y = North   Z = Up
 *
 * Three.js internal mapping (Y-up graphics engine):
 *   Three.X =  East   (same as CAD X)
 *   Three.Y =  Up     (= CAD Z)
 *   Three.Z = -North  (= negative CAD Y; so CAD North = Three -Z)
 *
 * The CAD Universe grid (gridHelper in index.html) is ALWAYS aligned with
 * True North. It must NEVER rotate. It is the fixed georeferenced reference.
 *
 * All imported geometry (CADMapper DXF, OBJ, site boundary) also lives in
 * the CAD Universe and must never rotate.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DESIGN GRID CONCEPT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A Design Grid is a USER-DEFINED overlay that does NOT belong to the CAD
 * Universe. It is defined by two parameters only:
 *
 *   origin  (Vector3) — a point ON the selected surface
 *   xAxis   (Vector3) — a direction vector LYING IN the surface plane
 *                       (the user-indicated "Design East" direction)
 *
 * From these two, all else is computed:
 *   yAxis  = cross(surfaceNormal, xAxis).normalize()   — Design North
 *   normal = surface normal                            — Design Up (= grid Z)
 *
 * The grid lines run parallel to xAxis and yAxis.
 * Spacing is user-controlled (major metres, minor subdivisions).
 * The grid is rendered as a flat overlay on the surface plane.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CURRENT PHASE — Phase 1 (DXF model, horizontal ground plane)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   origin  = centre of the DXF model (world 0,0,0 after import centering)
 *   surface = ground plane (normal = Three.Y = CAD Z = Up)
 *   xAxis   = derived from designNorthAngle (NPoint compass rotation)
 *             xAxis = (sin(dnRad), 0, -cos(dnRad))  [Three.js Y-up coords]
 *
 * When the user rotates the NPoint compass, designNorthAngle changes.
 * The Design Grid group is simply rotated around Y (cheap matrix op, no
 * geometry rebuild). The CAD Universe grid and the DXF model never move.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * FUTURE PHASE — "Insert Design Grid" command
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Command flow (to be implemented):
 *   1. User selects a surface → surface.normal and surface plane defined
 *   2. User clicks a point on the surface → origin (Vector3)
 *   3. User drags to indicate X-axis direction → xAxis (Vector3 in surface plane)
 *   4. DesignGridManager.addGrid({ origin, xAxis, normal, ... }) is called
 *
 * Surface types and their grid planes:
 *   Ground / roof (horizontal):
 *     normal = (0,1,0) [Three.js Y = CAD Z = Up]
 *     grid XY plane is horizontal at elevation = origin.y
 *
 *   Wall facing East (vertical):
 *     normal = (1,0,0) [Three.js +X = East]
 *     xAxis lies along the wall (e.g. up = (0,1,0) or along wall strike)
 *     grid XY plane is the wall face; Z points out of the wall
 *
 *   Wall facing North (vertical):
 *     normal = (0,0,-1) [Three.js -Z = CAD North]
 *
 *   Sloped surface:
 *     normal = surface face normal (computed from mesh triangle normals)
 *     xAxis = user-defined direction projected onto the slope
 *
 * Multiple Design Grids can coexist. Each is independent: its own origin,
 * xAxis, spacing, and surface. They are managed by DesignGridManager.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IMPLEMENTATION NOTE — horizontal grid efficiency
 * ════════════════════════════════════════════════════════════════════════════
 *
 * For Phase 1 (horizontal grid), the grid geometry is built ONCE with
 * xAxis aligned to True North. The group's rotation.y is updated each frame
 * to match designNorthAngle. This avoids rebuilding geometry on every
 * compass rotation — the Three.js matrix update is essentially free.
 *
 * For surface grids (future), a full quaternion / matrix approach is needed
 * because rotation.y alone cannot represent arbitrary 3D orientations.
 * Use group.quaternion or group.matrix to position and orient the grid.
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

const DESIGN_GRID_MAJOR_COLOUR  = 0x3a6b30; // GPRTool accent green
const DESIGN_GRID_MAJOR_OPACITY = 0.6;
const DESIGN_GRID_MINOR_COLOUR  = 0x5d9450; // lighter green
const DESIGN_GRID_MINOR_OPACITY = 0.28;

// ─────────────────────────────────────────────────────────────────────────────
//  DesignGrid — a single Design Grid instance
// ─────────────────────────────────────────────────────────────────────────────

export class DesignGrid {
  /**
   * @param {Object} THREE     - Three.js module reference
   * @param {Object} params
   * @param {string}           [params.id]             - Unique identifier (auto-generated if omitted)
   * @param {string}           [params.label]          - Display label
   * @param {THREE.Vector3}    params.origin           - Origin point on the surface (world space)
   * @param {THREE.Vector3}    params.xAxis            - X-axis direction in the surface plane
   * @param {THREE.Vector3}    params.normal           - Surface normal (= Design Grid Z-axis)
   * @param {number}           [params.majorSpacing]   - Major cell size in metres (default 100)
   * @param {number}           [params.minorDivisions] - Sub-divisions per major cell (default 0)
   * @param {number}           [params.extent]         - Half-extent of the grid in metres (default 5000)
   */
  constructor(THREE, params) {
    this.THREE  = THREE;
    this.id     = params.id    ?? ('dg-' + Date.now());
    this.label  = params.label ?? 'Design Grid';

    this.origin = params.origin.clone();
    this.xAxis  = params.xAxis.clone().normalize();
    this.normal = params.normal.clone().normalize();

    // yAxis = Design North direction (perpendicular to xAxis, lying in surface plane)
    this.yAxis  = new THREE.Vector3()
      .crossVectors(this.normal, this.xAxis)
      .normalize();

    this.majorSpacing   = params.majorSpacing   ?? 100;
    this.minorDivisions = params.minorDivisions ?? 0;
    this.extent         = params.extent         ?? 5000;

    // _group is the Three.js object added to the scene.
    // For Phase 1 (horizontal): rotation.y is set externally to match designNorthAngle.
    // For surface grids (future): group.quaternion or group.matrix is set externally.
    this._group = new THREE.Group();
    this._group.name = `design-grid-${this.id}`;

    this._build();
  }

  /** The Three.js Group to add to the scene. */
  get group() { return this._group; }

  /**
   * Update spacing then rebuild geometry.
   * Call this when the user changes Major Grid / Minor Grid in the popup.
   */
  setSpacing(majorSpacing, minorDivisions) {
    let changed = false;
    if (majorSpacing   !== undefined && majorSpacing   !== this.majorSpacing)   { this.majorSpacing   = majorSpacing;   changed = true; }
    if (minorDivisions !== undefined && minorDivisions !== this.minorDivisions) { this.minorDivisions = minorDivisions; changed = true; }
    if (changed) this._rebuild();
  }

  /**
   * Update extent (half-size of the grid) then rebuild.
   * Called from updateSceneHelpers when site span changes.
   */
  setExtent(extent) {
    if (extent !== this.extent) { this.extent = extent; this._rebuild(); }
  }

  /** Show or hide the grid. */
  setVisible(v) { this._group.visible = v; }

  /** Remove geometry and dispose GPU resources. */
  dispose() { this._clearGroup(); }

  // ── Private ───────────────────────────────────────────────────────────────

  _rebuild() { this._clearGroup(); this._build(); }

  _clearGroup() {
    while (this._group.children.length) {
      const c = this._group.children[0];
      c.geometry?.dispose();
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
      else c.material?.dispose();
      this._group.remove(c);
    }
  }

  /**
   * Build line geometry for the Design Grid.
   *
   * The grid is built with xAxis aligned to True North (rotation = 0).
   * For Phase 1, external code sets group.rotation.y to apply Design North.
   * For surface grids (future), group.quaternion/matrix is set instead.
   *
   * Lines are batched into two LineSegments (major + minor) for efficiency.
   * One draw call per colour rather than one per line.
   */
  _build() {
    const { THREE, origin, xAxis, yAxis, majorSpacing, minorDivisions, extent } = this;

    const count = Math.ceil(extent / majorSpacing);
    const half  = count * majorSpacing;

    const majorVerts = [];
    const minorVerts = [];

    // Helper: world point = origin + along * dAlong + perp * dPerp
    const pt = (along, dAlong, perp, dPerp, target = new THREE.Vector3()) =>
      target.copy(origin)
        .addScaledVector(along, dAlong)
        .addScaledVector(perp,  dPerp);

    const pushLine = (buf, a, b) => {
      buf.push(a.x, a.y, a.z, b.x, b.y, b.z);
    };

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();

    // Lines parallel to xAxis (spaced along yAxis)
    for (let i = -count; i <= count; i++) {
      const d = i * majorSpacing;
      pushLine(majorVerts, pt(yAxis, d, xAxis, -half, a), pt(yAxis, d, xAxis, half, b));
      if (minorDivisions >= 2 && i < count) {
        const sub = majorSpacing / minorDivisions;
        for (let m = 1; m < minorDivisions; m++) {
          const dm = d + m * sub;
          pushLine(minorVerts, pt(yAxis, dm, xAxis, -half, a), pt(yAxis, dm, xAxis, half, b));
        }
      }
    }

    // Lines parallel to yAxis (spaced along xAxis)
    for (let i = -count; i <= count; i++) {
      const d = i * majorSpacing;
      pushLine(majorVerts, pt(xAxis, d, yAxis, -half, a), pt(xAxis, d, yAxis, half, b));
      if (minorDivisions >= 2 && i < count) {
        const sub = majorSpacing / minorDivisions;
        for (let m = 1; m < minorDivisions; m++) {
          const dm = d + m * sub;
          pushLine(minorVerts, pt(xAxis, dm, yAxis, -half, a), pt(xAxis, dm, yAxis, half, b));
        }
      }
    }

    if (majorVerts.length) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(majorVerts), 3));
      this._group.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({
        color: DESIGN_GRID_MAJOR_COLOUR, opacity: DESIGN_GRID_MAJOR_OPACITY, transparent: true,
      })));
    }

    if (minorVerts.length) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(minorVerts), 3));
      this._group.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({
        color: DESIGN_GRID_MINOR_COLOUR, opacity: DESIGN_GRID_MINOR_OPACITY, transparent: true,
      })));
    }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
//  DesignGridManager — manages the collection of Design Grids
// ─────────────────────────────────────────────────────────────────────────────

const HORIZONTAL_ID = 'design-grid-horizontal';

export class DesignGridManager {
  /**
   * @param {Object}       THREE  - Three.js module reference
   * @param {THREE.Scene}  scene  - The scene to add grids to
   */
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.grids = new Map();   // id → DesignGrid
    this._activeId = null;
  }

  // ── Phase 1 API — horizontal Design Grid driven by NPoint ─────────────────

  /**
   * Create or update the single horizontal Design Grid.
   *
   * Called once after a DXF or model import to establish the grid.
   * The grid is built with True North xAxis; rotation is applied separately
   * via setHorizontalRotation() in the animation loop.
   *
   * @param {number}        majorSpacing   - Major cell size in metres
   * @param {number}        minorDivisions - Sub-divisions per major cell (0 = none)
   * @param {number}        extent         - Half-extent in metres
   * @param {THREE.Vector3} [origin]       - Origin in world space (default 0,0,0)
   */
  initHorizontal(majorSpacing, minorDivisions, extent, origin) {
    const THREE = this.THREE;

    // True North xAxis in Three.js Y-up coords = (0,0,-1)
    // Rotation is applied via group.rotation.y externally — no need to bake it in.
    const xAxis  = new THREE.Vector3(0, 0, -1);   // True North direction
    const normal = new THREE.Vector3(0, 1,  0);   // Horizontal surface, Y = Up
    const org    = origin ?? new THREE.Vector3(0, 0, 0);

    if (this.grids.has(HORIZONTAL_ID)) {
      const g = this.grids.get(HORIZONTAL_ID);
      g.setSpacing(majorSpacing, minorDivisions);
      g.setExtent(extent);
    } else {
      this.addGrid({
        id:             HORIZONTAL_ID,
        label:          'Design Grid',
        origin:         org,
        xAxis,
        normal,
        majorSpacing,
        minorDivisions,
        extent,
      });
      this._activeId = HORIZONTAL_ID;
    }
  }

  /**
   * Apply the Design North rotation to the horizontal grid.
   * Called EVERY FRAME from the animation loop — cheap (matrix only, no rebuild).
   *
   * @param {number} rotY - rotation.y value in radians (= -designNorthAngle * π/180)
   */
  setHorizontalRotation(rotY) {
    const grid = this.grids.get(HORIZONTAL_ID);
    if (grid) grid.group.rotation.y = rotY;
  }

  /**
   * Update spacing for the horizontal grid.
   * Called from the Grid Spacing popup (applyAll).
   */
  setHorizontalSpacing(majorSpacing, minorDivisions) {
    const grid = this.grids.get(HORIZONTAL_ID);
    if (grid) grid.setSpacing(majorSpacing, minorDivisions);
  }

  /**
   * Update the extent (half-size) of the horizontal grid.
   * Called from updateSceneHelpers when site span changes.
   */
  setHorizontalExtent(extent) {
    const grid = this.grids.get(HORIZONTAL_ID);
    if (grid) grid.setExtent(extent);
  }

  // ── Visibility ─────────────────────────────────────────────────────────────

  /**
   * Show or hide all Design Grids.
   * Called from switchMode() to hide in 3D and show in 2D (same as CAD grid).
   *
   * @param {boolean} v
   */
  setVisible(v) {
    for (const g of this.grids.values()) g.setVisible(v);
  }

  // ── Future API — "Insert Design Grid" command ──────────────────────────────

  /**
   * Add a new Design Grid to the scene.
   *
   * FUTURE USE: called by "Insert Design Grid" after the user defines:
   *   1. A surface (provides normal vector)
   *   2. An origin point on the surface (Vector3)
   *   3. An X-axis direction in the surface plane (Vector3)
   *
   * For surface grids, the caller must also set the group's world transform
   * after this call if the grid is not at the world origin. Example:
   *
   *   const id = mgr.addGrid({ origin, xAxis, normal, ... });
   *   // For arbitrary orientation, set group quaternion:
   *   // mgr.getGrid(id).group.quaternion.setFromUnitVectors(...)
   *
   * @param {Object} params - See DesignGrid constructor
   * @returns {string} id of the new grid
   */
  addGrid(params) {
    const grid = new DesignGrid(this.THREE, params);
    this.grids.set(grid.id, grid);
    this.scene.add(grid.group);
    return grid.id;
  }

  /** Get a grid by id. */
  getGrid(id) { return this.grids.get(id); }

  /** Remove a grid and dispose its GPU resources. */
  removeGrid(id) {
    const grid = this.grids.get(id);
    if (!grid) return;
    this.scene.remove(grid.group);
    grid.dispose();
    this.grids.delete(id);
    if (this._activeId === id) this._activeId = null;
  }

  /** Remove all Design Grids. */
  clear() {
    for (const id of [...this.grids.keys()]) this.removeGrid(id);
  }
}
