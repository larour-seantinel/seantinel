// Three.js wrapper that mirrors VESL's Node.patch() interface for the two cases we need:
// - FaceColor='interp' (per-vertex colors, used for node data like Vel)
// - FaceColor='flat'   (per-element colors, used for element data)

import * as THREE from 'three';
import { colorbars } from './colorbars.js';

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function sampleColormap(cmapName, t) {
  const cmap = colorbars[cmapName] || colorbars['jet'];
  const idx = clamp01(t) * (cmap.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(i0 + 1, cmap.length - 1);
  const f = idx - i0;
  const c0 = cmap[i0], c1 = cmap[i1];
  return [
    c0[0] + (c1[0] - c0[0]) * f,
    c0[1] + (c1[1] - c0[1]) * f,
    c0[2] + (c1[2] - c0[2]) * f,
  ];
}

export class Node {
  constructor({ caxis, colormap = 'jet', opacity = 1.0, log = false } = {}) {
    this.caxis = caxis;    // [min, max]
    this.colormap = colormap;
    this.opacity = opacity;
    this.log = log;
    this.mesh = null;      // Three.js Mesh once patched
  }

  // vertices: Float32Array[Nvtx*3] (x,y,z interleaved)
  // elements: Ntri x 3 (1-indexed, as in ISSM) OR flat Uint32Array (0-indexed)
  // data:     per-vertex (interp) OR per-element (flat)
  patch({ Faces, Vertices, FaceVertexCData, FaceColor = 'interp', EdgeColor = null }) {
    const nvtx = Vertices.length / 3;

    // Flatten elements to Uint32 index buffer (0-indexed)
    const ntri = Faces.length;
    const indices = new Uint32Array(ntri * 3);
    for (let i = 0; i < ntri; i++) {
      indices[3 * i + 0] = Faces[i][0] - 1;
      indices[3 * i + 1] = Faces[i][1] - 1;
      indices[3 * i + 2] = Faces[i][2] - 1;
    }

    const [cmin, cmax] = this.caxis;
    const span = (cmax - cmin) || 1;
    const colormapName = this.colormap;

    let geometry;
    if (FaceColor === 'interp') {
      // Per-vertex color
      const colors = new Float32Array(nvtx * 3);
      for (let v = 0; v < nvtx; v++) {
        const t = (FaceVertexCData[v] - cmin) / span;
        const rgb = sampleColormap(colormapName, t);
        colors[3 * v + 0] = rgb[0];
        colors[3 * v + 1] = rgb[1];
        colors[3 * v + 2] = rgb[2];
      }
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(Vertices, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    } else {
      // FaceColor === 'flat' — one color per triangle. Duplicate vertices so colors don't blend.
      const positions = new Float32Array(ntri * 3 * 3);
      const colors    = new Float32Array(ntri * 3 * 3);
      for (let f = 0; f < ntri; f++) {
        const t = (FaceVertexCData[f] - cmin) / span;
        const rgb = sampleColormap(colormapName, t);
        for (let k = 0; k < 3; k++) {
          const vi = indices[3 * f + k];
          positions[9 * f + 3 * k + 0] = Vertices[3 * vi + 0];
          positions[9 * f + 3 * k + 1] = Vertices[3 * vi + 1];
          positions[9 * f + 3 * k + 2] = Vertices[3 * vi + 2];
          colors[9 * f + 3 * k + 0] = rgb[0];
          colors[9 * f + 3 * k + 1] = rgb[1];
          colors[9 * f + 3 * k + 2] = rgb[2];
        }
      }
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: this.opacity < 1.0,
      opacity: this.opacity,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const group = new THREE.Group();
    group.add(mesh);

    if (EdgeColor) {
      const edges = new THREE.EdgesGeometry(geometry, 1);
      const edgeMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(EdgeColor[0], EdgeColor[1], EdgeColor[2]),
        transparent: EdgeColor.length > 3,
        opacity: EdgeColor.length > 3 ? EdgeColor[3] : 1.0,
      });
      group.add(new THREE.LineSegments(edges, edgeMat));
    }

    this.mesh = group;
    return group;
  }
}
