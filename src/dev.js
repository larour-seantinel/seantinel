import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { colorbars } from './plot/colorbars.js';

const statusEl = document.getElementById('status');
const canvas = document.getElementById('canvas');
const snapSelect = document.getElementById('snap-select');
const snapMeta = document.getElementById('snap-meta');
const autoRefresh = document.getElementById('auto-refresh');
const zexagRange = document.getElementById('zexag-range');
const zexagLabel = document.getElementById('zexag-label');
const waterRange = document.getElementById('water-range');
const waterLabel = document.getElementById('water-label');
const cbarWrap = document.getElementById('cbar');
const cbarCanvas = document.getElementById('cbar-canvas');
const cbarTitle = document.getElementById('cbar-title');
const cminEl = document.getElementById('cmin');
const cmaxEl = document.getElementById('cmax');
const camReadout = document.getElementById('cam-readout');

const COLORMAP = 'jet';
let scene, camera, renderer, controls;
let currentMesh = null;
let currentWater = null;
let currentSnap = null;
let currentZExag = 1;
let currentZMean = 0;
let currentWaterZ = 0;
let indexMtimeSeen = 0;

function setStatus(m) { statusEl.textContent = m; }

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1e8);
  // World is Z-up (DEM z = elevation). Default Y-up makes OrbitControls roll
  // the horizon as you drag — set up=Z so orbit stays around the vertical axis.
  camera.up.set(0, 0, 1);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  const light = new THREE.DirectionalLight(0xffffff, 0.6);
  light.position.set(1, 1, 2);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  (function tick() {
    controls.update();
    renderer.render(scene, camera);
    const dx = camera.position.x - controls.target.x;
    const dy = camera.position.y - controls.target.y;
    const dz = camera.position.z - controls.target.z;
    const r = Math.hypot(dx, dy);
    const dist = Math.hypot(r, dz);
    let az = Math.atan2(dx, dy) * 180 / Math.PI;
    if (az < 0) az += 360;
    const el = Math.atan2(dz, r) * 180 / Math.PI;
    camReadout.textContent = `cam · az=${az.toFixed(1)}° el=${el.toFixed(1)}° dist=${dist.toExponential(2)}`;
    requestAnimationFrame(tick);
  })();
}

function clearMesh() {
  if (!currentMesh) return;
  scene.remove(currentMesh);
  if (currentMesh.geometry) currentMesh.geometry.dispose();
  if (currentMesh.material) currentMesh.material.dispose();
  currentMesh = null;
}

function clearWater() {
  if (!currentWater) return;
  scene.remove(currentWater);
  if (currentWater.geometry) currentWater.geometry.dispose();
  if (currentWater.material) currentWater.material.dispose();
  currentWater = null;
}

function waterZDisplayed(zWater) {
  return (zWater - currentZMean) * currentZExag + currentZMean;
}

function updateWater() {
  if (!currentSnap || !currentSnap.field) return;
  const x = currentSnap.x, y = currentSnap.y;
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < x.length; i++) {
    if (x[i] < xmin) xmin = x[i]; if (x[i] > xmax) xmax = x[i];
    if (y[i] < ymin) ymin = y[i]; if (y[i] > ymax) ymax = y[i];
  }
  const z = waterZDisplayed(currentWaterZ);
  if (!currentWater) {
    const geom = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2b7fcf, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthWrite: false,
    });
    currentWater = new THREE.Mesh(geom, mat);
    scene.add(currentWater);
  }
  currentWater.position.set((xmin + xmax) / 2, (ymin + ymax) / 2, z);
  currentWater.scale.set(xmax - xmin, ymax - ymin, 1);
  waterLabel.textContent = `${currentWaterZ.toFixed(2)} m`;
}

// Pick a value between min/max from a colormap LUT.
function sampleCmap(cmap, t) {
  const n = cmap.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(t * (n - 1))));
  return cmap[i];
}

