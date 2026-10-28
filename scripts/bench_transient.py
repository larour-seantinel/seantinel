#!/usr/bin/env python3
"""Bench 2D SSA transient on this device at np=4.

Sweeps triangle maxarea to produce ~10 meshes spanning ~200..~2000 elements.
Each model is 2D SSA, 10 year run, 1 year step. Times the solve() wall clock.

Env:
  NP=<int>          mpi ranks (default 4)
  FINAL=<float>     final_time in years (default 10)
  STEP=<float>      time_step in years (default 1)
  AREAS=a,b,c,...   override maxarea sweep (defaults to a 10-point sweep)
"""

import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ISSM_DIR = os.environ.get('ISSM_DIR') or os.path.expanduser('~/issm')
NR = os.path.join(ISSM_DIR, 'test', 'NightlyRun')


def setup_paths():
    for root, dirs, files in os.walk(os.path.join(ISSM_DIR, 'src/m')):
        if '.svn' in dirs: dirs.remove('.svn')
        if any(f.endswith('.py') and not f.endswith('.pyc') for f in files):
            if root not in sys.path:
                sys.path.append(root)
    for extra in [NR, os.path.join(ISSM_DIR, 'lib'), os.path.join(ISSM_DIR, 'src/wrappers/python/.libs')]:
        if extra not in sys.path:
            sys.path.append(extra)


def build(area, np_ranks, final_time, time_step):
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
    md.cluster = generic('name', gethostname(), 'np', np_ranks)
    md.transient.requested_outputs = ['default', 'IceVolume']
    md.timestepping.start_time = 0.
    md.timestepping.time_step = float(time_step)
    md.timestepping.final_time = float(final_time)
    md.verbose.solution = False
    return md


def main():
    np_ranks = int(os.environ.get('NP', '4'))
    final_time = float(os.environ.get('FINAL', '10'))
    time_step = float(os.environ.get('STEP', '1'))
    if 'AREAS' in os.environ:
        areas = [float(x) for x in os.environ['AREAS'].split(',') if x.strip()]
    else:
        areas = [60000, 30000, 20000, 15000, 12000, 10000, 8500, 7500, 6700, 6000]

    setup_paths()
    os.chdir(NR)
    from solve import solve

    print(f'np={np_ranks}  final_time={final_time}yr  step={time_step}yr  nsteps={int(final_time/time_step)}')
    print(f'{"area":>8}  {"nvtx":>6}  {"nelt":>6}  {"wall_s":>8}')
    print('-' * 36)

    rows = []
    for area in areas:
        md = build(area, np_ranks, final_time, time_step)
        nvtx = int(md.mesh.numberofvertices)
        nelt = int(md.mesh.numberofelements)
        t0 = time.perf_counter()
        try:
            md = solve(md, 'Transient')
            ok = True
        except Exception as e:
            print(f'{area:>8.0f}  {nvtx:>6d}  {nelt:>6d}  ERROR: {e}', flush=True)
            continue
        wall = time.perf_counter() - t0
        rows.append((area, nvtx, nelt, wall))
        print(f'{area:>8.0f}  {nvtx:>6d}  {nelt:>6d}  {wall:>8.2f}', flush=True)

    print()
    print('rows near ~2.0 s:')
    rows.sort(key=lambda r: abs(r[3] - 2.0))
    for r in rows[:3]:
        print(f'  area={r[0]:.0f}  nvtx={r[1]}  nelt={r[2]}  wall={r[3]:.2f}s')


if __name__ == '__main__':
    main()
