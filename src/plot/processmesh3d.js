// 3D prism-mesh skin extraction for ISSM `mesh3dprisms`.
//
// A 3D prism is 6-vertex: [bottom_tri, top_tri] = [v0, v1, v2, v3, v4, v5].
// 3D vertex index for 2D vertex `v` at layer `k` is `v + k*numberofvertices2d`
// (1-indexed on the ISSM side).
//
// For rendering we emit only the outer skin:
//   - Top triangles (at layer = numberoflayers - 1)
//   - Bottom triangles (at layer 0, reverse winding)
//   - Side quads for each boundary 2D edge × each prism layer, split into 2 tris
//
// Returns `{ vertices: Float32Array[nvtx*3], elements: Array<[a,b,c] 1-indexed>, is2d: false }`
// — the same shape as processmesh.js, so Node.js patch() consumes it directly.

export function processmesh3d(md) {
  const nvtx = md.mesh.numberofvertices;
  const nvtx2d = md.mesh.numberofvertices2d;
  const layers = md.mesh.numberoflayers;
  const prismLayers = layers - 1;
  const elements2d = md.mesh.elements2d;
  const nelt2d = elements2d.length;

  const x = md.mesh.x;
  const y = md.mesh.y;
  const z = md.mesh.z;
  const vertices = new Float32Array(nvtx * 3);
  for (let i = 0; i < nvtx; i++) {
    vertices[3 * i + 0] = x[i];
    vertices[3 * i + 1] = y[i];
    vertices[3 * i + 2] = z[i];
  }

  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const edgeCount = new Map();
  for (let t = 0; t < nelt2d; t++) {
    const [a, b, c] = elements2d[t];
    for (const [va, vb] of [[a, b], [b, c], [c, a]]) {
      const k = key(va, vb);
      edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
    }
  }
  const boundaryEdges = [];
  for (let t = 0; t < nelt2d; t++) {
    const [a, b, c] = elements2d[t];
    for (const [va, vb] of [[a, b], [b, c], [c, a]]) {
      if (edgeCount.get(key(va, vb)) === 1) boundaryEdges.push([va, vb]);
    }
  }

  const faces = [];
  const topOff = (layers - 1) * nvtx2d;

  for (let t = 0; t < nelt2d; t++) {
    const [a, b, c] = elements2d[t];
    faces.push([a + topOff, b + topOff, c + topOff]);
    faces.push([a, c, b]);
  }
  for (const [va, vb] of boundaryEdges) {
    for (let k = 0; k < prismLayers; k++) {
      const kOff = k * nvtx2d;
      const kOff1 = (k + 1) * nvtx2d;
      faces.push([va + kOff, vb + kOff, vb + kOff1]);
      faces.push([va + kOff, vb + kOff1, va + kOff1]);
    }
  }

  return { vertices, elements: faces, is2d: false };
}