function paintColorbar(name, cmin, cmax) {
  const cmap = colorbars[name] || colorbars['jet'];
  const ctx = cbarCanvas.getContext('2d');
  const w = cbarCanvas.width, h = cbarCanvas.height;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i < cmap.length; i++) {
    const t = i / (cmap.length - 1);
    const [r, g, b] = cmap[i];
    grad.addColorStop(t, `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  cminEl.textContent = cmin.toExponential(2);
  cmaxEl.textContent = cmax.toExponential(2);
}

function renderSnap(snap) {
  clearMesh();
  const x = snap.x, y = snap.y, elts = snap.elements, field = snap.field;
  const nv = x.length;
  const z = field ? field : new Array(nv).fill(0);

  // Z-exaggerate relative to the field mean so the terrain stays centered.
  let zMean = 0;
  for (let i = 0; i < nv; i++) zMean += z[i];
  zMean /= nv;
  currentZMean = zMean;

  const positions = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    positions[3 * i + 0] = x[i];
    positions[3 * i + 1] = y[i];
    positions[3 * i + 2] = (z[i] - zMean) * currentZExag + zMean;
  }

  const ne = elts.length;
  const index = new Uint32Array(ne * 3);
  for (let j = 0; j < ne; j++) {
    // ISSM elements are 1-indexed; Three.js wants 0-indexed.
    index[3 * j + 0] = elts[j][0] - 1;
    index[3 * j + 1] = elts[j][1] - 1;
    index[3 * j + 2] = elts[j][2] - 1;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(new THREE.BufferAttribute(index, 1));

  let mat;
  if (snap.imagery) {
    // Planar top-down drape: u/v from bbox so each vertex samples the right pixel.
    const bbox = snap.bbox || [
      Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y),
    ];
    const [xmin, ymin, xmax, ymax] = bbox;
    const uvs = new Float32Array(nv * 2);
    for (let i = 0; i < nv; i++) {
      uvs[2 * i + 0] = (x[i] - xmin) / (xmax - xmin);
      uvs[2 * i + 1] = (y[i] - ymin) / (ymax - ymin);
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    const tex = new THREE.TextureLoader().load('/dev/' + snap.imagery);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    cbarWrap.style.display = 'none';
  } else if (field) {
    let fmin = Infinity, fmax = -Infinity;
    for (let i = 0; i < nv; i++) {
      if (field[i] < fmin) fmin = field[i];
      if (field[i] > fmax) fmax = field[i];
    }
    if (fmin === fmax) { fmin -= 0.5; fmax += 0.5; }
    const cmap = colorbars[COLORMAP] || colorbars['jet'];
    const colors = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      const t = (field[i] - fmin) / (fmax - fmin);
      const [r, g, b] = sampleCmap(cmap, t);
      colors[3 * i + 0] = r;
      colors[3 * i + 1] = g;
      colors[3 * i + 2] = b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    cbarWrap.style.display = '';
    cbarTitle.textContent = snap.field_name || 'field';
    paintColorbar(COLORMAP, fmin, fmax);
  } else {
    mat = new THREE.MeshBasicMaterial({ color: 0x6688aa, side: THREE.DoubleSide, wireframe: true });
    cbarWrap.style.display = 'none';
  }

  geom.computeVertexNormals();
  currentMesh = new THREE.Mesh(geom, mat);
  scene.add(currentMesh);

  const box = new THREE.Box3().setFromObject(currentMesh);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  // Prefer snapshot-provided center (e.g., the lat/lon anchor at sea level)
  // over the DEM-bbox midpoint, which otherwise floats mid-air.
  const target = snap.center
    ? new THREE.Vector3(snap.center[0], snap.center[1], (snap.center[2] - zMean) * currentZExag + zMean)
    : box.getCenter(new THREE.Vector3());
  // Frame the lat/lon anchor at focus_radius (not the whole mesh bbox).
  const focusR = snap.focus_radius || maxDim * 0.5;
  const camDist = focusR / Math.tan(camera.fov * Math.PI / 360);
  const elRad = 33 * Math.PI / 180;
  camera.position.set(
    target.x,
    target.y - camDist * Math.cos(elRad),
    target.z + camDist * Math.sin(elRad),
  );
  camera.near = Math.max(focusR * 1e-2, 0.1);
  camera.far = maxDim * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  controls.target.copy(target);
  controls.update();

  snapMeta.textContent = `nverts=${nv} nelts=${ne}${field ? ` · field=${snap.field_name || 'field'}` : ''}`;
  setStatus(`loaded ${snap.name}`);

  if (field) {
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < nv; i++) {
      if (field[i] < zmin) zmin = field[i];
      if (field[i] > zmax) zmax = field[i];
    }
    // Pad range a bit so the slider can go below terrain min / above max.
    const pad = Math.max((zmax - zmin) * 0.05, 0.5);
    waterRange.min = (zmin - pad).toFixed(2);
    waterRange.max = (zmax + pad).toFixed(2);
    waterRange.step = Math.max((zmax - zmin) / 500, 0.01).toFixed(3);
    waterRange.disabled = false;
    if (currentWaterZ < +waterRange.min || currentWaterZ > +waterRange.max) {
      currentWaterZ = Math.max(0, +waterRange.min);
    }
    waterRange.value = currentWaterZ;
    updateWater();
  } else {
    clearWater();
    waterRange.disabled = true;
    waterLabel.textContent = '—';
  }
}

async function fetchJson(url) {
  const res = await fetch(url + '?t=' + Date.now());
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.json();
}

async function loadIndex() {
  let idx;
  try {
    idx = await fetchJson('/dev/index.json');
  } catch (e) {
    setStatus('no snapshots yet — run scripts/runme.py to produce one');
    snapSelect.innerHTML = '<option>(none)</option>';
    return [];
  }
  const prevValue = snapSelect.value;
  snapSelect.innerHTML = '';
  if (idx.length === 0) {
    snapSelect.innerHTML = '<option>(none)</option>';
    return idx;
  }
  for (const e of idx) {
    const opt = document.createElement('option');
    opt.value = e.file;
    opt.textContent = e.name + (e.has_field ? ` · ${e.field_name}` : '');
    snapSelect.appendChild(opt);
  }
  const stillThere = idx.find(e => e.file === prevValue);
  snapSelect.value = stillThere ? prevValue : idx[idx.length - 1].file;
  return idx;
}

async function loadSelected() {
  const file = snapSelect.value;
  if (!file || file === '(none)') return;
  setStatus(`loading ${file}…`);
  try {
    const snap = await fetchJson('/dev/' + file);
    currentSnap = snap;
    renderSnap(snap);
  } catch (e) {
    setStatus('error: ' + e.message);
  }
}

async function refresh() {
  const idx = await loadIndex();
  if (!idx || idx.length === 0) return;
  const newest = idx.reduce((a, b) => (a.mtime > b.mtime ? a : b));
  if (newest.mtime > indexMtimeSeen) {
    indexMtimeSeen = newest.mtime;
    // On fresh snapshots, jump to the newest and render it.
    if (!currentSnap || currentSnap.name !== newest.name) {
      snapSelect.value = newest.file;
      await loadSelected();
    }
  }
}

window.__dev = { refresh };

async function main() {
  initScene();
  snapSelect.addEventListener('change', loadSelected);
  zexagRange.addEventListener('input', () => {
    currentZExag = Math.pow(10, parseFloat(zexagRange.value));
    zexagLabel.textContent = `×${currentZExag < 10 ? currentZExag.toFixed(1) : Math.round(currentZExag)}`;
    if (currentSnap) renderSnap(currentSnap);
  });
  waterRange.addEventListener('input', () => {
    currentWaterZ = parseFloat(waterRange.value);
    updateWater();
  });

  await loadIndex();
  await loadSelected();

  setInterval(() => {
    if (autoRefresh.checked) refresh();
  }, 1500);
}

main().catch(e => {
  console.error(e);
  setStatus('error: ' + e.message);
});
