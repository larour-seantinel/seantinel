#!/usr/bin/env python3
"""Build an ISSM test (101/102/103/104/105/106/107/110) and dump mesh + solution to JSON + .bin/.toolkits.

Supported tests:
  TEST=101  Stressbalance SSA (minimal outputs: Vel/Vx/Vy/Pressure)   -- 2D, Seantinel variant
  TEST=102  Stressbalance SSA extruded 3 layers (6-vertex prisms)      -- 3D, real ISSM test102
  TEST=103  Stressbalance HO (higher-order 3D with StressTensor)       -- 3D, real ISSM test103
  TEST=104  Stressbalance FS (full-Stokes 3D)                          -- 3D, real ISSM test104
  TEST=105  Masstransport 2D DG (Thickness)                            -- 2D, real ISSM test105
  TEST=106  Stressbalance SSA (full outputs incl. DevStress/MassFlux)  -- 2D, real ISSM test106
  TEST=107  Masstransport 3D (5 layers, Thickness)                     -- 3D, real ISSM test107
  TEST=110  Transient SSA2D (3-step time integration)                  -- 2D, real ISSM test110

Outputs:
  public/data/test{N}.json                       -- mesh + bundled results (browser path)
  android-spike/assets/data/test{N}.json         -- same (WebView path)
  android-spike/assets/test{N}/test{N}.bin       -- marshaled model (JNI input)
  android-spike/assets/test{N}/test{N}.toolkits  -- PETSc toolkit options

Env:
  TEST=101|105|106|110   -- which test to build (default 101)
  MESH_AREA=<float>      -- override triangle(..., maxarea). Defaults are per-test.

Usage: cd ~/issm/test/NightlyRun && TEST=106 python3 ~/Seantinel/scripts/dump_test.py
"""

import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
ISSM_DIR = os.environ.get('ISSM_DIR') or os.path.expanduser('~/issm')
NR = os.path.join(ISSM_DIR, 'test', 'NightlyRun')


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


def setup_paths():
    for root, dirs, files in os.walk(os.path.join(ISSM_DIR, 'src/m')):
        if '.svn' in dirs: dirs.remove('.svn')
        if any(f.endswith('.py') and not f.endswith('.pyc') for f in files):
            if root not in sys.path:
                sys.path.append(root)
    for extra in [NR, os.path.join(ISSM_DIR, 'lib'), os.path.join(ISSM_DIR, 'src/wrappers/python/.libs')]:
        if extra not in sys.path:
            sys.path.append(extra)


def build_test101(area):
    from model import model
    from triangle import triangle
    from setmask import setmask
    from parameterize import parameterize
    from setflowequation import setflowequation
    from generic import generic
    from socket import gethostname
    md = triangle(model(), '../Exp/Square.exp', area)
    md = setmask(md, 'all', '')
    md = parameterize(md, '../Par/SquareShelfConstrained.py')
    md = setflowequation(md, 'SSA', 'all')
    md.cluster = generic('name', gethostname(), 'np', 1)
    md.stressbalance.requested_outputs = ['default']
    return md, 'Stressbalance'


def build_test102(area):
    from model import model
    from triangle import triangle
    from setmask import setmask
    from parameterize import parameterize
    from setflowequation import setflowequation
    from generic import generic
    from socket import gethostname
    md = triangle(model(), '../Exp/Square.exp', area)
    md = setmask(md, 'all', '')
    md = parameterize(md, '../Par/SquareShelfConstrained.py')
    md.extrude(3, 2.)
    md = setflowequation(md, 'SSA', 'all')
    md.cluster = generic('name', gethostname(), 'np', 1)
    return md, 'Stressbalance'


