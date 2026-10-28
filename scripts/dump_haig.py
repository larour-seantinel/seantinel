#!/usr/bin/env python3
"""Build the Haig glacier model from VESL's md.js dump, run it, dump JSON + .bin/.toolkits.

Reads scripts/haig_src/md.js (1 MB JS literal: 232 `md.X.Y = ...;` lines + 8 toolkits entries).
Instantiates a Python ISSM model(), populates fields with legacy-name remapping
(trans->transient, priv->private; skip slr/gia). Runs solve(md, 'Transient'),
copies marshaled .bin/.toolkits + mesh+results JSON into the APK asset tree.

Outputs:
  public/data/testHaig.json
  android-spike/assets/data/testHaig.json
  android-spike/assets/testHaig/testHaig.bin
  android-spike/assets/testHaig/testHaig.toolkits

Env:
  NP=<int>        mpi ranks (default 1 — np=1 is the fast path on-device)
  FINAL=<float>   override transient final_time (default: from md.js, 30)
  STEP=<float>    override transient time_step (default: from md.js, 3)
"""

import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
ISSM_DIR = os.environ.get('ISSM_DIR') or os.path.expanduser('~/issm')
NR = os.path.join(ISSM_DIR, 'test', 'NightlyRun')
MD_JS = os.path.join(HERE, 'haig_src', 'md.js')

# Legacy -> modern top-level renames.
SUB_RENAME = {
    'trans': 'transient',
    'priv': 'private',
}
# Top-level fields in md.js that don't exist in the current Python model class.
SKIP_SUBS = {'slr', 'gia'}
# Fields that were renamed/removed inside the modern transient class.
SKIP_FIELDS_PER_SUB = {
    'transient': {'isgia', 'isslr', 'iscoupler'},
}
# Per-subclass field renames (legacy -> modern).
FIELD_RENAME_PER_SUB = {
    'mask': {'groundedice_levelset': 'ocean_levelset'},
}

LINE_RE = re.compile(r"^md\.(\w+)\.(\w+)\s*=\s*(.+?)\s*;\s*$")
TOOLKIT_RE = re.compile(r"^md\.toolkits\.DefaultAnalysis\['(\w+)'\]\s*=\s*(.+?)\s*;\s*$")


def setup_paths():
    for root, dirs, files in os.walk(os.path.join(ISSM_DIR, 'src/m')):
        if '.svn' in dirs:
            dirs.remove('.svn')
        if any(f.endswith('.py') and not f.endswith('.pyc') for f in files):
            if root not in sys.path:
                sys.path.append(root)
    for extra in [NR, os.path.join(ISSM_DIR, 'lib'), os.path.join(ISSM_DIR, 'src/wrappers/python/.libs')]:
        if extra not in sys.path:
            sys.path.append(extra)


def _is_numeric_tree(v):
    if isinstance(v, (int, float, bool)):
        return True
    if isinstance(v, list) and v:
        return all(_is_numeric_tree(x) for x in v)
    return False


def parse_js_value(rhs):
    """Convert a JS literal (number / 'string' / nested array / NaN) to a Python value.

    Numeric arrays (incl. nested) become numpy.ndarray — ISSM's checkconsistency
    expects numpy for fields like md.mesh.elements. String lists and empty lists
    stay as plain lists (several checks reject arrays where a list is required).
    """
    import numpy as np
    if rhs.strip() == '{}':
        return {}
    s = rhs.replace("'", '"')
    v = json.loads(s)
    if isinstance(v, list) and _is_numeric_tree(v):
        return np.array(v)
    return v


def to_list(a):
    try:
        import numpy as np
        if isinstance(a, np.ndarray):
            return a.tolist()
    except ImportError:
        pass
    if isinstance(a, (list, tuple)):
        return [to_list(x) for x in a]
    return a


