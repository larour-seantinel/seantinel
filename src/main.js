import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { plotmodel } from './plot/plotmodel.js';
import { colorbars } from './plot/colorbars.js';
import { parseresults } from './plot/parseresults.js';

const statusEl = document.getElementById('status');
const canvas = document.getElementById('canvas');
const cbarCanvas = document.getElementById('cbar-canvas');
const cbarTitleEl = document.getElementById('cbar-title');
const cminEl = document.getElementById('cmin');
const cmaxEl = document.getElementById('cmax');
const testSelect = document.getElementById('test-select');
const fieldSelect = document.getElementById('field-select');
const npSelect = document.getElementById('np-select');
const stepRange = document.getElementById('step-range');
const stepLabel = document.getElementById('step-label');
const stepRow = document.getElementById('step-row');
const zexagRange = document.getElementById('zexag-range');
const zexagLabel = document.getElementById('zexag-label');
const zexagRow = document.getElementById('zexag-row');

const TESTS = {
  'Haig': { solution: 'TransientSolution', defaultField: 'Vel' },
};

function setStatus(msg) { statusEl.textContent = msg; }

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

function flattenJsonResults(md) {
  const flatten1 = (a) => {
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Array.isArray(a[i]) ? a[i][0] : a[i];
    return out;
  };
  const flattenStep = (step) => {
    for (const k of Object.keys(step)) {
      if (Array.isArray(step[k])) step[k] = flatten1(step[k]);
    }
  };
  for (const solName of Object.keys(md.results || {})) {
    const sol = md.results[solName];
    if (Array.isArray(sol)) sol.forEach(flattenStep);
    else flattenStep(sol);
  }
}

let scene, camera, renderer, controls, currentGroup = null;
let overlayMesh = null;
let modelData = null;
let currentTestId = null;
let currentStepIdx = 0;
let frozenCaxis = null;
let currentZExag = 100;

function is3dMesh(md) {
  return (md && md.mesh && md.mesh.numberoflayers && md.mesh.numberoflayers > 1)
      || (md && md.mesh && Array.isArray(md.mesh.elements) && md.mesh.elements[0] && md.mesh.elements[0].length === 6);
}

// 2D meshes with per-vertex surface elevation can be draped like terrain.
function hasDrapableSurface(md) {
  if (is3dMesh(md)) return false;
  return !!(md && md.geometry && md.geometry.surface
            && md.geometry.surface.length === md.mesh.numberofvertices);
}

function needsZExagUI(md) { return is3dMesh(md) || hasDrapableSurface(md); }

function clearOverlay() {
  if (!overlayMesh) return;
  scene.remove(overlayMesh);
  if (overlayMesh.geometry) overlayMesh.geometry.dispose();
  if (overlayMesh.material) {
    if (overlayMesh.material.map) overlayMesh.material.map.dispose();
    overlayMesh.material.dispose();
  }
  overlayMesh = null;
}

// Build a textured 3D terrain mesh from md.overlay.outer{index,x,y,height}.
// Vertices are 1-indexed on the ISSM side; subtract 1 before writing the
// Three.js index buffer. UVs map (x,y) linearly into xlim/ylim so radar.png
// aligns with the glacier box. Relief is mean-centered + zExag-scaled using
// the terrain's own mean so cranking the slider amplifies mountains without
// drifting the whole mesh skyward.
function addOverlayTerrain(md) {
  clearOverlay();
  const ov = md && md.overlay;
  if (!ov || !ov.xlim || !ov.ylim || !ov.image
      || !ov.outerindex || !ov.outerx || !ov.outery || !ov.outerheight) {
    return;
  }
  const nv = ov.outerx.length;
  const [xl0, xl1] = ov.xlim;
  const [yl0, yl1] = ov.ylim;
  const dx = xl1 - xl0, dy = yl1 - yl0;

  let zMean = 0;
  for (let i = 0; i < nv; i++) zMean += ov.outerheight[i];
  zMean /= nv;
  const zExag = needsZExagUI(md) ? currentZExag : 1;

  const positions = new Float32Array(nv * 3);
  const uvs = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) {
    positions[3 * i + 0] = ov.outerx[i];
    positions[3 * i + 1] = ov.outery[i];
    positions[3 * i + 2] = (ov.outerheight[i] - zMean) * zExag + zMean;
    uvs[2 * i + 0] = (ov.outerx[i] - xl0) / dx;
    uvs[2 * i + 1] = (ov.outery[i] - yl0) / dy;
  }

  const tris = ov.outerindex;
  const ne = tris.length;
  const index = new Uint32Array(ne * 3);
  for (let j = 0; j < ne; j++) {
    index[3 * j + 0] = tris[j][0] - 1;
    index[3 * j + 1] = tris[j][1] - 1;
    index[3 * j + 2] = tris[j][2] - 1;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(index, 1));
  geom.computeVertexNormals();

  // Build the mesh synchronously with a neutral material so renderField's
  // Box3 sees the real terrain extent for camera framing; swap the radar
  // texture in on load.
  const mat = new THREE.MeshBasicMaterial({
    color: 0x7a6a56,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  overlayMesh = new THREE.Mesh(geom, mat);
  overlayMesh.renderOrder = -1;
  scene.add(overlayMesh);
  new THREE.TextureLoader().load(ov.image, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    mat.map = texture;
    mat.color.setHex(0xffffff);
    mat.needsUpdate = true;
  }, undefined, (err) => {
    console.warn('overlay texture failed:', ov.image, err);
  });
}

