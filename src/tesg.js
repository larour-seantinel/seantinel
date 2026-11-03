import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');

let scene, camera, renderer, controls;

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050810);
  camera = new THREE.PerspectiveCamera(45, 1, 1, 1e9);
  camera.up.set(0, 0, 1);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
  controls.maxPolarAngle = (89 * Math.PI) / 180;
  controls.minDistance = 20;
  controls.maxDistance = 800000;

  (function tick() {
    controls.update();
    const d = camera.position.distanceTo(controls.target);
    camera.near = Math.max(d * 0.001, 1);
    camera.far  = Math.max(d * 500, 100000);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();
}

// Wireframe of the BAMG mesh as LineSegments (deduplicated edges).
function buildWireframe(snap) {
  const { x, y, elements_flat } = snap;
  const nv = x.length;

  const positions = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    positions[3*i]   = x[i];
    positions[3*i+1] = y[i];
    positions[3*i+2] = 0;
  }

  // Deduplicated edges via a Set.
  const edgeSet = new Set();
  const ne = elements_flat.length / 3;
  for (let j = 0; j < ne; j++) {
    const a = elements_flat[3*j], b = elements_flat[3*j+1], c = elements_flat[3*j+2];
    for (const [p, q] of [[a,b],[b,c],[a,c]]) {
      edgeSet.add(p < q ? p * 2000000 + q : q * 2000000 + p);
    }
  }

  const linePos = new Float32Array(edgeSet.size * 6);
  let pi = 0;
  for (const key of edgeSet) {
    const q = key % 2000000;
    const p = (key - q) / 2000000;
    linePos[pi++] = positions[3*p];   linePos[pi++] = positions[3*p+1]; linePos[pi++] = 0;
    linePos[pi++] = positions[3*q];   linePos[pi++] = positions[3*q+1]; linePos[pi++] = 0;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
  scene.add(new THREE.LineSegments(geom, mat));
}

function addRing(pts, color) {
  if (!pts || pts.length < 2) return;
  const closed = [...pts, pts[0]];
  const pos = new Float32Array(closed.length * 3);
  for (let i = 0; i < closed.length; i++) {
    pos[3*i] = closed[i][0]; pos[3*i+1] = closed[i][1]; pos[3*i+2] = 0;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color, depthTest: false });
  const line = new THREE.Line(geom, mat);
  line.renderOrder = 20;
  scene.add(line);
}

function buildRings(snap) {
  if (!snap.rings) return;
  for (const r of (snap.rings.ocean || [])) addRing(r, 0xff2244);
  for (const r of (snap.rings.land  || [])) addRing(r, 0x00ffff);
}

// Standard even-odd ray-cast point-in-polygon.
function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > py) !== (yj > py)) &&
                      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Classify TESG verts: inside ANY ocean ring = ocean (blue); otherwise land (orange).
function classifyVerts(snap) {
  const { x, y } = snap;
  const nv = x.length;
  const oceanRings = (snap.rings && snap.rings.ocean) || [];
  const posIn  = []; const posOut = [];
  let nIn = 0;
  for (let i = 0; i < nv; i++) {
    const px = x[i], py = y[i];
    let inside = false;
    for (const r of oceanRings) {
      if (pointInRing(px, py, r)) { inside = true; break; }
    }
    if (inside) { posIn.push(px, py, 1);  nIn++; }
    else        { posOut.push(px, py, 1); }
  }
  const mk = (arr, color) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    const m = new THREE.PointsMaterial({ color, size: 2.5, sizeAttenuation: false, depthTest: false });
    const pts = new THREE.Points(g, m);
    pts.renderOrder = 25;
    scene.add(pts);
  };
  mk(posIn,  0x3399ff);  // ocean verts — blue
  mk(posOut, 0xffaa33);  // land verts  — orange
  return { nIn, nOut: nv - nIn };
}

function frameCamera() {
  // Top-down view from 300 km up, looking at origin.
  camera.position.set(0, -50000, 300000);
  controls.target.set(0, 0, 0);
  controls.update();
}

async function main() {
  initScene();
  try {
    const res = await fetch('data/tesg.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const snap = await res.json();
    buildWireframe(snap);
    buildRings(snap);
    const { nIn, nOut } = classifyVerts(snap);
    frameCamera();
    const nv = snap.x.length;
    const ne = snap.elements_flat.length / 3;
    statusEl.textContent = `${nv.toLocaleString()} verts · ${ne.toLocaleString()} triangles · ocean ${nIn.toLocaleString()} · land ${nOut.toLocaleString()}`;
  } catch(e) {
    statusEl.textContent = 'error: ' + e.message;
    console.error(e);
  }
}

main();
