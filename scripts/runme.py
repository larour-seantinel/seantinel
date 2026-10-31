#!/usr/bin/env python3
"""Seantinel pipeline — Python port of runme.m.

Uses the local ISSM trunk (~/issm) Python layer. Steps mirror the MATLAB
organizer pattern: `if org.perform('StepName'): ...`.

First site: Hermosa Beach, CA.

Usage:
    python3 scripts/runme.py                # list steps
    python3 scripts/runme.py 1              # run step 1
    python3 scripts/runme.py 1 2 3          # run multiple
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ISSM_DIR = Path(os.environ.get("ISSM_DIR", Path.home() / "issm"))
os.environ["ISSM_DIR"] = str(ISSM_DIR)

# ISSM C wrappers need libtriangle.so at dlopen time. Re-exec once with
# LD_LIBRARY_PATH set so wrappers can load without a shell wrapper.
_TRI_LIB = ISSM_DIR / "externalpackages" / "triangle" / "install" / "lib"
_WANT_LD = f"{_TRI_LIB}:{ISSM_DIR / 'lib'}"
if _WANT_LD not in os.environ.get("LD_LIBRARY_PATH", ""):
    os.environ["LD_LIBRARY_PATH"] = _WANT_LD + ":" + os.environ.get("LD_LIBRARY_PATH", "")
    os.execvp(sys.executable, [sys.executable] + sys.argv)

# Walk src/m like devpath.py does, but skip the plotting chain
# (plotmodel pulls InterpFromMeshToGrid_python which needs libtriangle.so).
SKIP_DIRS = {"plot"}
for root, dirs, files in os.walk(ISSM_DIR / "src" / "m"):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
    if any(f.endswith(".py") and not f.endswith(".pyc") for f in files):
        if root not in sys.path:
            sys.path.append(root)
for extra in [ISSM_DIR / "lib", ISSM_DIR / "src" / "wrappers" / "python" / ".libs"]:
    if extra.exists() and str(extra) not in sys.path:
        sys.path.append(str(extra))

MODELS = ROOT / "scripts" / "Models"
EXP = ROOT / "scripts" / "Exp"
DEV_OUT = ROOT / "public" / "dev"
MODELS.mkdir(parents=True, exist_ok=True)
EXP.mkdir(parents=True, exist_ok=True)
DEV_OUT.mkdir(parents=True, exist_ok=True)

from organizer import organizer  # noqa: E402


def plot_web(md, name, field=None, field_name=None, center=None,
             imagery=None, bbox=None, focus_radius=None):
    """Write a mesh+field snapshot the local Vite dev viewer can render.

    center: optional [cx, cy, cz] in local coords for the viewer's orbit target.
    imagery: optional filename (relative to public/dev/) of a top-down texture.
    bbox: optional [xmin, ymin, xmax, ymax] for planar UVs (derived if omitted).
    focus_radius: optional radius (local units) the initial camera should frame.
    """
    import numpy as np
    import time
    out = {
        "name": name,
        "x": np.asarray(md.mesh.x, dtype=float).tolist(),
        "y": np.asarray(md.mesh.y, dtype=float).tolist(),
        "elements": np.asarray(md.mesh.elements, dtype=int).tolist(),
    }
    if center is not None:
        out["center"] = [float(c) for c in center]
    if focus_radius is not None:
        out["focus_radius"] = float(focus_radius)
    if field is not None:
        out["field"] = np.asarray(field, dtype=float).tolist()
        out["field_name"] = field_name or "field"
    if imagery is not None:
        out["imagery"] = imagery
        if bbox is None:
            bbox = [float(min(out["x"])), float(min(out["y"])),
                    float(max(out["x"])), float(max(out["y"]))]
        out["bbox"] = [float(b) for b in bbox]
    (DEV_OUT / f"{name}.json").write_text(json.dumps(out))

    # Maintain index.json so the /dev viewer can list snapshots.
    idx_path = DEV_OUT / "index.json"
    try:
        idx = json.loads(idx_path.read_text()) if idx_path.exists() else []
    except Exception:
        idx = []
    idx = [e for e in idx if e.get("name") != name]
    idx.append({
        "name": name,
        "file": f"{name}.json",
        "nverts": len(out["x"]),
        "nelts": len(out["elements"]),
        "has_field": field is not None,
        "field_name": out.get("field_name"),
        "mtime": int(time.time()),
    })
    idx.sort(key=lambda e: e["mtime"])
    idx_path.write_text(json.dumps(idx, indent=2))
    print(f"  plot_web -> public/dev/{name}.json  (verts={len(out['x'])})")


HERMOSA_CENTER = (33.8625476, -118.4019461)  # pier
HERMOSA_HALF_M = 500                           # ±500 m box


def _wgs84_bbox(center_lat, center_lon, half_m):
    import math
    m_per_deg_lat = 110540.0
    m_per_deg_lon = 110540.0 * math.cos(math.radians(center_lat))
    dlat = half_m / m_per_deg_lat
    dlon = half_m / m_per_deg_lon
    return (center_lon - dlon, center_lat - dlat,
            center_lon + dlon, center_lat + dlat,
            m_per_deg_lon, m_per_deg_lat)


def fetch_hermosa_dem():
    """USGS 3DEP 1m DEM via ExportImage (CONUS, no auth). Cache in data/Hermosa."""
    import requests
    out_dir = ROOT / "data" / "Hermosa"
    out_dir.mkdir(parents=True, exist_ok=True)
    tif = out_dir / "hermosa_1m_wgs84.tif"
    if tif.exists() and tif.stat().st_size > 1_000_000:
        print(f"  cached DEM: {tif} ({tif.stat().st_size} bytes)")
        return tif
    west, south, east, north, _, _ = _wgs84_bbox(*HERMOSA_CENTER, HERMOSA_HALF_M)
    url = ("https://elevation.nationalmap.gov/arcgis/rest/services/"
           "3DEPElevation/ImageServer/exportImage")
    params = {
        "bbox": f"{west},{south},{east},{north}",
        "bboxSR": "4326", "imageSR": "4326",
        "size": "1000,1000", "format": "tiff",
        "pixelType": "F32", "f": "image",
    }
    r = requests.get(url, params=params, timeout=90)
    r.raise_for_status()
    tif.write_bytes(r.content)
    print(f"  fetched DEM: {tif} ({len(r.content)} bytes)")
    return tif


def fetch_hermosa_imagery():
    """USGS NAIPPlus 1m aerial via ExportImage (CONUS, no auth). JPG cached in data/Hermosa."""
    import requests
    out_dir = ROOT / "data" / "Hermosa"
    out_dir.mkdir(parents=True, exist_ok=True)
    jpg = out_dir / "hermosa_naip.jpg"
    if jpg.exists() and jpg.stat().st_size > 50_000:
        print(f"  cached imagery: {jpg} ({jpg.stat().st_size} bytes)")
        return jpg
    west, south, east, north, _, _ = _wgs84_bbox(*HERMOSA_CENTER, HERMOSA_HALF_M)
    url = ("https://imagery.nationalmap.gov/arcgis/rest/services/"
           "USGSNAIPPlus/ImageServer/exportImage")
    params = {
        "bbox": f"{west},{south},{east},{north}",
        "bboxSR": "4326", "imageSR": "4326",
        "size": "1024,1024", "format": "jpg", "f": "image",
    }
    r = requests.get(url, params=params, timeout=90)
    r.raise_for_status()
    jpg.write_bytes(r.content)
    print(f"  fetched imagery: {jpg} ({len(r.content)} bytes)")
    return jpg


def step_read_hermosa_dem(org):
    """Fetch USGS 3DEP 1m DEM, mesh via BAMG, drape topo, snapshot."""
    import numpy as np
    from PIL import Image
    from bamg import bamg
    from model import model
    from InterpFromGridToMesh import InterpFromGridToMesh

    tif = fetch_hermosa_dem()
    dem = np.array(Image.open(tif), dtype=np.float64)
    print(f"  DEM shape={dem.shape} min={dem.min():.2f} max={dem.max():.2f} mean={dem.mean():.2f}")

    west, south, east, north, mpl, mpa = _wgs84_bbox(*HERMOSA_CENTER, HERMOSA_HALF_M)
    lat0, lon0 = HERMOSA_CENTER
    nrows, ncols = dem.shape
    col_lon = west + (np.arange(ncols) + 0.5) / ncols * (east - west)
    row_lat_td = north - (np.arange(nrows) + 0.5) / nrows * (north - south)
    x_grid = (col_lon - lon0) * mpl                 # ascending east
    y_grid_td = (row_lat_td - lat0) * mpa           # descending (row 0 = north)
    # Flip so y is ascending (InterpFromGridToMesh requires it).
    dem_flip = dem[::-1, :]
    y_grid = y_grid_td[::-1]
    print(f"  local x: {x_grid[0]:.1f}..{x_grid[-1]:.1f} m  y: {y_grid[0]:.1f}..{y_grid[-1]:.1f} m")

    exp_path = EXP / "HermosaSquare.exp"
    xl0, xl1 = x_grid[0], x_grid[-1]
    yl0, yl1 = y_grid[0], y_grid[-1]
    with open(exp_path, "w") as f:
        f.write("## Name:square\n## Icon:0\n# Points Count Value\n5 1.\n# X pos Y pos\n")
        for px, py in [(xl0, yl0), (xl1, yl0), (xl1, yl1), (xl0, yl1), (xl0, yl0)]:
            f.write(f"{px:.4f} {py:.4f}\n")
    print(f"  wrote {exp_path}")

    md = bamg(model(), "domain", str(exp_path), "hmax", 20.0)
    print(f"  initial mesh: nv={md.mesh.numberofvertices} ne={md.mesh.numberofelements}")

    topo = InterpFromGridToMesh(x_grid, y_grid, dem_flip, md.mesh.x, md.mesh.y, 0.0)
    for i in range(3):
        md = bamg(md, "field", topo, "hmax", 100.0, "hmin", 4.0, "err", 0.5)
        topo = InterpFromGridToMesh(x_grid, y_grid, dem_flip, md.mesh.x, md.mesh.y, 0.0)
        print(f"  refine {i+1}: nv={md.mesh.numberofvertices} ne={md.mesh.numberofelements}")

    md.geometry.surface = topo
    # Orbit target = HERMOSA_CENTER (local origin) at sea level, not the DEM midpoint.
    plot_web(md, "hermosa_topo", field=topo, field_name="topo (m)",
             center=[0.0, 0.0, 0.0])

    # Satellite drape: NAIP 1m aerial over the same mesh. Second snapshot so
    # the elevation-colored view is still available.
    import shutil
    naip_src = fetch_hermosa_imagery()
    naip_dst = DEV_OUT / "hermosa_naip.jpg"
    if not naip_dst.exists() or naip_dst.stat().st_mtime < naip_src.stat().st_mtime:
        shutil.copyfile(naip_src, naip_dst)
    xmin, xmax = float(x_grid[0]), float(x_grid[-1])
    ymin, ymax = float(y_grid[0]), float(y_grid[-1])
    plot_web(md, "hermosa_draped", field=topo, field_name="topo (m)",
             center=[0.0, 0.0, 0.0], focus_radius=150.0,
             imagery="hermosa_naip.jpg", bbox=[xmin, ymin, xmax, ymax])


STEPS = [
    ("ReadHermosaDEM", step_read_hermosa_dem),
]


def main(argv):
    requested = [int(a) for a in argv[1:]] or [0]
    org = organizer("repository", str(MODELS), "prefix", "Hermosa.",
                    "steps", requested)
    for name, fn in STEPS:
        if org.perform(name):
            fn(org)


if __name__ == "__main__":
    main(sys.argv)
