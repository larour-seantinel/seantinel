import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { t, applyI18n, mountLangToggle } from './i18n.js';

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
  controls.maxPolarAngle = (85 * Math.PI) / 180;
  controls.minDistance = 20;
  controls.maxDistance = 4000;

  (function tick() {
    controls.update();
    const camDist = camera.position.distanceTo(controls.target);
    camera.near = Math.max(camDist * 0.1, 1);
    camera.far = Math.max(camDist * 50, 10000);
    camera.updateProjectionMatrix();
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

  const label = makeLabelSprite(t('site.you_are_here'));
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

// Load an image as a canvas ImageData so we can sample per-pixel RGB.
function loadImageData(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        // Dump a few sample pixels so we can confirm the image decoded.
        const mid = (Math.floor(c.height / 2) * c.width + Math.floor(c.width / 2)) * 4;
        console.log('[loadImageData]', url, c.width + 'x' + c.height,
                    'center RGB:', data.data[mid], data.data[mid+1], data.data[mid+2]);
        resolve(data);
      } catch (e) {
        console.error('[loadImageData] getImageData failed:', e);
        reject(e);
      }
    };
    img.onerror = (e) => { console.error('[loadImageData] load error:', url, e); reject(e); };
    img.src = url;
  });
}

// Mean RGB (0..1) of the NAIP pixels inside the building's local-coord bbox.
// Subsamples at most ~16 steps per side so a 17k-building site stays fast.
function sampleBuildingColor(contour, s, imgData) {
  const [xmin, ymin, xmax, ymax] = s.bbox;
  const xspan = xmax - xmin, yspan = ymax - ymin;
  let bxmin = Infinity, bymin = Infinity, bxmax = -Infinity, bymax = -Infinity;
  for (const p of contour) {
    if (p.x < bxmin) bxmin = p.x;
    if (p.x > bxmax) bxmax = p.x;
    if (p.y < bymin) bymin = p.y;
    if (p.y > bymax) bymax = p.y;
  }
  const W = imgData.width, H = imgData.height;
  const ix0 = Math.max(0, Math.floor((bxmin - xmin) / xspan * W));
  const ix1 = Math.min(W - 1, Math.ceil((bxmax - xmin) / xspan * W));
  // Image y is top-down; UV v=0 is bottom.
  const iy0 = Math.max(0, Math.floor((1 - (bymax - ymin) / yspan) * H));
  const iy1 = Math.min(H - 1, Math.ceil((1 - (bymin - ymin) / yspan) * H));
  const dxs = Math.max(1, Math.floor((ix1 - ix0) / 16));
  const dys = Math.max(1, Math.floor((iy1 - iy0) / 16));
  const d = imgData.data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = iy0; y <= iy1; y += dys) {
    for (let x = ix0; x <= ix1; x += dxs) {
      const i = (y * W + x) * 4;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
  }
  if (!n) return [0.6, 0.6, 0.6];
  return [r / n / 255, g / n / 255, b / n / 255];
}

