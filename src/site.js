import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const Z_EXAG = 5;

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
  // Clip NoData spikes at 95th percentile, and floor to -2 so 3DEP's
  // zero-valued ocean floor sits below the water plane (eliminates z-fighting).
  const sorted = Float32Array.from(zArr).sort();
  const ceil = sorted[Math.floor(sorted.length * 0.95)];
  return zArr.map(v => Math.max(-2, Math.min(v, ceil)));
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

  const tex = new THREE.TextureLoader().load('data/' + s.imagery);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
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

function buildWater(s) {
  const [xmin, ymin, xmax, ymax] = s.bbox;
  const w = xmax - xmin, h = ymax - ymin;
  // Make water 5× larger than terrain so its edge is never visible.
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
  buildTerrain(snap);
  buildWater(snap);
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
