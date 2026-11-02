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
import math as _math
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
     "focus_radius": 150.0, "elev_max": 500,
     "buildings": True,
     "farfield": {"half_m": 10000, "grid_n": 80, "naip_px": 1024},
     "superfarfield": {"half_m": 200000, "grid_n": 60, "naip_px": 1024}},
    {"slug": "redondo", "title": "Redondo Beach",
     "center": (33.8382488, -118.3907496),
     "half_m": 2500, "fine_r": 500,
     "focus_radius": 150.0, "elev_max": 500,
     "buildings": True,
     "farfield": {"half_m": 10000, "grid_n": 80, "naip_px": 1024},
     "superfarfield": {"half_m": 200000, "grid_n": 60, "naip_px": 1024}},
    {"slug": "hermosa_closeup", "title": "Hermosa Beach (close-up)",
     "center": (33.8625476, -118.4019461),
     "half_m": 250, "fine_r": 100,
     "focus_radius": 60.0, "elev_max": 500,
     "hmin": 2.0, "hmax": 30.0, "buildings": True},
    {"slug": "manhattan", "title": "Manhattan Beach Pier",
     "center": (33.8835911, -118.4139571),
     "half_m": 2500, "fine_r": 500,
     "focus_radius": 150.0, "elev_max": 500,
     "buildings": True,
     "farfield": {"half_m": 10000, "grid_n": 80, "naip_px": 1024},
     "superfarfield": {"half_m": 200000, "grid_n": 60, "naip_px": 1024}},
    # Non-CONUS: Copernicus GLO-30 DSM + Esri World_Imagery, OSM buildings
    # with no lidar HAG (falls back to OSM tag heights / 7 m default).
    # Super-far skipped — would need a mosaic of ~16 GLO-30 tiles.
    {"slug": "mardelplata", "title": "Mar del Plata",
     "center": (-37.9734483, -57.5423292),
     "half_m": 2500, "fine_r": 500,
     "focus_radius": 150.0, "elev_max": 500,
     "buildings": True,
     "farfield": {"half_m": 10000, "grid_n": 80, "naip_px": 1024}},
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


def _aspect_size(east, west, north, south, long_px):
    """Pixel size matching the bbox aspect in degrees.

    ArcGIS ExportImage expands the bbox to square if size is square in degrees
    (bbox is non-square because 1° lat != 1° lon). Match the aspect ratio and
    the server returns our exact bbox.
    """
    aspect = (east - west) / (north - south)
    if aspect >= 1:
        return long_px, int(round(long_px / aspect))
    return int(round(long_px * aspect)), long_px


def _in_conus(center):
    lat, lon = center
    return (24.0 <= lat <= 50.0) and (-125.0 <= lon <= -66.0)


def _fetch_dem(slug, center, half_m, out_name=None):
    """Dispatch: 3DEP for CONUS, Copernicus GLO-30 elsewhere."""
    name = out_name or f"{slug}_dem_h{int(half_m)}.tif"
    if _in_conus(center):
        return _fetch_dem_3dep(slug, center, half_m, name)
    return _fetch_dem_copernicus(slug, center, half_m, name)


def _fetch_dem_3dep(slug, center, half_m, out_name):
    """USGS 3DEP DEM via ExportImage (CONUS, no auth). Cache keyed by extent."""
    import requests
    out_dir = ROOT / "data" / slug.capitalize()
    out_dir.mkdir(parents=True, exist_ok=True)
    tif = out_dir / out_name
    if tif.exists() and tif.stat().st_size > 1_000_000:
        print(f"  cached DEM: {tif} ({tif.stat().st_size} bytes)")
        return tif
    west, south, east, north, _, _ = _wgs84_bbox(*center, half_m)
    w_px, h_px = _aspect_size(east, west, north, south, 1000)
    url = ("https://elevation.nationalmap.gov/arcgis/rest/services/"
           "3DEPElevation/ImageServer/exportImage")
    params = {
        "bbox": f"{west},{south},{east},{north}",
        "bboxSR": "4326", "imageSR": "4326",
        "size": f"{w_px},{h_px}", "format": "tiff",
        "pixelType": "F32", "f": "image",
    }
    r = requests.get(url, params=params, timeout=120)
    r.raise_for_status()
    tif.write_bytes(r.content)
    print(f"  fetched DEM: {tif} ({len(r.content)} bytes, size={w_px}x{h_px})")
    return tif


def _fetch_dem_copernicus(slug, center, half_m, out_name):
    """Copernicus GLO-30 DSM via Planetary Computer STAC. Global, 30 m.

    One 1°×1° tile covers up to a ~50 km half-extent at mid-latitudes, so a
    single `items[0]` is enough for all current site sizes. Downloads the full
    tile once (~50 MB), then uses gdal_translate -projwin to crop to our bbox.
    """
    import requests, subprocess
    out_dir = ROOT / "data" / slug.capitalize()
    out_dir.mkdir(parents=True, exist_ok=True)
    tif = out_dir / out_name
    if tif.exists() and tif.stat().st_size > 10_000:
        print(f"  cached DEM: {tif} ({tif.stat().st_size} bytes)")
        return tif
    west, south, east, north, _, _ = _wgs84_bbox(*center, half_m)

    r = requests.post(
        "https://planetarycomputer.microsoft.com/api/stac/v1/search",
        json={"collections": ["cop-dem-glo-30"],
              "bbox": [west, south, east, north], "limit": 5},
        timeout=60)
    r.raise_for_status()
    items = r.json().get("features", [])
    if not items:
        raise RuntimeError(f"No Copernicus GLO-30 coverage for {west},{south},{east},{north}")
    item = items[0]
    tile_id = item["id"]
    raw = out_dir / f"{tile_id}.tif"
    if not (raw.exists() and raw.stat().st_size > 1_000_000):
        sign = requests.get(
            "https://planetarycomputer.microsoft.com/api/sas/v1/sign",
            params={"href": item["assets"]["data"]["href"]},
            timeout=60).json()
        raw.write_bytes(requests.get(sign["href"], timeout=240).content)
        print(f"  fetched Copernicus tile: {raw.name} ({raw.stat().st_size} bytes)")
    subprocess.run(
        ["gdal_translate", "-q",
         "-projwin", str(west), str(north), str(east), str(south),
         "-projwin_srs", "EPSG:4326",
         "-co", "COMPRESS=NONE",
         str(raw), str(tif)],
        check=True)
    print(f"  cropped DEM: {tif} ({tif.stat().st_size} bytes)")
    return tif


