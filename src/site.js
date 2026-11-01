import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const Z_EXAG = 1;

const statusEl = document.getElementById('status');
const titleEl = document.getElementById('site-title');
const canvas = document.getElementById('canvas');
const waterRange = document.getElementById('water-range');
const waterLabel = document.getElementById('water-label');
const waterContext = document.getElementById('water-context');

let scene, camera, renderer, controls;
let terrainMesh = null;
let waterMesh = null;
let markerGroup = null;
let naipTexture = null;
let snap = null;

function setStatus(m) { statusEl.textContent = m; }

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#3a7fb8');
  g.addColorStop(0.7, '#8fc4e8');
  g.addColorStop(1, '#d6ecf7');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1e7);
  camera.up.set(0, 0, 1);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = (85 * Math.PI) / 180;

  (function tick() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();
}

function clampedZ(zArr) {
  const sorted = Float32Array.from(zArr).sort();
  const n = sorted.length;
  const q25 = sorted[Math.floor(n * 0.25)];
  const q75 = sorted[Math.floor(n * 0.75)];
  const fence = q75 + 5 * (q75 - q25); // Tukey outer fence
  // Outliers above fence are 3DEP NoData in the ocean — sink them, don't clamp.
  return zArr.map(v => (v > fence || v <= 0) ? -5 : v);
}

function buildTerrain(s) {
  const x = s.x, y = s.y, z = clampedZ(s.field), elts = s.elements;
  const nv = x.length;
  const positions = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    positions[3 * i + 0] = x[i];
    positions[3 * i + 1] = y[i];
    positions[3 * i + 2] = z[i] * Z_EXAG;
  }
  const ne = elts.length;
  const idx = new Uint32Array(ne * 3);
  for (let j = 0; j < ne; j++) {
    idx[3 * j + 0] = elts[j][0] - 1;
    idx[3 * j + 1] = elts[j][1] - 1;
    idx[3 * j + 2] = elts[j][2] - 1;
  }

  const [xmin, ymin, xmax, ymax] = s.bbox;
  const uvs = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) {
    uvs[2 * i + 0] = (x[i] - xmin) / (xmax - xmin);
    uvs[2 * i + 1] = (y[i] - ymin) / (ymax - ymin);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(idx, 1));
  geom.computeVertexNormals();

  naipTexture = new THREE.TextureLoader().load('data/' + s.imagery);
  naipTexture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: naipTexture, side: THREE.DoubleSide });
  terrainMesh = new THREE.Mesh(geom, mat);
  scene.add(terrainMesh);
}

// Ground elevation at (x0,y0) by nearest-neighbor over the mesh verts.
// Good enough for a single marker; the mesh is finer at the shoreline.
function groundZAt(s, x0, y0) {
  let bestD = Infinity, bestZ = 0;
  for (let i = 0; i < s.x.length; i++) {
    const dx = s.x[i] - x0, dy = s.y[i] - y0;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; bestZ = s.field[i]; }
  }
  return bestZ;
}

function makeLabelSprite(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(text, c.width / 2, c.height / 2);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 10;
  return sprite;
}

function buildMarker(s) {
  const x0 = s.center[0], y0 = s.center[1];
  const groundZ = groundZAt(s, x0, y0) * Z_EXAG;
  markerGroup = new THREE.Group();

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(4, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xe02020 }),
  );
  sphere.position.set(x0, y0, groundZ + 4);
  sphere.renderOrder = 10;
  markerGroup.add(sphere);

  const label = makeLabelSprite('You are here');
  label.position.set(x0, y0, groundZ + 24);
  label.scale.set(80, 20, 1);
  markerGroup.add(label);

  scene.add(markerGroup);
}

// Precompute a regular grid of ground-Z over the mesh bbox. Nearest-neighbor
// lookup from (x,y) is O(1) instead of O(n_mesh_verts) per building vertex.
function buildGroundGrid(s, nx = 128, ny = 128) {
  const [xmin, ymin, xmax, ymax] = s.bbox;
  const xspan = xmax - xmin, yspan = ymax - ymin;
  const grid = new Float32Array(nx * ny);
  const bestD = new Float32Array(nx * ny).fill(Infinity);
  grid.fill(-5);
  for (let i = 0; i < s.x.length; i++) {
    const ix = Math.min(nx - 1, Math.max(0, Math.floor((s.x[i] - xmin) / xspan * nx)));
    const iy = Math.min(ny - 1, Math.max(0, Math.floor((s.y[i] - ymin) / yspan * ny)));
    const k = iy * nx + ix;
    // Keep the max-z vertex that falls in the cell (building sits on highest
    // nearby ground so wall never pokes through terrain).
    if (s.field[i] > grid[k] || bestD[k] === Infinity) {
      grid[k] = s.field[i];
      bestD[k] = 0;
    }
  }
  return { grid, nx, ny, xmin, ymin, xspan, yspan };
}

