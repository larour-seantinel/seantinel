#!/usr/bin/env python3
"""Run ISSM test101 and dump mesh + StressbalanceSolution.Vel to JSON.
Output: ../public/data/test101.json

Requires the same env test101 needs on Termux:
  PATH prepended with ~/issm/externalpackages/mpich/install/bin
  LD_LIBRARY_PATH with mpich lib + triangle lib + issm lib
  PYTHONSTARTUP=$ISSM_DIR/src/m/dev/devpath.py
Easiest: `cd ~/issm/test/NightlyRun && python3 ~/Seantinel/scripts/dump_test101.py`
"""

import json
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(HERE, '..', 'public', 'data', 'test101.json')
OUT_PATH = os.path.abspath(OUT_PATH)

ISSM_DIR = os.environ.get('ISSM_DIR') or os.path.expanduser('~/issm')
NR = os.path.join(ISSM_DIR, 'test', 'NightlyRun')


def to_list(a):
    # Accept numpy arrays, nested lists, scalars
    try:
        import numpy as np
        if isinstance(a, np.ndarray):
            return a.tolist()
    except ImportError:
        pass
    if isinstance(a, (list, tuple)):
        return [to_list(x) for x in a]
    return a


def main():
    # Replicate devpath.py: walk src/m and add every dir containing .py
    for root, dirs, files in os.walk(os.path.join(ISSM_DIR, 'src/m')):
        if '.svn' in dirs: dirs.remove('.svn')
        if any(f.endswith('.py') and not f.endswith('.pyc') for f in files):
            if root not in sys.path:
                sys.path.append(root)
    for extra in [NR, os.path.join(ISSM_DIR, 'lib'), os.path.join(ISSM_DIR, 'src/wrappers/python/.libs')]:
        if extra not in sys.path:
            sys.path.append(extra)

    os.chdir(NR)
    # Build model inline so we can tune mesh area. test101.py uses area=50000 (614 elts).
    # Override with MESH_AREA env var, default picked for ~5000 elements.
    area = float(os.environ.get('MESH_AREA', '6000'))
    print(f'[dump] building test101 model with mesh area={area}')
    from model import model
    from triangle import triangle
    from setmask import setmask
    from parameterize import parameterize
    from setflowequation import setflowequation
    from solve import solve
    from generic import generic
    from socket import gethostname

    md = triangle(model(), '../Exp/Square.exp', area)
    md = setmask(md, 'all', '')
    md = parameterize(md, '../Par/SquareShelfConstrained.py')
    md = setflowequation(md, 'SSA', 'all')
    md.cluster = generic('name', gethostname(), 'np', 1)
    md.stressbalance.requested_outputs = ['default']
    md.miscellaneous.name = 'test101'  # output prefix must match Android app assets
    md = solve(md, 'Stressbalance')

    nvtx = int(md.mesh.numberofvertices)
    nelt = int(md.mesh.numberofelements)
    print(f'[dump] nvtx={nvtx} nelt={nelt}')

    # md.mesh.elements is 1-indexed in ISSM — keep that; Node.js code expects it.
    out = {
        'mesh': {
            'numberofvertices': nvtx,
            'numberofelements': nelt,
            'x': to_list(md.mesh.x),
            'y': to_list(md.mesh.y),
            'elements': to_list(md.mesh.elements),
        },
        'results': {
            'StressbalanceSolution': {
                'Vel': to_list(md.results.StressbalanceSolution.Vel),
                'Vx':  to_list(md.results.StressbalanceSolution.Vx),
                'Vy':  to_list(md.results.StressbalanceSolution.Vy),
                'Pressure': to_list(md.results.StressbalanceSolution.Pressure),
            },
        },
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(out, f)
    print(f'[dump] wrote {OUT_PATH} ({os.path.getsize(OUT_PATH)} bytes)')


if __name__ == '__main__':
    main()