def _fetch_hag_raster(slug, center, half_m):
    """Microsoft Planetary Computer 3dep-lidar-hag (Height Above Ground, 2 m).

    Returns (hag_array, transform=[sx, x0, sy, y0]) in UTM meters, or None if
    no coverage or any step fails. Decompressed via gdal_translate (LERC).
    """
    import requests, subprocess
    out_dir = ROOT / "data" / slug.capitalize()
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = out_dir / f"{slug}_hag_h{int(half_m)}.tif"
    uncompressed = out_dir / f"{slug}_hag_h{int(half_m)}_raw.tif"
    transform_cache = out_dir / f"{slug}_hag_h{int(half_m)}_tr.json"

    if uncompressed.exists() and transform_cache.exists():
        tr = json.loads(transform_cache.read_text())
    else:
        import math
        lat0, lon0 = center
        mpl = 110540.0 * math.cos(math.radians(lat0))
        dlat = half_m / 110540.0
        dlon = half_m / mpl
        bbox = [lon0 - dlon, lat0 - dlat, lon0 + dlon, lat0 + dlat]
        try:
            r = requests.post(
                "https://planetarycomputer.microsoft.com/api/stac/v1/search",
                json={"collections": ["3dep-lidar-hag"], "bbox": bbox, "limit": 5},
                timeout=60)
            r.raise_for_status()
            items = r.json().get("features", [])
            if not items:
                print(f"  HAG: no coverage for {slug}"); return None
            item = items[0]
            tr_full = item["properties"]["proj:transform"]
            tr = [tr_full[0], tr_full[2], tr_full[4], tr_full[5]]  # sx, x0, sy, y0
            if not raw.exists():
                sign = requests.get(
                    "https://planetarycomputer.microsoft.com/api/sas/v1/sign",
                    params={"href": item["assets"]["data"]["href"]},
                    timeout=60).json()
                raw.write_bytes(requests.get(sign["href"], timeout=180).content)
                print(f"  fetched HAG: {raw} ({raw.stat().st_size} bytes)")
            subprocess.run(["gdal_translate", "-q", "-of", "GTiff",
                            "-co", "COMPRESS=NONE", str(raw), str(uncompressed)],
                           check=True)
            transform_cache.write_text(json.dumps(tr))
        except Exception as ex:
            print(f"  HAG: failed ({ex}); will fall back to 7 m default")
            return None

    import numpy as np
    from PIL import Image
    arr = np.array(Image.open(uncompressed), dtype=np.float32)
    arr = np.where(arr < -100, 0, arr)
    print(f"  HAG raster: {arr.shape} transform={tr}")
    return arr, tr


def _apply_lidar_heights(buildings, center, hag_pkg):
    """Replace each building's default h with 95th-pct HAG inside its polygon."""
    if hag_pkg is None:
        return
    import utm
    import numpy as np
    from matplotlib.path import Path
    hag, (sx, x0, sy, y0) = hag_pkg
    lat0, lon0 = center
    e0, n0, _, _ = utm.from_latlon(lat0, lon0)
    nrows, ncols = hag.shape
    hits = 0
    for b in buildings:
        ring = b["ring"]
        es = [p[0] + e0 for p in ring]
        ns = [p[1] + n0 for p in ring]
        c_lo = max(0, int((min(es) - x0) / sx))
        c_hi = min(ncols, int((max(es) - x0) / sx) + 1)
        r_lo = max(0, int((max(ns) - y0) / sy))
        r_hi = min(nrows, int((min(ns) - y0) / sy) + 1)
        if c_hi <= c_lo or r_hi <= r_lo:
            continue
        rr, cc = np.mgrid[r_lo:r_hi, c_lo:c_hi]
        pix_e = x0 + (cc + 0.5) * sx
        pix_n = y0 + (rr + 0.5) * sy
        pts = np.column_stack([pix_e.ravel(), pix_n.ravel()])
        ring_utm = list(zip(es, ns))
        mask = Path(ring_utm).contains_points(pts).reshape(rr.shape)
        if mask.sum() == 0:
            continue
        vals = hag[r_lo:r_hi, c_lo:c_hi][mask]
        # Lidar HAG has outliers: antennas, overhanging trees, bounce artifacts
        # (raster max for Hermosa is 287 m). Cap at 40 m — residential/coastal
        # LA tops out well below that — and use median instead of p95 so a
        # couple of bad pixels can't dominate a polygon with hundreds of hits.
        vals = vals[(vals > 0.5) & (vals < 40.0)]
        if len(vals) < 2:
            continue
        b["h"] = float(np.median(vals))
        hits += 1
    print(f"  lidar heights: {hits}/{len(buildings)} buildings")