// Build merged BufferGeometries for buildings. Walls are quads along each
// polygon edge; roof is the polygon triangulated via Three.js earcut.
// If flatWalls=true, walls get one averaged NAIP color per building instead
// of UV-mapping the aerial image (which looks extruded from above).
async function buildBuildings(s, flatWalls) {
  if (!s.buildings || !s.buildings.length) return;
  const [xmin, ymin, xmax, ymax] = s.bbox;
  const xspan = xmax - xmin, yspan = ymax - ymin;
  const groundGrid = buildGroundGrid(s);
  const LIFT_M = 0.3;
  const imgData = flatWalls ? await loadImageData('data/' + s.imagery) : null;
  if (flatWalls) {
    const mid = (Math.floor(imgData.height / 2) * imgData.width + Math.floor(imgData.width / 2)) * 4;
    const c0 = sampleBuildingColor([{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}], s, imgData);
    setStatus(`debug: img ${imgData.width}x${imgData.height} centerRGB=${imgData.data[mid]},${imgData.data[mid+1]},${imgData.data[mid+2]} sample0=${c0.map(x=>x.toFixed(2)).join(',')}`);
  }

  let wallVerts = 0, wallTris = 0, roofVerts = 0, roofTris = 0;
  const prepped = [];
  for (const b of s.buildings) {
    let ring = b.ring;
    if (!ring || ring.length < 3) continue;
    let n = ring.length;
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
    const color = flatWalls ? sampleBuildingColor(contour, s, imgData) : null;
    prepped.push({ contour, tris, cx, cy, h: b.h || 7, color });
    wallVerts += n * 4; wallTris += n * 2;
    roofVerts += n;     roofTris += tris.length;
  }

  const wallPos = new Float32Array(wallVerts * 3);
  const wallIdx = new Uint32Array(wallTris * 3);
  const wallUV = flatWalls ? null : new Float32Array(wallVerts * 2);
  const wallCol = flatWalls ? new Float32Array(wallVerts * 3) : null;
  const roofPos = new Float32Array(roofVerts * 3);
  const roofUV = new Float32Array(roofVerts * 2);
  const roofIdx = new Uint32Array(roofTris * 3);
  let wpi = 0, wii = 0, wui = 0, wci = 0, wvi = 0;
  let rpi = 0, rui = 0, rii = 0, rvi = 0;

  for (const b of prepped) {
    const { contour, tris, cx, cy, h, color } = b;
    const n = contour.length;
    const groundZ = (groundZFromGrid(groundGrid, cx, cy) + LIFT_M) * Z_EXAG;
    const topZ = groundZ + h;
    for (let i = 0; i < n; i++) {
      const a = contour[i], c = contour[(i + 1) % n];
      wallPos[wpi++] = a.x; wallPos[wpi++] = a.y; wallPos[wpi++] = groundZ;
      wallPos[wpi++] = c.x; wallPos[wpi++] = c.y; wallPos[wpi++] = groundZ;
      wallPos[wpi++] = c.x; wallPos[wpi++] = c.y; wallPos[wpi++] = topZ;
      wallPos[wpi++] = a.x; wallPos[wpi++] = a.y; wallPos[wpi++] = topZ;
      if (flatWalls) {
        for (let k = 0; k < 4; k++) {
          wallCol[wci++] = color[0]; wallCol[wci++] = color[1]; wallCol[wci++] = color[2];
        }
      } else {
        const ua = (a.x - xmin) / xspan, va = (a.y - ymin) / yspan;
        const uc = (c.x - xmin) / xspan, vc = (c.y - ymin) / yspan;
        wallUV[wui++] = ua; wallUV[wui++] = va;
        wallUV[wui++] = uc; wallUV[wui++] = vc;
        wallUV[wui++] = uc; wallUV[wui++] = vc;
        wallUV[wui++] = ua; wallUV[wui++] = va;
      }
      wallIdx[wii++] = wvi;     wallIdx[wii++] = wvi + 1; wallIdx[wii++] = wvi + 2;
      wallIdx[wii++] = wvi;     wallIdx[wii++] = wvi + 2; wallIdx[wii++] = wvi + 3;
      wvi += 4;
    }
    const roofStart = rvi;
    for (let i = 0; i < n; i++) {
      const p = contour[i];
      roofPos[rpi++] = p.x; roofPos[rpi++] = p.y; roofPos[rpi++] = topZ;
      roofUV[rui++] = (p.x - xmin) / xspan;
      roofUV[rui++] = (p.y - ymin) / yspan;
      rvi++;
    }
    for (const t of tris) {
      roofIdx[rii++] = roofStart + t[0];
      roofIdx[rii++] = roofStart + t[1];
      roofIdx[rii++] = roofStart + t[2];
    }
  }

  const wallGeom = new THREE.BufferGeometry();
  wallGeom.setAttribute('position', new THREE.BufferAttribute(wallPos, 3));
  wallGeom.setIndex(new THREE.BufferAttribute(wallIdx, 1));
  let wallMat;
  if (flatWalls) {
    wallGeom.setAttribute('color', new THREE.BufferAttribute(wallCol, 3));
    wallMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  } else {
    wallGeom.setAttribute('uv', new THREE.BufferAttribute(wallUV, 2));
    wallMat = new THREE.MeshBasicMaterial({ map: naipTexture, side: THREE.DoubleSide });
  }
  scene.add(new THREE.Mesh(wallGeom, wallMat));

  const roofGeom = new THREE.BufferGeometry();
  roofGeom.setAttribute('position', new THREE.BufferAttribute(roofPos, 3));
  roofGeom.setAttribute('uv', new THREE.BufferAttribute(roofUV, 2));
  roofGeom.setIndex(new THREE.BufferAttribute(roofIdx, 1));
  const roofMat = new THREE.MeshBasicMaterial({ map: naipTexture, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(roofGeom, roofMat));
}

// Coarse grid layer draped with its own low-res texture. Sunk `sinkM` meters
// under whatever is covering it so inner meshes win by depth test. Hole-cut
// rule: cull a cell only if it both overlaps the (shrunk) hole AND has any
// dry-land corner. All-ocean cells in the hole are kept so the water plane
// hides them, closing the ocean-side seam gap. The hole is shrunk by one cell
// width (capped at a quarter of the hole width) so the kept-cell edge lands
// at the inner-mesh edge instead of one cell past it.
function buildGridLayer(layer, holeBbox, sinkM) {
  if (!layer) return;
  const nx = layer.nx, ny = layer.ny;
  const xs = layer.xs, ys = layer.ys, z = layer.z;
  const [xmin, ymin, xmax, ymax] = layer.bbox;
  const xspan = xmax - xmin, yspan = ymax - ymin;
  const [ixmin, iymin, ixmax, iymax] = holeBbox;
  const cellX = (xs[nx - 1] - xs[0]) / (nx - 1);
  const cellY = (ys[ny - 1] - ys[0]) / (ny - 1);
  const shrinkX = Math.min(cellX, (ixmax - ixmin) * 0.25);
  const shrinkY = Math.min(cellY, (iymax - iymin) * 0.25);
  const hxmin = ixmin + shrinkX, hxmax = ixmax - shrinkX;
  const hymin = iymin + shrinkY, hymax = iymax - shrinkY;

  const positions = new Float32Array(nx * ny * 3);
  const uvs = new Float32Array(nx * ny * 2);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      positions[3 * k + 0] = xs[i];
      positions[3 * k + 1] = ys[j];
      positions[3 * k + 2] = z[k] * Z_EXAG - sinkM;
      uvs[2 * k + 0] = (xs[i] - xmin) / xspan;
      uvs[2 * k + 1] = (ys[j] - ymin) / yspan;
    }
  }
  const inHole = (i, j) =>
    xs[i] > hxmin && xs[i] < hxmax && ys[j] > hymin && ys[j] < hymax;
  const isLand = (i, j) => z[j * nx + i] > 0;
  const tris = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const anyInHole = inHole(i, j) || inHole(i + 1, j) || inHole(i, j + 1) || inHole(i + 1, j + 1);
      const anyLand = isLand(i, j) || isLand(i + 1, j) || isLand(i, j + 1) || isLand(i + 1, j + 1);
      if (anyInHole && anyLand) continue;
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
  const tex = new THREE.TextureLoader().load('data/' + layer.imagery);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom, mat);
  scene.add(mesh);
}

