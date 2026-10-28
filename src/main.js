import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { plotmodel } from './plot/plotmodel.js';
import { colorbars } from './plot/colorbars.js';
import { parseresults } from './plot/parseresults.js';

const statusEl = document.getElementById('status');
const canvas = document.getElementById('canvas');
const cbarCanvas = document.getElementById('cbar-canvas');
const cminEl = document.getElementById('cmin');
const cmaxEl = document.getElementById('cmax');

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

// ISSM result arrays are serialized as Nx1 column matrices in JSON ([[v],[v],...]).
// Flatten to plain Float64Array.
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

// Scene state kept at module scope so Run test101 can rebuild the mesh.
let scene, camera, renderer, controls, currentGroup = null, modelData = null;

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

  function tick() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
}

function renderVel(md) {
  if (currentGroup) {
    scene.remove(currentGroup);
    currentGroup.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
  const vel = md.results.StressbalanceSolution.Vel;
  const colormap = 'jet';
  const { group, caxis } = plotmodel(scene, md, vel, {
    colormap,
    edgecolor: [1, 1, 1, 0.2],
  });
  currentGroup = group;
  paintColorbar(colormap, caxis[0], caxis[1]);

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  camera.position.set(center.x, center.y, center.z + maxDim * 1.6);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();

  setStatus(`nvtx=${md.mesh.numberofvertices}, nelt=${md.mesh.numberofelements} · Vel ∈ [${caxis[0].toExponential(2)}, ${caxis[1].toExponential(2)}]`);
}

async function loadInitialModel() {
  setStatus('fetching test101 data…');
  if (window.Native && typeof window.Native.getAsset === 'function') {
    const text = window.Native.getAsset('data/test101.json');
    if (text.startsWith('ERROR:')) throw new Error('getAsset: ' + text);
    modelData = JSON.parse(text);
  } else {
    const url = (location.protocol === 'file:') ? './data/test101.json' : '/data/test101.json';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch test101.json: HTTP ${res.status}`);
    modelData = await res.json();
  }
  flattenJsonResults(modelData);
}

function hasNative() { return !!(window.Native && typeof window.Native.runTest101 === 'function'); }

function runNativeAndReplot() {
  const out = document.getElementById('native-out');
  const n = window.Native;
  if (!n || typeof n.runTest101 !== 'function') {
    out.textContent = '(no Native.runTest101; running in browser)';
    return;
  }
  out.textContent = 'loading libs…';
  let loadMsg;
  try { loadMsg = n.load(); } catch (e) { out.textContent = 'load error: ' + e; return; }
  if (loadMsg.includes('FAIL')) { out.textContent = loadMsg; return; }

  out.textContent = 'calling Native.runTest101…';
  let msg;
  try { msg = n.runTest101(); } catch (e) { out.textContent = 'error: ' + e; return; }
  if (!msg.startsWith('test101: OK')) { out.textContent = msg; return; }

  let b64;
  try { b64 = n.readOutbinBase64(); } catch (e) { out.textContent = msg + '\n\nreadOutbin error: ' + e; return; }
  if (b64.startsWith('ERROR')) { out.textContent = msg + '\n\n' + b64; return; }

  const b64Len = b64.length;
  let steps;
  try { steps = parseresults(b64); } catch (e) { out.textContent = msg + `\n\nparseresults (b64=${b64Len}): ` + e; return; }

  // Debug: show what the parser found before trying to render.
  const summary = steps.map((s, i) => {
    const fs = Object.keys(s).filter(k => k !== 'step' && k !== 'time');
    return `  [${i}] step=${s.step ?? '?'} time=${s.time ?? '?'} fields=${fs.join(',') || '(none)'}`;
  }).join('\n');
  const diag = `${msg}\n\noutbin bytes (b64 len): ${b64Len}\nparsed ${steps.length} step(s):\n${summary}`;

  if (steps.length === 0) { out.textContent = diag; return; }

  // Pick the first step that actually contains Vel.
  const stepWithVel = steps.find(s => s.Vel);
  if (!stepWithVel) { out.textContent = diag + '\n\n(no Vel field found in any step)'; return; }

  modelData.results = { StressbalanceSolution: stepWithVel };
  try { renderVel(modelData); } catch (e) { out.textContent = diag + '\n\nrender: ' + e; return; }

  out.textContent = diag;
}

window.__hud = {
  runTest101() { runNativeAndReplot(); },
  readLog() { this._call('readLog'); },
  _call(name) {
    const out = document.getElementById('native-out');
    const n = window.Native;
    if (!n || typeof n[name] !== 'function') { out.textContent = `(no Native.${name}; running in browser)`; return; }
    out.textContent = 'calling Native.' + name + '…';
    try { out.textContent = n[name](); } catch (e) { out.textContent = 'error: ' + e; }
  }
};

async function main() {
  initScene();
  await loadInitialModel();
  if (hasNative()) {
    // In the APK, keep the canvas empty until the user runs the native solve,
    // so we can see one-on-one that the render came from live data.
    setStatus(`nvtx=${modelData.mesh.numberofvertices}, nelt=${modelData.mesh.numberofelements} · press Run test101 to solve + render`);
  } else {
    setStatus(`nvtx=${modelData.mesh.numberofvertices}, nelt=${modelData.mesh.numberofelements}; rendering bundled…`);
    renderVel(modelData);
  }
}

main().catch(e => {
  console.error(e);
  setStatus('error: ' + e.message);
});