def load_md_js(md):
    """Populate md fields in-place from the Haig md.js dump. Returns stats."""
    stats = {'set': 0, 'toolkit': 0, 'skipped': 0, 'warnings': []}
    with open(MD_JS) as f:
        for lineno, raw in enumerate(f, 1):
            line = raw.strip()
            if not line or line.startswith('var md'):
                continue

            m = TOOLKIT_RE.match(line)
            if m:
                key, rhs = m.group(1), m.group(2)
                try:
                    md.toolkits.DefaultAnalysis[key] = parse_js_value(rhs)
                    stats['toolkit'] += 1
                except Exception as e:
                    stats['warnings'].append(f'line {lineno} toolkit {key}: {e}')
                continue

            # Toolkits DefaultAnalysis = {} initializer
            if line.startswith('md.toolkits.DefaultAnalysis'):
                m2 = re.match(r"^md\.toolkits\.DefaultAnalysis\s*=\s*\{\}\s*;\s*$", line)
                if m2:
                    md.toolkits.DefaultAnalysis = {}
                    continue

            m = LINE_RE.match(line)
            if not m:
                stats['warnings'].append(f'line {lineno} unparsed: {line[:80]}')
                continue
            sub, field, rhs = m.group(1), m.group(2), m.group(3)

            if sub in SKIP_SUBS:
                stats['skipped'] += 1
                continue
            sub_modern = SUB_RENAME.get(sub, sub)
            if field in SKIP_FIELDS_PER_SUB.get(sub_modern, set()):
                stats['skipped'] += 1
                continue
            field = FIELD_RENAME_PER_SUB.get(sub_modern, {}).get(field, field)

            target = getattr(md, sub_modern, None)
            if target is None:
                stats['warnings'].append(f'line {lineno}: md.{sub_modern} is None')
                continue

            try:
                value = parse_js_value(rhs)
            except Exception as e:
                stats['warnings'].append(f'line {lineno} parse md.{sub}.{field}: {e}')
                continue

            try:
                setattr(target, field, value)
                stats['set'] += 1
            except Exception as e:
                stats['warnings'].append(f'line {lineno} setattr md.{sub_modern}.{field}: {e}')

    return stats


def _collect_one(sol):
    import numpy as np
    out = {}
    for name in dir(sol):
        if name.startswith('_'):
            continue
        v = getattr(sol, name)
        if callable(v):
            continue
        if isinstance(v, np.ndarray):
            out[name] = v.tolist()
        elif isinstance(v, (int, float, bool, str)):
            out[name] = v
    return out


def collect_results(md, solution):
    sol = getattr(md.results, solution + 'Solution', None)
    if sol is None:
        return {}
    if hasattr(sol, '__len__') and hasattr(sol, '__getitem__') and not isinstance(sol, (dict, str, bytes)):
        return [_collect_one(sol[i]) for i in range(len(sol))]
    return _collect_one(sol)


