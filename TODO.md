# TODO

Shipped work moved to [DONE.md](DONE.md). Pull in on demand.

## In Progress

(none)

## Next Up — Seantinel core

- QR code pipeline: encode a coastal location in the URL (`?lat=…&lon=…` vs slug `?loc=miami-beach`). Decide shape, then prototype one QR → one scene flow.
- Load a NASA DEM (altimetry) for a specific coastal location. Identify dataset: ICESat-2, SRTM, or Copernicus DEM.
- Run BAMG triangulation on the DEM. Browser path: Emscripten/WASM via `issm-binaries.js` (extract from VESL or compile).
- Drape satellite image texture over triangulated terrain mesh.
- Render sea level rise as a rising water plane over terrain.
- Decide custom domain: `seantinel.app` (~$15/yr) vs stay on free `seantinel.pages.dev`.

## Nice to have

- Expose np=1/np=4 bench finding in APK HUD: default np=1 for ≤10k elt meshes, auto-upgrade to np=4 only for larger.
- 3D flat-shading support in `processmesh3d.js`: need triangle→prism index map for per-element 3D fields.
- Clean fix for Termux netCDF4 missing `libhdf5` NEEDED: `patchelf --add-needed` on the wrapper, or lazy-import.
- Investigate ISSM Restart tests 125/126/129 (velocities blow up at np=4).
- Sign up Oracle Cloud Always Free (home region: Querétaro or Hyderabad for ARM-A1 availability) — 4-core / 24 GB ARM VM for NASA DEM preprocessing when needed.
- Move `Letter/*.docx` to Google Drive (currently phone-only, not in any repo).

## Aspirational

- Time slider for year-based projections (2025–2100)
- Region selector / zoom to coastline
- Multiple scenario overlays (1.5°C, 2°C, 4°C)
- Animated inundation visualization
- Specific coastal location scenes (Miami, NYC, Jakarta)