function groundZFromGrid(g, x, y) {
  const ix = Math.min(g.nx - 1, Math.max(0, Math.floor((x - g.xmin) / g.xspan * g.nx)));
  const iy = Math.min(g.ny - 1, Math.max(0, Math.floor((y - g.ymin) / g.yspan * g.ny)));
  return g.grid[iy * g.nx + ix];
}

// Build one merged BufferGeometry across all buildings — one draw call, one
// construction pass. Walls are quads along each polygon edge; roof is the
// polygon triangulated via Three.js earcut (ShapeUtils.triangulateShape).
function buildBuildings(s) {
  if (!s.buildings || !s.buildings.length) return;
  const [xmin, ymin, xmax, ymax] = s.bbox;
  const xspan = xmax - xmin, yspan = ymax - ymin;
  const groundGrid = buildGroundGrid(s);
  const LIFT_M = 0.3;

  // Pre-count so we can allocate typed arrays once.
  let totalVerts = 0, totalTris = 0;
  const prepped = [];
  for (const b of s.buildings) {
    let ring = b.ring;
    if (!ring || ring.length < 3) continue;
    let n = ring.length;
    // Drop trailing duplicate close-point if OSM shipped one.
    const first = ring[0], last = ring[n - 1];
    if (first[0] === last[0] && first[1] === last[1]) n--;
    if (n < 3) continue;
    const contour = [];
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) {
      contour.push(new THREE.Vector2(ring[i][0], ring[i][1]));
      cx += ring[i][0]; cy += ring[i][1];
    }
    cx /= n; cy /= n;
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    if (tris.length === 0) continue;
    prepped.push({ contour, tris, cx, cy, h: b.h || 7 });
    totalVerts += n * 4 + n;    // wall quads (4 verts each) + roof ring verts
    totalTris  += n * 2 + tris.length;
  }

  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalTris * 3);
  let pi = 0, ui = 0, ii = 0, vi = 0;

  for (const b of prepped) {
    const { contour, tris, cx, cy, h } = b;
    const n = contour.length;
    const groundZ = (groundZFromGrid(groundGrid, cx, cy) + LIFT_M) * Z_EXAG;
    const topZ = groundZ + h;

    // Walls: one quad per edge.
    for (let i = 0; i < n; i++) {
      const a = contour[i], c = contour[(i + 1) % n];
      const ua = (a.x - xmin) / xspan, va = (a.y - ymin) / yspan;
      const uc = (c.x - xmin) / xspan, vc = (c.y - ymin) / yspan;
      positions[pi++] = a.x; positions[pi++] = a.y; positions[pi++] = groundZ;
      positions[pi++] = c.x; positions[pi++] = c.y; positions[pi++] = groundZ;
      positions[pi++] = c.x; positions[pi++] = c.y; positions[pi++] = topZ;
      positions[pi++] = a.x; positions[pi++] = a.y; positions[pi++] = topZ;
      uvs[ui++] = ua; uvs[ui++] = va;
      uvs[ui++] = uc; uvs[ui++] = vc;
      uvs[ui++] = uc; uvs[ui++] = vc;
      uvs[ui++] = ua; uvs[ui++] = va;
      indices[ii++] = vi;     indices[ii++] = vi + 1; indices[ii++] = vi + 2;
      indices[ii++] = vi;     indices[ii++] = vi + 2; indices[ii++] = vi + 3;
      vi += 4;
    }

    // Roof: shared ring verts at topZ, triangulated by earcut.
    const roofStart = vi;
    for (let i = 0; i < n; i++) {
      const p = contour[i];
      positions[pi++] = p.x; positions[pi++] = p.y; positions[pi++] = topZ;
      uvs[ui++] = (p.x - xmin) / xspan;
      uvs[ui++] = (p.y - ymin) / yspan;
      vi++;
    }
    for (const t of tris) {
      indices[ii++] = roofStart + t[0];
      indices[ii++] = roofStart + t[1];
      indices[ii++] = roofStart + t[2];
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  const mat = new THREE.MeshBasicMaterial({ map: naipTexture });
  const mesh = new THREE.Mesh(geom, mat);
  scene.add(mesh);
}

// Far-field ring: regular NxN grid draped with low-res NAIP. Sunk 1 m under
// the inner terrain so there is no z-fight where they overlap — the inner mesh
// wins by depth test. A clean rectangular hole is cut matching the inner bbox:
// cells with any strictly-interior vertex are dropped, so no coastal "flaps"
// poke past the inner mesh's edge into the water.
function buildFarfield(s) {
  if (!s.farfield) return;
  const ff = s.farfield;
  const nx = ff.nx, ny = ff.ny;
  const xs = ff.xs, ys = ff.ys, z = ff.z;
  const [xmin, ymin, xmax, ymax] = ff.bbox;
  const xspan = xmax - xmin, yspan = ymax - ymin;
  const [ixmin, iymin, ixmax, iymax] = s.bbox;

  const positions = new Float32Array(nx * ny * 3);
  const uvs = new Float32Array(nx * ny * 2);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      positions[3 * k + 0] = xs[i];
      positions[3 * k + 1] = ys[j];
      positions[3 * k + 2] = z[k] * Z_EXAG - 1;
      uvs[2 * k + 0] = (xs[i] - xmin) / xspan;
      uvs[2 * k + 1] = (ys[j] - ymin) / yspan;
    }
  }
  const inside = (i, j) =>
    xs[i] > ixmin && xs[i] < ixmax && ys[j] > iymin && ys[j] < iymax;
  const tris = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      if (inside(i, j) || inside(i + 1, j) || inside(i, j + 1) || inside(i + 1, j + 1)) continue;
      const a = j * nx + i;
      const b = j * nx + i + 1;
      const c = (j + 1) * nx + i;
      const d = (j + 1) * nx + i + 1;
      tris.push(a, b, d, a, d, c);
    }
  }
  const idx = new Uint32Array(tris);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(idx, 1));
  const tex = new THREE.TextureLoader().load('data/' + ff.imagery);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom, mat);
  scene.add(mesh);
}

