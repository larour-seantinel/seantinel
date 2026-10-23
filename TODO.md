# TODO

## In Progress

- Compile ISSM natively on Android/Termux (step 4: `make -j5` crashed mid-build, 53 .o files exist, resumable)

## Next Up

- Resume ISSM build: `make -j5 -C ~/issm` (will continue from where it crashed)
- Verify ISSM install: check `~/issm/lib/` and `~/issm/bin/` for output
- Get or extract `issm-binaries.js` (Emscripten WASM) from VESL server
- Scaffold Seantinel project with Vite + Three.js
- Implement ISSM JS model layer (load mesh2d, geometry classes)
- Implement `processmesh` + Three.js `Node` renderer (port from VESL)
- Load a DEM (altimetry) for a specific coastal location
- Run BAMG triangulation on DEM via WASM
- Drape satellite image texture over triangulated terrain mesh
- Render sea level rise as rising water plane over terrain
- Identify NASA altimetry datasets (ICESat-2, SRTM, or Copernicus DEM)

## Aspirational

- Time slider for year-based projections (2025–2100)
- Region selector / zoom to coastline
- Multiple scenario overlays (1.5°C, 2°C, 4°C)
- Animated inundation visualization
- Mobile / DeX support
- Specific coastal location scenes (e.g. Miami, NYC, Jakarta)

## Done

- Project initialized
- `/start`, `/close`, `/debug` commands set up and working (global + project)
- GNU screen configured: `~/.screenrc` with window tab caption and Claude stats hardstatus
- VESL tech stack identified: Three.js + litegl + d3 + gl-matrix + proj4, no bundler
- Tech stack decision: Three.js + Vite + plain JS (no TypeScript, no Deck.gl)
- ISSM repo cloned to `~/issm`; JS layer fully explored (mesh classes, BAMG wrappers, plot pipeline)
- ISSM build dependencies installed: openmpi, openblas, hdf5, netcdf-c, autoconf, automake, libtool, cmake, flang
- MPICH 5.0.0 built with Android patches → `~/issm/externalpackages/mpich/install/`
- PETSc 3.25.4 built and installed → `~/issm/externalpackages/petsc/install/` (with ScaLAPACK, METIS, ParMETIS, MUMPS)
- `install-3.25-android.sh` and `patch-mpich-android.sh` written and committed
- Triangle built → `~/issm/externalpackages/triangle/install/lib/`
- ISSM autoreconf + configure completed (numpy installed, `bash ./configure` required)
