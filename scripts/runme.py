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
SITE_OUT = ROOT / "public" / "data"
MODELS.mkdir(parents=True, exist_ok=True)
EXP.mkdir(parents=True, exist_ok=True)
DEV_OUT.mkdir(parents=True, exist_ok=True)
SITE_OUT.mkdir(parents=True, exist_ok=True)

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


SITES = [
    {"slug": "hermosa", "title": "Hermosa Beach",
     "center": (33.8625476, -118.4019461),
     "half_m": 2500, "fine_r": 500,
     "focus_radius": 150.0, "elev_max": 500},
    {"slug": "redondo", "title": "Redondo Beach",
     "center": (33.8382488, -118.3907496),
     "half_m": 2500, "fine_r": 500,
     "focus_radius": 150.0, "elev_max": 500},
]


def _wgs84_bbox(center_lat, center_lon, half_m):
    import math
    m_per_deg_lat = 110540.0
    m_per_deg_lon = 110540.0 * math.cos(math.radians(center_lat))
    dlat = half_m / m_per_deg_lat
    dlon = half_m / m_per_deg_lon
    return (center_lon - dlon, center_lat - dlat,
            center_lon + dlon, center_lat + dlat,
            m_per_deg_lon, m_per_deg_lat)


def _fetch_dem(slug, center, half_m):
    """USGS 3DEP DEM via ExportImage (CONUS, no auth). Cache keyed by extent."""
    import requests
    out_dir = ROOT / "data" / slug.capitalize()
    out_dir.mkdir(parents=True, exist_ok=True)
    tif = out_dir / f"{slug}_dem_h{int(half_m)}.tif"
    if tif.exists() and tif.stat().st_size > 1_000_000:
        print(f"  cached DEM: {tif} ({tif.stat().st_size} bytes)")
        return tif
    west, south, east, north, _, _ = _wgs84_bbox(*center, half_m)
    url = ("https://elevation.nationalmap.gov/arcgis/rest/services/"
           "3DEPElevation/ImageServer/exportImage")
    params = {
        "bbox": f"{west},{south},{east},{north}",
        "bboxSR": "4326", "imageSR": "4326",
        "size": "1000,1000", "format": "tiff",
        "pixelType": "F32", "f": "image",
    }
    r = requests.get(url, params=params, timeout=120)
    r.raise_for_status()
    tif.write_bytes(r.content)
    print(f"  fetched DEM: {tif} ({len(r.content)} bytes)")
    return tif


def _fetch_naip(slug, center, half_m):
    """USGS NAIPPlus 1m aerial via ExportImage. Cache keyed by extent."""
    import requests
    out_dir = ROOT / "data" / slug.capitalize()
    out_dir.mkdir(parents=True, exist_ok=True)
    jpg = out_dir / f"{slug}_naip_h{int(half_m)}.jpg"
    if jpg.exists() and jpg.stat().st_size > 50_000:
        print(f"  cached imagery: {jpg} ({jpg.stat().st_size} bytes)")
        return jpg
    west, south, east, north, _, _ = _wgs84_bbox(*center, half_m)
    url = ("https://imagery.nationalmap.gov/arcgis/rest/services/"
           "USGSNAIPPlus/ImageServer/exportImage")
    params = {
        "bbox": f"{west},{south},{east},{north}",
        "bboxSR": "4326", "imageSR": "4326",
        "size": "2048,2048", "format": "jpg", "f": "image",
    }
    r = requests.get(url, params=params, timeout=120)
    r.raise_for_status()
    jpg.write_bytes(r.content)
    print(f"  fetched imagery: {jpg} ({len(r.content)} bytes)")
    return jpg


def _publish_site(slug, title, md, topo, imagery_file, bbox, focus_radius):
    """Write the draped snapshot into public/data/<slug>.json for the website.

    Mirrors plot_web()'s payload but carries a `title` field and lives in a
    git-tracked directory so Cloudflare Pages ships it.
    """
    import json as _json
    import numpy as np
    out = {
        "name": slug,
        "title": title,
        "x": np.asarray(md.mesh.x, dtype=float).tolist(),
        "y": np.asarray(md.mesh.y, dtype=float).tolist(),
        "elements": np.asarray(md.mesh.elements, dtype=int).tolist(),
        "field": np.asarray(topo, dtype=float).tolist(),
        "field_name": "topo (m)",
        "center": [0.0, 0.0, 0.0],
        "focus_radius": float(focus_radius),
        "imagery": imagery_file,
        "bbox": [float(b) for b in bbox],
    }
    path = SITE_OUT / f"{slug}.json"
    path.write_text(_json.dumps(out))
    print(f"  publish_site -> {path.relative_to(ROOT)} (verts={len(out['x'])})")