def _fetch_osm_buildings(slug, center, half_m, mpl, mpa):
    """Overpass API: way['building'] polygons in local x/y coords.

    Returns a list of outer rings; each ring is a list of [x, y] pairs in the
    same local tangent plane the mesh uses. Multipolygon relations ignored for
    now (first pass — flat polygons only).
    """
    import requests
    out_dir = ROOT / "data" / slug.capitalize()
    out_dir.mkdir(parents=True, exist_ok=True)
    cache = out_dir / f"{slug}_osm_h{int(half_m)}.json"
    if cache.exists() and cache.stat().st_size > 100:
        print(f"  cached OSM: {cache} ({cache.stat().st_size} bytes)")
        data = json.loads(cache.read_text())
    else:
        west, south, east, north, _, _ = _wgs84_bbox(*center, half_m)
        q = (f'[out:json][timeout:60];'
             f'(way["building"]({south},{west},{north},{east}););'
             f'out body;>;out skel qt;')
        headers = {"User-Agent": "seantinel/0.1 (eric.larour@gmail.com)"}
        r = requests.post("https://overpass-api.de/api/interpreter",
                          data={"data": q}, headers=headers, timeout=120)
        r.raise_for_status()
        data = r.json()
        cache.write_text(json.dumps(data))
        print(f"  fetched OSM: {cache} ({cache.stat().st_size} bytes)")

    nodes = {e["id"]: (e["lon"], e["lat"]) for e in data["elements"]
             if e["type"] == "node"}
    lat0, lon0 = center
    buildings = []
    for e in data["elements"]:
        if e["type"] != "way":
            continue
        refs = e.get("nodes", [])
        if len(refs) < 3:
            continue
        ring = []
        for nid in refs:
            if nid not in nodes:
                continue
            lon, lat = nodes[nid]
            ring.append([(lon - lon0) * mpl, (lat - lat0) * mpa])
        if len(ring) < 3:
            continue
        tags = e.get("tags", {})
        # OSM: building:levels is floor count, height is literal meters.
        # 3 m per level is the usual residential/commercial assumption; 7 m
        # fallback matches a 2-story default.
        h = None
        if "height" in tags:
            try: h = float(str(tags["height"]).split()[0])
            except ValueError: pass
        if h is None and "building:levels" in tags:
            try: h = float(tags["building:levels"]) * 3.0
            except ValueError: pass
        if h is None:
            h = 7.0
        buildings.append({"ring": ring, "h": h})
    print(f"  OSM buildings: {len(buildings)} polygons")
    return buildings


def _trim_buildings(buildings, min_area_m2=20.0):
    """Drop sheds/clutter, strip duplicate close-point, round coords to 0.1 m.

    Shoelace area filter removes garages, sheds, pool houses — low signal for a
    5 km coastal viewer and a big chunk of the JSON payload. Rounding caps JSON
    precision at 10 cm (plenty for city viz) and gzips better.
    """
    out = []
    kept_coords = 0
    for b in buildings:
        ring = b["ring"]
        if len(ring) >= 2 and ring[0] == ring[-1]:
            ring = ring[:-1]
        if len(ring) < 3:
            continue
        # Shoelace area (abs).
        a2 = 0.0
        for i in range(len(ring)):
            x0, y0 = ring[i]
            x1, y1 = ring[(i + 1) % len(ring)]
            a2 += x0 * y1 - x1 * y0
        area = abs(a2) * 0.5
        if area < min_area_m2:
            continue
        ring = [[round(p[0], 1), round(p[1], 1)] for p in ring]
        out.append({"ring": ring, "h": round(b.get("h", 7.0), 1)})
        kept_coords += len(ring)
    print(f"  trimmed buildings: {len(out)}/{len(buildings)} "
          f"(min_area={min_area_m2} m², avg ring={kept_coords/max(len(out),1):.1f})")
    return out


def _fetch_naip(slug, center, half_m, out_name=None, px=4000):
    """Esri World_Imagery for every site. USGSNAIPPlus's reprojection is tilted
    ~5° vs OSM/FEMA/Esri in SoCal — ground-truth polygons drift into the beach
    when draped on NAIPPlus. Esri's World_Imagery (Maxar-backed in SoCal, 0.3 m
    native) aligns perfectly. Function name kept for caller compatibility.
    """
    name = out_name or f"{slug}_naip_h{int(half_m)}.jpg"
    return _fetch_imagery_esri(slug, center, half_m, name, min(px, 4000))


def _fetch_naip_usgs(slug, center, half_m, out_name, px=4000):
    """USGS NAIPPlus 1m aerial via ExportImage. Cache keyed by extent."""
    import requests
    out_dir = ROOT / "data" / slug.capitalize()
    out_dir.mkdir(parents=True, exist_ok=True)
    jpg = out_dir / out_name
    if jpg.exists() and jpg.stat().st_size > 50_000:
        print(f"  cached imagery: {jpg} ({jpg.stat().st_size} bytes)")
        return jpg
    west, south, east, north, _, _ = _wgs84_bbox(*center, half_m)
    w_px, h_px = _aspect_size(east, west, north, south, px)
    url = ("https://imagery.nationalmap.gov/arcgis/rest/services/"
           "USGSNAIPPlus/ImageServer/exportImage")
    params = {
        "bbox": f"{west},{south},{east},{north}",
        "bboxSR": "4326", "imageSR": "4326",
        "size": f"{w_px},{h_px}", "format": "jpg", "f": "image",
    }
    r = requests.get(url, params=params, timeout=120)
    r.raise_for_status()
    if r.content.startswith(b"{"):
        raise RuntimeError(f"NAIP returned JSON error: {r.content[:200]!r}")
    jpg.write_bytes(r.content)
    print(f"  fetched imagery: {jpg} ({len(r.content)} bytes, size={w_px}x{h_px})")
    return jpg


