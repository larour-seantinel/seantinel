// Simplified port of ~/issm/src/m/plot/processdata.js.
// Classifies a result array as node (per-vertex, type=2) or element (per-element, type=1).

export function processdata(md, data) {
  if (!data || data.length === 0) {
    throw new Error('processdata: data is empty');
  }

  const nvtx = md.mesh.numberofvertices;
  const nelt = md.mesh.numberofelements;
  const n = data.length;

  let datatype;
  if (n === nvtx) datatype = 2;          // node (per-vertex) data
  else if (n === nelt) datatype = 1;     // element (per-element) data
  else throw new Error(`processdata: unrecognized length ${n} (nvtx=${nvtx}, nelt=${nelt})`);

  return { data, datatype };
}
