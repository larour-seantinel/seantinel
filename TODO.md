# TODO

## In Progress

- Rebuild MPICH with `--with-device=ch3:sock` (pure TCP, no SHM) to unblock multi-proc on Android. Reuse `install-3.25-android.sh` / `patch-mpich-android.sh` as reference. Then re-run test 101 with np=2.

## Next Up
- Permanent fix for ScaLAPACK OpenMPI leak: either patchelf `replace-needed libmpi.so libmpi.so.12` on `libscalapack.so.2.2`, or rebuild ScaLAPACK against MPICH. Currently masked by `LD_LIBRARY_PATH` ordering.
- Decide longer-term fix for Termux netCDF4 missing `libhdf5` NEEDED: `pkg install patchelf` + patch wrapper, or lazy-import in `loadmodel.py` so tests that don't need netCDF4 skip it.
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
- ISSM `make -j5 && make install` succeeded on Android — `~/issm/bin/` and `~/issm/lib/` populated (35s build)
- Fixed `libISSMCore.so` missing `dbesj0_`/`dbesj1_` NEEDED entry — copied `libslatec.so` into `petsc/install/lib/`, forced relink, verified `DT_NEEDED: libslatec.so` present
- Confirmed scipy/numpy/netcdf4/hdf5 all installable via Termux `pkg` (not pip) — pip triggers Android lmkd OOM-kill (signal 9) on scipy source build
- Diagnosed test 101 blocker: `issm.exe` doubly linked against MPICH (via PETSc) + OpenMPI (via Termux `mpicxx` on PATH) → ABI conflict → segfault
- Patched MPICH's `mpicxx` wrapper (`-std=gnu++20` → `-std=gnu++17`); clean-rebuilt `src/c` with MPICH on PATH. `libISSMCore.so` and `libISSMModules.so` now cleanly MPICH-only
- Discovered bionic resolves NEEDED by filename not SONAME — `LD_LIBRARY_PATH=mpich/lib:...` makes ScaLAPACK's `libmpi.so` NEEDED resolve to MPICH at runtime
- Test 101 **PASSES** with `np=1` on Android: FemModel init 62 ms, solver 61 ms. Full ISSM native stack verified end-to-end
