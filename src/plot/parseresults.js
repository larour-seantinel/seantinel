// Port of ~/issm/src/m/solve/parseresultsfrombuffer.js for a browser DataView.
// Record format (little-endian):
//   int32  length         (-1 => EOF)
//   char[length] fieldname
//   float64 time
//   int32   step
//   int32   type           1=double vec, 2=char str, 3=double matrix, 4=int matrix
//   int32   M
//   if type==1: float64[M]
//   if type==2: char[M]
//   if type==3: int32 N; float64[N*M]
//   if type==4: int32 N; int32[N*M]

const YTS = 31557600.0; // 365.2422 * 86400, matches ISSM constants.yts
const UNIT_YTS = new Set([
  'BalancethicknessThickeningRate',
  'HydrologyWaterVx', 'HydrologyWaterVy',
  'Vx', 'Vy', 'Vz', 'Vel',
  'BasalforcingsGroundediceMeltingRate', 'BasalforcingsFloatingiceMeltingRate',
  'SmbMassBalance', 'SmbPrecipitation', 'SmbRunoff', 'SmbCondensation',
  'SmbAccumulation', 'SmbMelt',
  'CalvingCalvingrate', 'Calvingratex', 'Calvingratey', 'CalvingMeltingrate',
]);

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function parseresults(bufferOrBase64) {
  const bytes = (typeof bufferOrBase64 === 'string')
    ? base64ToBytes(bufferOrBase64)
    : new Uint8Array(bufferOrBase64);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 0;
  const LE = true;

  const steps = [];
  let counter = 0;
  let lastStep = null;
  let checkNoMoreSteps = false;

  while (off < bytes.byteLength) {
    const length = dv.getInt32(off, LE); off += 4;
    if (length === -1) break;

    const nameBytes = new Uint8Array(bytes.buffer, bytes.byteOffset + off, length);
    // ISSM writes field names with a trailing NUL (length includes it) — strip NULs.
    const fieldname = new TextDecoder('utf-8').decode(nameBytes).replace(/\x00+$/, '');
    off += length;

    const time = dv.getFloat64(off, LE); off += 8;
    const step = dv.getInt32(off, LE);   off += 4;
    const type = dv.getInt32(off, LE);   off += 4;
    const M    = dv.getInt32(off, LE);   off += 4;

    let field;
    if (type === 1) {
      field = new Float64Array(M);
      for (let i = 0; i < M; i++) { field[i] = dv.getFloat64(off, LE); off += 8; }
    } else if (type === 2) {
      const sb = new Uint8Array(bytes.buffer, bytes.byteOffset + off, M);
      field = new TextDecoder('utf-8').decode(sb);
      off += M;
    } else if (type === 3) {
      const N = dv.getInt32(off, LE); off += 4;
      const total = N * M;
      field = new Float64Array(total);
      for (let i = 0; i < total; i++) { field[i] = dv.getFloat64(off, LE); off += 8; }
      field.rows = M; field.cols = N;
    } else if (type === 4) {
      const N = dv.getInt32(off, LE); off += 4;
      const total = N * M;
      field = new Int32Array(total);
      for (let i = 0; i < total; i++) { field[i] = dv.getInt32(off, LE); off += 4; }
      field.rows = M; field.cols = N;
    } else {
      throw new Error(`parseresults: unknown type ${type} for ${fieldname}`);
    }

    // Unit conversion m/s → m/year (and friends).
    if (UNIT_YTS.has(fieldname) && field instanceof Float64Array) {
      for (let i = 0; i < field.length; i++) field[i] = field[i] * YTS;
    }

    if (checkNoMoreSteps && step >= 1) {
      throw new Error('steady-state result mixed with transient steps');
    }
    if (lastStep !== null && step !== lastStep && step > 1) counter += 1;
    lastStep = step;

    let index;
    if (step === 0) { index = 0; checkNoMoreSteps = true; }
    else if (step === 1) index = 0;
    else index = counter;

    while (steps.length <= index) steps.push({});
    steps[index][fieldname] = field;
    if (time !== -9999) {
      steps[index].step = step;
      steps[index].time = time / YTS;
    }
  }

  return steps;
}

// Convenience: shape results into md.results[SolutionName].{field}, matching
// what plotmodel/processdata expect.
export function resultsFromOutbin(solutionName, b64) {
  const steps = parseresults(b64);
  if (steps.length === 0) throw new Error('parseresults: no records');
  const flat = steps[0];
  return { [solutionName]: flat };
}
