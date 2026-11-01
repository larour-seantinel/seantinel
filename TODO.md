# TODO

Shipped work moved to [DONE.md](DONE.md). Pull in on demand.

## In Progress

- Verify textured-building scene on `hermosa_closeup` from a few orbit angles; decide whether we want any per-face shading beyond the planar NAIP drape.

## Next Up — Seantinel core

- Push the buildings + aspect-ratio fix to Cloudflare once we're happy with the look (currently local-only — Eric wants to experiment first).
- Fix hermosa + redondo mesh/NAIP alignment: re-run step 1 and 2 now that `_aspect_size` is in place (DEM and NAIP both compress ~10% N–S at the old pixel aspect, so coastal detail is slightly off even without OSM overlay).
- Take pictures of Long Beach, Torrance, Redondo and Hermosa Beach.
- Generate QR codes for existing sites (`site.html?loc=hermosa` / `?loc=redondo` / `?loc=hermosa_closeup`). URL shape is already settled on slug.
- Verify Redondo scene end-to-end on-device (same ocean/spike fixes applied; only Hermosa was eyeballed).
- Add `hermosa_closeup` card to landing page.
- Layer a 1 m/px inner NAIP tile (±500 m around center) over the current 4000² base — base is now ~1.25 m/px, but a sharper pier-area tile would still help.
- Investigate 3DEP ExportImage TIFF corruption at ≥2000×2000 — PIL reads it as float garbage. Would unlock higher-res DEMs. Likely rasterio solves it.
- Add more coastal sites (Long Beach, Torrance, Palos Verdes) — just needs lat/lon entries in `SITES` in `scripts/runme.py` (remember to pick `elev_max` for the site's max real elevation).
- Enable buildings on more sites: set `"buildings": True` in `SITES`. HAG tile size scales with box; may need multi-tile mosaicing for `half_m > 1000`.
- Decide custom domain: `seantinel.app` (~$15/yr) vs stay on free `seantinel.pages.dev`.

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
