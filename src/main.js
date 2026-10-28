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

// Solution name and preferred default field per test.
const TESTS = {
  '101': { solution: 'StressbalanceSolution', defaultField: 'Vel' },
  '105': { solution: 'MasstransportSolution', defaultField: 'Thickness' },
  '106': { solution: 'StressbalanceSolution', defaultField: 'Vel' },
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
  for (const solName of Object.keys(md.results || {})) {
    const sol = md.results[solName];
    for (const k of Object.keys(sol)) {
      if (Array.isArray(sol[k])) sol[k] = flatten1(sol[k]);
    }
  }
}

let scene, camera, renderer, controls, currentGroup = null;
let modelData = null;
let currentTestId = null;
let hasRunNative = false;

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1e8);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  (function tick() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();
}

function currentResults() {
  const sol = TESTS[currentTestId].solution;
  return (modelData.results || {})[sol] || null;
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
  const { group, caxis } = plotmodel(scene, modelData, results[fieldName], {
    colormap,
    edgecolor: [1, 1, 1, 0.2],
  });
  currentGroup = group;
  cbarTitleEl.textContent = fieldName;
  paintColorbar(colormap, caxis[0], caxis[1]);

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  camera.position.set(center.x, center.y, center.z + maxDim * 1.6);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();

  setStatus(`test${currentTestId} · nvtx=${modelData.mesh.numberofvertices}, nelt=${modelData.mesh.numberofelements} · ${fieldName} ∈ [${caxis[0].toExponential(2)}, ${caxis[1].toExponential(2)}]`);
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
  if (hasRunNative) return; // MPI_Init is one-shot per process
  currentTestId = testId;
  setStatus(`loading test${testId}…`);
  try {
    modelData = await loadTestJson(testId);
  } catch (e) {
    setStatus('error: ' + e.message);
    return;
  }
  flattenJsonResults(modelData);
  populateFieldDropdown();

  if (hasNative()) {
    setStatus(`test${testId} · nvtx=${modelData.mesh.numberofvertices}, nelt=${modelData.mesh.numberofelements} · press Run to solve`);
  } else {
    setStatus(`test${testId} · rendering bundled results`);
    renderField(fieldSelect.value);
  }
}

function hasNative() { return !!(window.Native && typeof window.Native.runTest === 'function'); }

function runNativeAndReplot() {
  const out = document.getElementById('native-out');
  const n = window.Native;
  if (!n || typeof n.runTest !== 'function') {
    out.textContent = '(no Native.runTest; running in browser)';
    return;
  }
  out.textContent = 'loading libs…';
  let loadMsg;
  try { loadMsg = n.load(); } catch (e) { out.textContent = 'load error: ' + e; return; }
  if (loadMsg.includes('FAIL')) { out.textContent = loadMsg; return; }

  const testId = currentTestId;
  const sol = TESTS[testId].solution;
  out.textContent = `calling Native.runTest("test${testId}", "${sol}")…`;
  let msg;
  try { msg = n.runTest('test' + testId, sol); } catch (e) { out.textContent = 'error: ' + e; return; }

  hasRunNative = true;           // MPI_Init happened — lock the test selector
  testSelect.disabled = true;

  if (!msg.startsWith('OK')) { out.textContent = msg; return; }

  let b64;
  try { b64 = n.readOutbinBase64('test' + testId); } catch (e) { out.textContent = msg + '\n\nreadOutbin error: ' + e; return; }
  if (b64.startsWith('ERROR')) { out.textContent = msg + '\n\n' + b64; return; }

  let steps;
  try { steps = parseresults(b64); } catch (e) { out.textContent = msg + '\n\nparseresults: ' + e; return; }
  if (steps.length === 0) { out.textContent = msg + '\n\n(parser returned 0 steps)'; return; }

  const summary = steps.map((s, i) => {
    const fs = Object.keys(s).filter(k => k !== 'step' && k !== 'time');
    return `  [${i}] step=${s.step ?? '?'} time=${s.time ?? '?'} fields=${fs.join(',') || '(none)'}`;
  }).join('\n');
  const diag = `${msg}\n\noutbin b64 len: ${b64.length}\nparsed ${steps.length} step(s):\n${summary}`;

  // Prefer the step containing the test's default field.
  const prefer = TESTS[testId].defaultField;
  const chosen = steps.find(s => s[prefer]) || steps[0];
  modelData.results = { [sol]: chosen };
  populateFieldDropdown();

  try { renderField(fieldSelect.value); } catch (e) { out.textContent = diag + '\n\nrender: ' + e; return; }
  out.textContent = diag;
}

window.__hud = {
  run() { runNativeAndReplot(); },
  readLog() {
    const out = document.getElementById('native-out');
    const n = window.Native;
    if (!n || typeof n.readLog !== 'function') { out.textContent = '(no Native.readLog; running in browser)'; return; }
    try { out.textContent = n.readLog('test' + currentTestId); } catch (e) { out.textContent = 'error: ' + e; }
  }
};

async function main() {
  initScene();
  testSelect.addEventListener('change', () => selectTest(testSelect.value));
  fieldSelect.addEventListener('change', () => renderField(fieldSelect.value));
  await selectTest(testSelect.value);
}

main().catch(e => {
  console.error(e);
  setStatus('error: ' + e.message);
});