def build_test103(area):
    from model import model
    from triangle import triangle
    from setmask import setmask
    from parameterize import parameterize
    from setflowequation import setflowequation
    from generic import generic
    from socket import gethostname
    md = triangle(model(), '../Exp/Square.exp', area)
    md = setmask(md, 'all', '')
    md = parameterize(md, '../Par/SquareShelfConstrained.py')
    md.extrude(3, 2.)
    md = setflowequation(md, 'HO', 'all')
    md.cluster = generic('name', gethostname(), 'np', 1)
    md.stressbalance.requested_outputs = [
        'default', 'StressTensorxx', 'StressTensoryy', 'StressTensorzz',
        'StressTensorxy', 'StressTensorxz', 'StressTensoryz',
    ]
    return md, 'Stressbalance'


def build_test104(area):
    from model import model
    from triangle import triangle
    from setmask import setmask
    from parameterize import parameterize
    from setflowequation import setflowequation
    from generic import generic
    from socket import gethostname
    md = triangle(model(), '../Exp/Square.exp', area)
    md = setmask(md, 'all', '')
    md = parameterize(md, '../Par/SquareShelfConstrained.py')
    md.extrude(3, 2.)
    md = setflowequation(md, 'FS', 'all')
    md.cluster = generic('name', gethostname(), 'np', 1)
    return md, 'Stressbalance'


def build_test107(area):
    from model import model
    from triangle import triangle
    from setmask import setmask
    from parameterize import parameterize
    from setflowequation import setflowequation
    from generic import generic
    from socket import gethostname
    md = triangle(model(), '../Exp/Square.exp', area)
    md = setmask(md, 'all', '')
    md = parameterize(md, '../Par/SquareShelfConstrained.py')
    md = setflowequation(md, 'SSA', 'all')
    md.extrude(5, 3.)
    md.cluster = generic('name', gethostname(), 'np', 1)
    return md, 'Masstransport'


def build_test105(area):
    from model import model
    from triangle import triangle
    from meshconvert import meshconvert
    from setmask import setmask
    from parameterize import parameterize
    from setflowequation import setflowequation
    from generic import generic
    from socket import gethostname
    md = triangle(model(), '../Exp/Square.exp', area)
    md = meshconvert(md)
    md = setmask(md, 'all', '')
    md = parameterize(md, '../Par/SquareShelfConstrained.py')
    md = setflowequation(md, 'SSA', 'all')
    md.cluster = generic('name', gethostname(), 'np', 1)
    md.masstransport.stabilization = 3
    md.masstransport.spcthickness = md.geometry.thickness
    return md, 'Masstransport'


def build_test106(area):
    from model import model
    from triangle import triangle
    from setmask import setmask
    from parameterize import parameterize
    from setflowequation import setflowequation
    from massfluxatgate import massfluxatgate
    from generic import generic
    from socket import gethostname
    md = triangle(model(), '../Exp/Square.exp', area)
    md = setmask(md, 'all', '')
    md = parameterize(md, '../Par/SquareShelfConstrained.py')
    md = setflowequation(md, 'SSA', 'all')
    md.cluster = generic('name', gethostname(), 'np', 1)
    md.stressbalance.requested_outputs = [
        'default',
        'DeviatoricStressxx', 'DeviatoricStressyy', 'DeviatoricStressxy',
        'MassFlux1', 'MassFlux2', 'MassFlux3', 'MassFlux4', 'MassFlux5', 'MassFlux6',
    ]
    md.outputdefinition.definitions = [
        massfluxatgate('name', f'MassFlux{i}',
                       'profilename', f'../Exp/MassFlux{i}.exp',
                       'definitionstring', f'Outputdefinition{i}')
        for i in range(1, 7)
    ]
    return md, 'Stressbalance'


def build_test110(area):
    from model import model
    from triangle import triangle
    from setmask import setmask
    from parameterize import parameterize
    from setflowequation import setflowequation
    from generic import generic
    from socket import gethostname
    md = triangle(model(), '../Exp/Square.exp', area)
    md = setmask(md, 'all', '')
    md = parameterize(md, '../Par/SquareShelfConstrained.py')
    md = setflowequation(md, 'SSA', 'all')
    md.cluster = generic('name', gethostname(), 'np', 1)
    md.transient.requested_outputs = ['default', 'IceVolume']
    return md, 'Transient'


