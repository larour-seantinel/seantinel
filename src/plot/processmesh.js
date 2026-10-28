// Simplified port of ~/issm/src/m/plot/processmesh.js — 2D triangles.
// Optionally drapes vertices onto a per-vertex z source (e.g. md.geometry.surface)
// scaled by zExaggeration — used for Haig and future terrain-draped 2D models.

export function processmesh(md, opts = {}) {
  if (!md.mesh || md.mesh.numberofvertices === 0) {
    throw new Error('processmesh: mesh is empty');
  }
  if (md.mesh.numberofvertices === md.mesh.numberofelements) {
    throw new Error('processmesh: nvtx == nelt — ambiguous');
  }

  const x = Array.from(md.mesh.x);
  const y = Array.from(md.mesh.y);
  const nvtx = md.mesh.numberofvertices;

  // Priority: explicit opts.vertexZ > md.mesh.z > geometry.surface > zeros.
  let zSrc = null;
  if (opts.vertexZ && opts.vertexZ.length === nvtx) zSrc = opts.vertexZ;
  else if (md.mesh.z && md.mesh.z.length === nvtx) zSrc = md.mesh.z;
  else if (opts.drapeOnSurface && md.geometry && md.geometry.surface && md.geometry.surface.length === nvtx) {
    zSrc = md.geometry.surface;
  }
  const z = zSrc ? Array.from(zSrc) : new Array(nvtx).fill(0);

  const zExag = opts.zExaggeration ?? 1;
  // Center the exaggeration on the mean altitude so z-exag amplifies RELIEF,
  // not absolute altitude — otherwise the whole mesh translates skyward as the
  // slider moves and nothing looks mountainous.
  let zMean = 0;
  if (zSrc) {
    for (let i = 0; i < nvtx; i++) zMean += z[i];
    zMean /= nvtx;
  }
  const vertices = new Float32Array(nvtx * 3);
  for (let i = 0; i < nvtx; i++) {
    vertices[3 * i + 0] = x[i];
    vertices[3 * i + 1] = y[i];
    vertices[3 * i + 2] = (z[i] - zMean) * zExag + zMean;
  }

  const is2d = !zSrc;
  return { x, y, z, elements: md.mesh.elements, vertices, is2d };
}