def _build_site(site):
    """Fetch DEM + NAIP, BAMG-refine, snapshot to dev viewer, publish to website."""
    import numpy as np
    import shutil
    from PIL import Image
    from bamg import bamg
    from model import model
    from InterpFromGridToMesh import InterpFromGridToMesh

    slug = site["slug"]
    center = site["center"]
    half_m = site["half_m"]
    title = site["title"]
    print(f"\n== building site: {slug} ({title}) ==")

    tif = _fetch_dem(slug, center, half_m)
    dem = np.array(Image.open(tif), dtype=np.float64)
    # 3DEP returns NoData / out-of-coverage pixels as a huge sentinel; clamp
    # anything outside a plausible coastal elevation range to sea level.
    elev_max = site.get("elev_max", 1200)
    bad = ~np.isfinite(dem) | (dem < -200) | (dem > elev_max)
    if bad.any():
        print(f"  DEM: masking {bad.sum()}/{bad.size} nodata/absurd pixels to -10")
        dem[bad] = -10.0
    print(f"  DEM shape={dem.shape} min={dem.min():.2f} max={dem.max():.2f} mean={dem.mean():.2f}")

    west, south, east, north, mpl, mpa = _wgs84_bbox(*center, half_m)
    lat0, lon0 = center
    nrows, ncols = dem.shape
    col_lon = west + (np.arange(ncols) + 0.5) / ncols * (east - west)
    row_lat_td = north - (np.arange(nrows) + 0.5) / nrows * (north - south)
    x_grid = (col_lon - lon0) * mpl
    y_grid_td = (row_lat_td - lat0) * mpa
    dem_flip = dem[::-1, :]
    y_grid = y_grid_td[::-1]
    print(f"  local x: {x_grid[0]:.1f}..{x_grid[-1]:.1f} m  y: {y_grid[0]:.1f}..{y_grid[-1]:.1f} m")

    exp_path = EXP / f"{slug.capitalize()}Square.exp"
    xl0, xl1 = x_grid[0], x_grid[-1]
    yl0, yl1 = y_grid[0], y_grid[-1]
    with open(exp_path, "w") as f:
        f.write("## Name:square\n## Icon:0\n# Points Count Value\n5 1.\n# X pos Y pos\n")
        for px, py in [(xl0, yl0), (xl1, yl0), (xl1, yl1), (xl0, yl1), (xl0, yl0)]:
            f.write(f"{px:.4f} {py:.4f}\n")
    print(f"  wrote {exp_path}")

    # Graded mesh: fine (~hmin) inside fine_r of the center, growing linearly
    # to ~hmax at the outer edge. One remesh pass with per-vertex target sizes.
    fine_r = site.get("fine_r", 500.0)
    hmin, hmax = 4.0, 150.0
    md = bamg(model(), "domain", str(exp_path), "hmax", hmax)
    print(f"  initial mesh: nv={md.mesh.numberofvertices} ne={md.mesh.numberofelements}")

    r = np.sqrt(np.asarray(md.mesh.x) ** 2 + np.asarray(md.mesh.y) ** 2)
    growth = (hmax - hmin) / max(half_m - fine_r, 1.0)
    hv = np.clip(hmin + growth * np.maximum(r - fine_r, 0.0), hmin, hmax)
    md = bamg(md, "hVertices", hv, "hmin", hmin, "hmax", hmax)
    print(f"  graded mesh: nv={md.mesh.numberofvertices} ne={md.mesh.numberofelements}")
    topo = InterpFromGridToMesh(x_grid, y_grid, dem_flip, md.mesh.x, md.mesh.y, 0.0)
    # 3DEP returns small positive values for ocean floor sampling. Anything
    # below 1 m is almost certainly ocean, not real beach — sink it.
    topo = np.where(np.asarray(topo) < 1.0, -5.0, topo)

    md.geometry.surface = topo

    # Dev viewer snapshots (ignored by git, served from /dev/).
    plot_web(md, f"{slug}_topo", field=topo, field_name="topo (m)",
             center=[0.0, 0.0, 0.0])

    naip_src = _fetch_naip(slug, center, half_m)
    naip_dev = DEV_OUT / f"{slug}_naip.jpg"
    if not naip_dev.exists() or naip_dev.stat().st_mtime < naip_src.stat().st_mtime:
        shutil.copyfile(naip_src, naip_dev)

    xmin, xmax = float(x_grid[0]), float(x_grid[-1])
    ymin, ymax = float(y_grid[0]), float(y_grid[-1])
    plot_web(md, f"{slug}_draped", field=topo, field_name="topo (m)",
             center=[0.0, 0.0, 0.0], focus_radius=site["focus_radius"],
             imagery=f"{slug}_naip.jpg", bbox=[xmin, ymin, xmax, ymax])

    # Website payload (tracked, served from /data/).
    naip_pub = SITE_OUT / f"{slug}_naip.jpg"
    shutil.copyfile(naip_src, naip_pub)
    _publish_site(slug, title, md, topo, f"{slug}_naip.jpg",
                  [xmin, ymin, xmax, ymax], site["focus_radius"])


def _step_for(site):
    def _fn(org):
        _build_site(site)
    _fn.__name__ = f"step_build_{site['slug']}"
    return _fn


STEPS = [(f"Build{s['slug'].capitalize()}", _step_for(s)) for s in SITES]


def main(argv):
    requested = [int(a) for a in argv[1:]] or list(range(1, len(STEPS) + 1))
    org = organizer("repository", str(MODELS), "prefix", "Seantinel.",
                    "steps", requested)
    for name, fn in STEPS:
        if org.perform(name):
            fn(org)


if __name__ == "__main__":
    main(sys.argv)