BUILDERS = {
    '101': (build_test101, 6000.0),
    '102': (build_test102, 50000.0),
    '103': (build_test103, 180000.0),
    '104': (build_test104, 180000.0),
    '105': (build_test105, 150000.0),
    '106': (build_test106, 50000.0),
    '107': (build_test107, 150000.0),
    '110': (build_test110, 150000.0),
}


def _collect_one(sol):
    import numpy as np
    out = {}
    for name in dir(sol):
        if name.startswith('_'): continue
        v = getattr(sol, name)
        if callable(v): continue
        if isinstance(v, np.ndarray):
            out[name] = v.tolist()
        elif isinstance(v, (int, float, bool, str)):
            out[name] = v
    return out


def collect_results(md, solution):
    sol = getattr(md.results, solution + 'Solution', None)
    if sol is None:
        return {}
    # Transient `solution` wrappers expose __len__ + __getitem__ (list), while
    # steady `solutionstep` objects are a single result dict. Prefer indexing.
    if hasattr(sol, '__len__') and hasattr(sol, '__getitem__') and not isinstance(sol, (dict, str, bytes)):
        return [_collect_one(sol[i]) for i in range(len(sol))]
    return _collect_one(sol)


def main():
    test_id = os.environ.get('TEST', '101')
    if test_id not in BUILDERS:
        print(f'TEST={test_id} not supported (use 101, 102, 103, 104, 105, 106, 107, 110)', file=sys.stderr)
        sys.exit(1)
    builder, default_area = BUILDERS[test_id]
    area = float(os.environ.get('MESH_AREA', default_area))

    setup_paths()
    os.chdir(NR)
    from solve import solve

    print(f'[dump] building test{test_id}, area={area}')
    md, solution = builder(area)
    md.miscellaneous.name = 'test' + test_id
    md = solve(md, solution)

    nvtx = int(md.mesh.numberofvertices)
    nelt = int(md.mesh.numberofelements)
    print(f'[dump] nvtx={nvtx} nelt={nelt} solution={solution}')

    sol_key = solution + 'Solution'
    mesh_out = {
        'numberofvertices': nvtx,
        'numberofelements': nelt,
        'x': to_list(md.mesh.x),
        'y': to_list(md.mesh.y),
        'elements': to_list(md.mesh.elements),
    }
    # 3D prism mesh carries extra fields; include whichever are present.
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
    out = {
        'mesh': mesh_out,
        'results': {
            sol_key: collect_results(md, solution),
        },
    }

    public_json = os.path.join(ROOT, 'public', 'data', f'test{test_id}.json')
    assets_json = os.path.join(ROOT, 'android-spike', 'assets', 'data', f'test{test_id}.json')
    for p in (public_json, assets_json):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w') as f:
            json.dump(out, f)
        print(f'[dump] wrote {p} ({os.path.getsize(p)} bytes)')

    # Copy marshaled .bin/.toolkits into the APK asset tree.
    # ISSM writes them to the execution dir under $ISSM_DIR/execution/<name>-<ts>/.
    exec_root = os.path.join(ISSM_DIR, 'execution')
    name = 'test' + test_id
    cand = sorted(
        [d for d in os.listdir(exec_root) if d.startswith(name + '-')],
        key=lambda d: os.path.getmtime(os.path.join(exec_root, d)),
    )
    if not cand:
        print(f'[dump] WARNING: no execution dir found for {name}')
        return
    latest = os.path.join(exec_root, cand[-1])
    assets_dir = os.path.join(ROOT, 'android-spike', 'assets', name)
    os.makedirs(assets_dir, exist_ok=True)
    for suf in ('.bin', '.toolkits'):
        src = os.path.join(latest, name + suf)
        dst = os.path.join(assets_dir, name + suf)
        if not os.path.exists(src):
            print(f'[dump] WARNING: {src} missing')
            continue
        shutil.copyfile(src, dst)
        print(f'[dump] copied {src} -> {dst} ({os.path.getsize(dst)} bytes)')


if __name__ == '__main__':
    main()
