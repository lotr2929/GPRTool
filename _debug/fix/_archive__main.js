// main.js — GPRTool (Boon Ong / Curtin University)

import * as THREE from "three";
import { OrbitControls } from "./js/OrbitControls.js";
import { createCamera } from "./js/camera.js";

/* ======================================
   ALARM VARIABLES (declared at top)
====================================== */
let alarmTime = null;
let alarmInterval = null;
let isRinging = false;

/* ======================================
   SITE STATE
====================================== */
let siteMesh   = null;   // THREE.Mesh — filled polygon
let siteOutline = null;  // THREE.LineLoop — boundary edge
let siteData   = null;   // { areaM2, perimeterM, pointCount, centroidLon, centroidLat, localCoords }

/* ======================================
   1) Load header + body
====================================== */
// asynchronously loads and inserts header HTML into the DOM
async function loadLayout() {
  const headerHTML = await fetch("header.html").then(r => r.text());
  document.getElementById("header-container").innerHTML = headerHTML;

  // updates the header datetime display with the current time
  function updateHeaderTime() {
    const el = document.getElementById("header-datetime");
    if (el) el.textContent = new Date().toLocaleString();
  }
  updateHeaderTime();
  setInterval(updateHeaderTime, 1000);

  document.getElementById('header-datetime').addEventListener('click', function() {
    if (isRinging) { stopAlarm(); return; }
    let popup = document.getElementById('alarm-popup');
    if (popup) { popup.remove(); return; }
    popup = createAlarmPopup();
    document.body.appendChild(popup);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    document.getElementById('alarm-time-input').value = timeStr;
    document.getElementById('set-alarm-btn').addEventListener('click', function() {
      const timeInput = document.getElementById('alarm-time-input').value;
      if (timeInput) { setAlarm(timeInput); popup.remove(); }
    });
    document.getElementById('cancel-alarm-btn').addEventListener('click', function() {
      clearAlarm(); popup.remove();
    });
  });

  const bodyHTML = await fetch("body.html").then(r => r.text());
  document.getElementById("body-container").innerHTML = bodyHTML;
}
await loadLayout();

/* ======================================
   2) DOM hooks
====================================== */
const canvas    = document.getElementById("three-canvas");
const container = canvas.parentElement;

const xIn = document.getElementById("widthX");
const yIn = document.getElementById("heightY");
const zIn = document.getElementById("depthZ");

const resetBtn    = document.getElementById("resetBtn");
const recenterBtn = document.getElementById("recenterBtn");

/* ======================================
   3) Renderer
====================================== */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/* ======================================
   4) Scene + Camera + Controls
====================================== */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdedede);

const camera = createCamera(renderer, container);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 500;
controls.minPolarAngle = Math.PI * 0.05;
controls.maxPolarAngle = Math.PI * 0.9;

/* ======================================
   5) Cube + Material (placeholder)
====================================== */
const cubeGeom = new THREE.BoxGeometry(1, 1, 1);
let cubeMat;
try {
  const tex = new THREE.TextureLoader().load("./textures/plywood.webp");
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  cubeMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
} catch {
  cubeMat = new THREE.MeshNormalMaterial();
}
const cube = new THREE.Mesh(cubeGeom, cubeMat);
scene.add(cube);

/* ======================================
   6) Lighting
====================================== */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

/* ======================================
   7) fitCameraToObject
====================================== */
// adjusts the camera to fit a 3D object with optional padding
function fitCameraToObject(object, padding = 1.3) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const radius = 0.5 * Math.max(size.x, size.y, size.z);
  const fitRadius = radius * padding;

  camera.lookAt(center);

  const fov = THREE.MathUtils.degToRad(camera.fov);
  const aspect = camera.aspect;
  const distV = fitRadius / Math.sin(fov / 2);
  const distH = fitRadius / Math.sin(Math.atan(Math.tan(fov / 2) * aspect));
  const distance = Math.max(distV, distH);

  const dir = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(camera.quaternion)
    .normalize();

  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - fitRadius * 2);
  camera.far  = distance + fitRadius * 10;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}