function buildWater(s) {
  const bbox = (s.farfield && s.farfield.bbox) || s.bbox;
  const [xmin, ymin, xmax, ymax] = bbox;
  const w = xmax - xmin, h = ymax - ymin;
  const geom = new THREE.PlaneGeometry(w * 5, h * 5);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2b7fcf });
  waterMesh = new THREE.Mesh(geom, mat);
  waterMesh.position.set((xmin + xmax) / 2, (ymin + ymax) / 2, 0);
  scene.add(waterMesh);
}

function frameCamera(s) {
  const target = new THREE.Vector3(s.center[0], s.center[1], s.center[2]);
  const focusR = s.focus_radius || 150;
  const camDist = focusR / Math.tan(camera.fov * Math.PI / 360);
  const elRad = 33 * Math.PI / 180;
  camera.position.set(
    target.x,
    target.y - camDist * Math.cos(elRad),
    target.z + camDist * Math.sin(elRad),
  );
  const [xmin, ymin, xmax, ymax] = s.bbox;
  const maxDim = Math.max(xmax - xmin, ymax - ymin);
  camera.near = Math.max(focusR * 1e-2, 0.1);
  camera.far = maxDim * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  controls.target.copy(target);
  controls.update();
}

// Browser locale → likely feet-using country. navigator.language is a decent
// proxy for where the viewer is — region is "US" for en-US, "FR" for fr-FR,
// etc. Only US, Liberia, Myanmar use feet officially.
function usesFeet() {
  try {
    const tag = navigator.language || 'en';
    const loc = new Intl.Locale(tag).maximize();
    return ['US', 'LR', 'MM'].includes((loc.region || '').toUpperCase());
  } catch (_) { return false; }
}

const UNITS = usesFeet()
  ? { label: 'ft', toMeters: 0.3048, max: 33, step: 0.5, decimals: 1 }
  : { label: 'm',  toMeters: 1,      max: 10, step: 0.1, decimals: 2 };

function configureWaterSlider() {
  waterRange.min = '0';
  waterRange.max = String(UNITS.max);
  waterRange.step = String(UNITS.step);
  waterRange.value = '0';
  waterRange.disabled = false;
  updateWaterDisplay(0);
}

// Rough IPCC AR6-ish framing. Not precise — meant to give the general
// public a sense of what each slider setting corresponds to in time.
function scenarioFor(meters) {
  if (meters < 0.05) return 'Today\u2019s sea level';
  if (meters < 0.3)  return 'Projected around 2050';
  if (meters < 0.6)  return 'Likely by 2100';
  if (meters < 1.2)  return 'High-end 2100 scenario';
  if (meters < 2.5)  return '2100+ with ice-sheet loss';
  return 'Beyond 2100 (worst case)';
}

function updateWaterDisplay(sliderValue) {
  const meters = sliderValue * UNITS.toMeters;
  if (waterMesh) waterMesh.position.z = meters * Z_EXAG;
  waterLabel.textContent = `${sliderValue.toFixed(UNITS.decimals)} ${UNITS.label}`;
  if (waterContext) waterContext.textContent = scenarioFor(meters);
}

function getLocSlug() {
  const p = new URLSearchParams(location.search);
  return (p.get('loc') || 'hermosa').replace(/[^a-z0-9_-]/gi, '');
}

async function main() {
  initScene();
  const slug = getLocSlug();
  try {
    const res = await fetch(`data/${slug}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    snap = await res.json();
  } catch (e) {
    setStatus('error loading data: ' + e.message);
    return;
  }
  const label = snap.title || slug;
  titleEl.textContent = `${label} · sea level`;
  document.title = `Seantinel · ${label}`;
  buildFarfield(snap);
  buildTerrain(snap);
  buildWater(snap);
  buildBuildings(snap);
  buildMarker(snap);
  frameCamera(snap);
  configureWaterSlider();
  setStatus('Drag to look around. Use the slider to see how sea-level rise reshapes the coastline.');

  waterRange.addEventListener('input', () => {
    updateWaterDisplay(parseFloat(waterRange.value));
  });
}

main().catch(e => {
  console.error(e);
  setStatus('error: ' + e.message);
});