function computeFrozenCaxis(fieldName) {
  const steps = getSteps();
  let lo = Infinity, hi = -Infinity;
  for (const s of steps) {
    const v = s && s[fieldName];
    if (!v || typeof v.length !== 'number') continue;
    for (let i = 0; i < v.length; i++) {
      const x = v[i];
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (lo === hi) { lo -= 0.5; hi += 0.5; }
  return [lo, hi];
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1e8);
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

  const camReadout = document.getElementById('cam-readout');
  (function tick() {
    controls.update();
    renderer.render(scene, camera);
    if (camReadout) {
      // Azimuth = compass bearing of the camera as seen from the target
      //   (0° = north/+Y, 90° = east/+X, clockwise). Elevation = pitch above
      //   the horizontal plane through the target. Dist = slant distance.
      const dx = camera.position.x - controls.target.x;
      const dy = camera.position.y - controls.target.y;
      const dz = camera.position.z - controls.target.z;
      const r = Math.hypot(dx, dy);
      const dist = Math.hypot(r, dz);
      let az = Math.atan2(dx, dy) * 180 / Math.PI;
      if (az < 0) az += 360;
      const el = Math.atan2(dz, r) * 180 / Math.PI;
      camReadout.textContent =
        `cam · az=${az.toFixed(1)}° el=${el.toFixed(1)}° dist=${dist.toExponential(2)}`;
    }
    requestAnimationFrame(tick);
  })();
}

function getSteps() {
  const sol = TESTS[currentTestId].solution;
  const raw = (modelData.results || {})[sol];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function currentResults() {
  const steps = getSteps();
  if (steps.length === 0) return null;
  return steps[Math.min(currentStepIdx, steps.length - 1)];
}

function populateStepSlider() {
  const n = getSteps().length;
  if (!stepRange) return;
  const maxIdx = Math.max(n - 1, 0);
  stepRange.max = maxIdx;
  if (currentStepIdx > maxIdx) currentStepIdx = maxIdx;
  stepRange.value = currentStepIdx;
  stepRange.disabled = n <= 1;
  if (stepRow) stepRow.style.display = n > 1 ? '' : 'none';
  updateStepLabel();
}

function updateStepLabel() {
  if (!stepLabel) return;
  const steps = getSteps();
  const s = steps[currentStepIdx];
  const t = s && s.time != null ? ` · t=${Number(s.time).toFixed(2)}` : '';
  stepLabel.textContent = `${currentStepIdx}/${Math.max(steps.length - 1, 0)}${t}`;
}

function listFields(results) {
  if (!results) return [];
  return Object.keys(results).filter(k => {
    if (k === 'step' || k === 'time') return false;
    const v = results[k];
    const nvtx = modelData.mesh.numberofvertices;
    const nelt = modelData.mesh.numberofelements;
    return v && typeof v.length === 'number' && (v.length === nvtx || v.length === nelt);
  });
}

function populateFieldDropdown() {
  const results = currentResults();
  const fields = listFields(results);
  fieldSelect.innerHTML = '';
  if (fields.length === 0) {
    fieldSelect.innerHTML = '<option>(no fields)</option>';
    fieldSelect.disabled = true;
    return;
  }
  for (const f of fields) {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    fieldSelect.appendChild(opt);
  }
  const preferred = TESTS[currentTestId].defaultField;
  fieldSelect.value = fields.includes(preferred) ? preferred : fields[0];
  fieldSelect.disabled = false;
  frozenCaxis = computeFrozenCaxis(fieldSelect.value);
}

function renderField(fieldName) {
  const results = currentResults();
  if (!results || !results[fieldName]) {
    setStatus(`field ${fieldName} not in results`);
    return;
  }
  if (currentGroup) {
    scene.remove(currentGroup);
    currentGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
  const colormap = 'jet';
  const zExag = needsZExagUI(modelData) ? currentZExag : 1;
  const { group, caxis } = plotmodel(scene, modelData, results[fieldName], {
    colormap,
    caxis: frozenCaxis || undefined,
    edgecolor: [1, 1, 1, 0.2],
    zExaggeration: zExag,
    drapeOnSurface: hasDrapableSurface(modelData),
  });
  currentGroup = group;
  // Rebuild the terrain overlay BEFORE Box3 so camera framing sees the full
  // scene extent, not just the glacier. zExag stays in sync with the glacier
  // because both use the same currentZExag. Cheap: 11k vertices on Haig.
  addOverlayTerrain(modelData);
  const steps = getSteps();
  const stepTag = steps.length > 1
    ? ` · step ${currentStepIdx}/${steps.length - 1}${results.time != null ? ` t=${Number(results.time).toFixed(2)}` : ''}`
    : '';
  cbarTitleEl.textContent = `${fieldName}${stepTag}`;
  paintColorbar(colormap, caxis[0], caxis[1]);

  // Center on the glacier so it stays the subject of the frame. For draped
  // meshes with a terrain overlay, use the FULL scene box (glacier + terrain)
  // to size the camera distance — otherwise the terrain's exaggerated relief
  // extends above the camera and we end up staring at mountains edge-on.
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const fullBox = overlayMesh ? box.clone().expandByObject(overlayMesh) : box;
  const size = box.getSize(new THREE.Vector3());
  const fullSize = fullBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fullMaxDim = Math.max(fullSize.x, fullSize.y, fullSize.z) || 1;
  // For draped 2D meshes, frame on horizontal extent only — otherwise cranking
  // z-exag inflates size.z and the camera pulls so far back that the horizontal
  // detail vanishes and the terrain reads as flat.
  const frameDim = hasDrapableSurface(modelData)
    ? (Math.max(fullSize.x, fullSize.y) || 1)
    : maxDim;
  if (hasDrapableSurface(modelData)) {
    // Landscape vista defaults, picked from a hand-tuned Haig view:
    //   azimuth ≈ 178° (nearly due south of target),
    //   elevation ≈ 30° above horizontal,
    //   slant distance ≈ 2.7× terrain width.
    const d = frameDim * 2.7;
    const camX = center.x + d * 0.030;                              // cos(30°) sin(178°)
    const camY = center.y - d * 0.866;                              // cos(30°) cos(178°)
    const camZ = center.z + Math.max(d * 0.500, fullSize.z * 1.2);  // sin(30°), clear peaks
    camera.position.set(camX, camY, camZ);
  } else if (needsZExagUI(modelData)) {
    const d = frameDim * 1.6;
    const zLift = Math.max(d * 0.6, fullSize.z * 1.2);
    camera.position.set(center.x + d * 0.6, center.y - d * 0.9, center.z + zLift);
  } else {
    camera.position.set(center.x, center.y, center.z + frameDim * 1.6);
  }
  camera.near = Math.max(fullMaxDim * 1e-3, 0.1);
  camera.far = fullMaxDim * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();

  setStatus(`test${currentTestId} · nvtx=${modelData.mesh.numberofvertices}, nelt=${modelData.mesh.numberofelements}${stepTag} · ${fieldName} ∈ [${caxis[0].toExponential(2)}, ${caxis[1].toExponential(2)}]`);
}

async function loadTestJson(testId) {
  const path = `data/test${testId}.json`;
  if (window.Native && typeof window.Native.getAsset === 'function') {
    const text = window.Native.getAsset(path);
    if (text.startsWith('ERROR:')) throw new Error('getAsset: ' + text);
    return JSON.parse(text);
  }
  const url = (location.protocol === 'file:') ? './' + path : '/' + path;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
  return await res.json();
}

async function selectTest(testId) {
  currentTestId = testId;
  setStatus(`loading test${testId}…`);
  try {
    modelData = await loadTestJson(testId);
  } catch (e) {
    setStatus('error: ' + e.message);
    return;
  }
  flattenJsonResults(modelData);
  currentStepIdx = Math.max(getSteps().length - 1, 0);
  populateStepSlider();
  populateFieldDropdown();
  // Pick a sensible default z-exag per model class. 3D ice shelves (test102
  // etc.) are 1000 km wide × 1 km thick → need ×100 to see any depth. Draped
  // 2D terrains (Haig) already carry real-world relief, so ×1 is natural.
  currentZExag = hasDrapableSurface(modelData) ? 1 : 100;
  if (zexagRange) zexagRange.value = Math.log10(currentZExag);
  if (zexagRow) zexagRow.style.display = needsZExagUI(modelData) ? '' : 'none';
  if (zexagLabel) zexagLabel.textContent = `×${Math.round(currentZExag)}`;

  if (hasNative()) {
    setStatus(`test${testId} · nvtx=${modelData.mesh.numberofvertices}, nelt=${modelData.mesh.numberofelements} · press Run to solve`);
  } else {
    setStatus(`test${testId} · rendering bundled results`);
    renderField(fieldSelect.value);
  }
}

function hasNative() { return !!(window.Native && typeof window.Native.execRunTest === 'function'); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runNativeAndReplot() {
  const out = document.getElementById('native-out');
  const n = window.Native;
  if (!n || typeof n.execRunTest !== 'function') {
    out.textContent = '(no Native.execRunTest; running in browser)';
    return;
  }

  const testId = currentTestId;
  const sol = TESTS[testId].solution;
  const np = npSelect ? parseInt(npSelect.value, 10) || 1 : 1;
  const testName = 'test' + testId;
  out.textContent = `exec libissmexe.so ${testName} ${sol} np=${np}…`;

  let started;
  try { started = n.execRunTest(testName, sol, np); } catch (e) { out.textContent = 'error: ' + e; return; }
  if (!started.startsWith('OK')) { out.textContent = started; return; }

  const t0 = Date.now();
  while (n.execRunning()) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    let tail = '';
    try { tail = n.readLog(testName); } catch (e) {}
    tail = tail.split('\n').slice(-12).join('\n');
    out.textContent = `running… ${elapsed}s\n${started}\n\n--- log tail ---\n${tail}`;
    await sleep(500);
  }

  const msg = n.execResult();
  if (!msg.startsWith('OK')) {
    let tail = '';
    try { tail = n.readLog(testName); } catch (e) {}
    out.textContent = `${msg}\n\n--- log tail ---\n${tail.split('\n').slice(-30).join('\n')}`;
    return;
  }

  let b64;
  try { b64 = n.readOutbinBase64(testName); } catch (e) { out.textContent = msg + '\n\nreadOutbin error: ' + e; return; }
  if (b64.startsWith('ERROR')) { out.textContent = msg + '\n\n' + b64; return; }

  let steps;
  try { steps = parseresults(b64); } catch (e) { out.textContent = msg + '\n\nparseresults: ' + e; return; }
  if (steps.length === 0) { out.textContent = msg + '\n\n(parser returned 0 steps)'; return; }

  const summary = steps.map((s, i) => {
    const fs = Object.keys(s).filter(k => k !== 'step' && k !== 'time');
    return `  [${i}] step=${s.step ?? '?'} time=${s.time ?? '?'} fields=${fs.join(',') || '(none)'}`;
  }).join('\n');
  const diag = `${msg}\n\noutbin b64 len: ${b64.length}\nparsed ${steps.length} step(s):\n${summary}`;

  modelData.results = { [sol]: steps };
  currentStepIdx = steps.length - 1;
  populateStepSlider();
  populateFieldDropdown();

  try { renderField(fieldSelect.value); } catch (e) { out.textContent = diag + '\n\nrender: ' + e; return; }
  out.textContent = diag;
}

window.__hud = {
  run() { runNativeAndReplot().catch(e => { document.getElementById('native-out').textContent = 'run error: ' + e; }); },
  readLog() {
    const out = document.getElementById('native-out');
    const n = window.Native;
    if (!n || typeof n.readLog !== 'function') { out.textContent = '(no Native.readLog; running in browser)'; return; }
    try { out.textContent = n.readLog('test' + currentTestId); } catch (e) { out.textContent = 'error: ' + e; }
  },
  kill() {
    const n = window.Native;
    if (!n || typeof n.execKill !== 'function') return;
    try { document.getElementById('native-out').textContent = n.execKill(); } catch (e) {}
  },
  toggleLog() {
    const out = document.getElementById('native-out');
    const btn = document.getElementById('log-toggle');
    const hidden = out.style.display === 'none';
    out.style.display = hidden ? '' : 'none';
    if (btn) btn.textContent = hidden ? 'Hide log' : 'Show log';
  }
};

async function main() {
  initScene();
  testSelect.addEventListener('change', () => selectTest(testSelect.value));
  fieldSelect.addEventListener('change', () => {
    frozenCaxis = computeFrozenCaxis(fieldSelect.value);
    renderField(fieldSelect.value);
  });
  if (stepRange) {
    stepRange.addEventListener('input', () => {
      currentStepIdx = parseInt(stepRange.value, 10) || 0;
      updateStepLabel();
      if (fieldSelect.value && !fieldSelect.disabled) renderField(fieldSelect.value);
    });
  }
  if (zexagRange) {
    zexagRange.addEventListener('input', () => {
      currentZExag = Math.pow(10, parseFloat(zexagRange.value));
      zexagLabel.textContent = `×${Math.round(currentZExag)}`;
      if (fieldSelect.value && !fieldSelect.disabled) renderField(fieldSelect.value);
    });
  }
  await selectTest(testSelect.value);
}

main().catch(e => {
  console.error(e);
  setStatus('error: ' + e.message);
});