fitCameraToObject(cube);

/* ======================================
   8) Resize
====================================== */
// updates camera and renderer dimensions to match container size
function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
new ResizeObserver(resize).observe(container);
window.addEventListener("resize", resize);
resize();

/* ======================================
   9) Cube scaling (placeholder)
====================================== */
// applies scaling to a cube object and updates its texture mapping
function applyScale() {
  const x = Math.max(0.1, parseFloat(xIn?.value) || 1);
  const y = Math.max(0.1, parseFloat(yIn?.value) || 1);
  const z = Math.max(0.1, parseFloat(zIn?.value) || 1);
  cube.scale.set(x, y, z);
  if (cubeMat.map) { cubeMat.map.repeat.set(Math.max(1, x), Math.max(1, y)); cubeMat.map.needsUpdate = true; }
  fitCameraToObject(cube);
}
["input", "change"].forEach(evt => {
  xIn?.addEventListener(evt, applyScale);
  yIn?.addEventListener(evt, applyScale);
  zIn?.addEventListener(evt, applyScale);
});

resetBtn?.addEventListener("click", () => { xIn.value = yIn.value = zIn.value = "1"; applyScale(); });
recenterBtn?.addEventListener("click", () => fitCameraToObject(siteMesh || cube));

/* ======================================
   10) Animation Loop
====================================== */
const clock = new THREE.Clock();
// continuously updates controls and renders the 3D scene
function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

/* ======================================
   11) GeoJSON IMPORT
====================================== */

// -- Coordinate helpers --

/**
 * Equirectangular projection: WGS84 lon/lat → local metres
 * Origin is the polygon centroid.
 * Accuracy is excellent over city-block scale (<1 km).
 */
// converts longitude/latitude coordinates to metres relative to an origin point
function lonLatToMetres(lon, lat, originLon, originLat) {
  const R = 6378137; // Earth radius (m)
  const toRad = Math.PI / 180;
  const x =  (lon - originLon) * toRad * R * Math.cos(originLat * toRad);
  const y =  (lat - originLat) * toRad * R;
  return [x, y];
}

/** Shoelace formula — area of a 2D polygon from [x,y] pairs */
function polygonArea(pts) {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2;
}

/** Perimeter of a polygon from [x,y] pairs */
function polygonPerimeter(pts) {
  let p = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = pts[j][0] - pts[i][0];
    const dy = pts[j][1] - pts[i][1];
    p += Math.sqrt(dx * dx + dy * dy);
  }
  return p;
}

/** Centroid of lon/lat ring */
function centroid(ring) {
  let lonSum = 0, latSum = 0;
  for (const [lon, lat] of ring) { lonSum += lon; latSum += lat; }
  return [lonSum / ring.length, latSum / ring.length];
}

/** Format metres² with thousands separator */
function fmtArea(m2) {
  return m2 >= 10000
    ? (m2 / 10000).toFixed(4) + " ha"
    : m2.toFixed(1) + " m²";
}

/** Format metres */
function fmtDist(m) { return m.toFixed(1) + " m"; }

// -- Scene helpers --

function clearSiteFromScene() {
  if (siteMesh)    { scene.remove(siteMesh);    siteMesh.geometry.dispose();    siteMesh = null; }
  if (siteOutline) { scene.remove(siteOutline); siteOutline.geometry.dispose(); siteOutline = null; }
  siteData = null;
}