def _fetch_imagery_esri(slug, center, half_m, out_name, px=4000):
    """Esri World_Imagery via arcgisonline ExportImage. Global, no auth.

    Server is flaky at mid sizes (3072 observed 504); retry up to 3× before
    giving up. 4000 is the empirically-safe upper bound.
    """
    import requests, time
    out_dir = ROOT / "data" / slug.capitalize()
    out_dir.mkdir(parents=True, exist_ok=True)
    jpg = out_dir / out_name
    if jpg.exists() and jpg.stat().st_size > 50_000:
        print(f"  cached imagery: {jpg} ({jpg.stat().st_size} bytes)")
        return jpg
    west, south, east, north, _, _ = _wgs84_bbox(*center, half_m)
    w_px, h_px = _aspect_size(east, west, north, south, px)
    url = ("https://services.arcgisonline.com/ArcGIS/rest/services/"
           "World_Imagery/MapServer/export")
    params = {
        "bbox": f"{west},{south},{east},{north}",
        "bboxSR": "4326", "imageSR": "4326",
        "size": f"{w_px},{h_px}", "format": "jpg", "f": "image",
    }
    last_err = None
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, timeout=180)
            if r.status_code == 200 and not r.content.startswith(b"{"):
                break
            last_err = f"HTTP {r.status_code} ({len(r.content)} bytes)"
        except requests.RequestException as e:
            last_err = str(e)
        wait = 2 ** attempt
        print(f"  Esri attempt {attempt+1} failed ({last_err}); retrying in {wait}s")
        time.sleep(wait)
    else:
        raise RuntimeError(f"Esri fetch failed after 3 tries: {last_err}")
    jpg.write_bytes(r.content)
    print(f"  fetched Esri imagery: {jpg} ({len(r.content)} bytes, size={w_px}x{h_px})")
    return jpg


def _publish_imagery(src_jpg, out_webp, quality=80):
    """Convert JPG → WebP via cwebp. ~40% smaller at visually-equivalent quality.

    cwebp is pulled from `pkg install libwebp`. Pillow on Termux ships without
    WebP support, so shelling out is simpler than building the module.
    """
    import subprocess
    subprocess.run(
        ["cwebp", "-q", str(quality), "-quiet",
         str(src_jpg), "-o", str(out_webp)],
        check=True)


def _publish_site(slug, title, md, topo, imagery_file, bbox, focus_radius,
                  buildings=None, farfield=None, superfarfield=None,
                  ocean_outline=None):
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
    if buildings:
        out["buildings"] = buildings
    if farfield:
        out["farfield"] = farfield
    if superfarfield:
        out["superfarfield"] = superfarfield
    if ocean_outline is not None:
        out["ocean_outline"] = [[round(float(p[0]), 1), round(float(p[1]), 1)]
                                for p in ocean_outline]
    json_path, bin_path = _write_site_binary(slug, out)
    extras = f" buildings={len(buildings)}" if buildings else ""
    if farfield:
        extras += f" farfield={farfield['nx']}x{farfield['ny']}"
    if superfarfield:
        extras += f" superfarfield={superfarfield['nx']}x{superfarfield['ny']}"
    print(f"  publish_site -> {json_path.relative_to(ROOT)} + "
          f"{bin_path.relative_to(ROOT)} "
          f"(verts={len(out['x'])}{extras}, "
          f"hdr={json_path.stat().st_size:,}B, "
          f"bin={bin_path.stat().st_size:,}B)")


_DTYPE_BYTES = {"i16": 2, "u16": 2, "u32": 4}


