// Simplified port of ~/issm/src/m/plot/processmesh.js — 2D only, xy coords.
// Returns { x, y, z, elements, vertices, is2d } for a given model.

export function processmesh(md) {
  if (!md.mesh || md.mesh.numberofvertices === 0) {
    throw new Error('processmesh: mesh is empty');
  }
  if (md.mesh.numberofvertices === md.mesh.numberofelements) {
    throw new Error('processmesh: nvtx == nelt — ambiguous');
  }

  const x = Array.from(md.mesh.x);
  const y = Array.from(md.mesh.y);
  const z = md.mesh.z ? Array.from(md.mesh.z) : new Array(x.length).fill(0);
  const elements = md.mesh.elements;

  // Build vertices as Nvtx x 3 Float32Array for Three.js
  const nvtx = md.mesh.numberofvertices;
  const vertices = new Float32Array(nvtx * 3);
  for (let i = 0; i < nvtx; i++) {
    vertices[3 * i + 0] = x[i];
    vertices[3 * i + 1] = y[i];
    vertices[3 * i + 2] = z[i];
  }

  const is2d = (!md.mesh.z) || md.mesh.z.every(v => v === 0);
  return { x, y, z, elements, vertices, is2d };
}