function buildWater(s) {
  const bbox = (s.superfarfield && s.superfarfield.bbox)
            || (s.farfield && s.farfield.bbox)
            || s.bbox;
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
  if (meters < 0.05) return t('scenario.today');
  if (meters < 0.3)  return t('scenario.2050');
  if (meters < 0.6)  return t('scenario.2100');
  if (meters < 1.2)  return t('scenario.2100_high');
  if (meters < 2.5)  return t('scenario.ice_loss');
  return t('scenario.worst');
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
  applyI18n();
  mountLangToggle(document.body);
  setStatus(t('site.loading'));
  initScene();
  const slug = getLocSlug();
  try {
    const res = await fetch(`data/${slug}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    snap = await res.json();
  } catch (e) {
    setStatus(t('site.error') + e.message);
    return;
  }
  const label = snap.title || slug;
  titleEl.textContent = `${label} \u00b7 ${t('site.title_suffix')}`;
  document.title = `Seantinel \u00b7 ${label}`;
  if (snap.superfarfield) buildGridLayer(snap.superfarfield, snap.farfield?.bbox || snap.bbox, 2);
  if (snap.farfield) buildGridLayer(snap.farfield, snap.bbox, 1);
  buildTerrain(snap);
  buildWater(snap);
  await buildBuildings(snap, slug === 'hermosa');
  buildMarker(snap);
  frameCamera(snap);
  configureWaterSlider();
  setStatus(t('site.ready'));

  waterRange.addEventListener('input', () => {
    updateWaterDisplay(parseFloat(waterRange.value));
  });
}

main().catch(e => {
  console.error(e);
  setStatus('error: ' + e.message);
});
