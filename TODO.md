# TODO

Shipped work moved to [DONE.md](DONE.md). Pull in on demand.

## In Progress

- Decide custom domain and buy via Cloudflare Registrar. Shortlist: `seantinel.app` (~$15/yr), `seantinel.org` (~$10/yr), `seantinel.earth` (~$70/yr). `seantinel.com` is squatted. See LEARNINGS "Domain research".

## Next Up — Seantinel core

- **Multi-tile HAG mosaicing for 5 km+ boxes.** Current pipeline grabs `items[0]` from `3dep-lidar-hag` STAC search, which is one ~8×3 km tile. Hermosa gets 70% coverage, Redondo only 32% (rest default to 7 m). Fetch all overlapping items, build an in-memory mosaic keyed by UTM extent, then look up per-building height.
- Take pictures of Long Beach, Torrance, Redondo and Hermosa Beach.
- Generate QR codes for existing sites (`site.html?loc=hermosa` / `?loc=redondo` / `?loc=hermosa_closeup`). URL shape is already settled on slug.
- Add `hermosa_closeup` card to landing page.
- Layer a 1 m/px inner NAIP tile (±500 m around center) over the current 4000² base — base is now ~1.25 m/px, but a sharper pier-area tile would still help.
- Investigate 3DEP ExportImage TIFF corruption at ≥2000×2000 — PIL reads it as float garbage. Would unlock higher-res DEMs. Likely rasterio solves it.
- Add more coastal sites (Long Beach, Torrance, Palos Verdes) — just needs lat/lon entries in `SITES` in `scripts/runme.py` (remember `elev_max` and `"buildings": True`).

## Nice to have

- Mesh JSON is 3 MB per site. If sites multiply, switch to a binary payload (positions as base64 Float32Array) or gzip-friendly packing.
- Fix `android-spike/build.sh` key-wipe bug the same way as `android-todo` (move signing keys to `.keys/` so `rm -rf build` doesn't change the APK cert).
- Expose np=1/np=4 bench finding in APK HUD: default np=1 for ≤10k elt meshes, auto-upgrade to np=4 only for larger.
- 3D flat-shading support in `processmesh3d.js`: need triangle→prism index map for per-element 3D fields.
- Clean fix for Termux netCDF4 missing `libhdf5` NEEDED: `patchelf --add-needed` on the wrapper, or lazy-import.
- Investigate ISSM Restart tests 125/126/129 (velocities blow up at np=4).
- Sign up Oracle Cloud Always Free (home region: Querétaro or Hyderabad for ARM-A1 availability) — 4-core / 24 GB ARM VM for NASA DEM preprocessing when needed.
- Move `Letter/*.docx` to Google Drive (currently phone-only, not in any repo).
- `pkg install proj` + `pip install pyproj` on Termux if we need proper geodetic transforms (UTM, EPSG) beyond local tangent plane.

## Aspirational

- Time slider for year-based projections (2025–2100)
- Region selector / zoom to coastline
- Multiple scenario overlays (1.5°C, 2°C, 4°C)
- Animated inundation visualization
- Specific coastal location scenes (Miami, NYC, Jakarta)
