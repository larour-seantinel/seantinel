// Entry equivalent to MATLAB plotmodel(md, 'data', ...)
// Usage: plotmodel(scene, md, data, { colormap, caxis, edgecolor })

import { processmesh } from './processmesh.js';
import { processdata } from './processdata.js';
import { Node } from './Node.js';

export function plotmodel(scene, md, data, opts = {}) {
  const meshres = processmesh(md);
  const { data: proc, datatype } = processdata(md, data);

  let cmin = opts.caxis ? opts.caxis[0] : Infinity;
  let cmax = opts.caxis ? opts.caxis[1] : -Infinity;
  if (!opts.caxis) {
    for (let i = 0; i < proc.length; i++) {
      const v = proc[i];
      if (v < cmin) cmin = v;
      if (v > cmax) cmax = v;
    }
  }

  const node = new Node({
    caxis: [cmin, cmax],
    colormap: opts.colormap || 'jet',
    opacity: opts.opacity ?? 1.0,
  });

  const faceColor = datatype === 2 ? 'interp' : 'flat';
  const group = node.patch({
    Faces: meshres.elements,
    Vertices: meshres.vertices,
    FaceVertexCData: proc,
    FaceColor: faceColor,
    EdgeColor: opts.edgecolor || null,
  });

  scene.add(group);
  return { node, group, caxis: [cmin, cmax] };
}