def main():
    np_ranks = int(os.environ.get('NP', '1'))

    setup_paths()
    from model import model
    from generic import generic
    from socket import gethostname

    md = model()
    md.toolkits.DefaultAnalysis = {}

    print(f'[haig] parsing {MD_JS}')
    stats = load_md_js(md)
    print(f'[haig] set={stats["set"]} toolkit={stats["toolkit"]} skipped={stats["skipped"]} warnings={len(stats["warnings"])}')
    for w in stats['warnings'][:20]:
        print(f'  WARN: {w}')
    if len(stats['warnings']) > 20:
        print(f'  ... {len(stats["warnings"]) - 20} more')

    # Fix up fields whose semantics drifted between the Haig md.js vintage
    # and the current ISSM Python class definitions.
    md.settings.results_on_nodes = []  # was an int flag, now a list of output names
    md.geometry.thickness = md.geometry.surface - md.geometry.base  # equality check expects exact

    # Override solve-time knobs that we care about on this device.
    md.cluster = generic('name', gethostname(), 'np', np_ranks)
    md.miscellaneous.name = 'testHaig'
    md.verbose.solution = False
    if 'FINAL' in os.environ:
        md.timestepping.final_time = float(os.environ['FINAL'])
    if 'STEP' in os.environ:
        md.timestepping.time_step = float(os.environ['STEP'])

    nvtx = int(md.mesh.numberofvertices)
    nelt = int(md.mesh.numberofelements)
    print(f'[haig] mesh nvtx={nvtx} nelt={nelt} '
          f'start={md.timestepping.start_time} final={md.timestepping.final_time} step={md.timestepping.time_step}')

    os.chdir(NR)
    from solve import solve
    md = solve(md, 'Transient')

    # Pack mesh + results into JSON for the WebView plotter.
    mesh_out = {
        'numberofvertices': nvtx,
        'numberofelements': nelt,
        'x': to_list(md.mesh.x),
        'y': to_list(md.mesh.y),
        'elements': to_list(md.mesh.elements),
    }
    # Pack geometry for 2D draping — the renderer uses surface as vertex z.
    geom_out = {}
    for g in ('surface', 'base', 'thickness', 'bed'):
        v = getattr(md.geometry, g, None)
        if v is None:
            continue
        if hasattr(v, 'tolist'):
            geom_out[g] = v.tolist()
        elif isinstance(v, (list, tuple)):
            geom_out[g] = to_list(v)
    for extra in ('z', 'numberoflayers', 'elements2d', 'numberofvertices2d',
                  'numberofelements2d', 'x2d', 'y2d', 'vertexonbase', 'vertexonsurface'):
        v = getattr(md.mesh, extra, None)
        if v is None:
            continue
        if hasattr(v, 'tolist'):
            mesh_out[extra] = v.tolist()
        elif isinstance(v, (list, tuple)):
            mesh_out[extra] = to_list(v)
        elif isinstance(v, (int, float, bool)):
            mesh_out[extra] = v

    # Radar overlay: xlim/ylim position the texture; outer{index,x,y,height}
    # carry the surrounding terrain mesh so we can rebuild a textured DEM like
    # VESL does. All fields come straight from md.radaroverlay in the JS dump.
    overlay = {}
    for k in ('xlim', 'ylim', 'outerindex', 'outerx', 'outery', 'outerheight'):
        v = getattr(md.radaroverlay, k, None)
        if v is None:
            continue
        if hasattr(v, 'tolist'):
            overlay[k] = v.tolist()
        else:
            overlay[k] = to_list(v)
    overlay['image'] = 'data/testHaig_radar.png'

    out = {
        'mesh': mesh_out,
        'geometry': geom_out,
        'overlay': overlay,
        'results': {'TransientSolution': collect_results(md, 'Transient')},
    }

    public_json = os.path.join(ROOT, 'public', 'data', 'testHaig.json')
    assets_json = os.path.join(ROOT, 'android-spike', 'assets', 'data', 'testHaig.json')
    for p in (public_json, assets_json):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w') as f:
            json.dump(out, f)
        print(f'[haig] wrote {p} ({os.path.getsize(p)} bytes)')

    # Copy marshaled .bin/.toolkits into the APK asset tree.
    exec_root = os.path.join(ISSM_DIR, 'execution')
    name = 'testHaig'
    cand = sorted(
        [d for d in os.listdir(exec_root) if d.startswith(name + '-')],
        key=lambda d: os.path.getmtime(os.path.join(exec_root, d)),
    )
    if not cand:
        print(f'[haig] WARNING: no execution dir found for {name}')
        return
    latest = os.path.join(exec_root, cand[-1])
    assets_dir = os.path.join(ROOT, 'android-spike', 'assets', name)
    os.makedirs(assets_dir, exist_ok=True)
    for suf in ('.bin', '.toolkits'):
        src = os.path.join(latest, name + suf)
        dst = os.path.join(assets_dir, name + suf)
        if not os.path.exists(src):
            print(f'[haig] WARNING: {src} missing')
            continue
        shutil.copyfile(src, dst)
        print(f'[haig] copied {src} -> {dst} ({os.path.getsize(dst)} bytes)')

    # Stage the radar overlay PNG next to the JSON so the same relative URL
    # (data/testHaig_radar.png) resolves in both the browser dev path and the
    # WebView (where it becomes file:///android_asset/data/...).
    radar_src = os.path.join(HERE, 'haig_src', 'radar.png')
    if os.path.exists(radar_src):
        for radar_dst in (
            os.path.join(ROOT, 'public', 'data', 'testHaig_radar.png'),
            os.path.join(ROOT, 'android-spike', 'assets', 'data', 'testHaig_radar.png'),
        ):
            shutil.copyfile(radar_src, radar_dst)
            print(f'[haig] copied radar.png -> {radar_dst} ({os.path.getsize(radar_dst)} bytes)')


if __name__ == '__main__':
    main()