def _write_site_binary(slug, out):
    """Pack hot numeric arrays as a quantized Int16/Uint16/Uint32 sidecar.

    Produces <slug>.json (header, tiny) + <slug>.bin (payload). Scales chosen
    to give ~0.1 m horizontal and ~0.1 m vertical precision across the inner
    mesh and 10 m at super-far scale. Over Float32 JSON text this is ~5× size
    reduction; over the former Float64 JSON it's ~10×.
    """
    import json as _json
    import numpy as np

    pieces = []
    descriptors = {}
    cursor = [0]

    def add(name, data, dtype, scale=None):
        if dtype in ("i16", "u16"):
            arr = np.asarray(data, dtype=np.float64) / scale
            if dtype == "i16":
                q = np.round(arr).clip(-32768, 32767).astype("<i2")
            else:
                q = np.round(arr).clip(0, 65535).astype("<u2")
            b = q.tobytes()
        elif dtype == "u32":
            b = np.asarray(data, dtype="<u4").tobytes()
        else:
            raise ValueError(dtype)
        pad = (-cursor[0]) % 4
        if pad:
            pieces.append(b"\x00" * pad)
            cursor[0] += pad
        d = {"off": cursor[0], "n": len(b) // _DTYPE_BYTES[dtype], "dtype": dtype}
        if scale is not None:
            d["scale"] = scale
        descriptors[name] = d
        pieces.append(b)
        cursor[0] += len(b)

    add("x", out["x"], "i16", 0.1)
    add("y", out["y"], "i16", 0.1)
    add("field", out["field"], "i16", 0.1)
    el = np.asarray(out["elements"], dtype=np.int64) - 1  # 1-indexed → 0-indexed
    add("elements", el.flatten(), "u32")

    buildings = out.get("buildings") or []
    if buildings:
        ring_offsets = [0]
        coords = []
        heights = []
        for b in buildings:
            ring = b["ring"]
            for p in ring:
                coords.append(p[0])
                coords.append(p[1])
            ring_offsets.append(len(coords) // 2)
            heights.append(b["h"])
        add("rings", coords, "i16", 0.1)
        add("ring_offsets", ring_offsets, "u32")
        add("heights", heights, "u16", 0.01)

    ff = out.get("farfield")
    if ff:
        add("farfield_xs", ff["xs"], "i16", 1.0)
        add("farfield_ys", ff["ys"], "i16", 1.0)
        add("farfield_z", ff["z"], "i16", 0.1)

    sf = out.get("superfarfield")
    if sf:
        add("super_xs", sf["xs"], "i16", 10.0)
        add("super_ys", sf["ys"], "i16", 10.0)
        add("super_z", sf["z"], "i16", 0.1)

    bin_path = SITE_OUT / f"{slug}.bin"
    with open(bin_path, "wb") as f:
        for piece in pieces:
            f.write(piece)

    header = {k: v for k, v in out.items()
              if k not in {"x", "y", "field", "elements", "buildings"}}
    header["binary"] = f"{slug}.bin"
    header["arrays"] = descriptors
    header["buildings_n"] = len(buildings)
    if ff:
        header["farfield"] = {k: v for k, v in ff.items()
                              if k not in {"xs", "ys", "z"}}
    if sf:
        header["superfarfield"] = {k: v for k, v in sf.items()
                                   if k not in {"xs", "ys", "z"}}

    json_path = SITE_OUT / f"{slug}.json"
    json_path.write_text(_json.dumps(header))
    return json_path, bin_path


def _fetch_osm_coastline(slug, center, half_m, mpl, mpa, label=None):
    """Overpass: natural=coastline ways, in local tangent plane coords.

    Returns a list of ways; each way is a list of (x, y) pairs. Direction is
    preserved (OSM convention: land on left, water on right). Empty list if
    the site has no coastline in its bbox. `label` goes into the cache name
    so inner / farfield / super caches don't collide.
    """
    import requests
    out_dir = ROOT / "data" / slug.capitalize()
    out_dir.mkdir(parents=True, exist_ok=True)
    tag = label or f"h{int(half_m)}"
    cache = out_dir / f"{slug}_coast_{tag}.json"
    if cache.exists() and cache.stat().st_size > 50:
        print(f"  cached coastline: {cache} ({cache.stat().st_size} bytes)")
        data = json.loads(cache.read_text())
    else:
        west, south, east, north, _, _ = _wgs84_bbox(*center, half_m)
        q = (f'[out:json][timeout:60];'
             f'way["natural"="coastline"]({south},{west},{north},{east});'
             f'out geom;')
        headers = {"User-Agent": "seantinel/0.1 (eric.larour@gmail.com)"}
        r = requests.post("https://overpass-api.de/api/interpreter",
                          data={"data": q}, headers=headers, timeout=120)
        r.raise_for_status()
        data = r.json()
        cache.write_text(json.dumps(data))
        print(f"  fetched coastline: {cache} ({cache.stat().st_size} bytes)")
    lat0, lon0 = center
    ways = []
    for e in data.get("elements", []):
        if e.get("type") != "way":
            continue
        geom = e.get("geometry", [])
        pts = [((p["lon"] - lon0) * mpl, (p["lat"] - lat0) * mpa) for p in geom]
        if len(pts) >= 2:
            ways.append(pts)
    print(f"  coastline ways: {len(ways)}")
    return ways


def _chain_ways(ways, tol=0.5):
    """Join coastline ways end-to-end into one or more continuous polylines.

    Matches each way's endpoints with others' at < `tol` meters. First pass
    only chains forward (water-on-right convention preserved); doesn't flip
    ways. For most coastal sites this handles the "coastline exits box, OSM
    splits it into pieces" case cleanly.
    """
    def close(a, b):
        return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 < tol * tol
    remaining = [list(w) for w in ways]
    chains = []
    while remaining:
        chain = remaining.pop(0)
        extended = True
        while extended:
            extended = False
            for i, w in enumerate(remaining):
                if close(chain[-1], w[0]):
                    chain.extend(w[1:])
                    remaining.pop(i)
                    extended = True
                    break
                if close(w[-1], chain[0]):
                    chain = list(w[:-1]) + chain
                    remaining.pop(i)
                    extended = True
                    break
        chains.append(chain)
    return chains


def _liang_barsky(p1, p2, H):
    """Clip segment (p1,p2) to [-H,H]^2. Returns (q1, q2, t0, t1) or None.

    t0, t1 are the parametric points along the input segment where the clipped
    endpoints lie (0=p1, 1=p2). Lets the caller detect "entered box here" vs
    "exited box here" by checking t0 > 0 or t1 < 1.
    """
    x1, y1 = p1
    x2, y2 = p2
    dx, dy = x2 - x1, y2 - y1
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x1 + H), (dx, H - x1), (-dy, y1 + H), (dy, H - y1)):
        if p == 0:
            if q < 0:
                return None
            continue
        t = q / p
        if p < 0:
            if t > t1: return None
            if t > t0: t0 = t
        else:
            if t < t0: return None
            if t < t1: t1 = t
    return ((x1 + t0 * dx, y1 + t0 * dy),
            (x1 + t1 * dx, y1 + t1 * dy), t0, t1)


