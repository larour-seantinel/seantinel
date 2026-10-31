# TODO

Shipped work moved to [DONE.md](DONE.md). Pull in on demand.

## In Progress

(none)

## Next Up — Seantinel core

- Take pictures of Long Beach, Torrance, Redondo and Hermosa Beach.
- Add rising-water-plane step to `runme.py` — translucent z=z_water plane over Hermosa topo; slider in `/dev` viewer.
- Satellite imagery drape over Hermosa terrain (NAIP or Google Static Maps for the same 1 km bbox).
- Port MATLAB `Naples` / `MergedLongBeach` steps if we want multi-site before QR flow.
- Widen Hermosa bbox options (1 km → 2–5 km) and let `runme.py` take `--half-m` arg.
- QR code pipeline: encode a coastal location in the URL (`?lat=…&lon=…` vs slug `?loc=hermosa-pier`). Decide shape, then prototype one QR → one scene flow.
- Decide custom domain: `seantinel.app` (~$15/yr) vs stay on free `seantinel.pages.dev`.

## Nice to have

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