// clears and redraws a site shape in the 3D scene from local coordinates
function drawSiteInScene(localCoords) {
  clearSiteFromScene();

  // Build THREE.Shape from local coords (x = east, y = north → Three.js x/z plane)
  const shape = new THREE.Shape();
  shape.moveTo(localCoords[0][0], localCoords[0][1]);
  for (let i = 1; i < localCoords.length; i++) {
    shape.lineTo(localCoords[i][0], localCoords[i][1]);
  }
  shape.closePath();

  // Filled polygon — flat on the XZ plane (y = 0)
  const geom = new THREE.ShapeGeometry(shape);
  // Rotate shape from XY plane to XZ plane
  geom.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a8f4a,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  siteMesh = new THREE.Mesh(geom, mat);
  siteMesh.position.y = 0.01; // slightly above ground plane
  scene.add(siteMesh);

  // Outline
  const outlinePts = localCoords.map(([x, y]) => new THREE.Vector3(x, 0.02, -y));
  const outlineGeom = new THREE.BufferGeometry().setFromPoints(outlinePts);
  const outlineMat = new THREE.LineBasicMaterial({ color: 0x1e5c1e, linewidth: 2 });
  siteOutline = new THREE.LineLoop(outlineGeom, outlineMat);
  scene.add(siteOutline);
}

// displays site information and hides empty properties section
function updateSitePanel(data) {
  // Show site info section
  const emptyProps = document.getElementById("empty-props");
  const siteSection = document.getElementById("site-info-section");
  if (emptyProps)  emptyProps.style.display = "none";
  if (siteSection) siteSection.style.display = "";

  // Populate fields
  const areaEl  = document.getElementById("site-area");
  const permEl  = document.getElementById("site-perimeter");
  const ptsEl   = document.getElementById("site-points");
  if (areaEl) areaEl.textContent  = fmtArea(data.areaM2);
  if (permEl) permEl.textContent  = fmtDist(data.perimeterM);
  if (ptsEl)  ptsEl.textContent   = data.pointCount;

  // Show GPR section
  const gprSection = document.getElementById("gpr-section");
  if (gprSection) gprSection.style.display = "";

  // Status bar
  const statusMsg = document.getElementById("status-message");
  if (statusMsg) statusMsg.textContent =
    `Site imported — ${fmtArea(data.areaM2)}, ${fmtDist(data.perimeterM)} perimeter`;
}

// -- File handling --

function parseGeoJSON(text) {
  let geojson;
  try {
    geojson = JSON.parse(text);
  } catch (e) {
    alert("Could not parse file — not valid JSON.");
    return;
  }

  // Accept FeatureCollection, Feature, or bare Geometry
  let geometry = null;
  if (geojson.type === "FeatureCollection") {
    // Use the first feature with a Polygon geometry
    const feat = geojson.features.find(
      f => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
    );
    if (!feat) { alert("No Polygon features found in this GeoJSON file."); return; }
    geometry = feat.geometry;
  } else if (geojson.type === "Feature") {
    geometry = geojson.geometry;
  } else {
    geometry = geojson; // bare Geometry
  }

  // Use outer ring of first polygon
  let ring;
  if (geometry.type === "Polygon") {
    ring = geometry.coordinates[0];
  } else if (geometry.type === "MultiPolygon") {
    ring = geometry.coordinates[0][0];
  } else {
    alert("GeoJSON must contain a Polygon or MultiPolygon geometry.");
    return;
  }

  // Remove duplicate closing vertex if present
  const last = ring[ring.length - 1];
  const first = ring[0];
  const isClosed = last[0] === first[0] && last[1] === first[1];
  const openRing = isClosed ? ring.slice(0, -1) : ring;

  // Compute centroid for projection origin
  const [originLon, originLat] = centroid(openRing);

  // Project to local metres
  const localCoords = openRing.map(([lon, lat]) =>
    lonLatToMetres(lon, lat, originLon, originLat)
  );

  const areaM2     = polygonArea(localCoords);
  const perimeterM = polygonPerimeter(localCoords);

  siteData = {
    areaM2,
    perimeterM,
    pointCount: openRing.length,
    centroidLon: originLon,
    centroidLat: originLat,
    localCoords,
  };

  // Hide placeholder cube
  cube.visible = false;

  // Draw in scene
  drawSiteInScene(localCoords);

  // Fit camera to site
  fitCameraToObject(siteMesh);

  // Update right panel
  updateSitePanel(siteData);

  console.log(`Site loaded: ${areaM2.toFixed(1)} m², ${perimeterM.toFixed(1)} m perimeter, ${openRing.length} vertices`);
}