def _clip_coastline(chain, H):
    """Walk `chain` and emit the subsequence of points inside [-H,H]^2.

    Inserts the exact entry/exit box-boundary intersection points. Assumes a
    single enter/exit pair (ok for a monotone coastal walk). Returns
    (clipped_pts, P_in, P_out) or None if the chain never enters the box.
    """
    def inside(p):
        return abs(p[0]) <= H + 1e-6 and abs(p[1]) <= H + 1e-6
    clipped = []
    P_in = None
    P_out = None
    for i in range(len(chain) - 1):
        a, b = chain[i], chain[i + 1]
        ai, bi = inside(a), inside(b)
        if ai and bi:
            if not clipped:
                clipped.append(a)
            clipped.append(b)
        elif not ai and bi:
            seg = _liang_barsky(a, b, H)
            if seg is None:
                continue
            P_in = seg[0]
            clipped.append(P_in)
            clipped.append(b)
        elif ai and not bi:
            seg = _liang_barsky(a, b, H)
            if seg is None:
                continue
            P_out = seg[1]
            clipped.append(P_out)
            return clipped, P_in, P_out
    if not clipped:
        return None
    return clipped, P_in, P_out


def _box_param(p, H):
    """Parameterize a point on the box boundary as t ∈ [0, 4) CCW from (-H,-H).

    0..1: bottom (y=-H),   1..2: right (x=H),
    2..3: top (y=H),       3..4: left (x=-H).
    """
    eps = 1e-3
    if abs(p[1] + H) < eps: return (p[0] + H) / (2 * H)
    if abs(p[0] - H) < eps: return 1 + (p[1] + H) / (2 * H)
    if abs(p[1] - H) < eps: return 2 + (H - p[0]) / (2 * H)
    if abs(p[0] + H) < eps: return 3 + (H - p[1]) / (2 * H)
    raise ValueError(f"point {p} not on box boundary H={H}")


def _box_corner(t_idx, H):
    """CCW box corner for index 0..3."""
    return [(-H, -H), (H, -H), (H, H), (-H, H)][t_idx % 4]


def _walk_box(P_out, P_in, H, ccw):
    """Perimeter path from P_out to P_in via box corners. Returns intermediate corners.

    `ccw=True` walks counter-clockwise (increasing box-param direction t ∈ [0,4),
    with corners at integer t values).
    """
    t_out = _box_param(P_out, H)
    t_in = _box_param(P_in, H)
    arc = (t_in - t_out) % 4 if ccw else (t_out - t_in) % 4
    pts = []
    for k in range(1, 5):
        # k-th integer t strictly past t_out in the walk direction.
        if ccw:
            corner_t = _math.floor(t_out) + k
            d = (corner_t - t_out) % 4
        else:
            corner_t = _math.ceil(t_out) - k
            d = (t_out - corner_t) % 4
        if d <= 1e-9 or d >= arc - 1e-9:
            break
        pts.append(_box_corner(int(corner_t) % 4, H))
    return pts


def _point_in_poly(x, y, poly):
    """Ray casting; poly is list of (x,y)."""
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-30) + xi):
            inside = not inside
        j = i
    return inside


def _signed_area(ring):
    """Shoelace area. Positive = CCW winding, negative = CW."""
    n = len(ring)
    s = 0.0
    for i in range(n - 1):
        s += (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1])
    return 0.5 * s


def _close_open_chain(clipped, P_in, P_out, H):
    """Close a coastline chain (clipped to the box) into an ocean polygon by
    walking the box perimeter on the water side (OSM: water on right of walk).
    Returns the closed polygon ring.
    """
    import math as _m
    # Seed right-of-tangent at mid-chain, then pick the box-closure direction
    # whose resulting polygon contains the seed.
    mi = len(clipped) // 2
    tx = clipped[mi + 1][0] - clipped[mi - 1][0]
    ty = clipped[mi + 1][1] - clipped[mi - 1][1]
    n = _m.hypot(tx, ty) or 1.0
    rx, ry = ty / n, -tx / n
    step = max(50.0, H * 0.01)
    seed = (clipped[mi][0] + step * rx, clipped[mi][1] + step * ry)
    seed = (max(-H + 0.5, min(H - 0.5, seed[0])),
            max(-H + 0.5, min(H - 0.5, seed[1])))
    for ccw in (True, False):
        corners = _walk_box(P_out, P_in, H, ccw)
        poly = clipped + corners + [clipped[0]]
        if _point_in_poly(seed[0], seed[1], poly):
            return poly
    # Fallback — shouldn't reach for well-formed input.
    corners = _walk_box(P_out, P_in, H, True)
    return clipped + corners + [clipped[0]]


def _clip_closed_chain(chain, H):
    """Keep a closed chain only if entirely inside the box (island fully
    contained). Chains that cross the box edge become open chains and are
    handled by `_clip_coastline`. Returns the chain or None.
    """
    for p in chain:
        if abs(p[0]) > H + 1e-6 or abs(p[1]) > H + 1e-6:
            return None
    return chain


def _build_ocean_polygons(ways, half_m):
    """Assemble OSM coastline ways into ocean and land (island) polygons.

    Returns a dict with:
      "ocean": list of closed rings — each a polygon of water. Open coastline
               chains in the box are each closed via the water-side box walk.
               Fully-contained closed chains with CCW winding (water on right
               = water inside) also go here (lagoons, bays encircled by coast).
      "land":  list of closed rings — islands fully inside the box with CW
               winding (water on right = water outside = land inside).

    Final ocean test: inside any ocean ring AND NOT inside any land ring.
    """
    H = float(half_m)
    chains = _chain_ways(ways)
    ocean_polys = []
    land_polys = []
    for chain in chains:
        if len(chain) < 3:
            continue
        is_closed = (abs(chain[0][0] - chain[-1][0]) < 1.0 and
                     abs(chain[0][1] - chain[-1][1]) < 1.0)
        if is_closed:
            ring = _clip_closed_chain(chain, H)
            if ring is None:
                continue
            area = _signed_area(ring)
            # OSM coastline: water on right of walk direction. A CCW walk has
            # exterior on the right → water outside, land inside → island.
            # A CW walk has interior on the right → water inside (lagoon).
            if area > 0:
                land_polys.append(ring)   # CCW → island (land interior)
            else:
                ocean_polys.append(ring)  # CW → water interior
        else:
            clip = _clip_coastline(chain, H)
            if clip is None:
                continue
            clipped, P_in, P_out = clip
            if P_in is None or P_out is None or len(clipped) < 3:
                continue
            ocean_polys.append(_close_open_chain(clipped, P_in, P_out, H))
    return {"ocean": ocean_polys, "land": land_polys}


