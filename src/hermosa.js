import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const statusEl = document.getElementById('status');
const canvas = document.getElementById('canvas');
const waterRange = document.getElementById('water-range');
const waterLabel = document.getElementById('water-label');

const Z_EXAG = 5;

let scene, camera, renderer, controls;
let terrainMesh = null;
let waterMesh = null;
let snap = null;

function setStatus(m) { statusEl.textContent = m; }

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
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

  (function tick() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();
}

function buildTerrain(s) {
  const x = s.x, y = s.y, z = s.field, elts = s.elements;
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

function buildWater(s) {
  const [xmin, ymin, xmax, ymax] = s.bbox;
  const geom = new THREE.PlaneGeometry(xmax - xmin, ymax - ymin);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x2b7fcf, transparent: true, opacity: 0.55,
    side: THREE.DoubleSide, depthWrite: false,
  });
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

function configureWaterSlider() {
  waterRange.min = '0';
  waterRange.max = '10';
  waterRange.step = '0.1';
  waterRange.value = '0';
  waterRange.disabled = false;
  updateWaterZ(0);
}

function updateWaterZ(z) {
  if (waterMesh) waterMesh.position.z = z * Z_EXAG;
  waterLabel.textContent = `${z.toFixed(2)} m`;
}

async function main() {
  initScene();
  try {
    const res = await fetch('data/hermosa.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    snap = await res.json();
  } catch (e) {
    setStatus('error loading data: ' + e.message);
    return;
  }
  buildTerrain(snap);
  buildWater(snap);
  frameCamera(snap);
  configureWaterSlider();
  setStatus(`Hermosa Beach pier · ${snap.x.length} verts, ${snap.elements.length} elts`);

  waterRange.addEventListener('input', () => {
    updateWaterZ(parseFloat(waterRange.value));
  });
}

main().catch(e => {
  console.error(e);
  setStatus('error: ' + e.message);
});