// -- Wire up button and file input --

document.addEventListener("DOMContentLoaded", () => {
  // GeoJSON import
  const importGeoJSONBtn  = document.getElementById("importGeoJSONBtn");
  const geojsonFileInput  = document.getElementById("geojsonFileInput");

  importGeoJSONBtn?.addEventListener("click", () => geojsonFileInput?.click());

  geojsonFileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseGeoJSON(ev.target.result);
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = "";
  });

  // Clear site
  const clearSiteBtn = document.getElementById("clearSiteBtn");
  clearSiteBtn?.addEventListener("click", () => {
    clearSiteFromScene();
    cube.visible = true;
    fitCameraToObject(cube);
    // Reset panels
    const emptyProps  = document.getElementById("empty-props");
    const siteSection = document.getElementById("site-info-section");
    const gprSection  = document.getElementById("gpr-section");
    if (emptyProps)  emptyProps.style.display  = "";
    if (siteSection) siteSection.style.display = "none";
    if (gprSection)  gprSection.style.display  = "none";
    const statusMsg = document.getElementById("status-message");
    if (statusMsg) statusMsg.textContent = "Ready — import a 3D model or site boundary to start";
  });

  // Fit to site button
  const fitSiteBtn = document.getElementById("fitSiteBtn");
  fitSiteBtn?.addEventListener("click", () => {
    fitCameraToObject(siteMesh || cube);
  });
});

/* ======================================
   12) ALARM FUNCTIONALITY
====================================== */

// creates a DOM element for an alarm popup interface
function createAlarmPopup() {
  const popup = document.createElement('div');
  popup.className = 'alarm-popup';
  popup.id = 'alarm-popup';
  popup.innerHTML = `
    <h4>Set Alarm</h4>
    <input type="time" id="alarm-time-input" />
    <button id="set-alarm-btn">Set Alarm</button>
    <button id="cancel-alarm-btn" style="background: var(--color-border); margin-top: 6px;">Cancel</button>
  `;
  return popup;
}

// sets an alarm time and adjusts it to the next day if it's in the past
function setAlarm(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  alarmTime = new Date();
  alarmTime.setHours(hours, minutes, 0, 0);
  if (alarmTime <= now) alarmTime.setDate(alarmTime.getDate() + 1);
  const datetimeEl = document.getElementById('header-datetime');
  datetimeEl.classList.add('alarm-active');
  if (alarmInterval) clearInterval(alarmInterval);
  alarmInterval = setInterval(checkAlarm, 1000);
}

// checks if the current time has reached the alarm time and triggers it if so
function checkAlarm() {
  if (!alarmTime) return;
  if (new Date() >= alarmTime) triggerAlarm();
}

// activates the alarm visual and audio feedback
function triggerAlarm() {
  isRinging = true;
  const datetimeEl = document.getElementById('header-datetime');
  datetimeEl.classList.remove('alarm-active');
  datetimeEl.classList.add('alarm-ringing');
  if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
}

// deactivates the alarm and cleans up related resources
function stopAlarm() {
  isRinging = false;
  const datetimeEl = document.getElementById('header-datetime');
  datetimeEl.classList.remove('alarm-ringing', 'alarm-active');
  alarmTime = null;
  if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
}

// removes alarm-related visual indicators and clears the alarm time
function clearAlarm() {
  document.getElementById('header-datetime')?.classList.remove('alarm-active');
  alarmTime = null;
  if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
}