def _write_exp(path, name, ring):
    """Write a single-ring .exp (ISSM contour format) with `name`."""
    with open(path, "w") as f:
        f.write(f"## Name:{name}\n## Icon:0\n# Points Count Value\n{len(ring)} 1.\n# X pos Y pos\n")
        for px, py in ring:
            f.write(f"{px:.4f} {py:.4f}\n")


def _write_exp_multi(path, name, rings):
    """Write a multi-ring .exp. ContourToNodes flags a node if inside ANY ring."""
    with open(path, "w") as f:
        for i, ring in enumerate(rings):
            f.write(f"## Name:{name}{i}\n## Icon:0\n# Points Count Value\n")
            f.write(f"{len(ring)} 1.\n# X pos Y pos\n")
            for px, py in ring:
                f.write(f"{px:.4f} {py:.4f}\n")


def _ocean_exp_path(slug, half_m):
    """Per-scale ocean exp path. Each layer (inner/farfield/super) gets its own
    polygon because the box is a different size."""
    return EXP / f"{slug}_ocean_h{int(half_m)}.exp"


def _land_exp_path(slug, half_m):
    """Per-scale land (island) exp path. Islands are subtracted from the ocean
    mask so land fully enclosed by ocean coastline isn't sunk."""
    return EXP / f"{slug}_land_h{int(half_m)}.exp"


def _make_ocean_exp(slug, center, half_m, mpl, mpa):
    """Fetch coastline + assemble ocean/land polygons for the given box.

    Returns `(ocean_path, land_path, main_ocean_ring)`. `main_ocean_ring` is
    the biggest ocean ring (for the viewer's red debug outline). `land_path`
    is None if there are no islands.
    """
    try:
        ways = _fetch_osm_coastline(slug, center, half_m, mpl, mpa,
                                    label=f"h{int(half_m)}")
    except Exception as e:
        print(f"  coastline fetch failed ({e}); falling back to blanket rule")
        return None, None, None
    if not ways:
        return None, None, None
    polys = _build_ocean_polygons(ways, half_m)
    if not polys["ocean"]:
        return None, None, None
    ocean_path = _ocean_exp_path(slug, half_m)
    _write_exp_multi(ocean_path, "ocean", polys["ocean"])
    land_path = None
    if polys["land"]:
        land_path = _land_exp_path(slug, half_m)
        _write_exp_multi(land_path, "land", polys["land"])
    main_ring = max(polys["ocean"], key=len)
    opts = f"{len(polys['ocean'])} ocean"
    if polys["land"]:
        opts += f", {len(polys['land'])} land"
    tot = sum(len(r) for r in polys["ocean"]) + sum(len(r) for r in polys["land"])
    print(f"  wrote ocean polygon: {ocean_path.name} ({opts}, {tot} pts)")
    return ocean_path, land_path, main_ring


def _ocean_flags(x, y, exp_path):
    """Point-in-polygon flags via ISSM ContourToNodes. 1 = inside ocean polygon.

    `x`, `y` are flat arrays in the site's local tangent plane (meters). The
    polygon in `exp_path` must be in the same local coords. Returns a flat
    bool numpy array of the same length as x.
    """
    import numpy as np
    from ContourToNodes import ContourToNodes
    flags = ContourToNodes(np.asarray(x, dtype=float),
                           np.asarray(y, dtype=float),
                           str(exp_path), 2)
    arr = flags[0] if isinstance(flags, tuple) else flags
    return np.asarray(arr).ravel().astype(bool)


def _apply_ocean_mask(x, y, topo, ocean_exp, land_exp=None):
    """Replace blanket `topo < 1 → -5` with explicit ocean polygon(s).

    Polygon is truth. Inside ocean polygon AND outside any island polygon
    → forced to -5 m (safely below any slider). Everywhere else → DEM z
    kept, floored at 0.1 m. If no `ocean_exp`, falls back to blanket rule.
    """
    import numpy as np
    topo = np.asarray(topo, dtype=float).copy()
    if ocean_exp is None:
        return np.where(topo < 1.0, -5.0, topo)
    ocean = _ocean_flags(x, y, ocean_exp)
    if land_exp is not None:
        ocean &= ~_ocean_flags(x, y, land_exp)
    topo[ocean] = -5.0
    land = ~ocean
    topo[land] = np.maximum(topo[land], 0.1)
    return topo


