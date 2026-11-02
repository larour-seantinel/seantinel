# TODO

Shipped work moved to [DONE.md](DONE.md). Pull in on demand.

## Next Up — Seantinel core

- **Land/ocean domain mask per site via `.exp` polygon.** Right now DEM elevations below a threshold are blanket-sunk to -5 m, which treats "truly ocean" and "coastal low-lying land" identically. For sites where the inner box straddles the shoreline (Mar del Plata is the trigger — center was on the beach, half the tile was open Atlantic rendered as uniform water), the result looks fine but doesn't *know* what's water. We want: an `ocean.exp` polygon (optional, per-site) that marks where ocean is allowed; outside the polygon, no vertex ever drops below sea level even if the DEM says so. Also usable for the farfield grid-layer cull. Pipeline: load `.exp` with ISSM `expread`, test each mesh vertex / farfield cell with a point-in-polygon, override z accordingly.
- **Multi-tile HAG mosaicing for 5 km+ boxes.** Current pipeline grabs `items[0]` from `3dep-lidar-hag` STAC search, which is one ~8×3 km tile. Hermosa gets 70% coverage, Redondo only 32% (rest default to 7 m). Fetch all overlapping items, build an in-memory mosaic keyed by UTM extent, then look up per-building height.
- Retry wrapper for Overpass + USGS 3DEP (2^n backoff, 3 tries) — transient 502s wasted 3 Manhattan rebuilds this session. See LEARNINGS "Flaky upstream services".
- Take pictures of Long Beach, Torrance, Redondo and Hermosa Beach (Manhattan Beach Pier done — 29 photos in `data/manhattan_pier/photos/`, gitignored).
- Generate QR codes for existing sites (`site.html?loc=hermosa` / `?loc=redondo` / `?loc=manhattan` / `?loc=mardelplata` / `?loc=hermosa_closeup`). URL shape is already settled on slug.
- Add `hermosa_closeup` card to landing page.
- **Landing page disclaimer link.** Viewer pages now have the ⚠ Disclaimer / Data & credits modals, but landing page still shows the raw author line only — add the same two pills (or at least a disclaimer link in the footer) so visitors see the legal disclosure before entering a viewer.
- **Flat-array `buildBuildings()`.** Steady memory for the viewer is still ~13 MB because `hydrateBinary` reconstructs `buildings` as array of `{ring: [[x,y],...], h}` objects. Rewrite `buildBuildings()` to iterate `rings` / `ring_offsets` / `heights` typed arrays directly — cuts steady memory to ~3 MB. Not blocking; do when memory shows up as a problem on low-end phones.
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

- Define scope for high-res pier-photo texture overlay (photogrammetry? planar drape?) — 29 Manhattan Pier photos already staged in `data/manhattan_pier/photos/`, EXIF GPS clustered around pier center.
- Time slider for year-based projections (2025–2100)
- Region selector / zoom to coastline
- Multiple scenario overlays (1.5°C, 2°C, 4°C)
- Animated inundation visualization
- Specific coastal location scenes (Miami, NYC, Jakarta)