def _build_grid_layer(site, cfg, key):
    """Coarse DEM + low-res imagery over an arbitrary extent, as a regular grid.

    `cfg` supplies half_m, grid_n, naip_px. `key` is used in cache filenames and
    the JSON key the viewer looks up. DEM + imagery sources dispatch on CONUS vs
    global (3DEP/NAIPPlus vs Copernicus/Esri) through `_fetch_dem`/`_fetch_naip`.
    """
    import shutil
    import numpy as np
    from PIL import Image

    slug = site["slug"]
    center = site["center"]
    half_m = int(cfg.get("half_m", 10000))
    grid_n = int(cfg.get("grid_n", 80))
    naip_px = int(cfg.get("naip_px", 1024))
    print(f"\n  == {key} for {slug}: half_m={half_m} grid={grid_n}x{grid_n} ==")

    west, south, east, north, _, _ = _wgs84_bbox(*center, half_m)
    lat0, lon0 = center

    dem_tif = _fetch_dem(slug, center, half_m,
                        out_name=f"{slug}_{key}_dem_h{half_m}.tif")
    img_jpg = _fetch_naip(slug, center, half_m,
                         out_name=f"{slug}_{key}_img_h{half_m}.jpg",
                         px=naip_px)

    dem = np.array(Image.open(dem_tif), dtype=np.float64)
    elev_max = site.get(f"{key}_elev_max", 5000)
    bad = ~np.isfinite(dem) | (dem < -200) | (dem > elev_max)
    if bad.any():
        dem[bad] = -10.0

    nrows, ncols = dem.shape
    col_lon = west + (np.arange(ncols) + 0.5) / ncols * (east - west)
    row_lat = north - (np.arange(nrows) + 0.5) / nrows * (north - south)
    xg = (col_lon - lon0) * mpl_at(lat0)
    yg_td = (row_lat - lat0) * 110540.0
    dem_flip = dem[::-1, :]
    yg = yg_td[::-1]

    xs = np.linspace(xg[0], xg[-1], grid_n)
    ys = np.linspace(yg[0], yg[-1], grid_n)
    xi = np.clip(((xs - xg[0]) / (xg[-1] - xg[0]) * (ncols - 1)).round().astype(int), 0, ncols - 1)
    yi = np.clip(((ys - yg[0]) / (yg[-1] - yg[0]) * (nrows - 1)).round().astype(int), 0, nrows - 1)
    zz = dem_flip[np.ix_(yi, xi)]
    layer_mpl = mpl_at(lat0)
    ocean_exp, land_exp, _ = _make_ocean_exp(slug, center, half_m, layer_mpl, 110540.0)
    xx, yy = np.meshgrid(xs, ys)
    zz = _apply_ocean_mask(xx.ravel(), yy.ravel(), zz.ravel(),
                           ocean_exp, land_exp).reshape(zz.shape)
    print(f"  {key} z: min={zz.min():.1f} max={zz.max():.1f} mean={zz.mean():.1f}")

    img_pub = SITE_OUT / f"{slug}_{key}_img.webp"
    _publish_imagery(img_jpg, img_pub)

    return {
        "nx": grid_n,
        "ny": grid_n,
        "xs": [round(float(v), 1) for v in xs],
        "ys": [round(float(v), 1) for v in ys],
        "z": [round(float(v), 2) for v in zz.flatten()],
        "bbox": [float(xs[0]), float(ys[0]), float(xs[-1]), float(ys[-1])],
        "imagery": f"{slug}_{key}_img.webp",
    }


def mpl_at(lat):
    import math
    return 110540.0 * math.cos(math.radians(lat))


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
    hmin = site.get("hmin", 4.0)
    hmax = site.get("hmax", 150.0)
    md = bamg(model(), "domain", str(exp_path), "hmax", hmax)
    print(f"  initial mesh: nv={md.mesh.numberofvertices} ne={md.mesh.numberofelements}")

    r = np.sqrt(np.asarray(md.mesh.x) ** 2 + np.asarray(md.mesh.y) ** 2)
    growth = (hmax - hmin) / max(half_m - fine_r, 1.0)
    hv = np.clip(hmin + growth * np.maximum(r - fine_r, 0.0), hmin, hmax)
    md = bamg(md, "hVertices", hv, "hmin", hmin, "hmax", hmax)
    print(f"  graded mesh: nv={md.mesh.numberofvertices} ne={md.mesh.numberofelements}")
    topo = InterpFromGridToMesh(x_grid, y_grid, dem_flip, md.mesh.x, md.mesh.y, 0.0)
    # Build ocean mask from OSM `natural=coastline` for the box. If the site
    # has no coastline (fully inland), the mask step falls through to the
    # historical blanket `topo<1 → -5` rule.
    ocean_exp, land_exp, ocean_poly = _make_ocean_exp(slug, center, half_m, mpl, mpa)
    topo = _apply_ocean_mask(md.mesh.x, md.mesh.y, topo, ocean_exp, land_exp)

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

    # Website payload (tracked, served from /data/). JPG → WebP for the wire.
    naip_pub = SITE_OUT / f"{slug}_naip.webp"
    _publish_imagery(naip_src, naip_pub)
    print(f"  wrote {naip_pub.relative_to(ROOT)} ({naip_pub.stat().st_size} bytes)")
    buildings = None
    if site.get("buildings"):
        buildings = _fetch_osm_buildings(slug, center, half_m, mpl, mpa)
        hag_pkg = _fetch_hag_raster(slug, center, half_m)
        _apply_lidar_heights(buildings, center, hag_pkg)
        buildings = _trim_buildings(buildings)
    farfield = _build_grid_layer(site, site["farfield"], "farfield") if site.get("farfield") else None
    superfarfield = _build_grid_layer(site, site["superfarfield"], "superfarfield") if site.get("superfarfield") else None
    _publish_site(slug, title, md, topo, f"{slug}_naip.webp",
                  [xmin, ymin, xmax, ymax], site["focus_radius"],
                  buildings=buildings, farfield=farfield, superfarfield=superfarfield,
                  ocean_outline=ocean_poly)


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
