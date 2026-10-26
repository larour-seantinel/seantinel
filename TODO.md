# TODO

## In Progress

- Verify the libissmstatics.so fix on-device: install `android-spike/build/spike.apk` (18:07), press **Load libs**, confirm all 15 libs OK; press **Call native**, confirm MPICH version string + `dlamch('E')` prints. If any `FAIL lib*.so` appears, debug the next undefined-symbol link.

## Next Up
- Figure out automatic APK install path (wireless adb blocked by Termux × Samsung protocol fault). Options: (a) copy APK into `~/storage/shared/Download/` so Files app can tap-install, (b) try adb from a USB-cable host, (c) revisit after Termux `android-tools` update.
- Decide longer-term fix for Termux netCDF4 missing `libhdf5` NEEDED: `pkg install patchelf` + patch wrapper, or lazy-import in `loadmodel.py` so tests that don't need netCDF4 skip it.
- Get or extract `issm-binaries.js` (Emscripten WASM) from VESL server
- Scaffold Seantinel project with Vite + Three.js
- Investigate 125/126/129 Restart test failures (velocities blow up to ~1e4; TotalSmb/Volume3 OK). Likely restart I/O or MPI-ordering issue; reproduces at np=4 with runme.py
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
- Rebuilt MPICH 5.0.0 with `--with-device=ch3:sock` (pure TCP, no SHM) — unblocks multi-proc on Android. Test 101 **PASSES** with `np=2`: 83 ms init, 135 ms solve
- Permanent ScaLAPACK/`issm.exe` OpenMPI-leak fix via `patchelf` + replaced stale nemesis-era MPICH SOs in `petsc/install/lib/` with the ch3:sock rebuild. Test 101 passes without the `LD_LIBRARY_PATH=mpich/lib:...` ordering trick, and with `np=4` on 10-core ARM
- `test10*.py` np=4 regression suite: **9/9 local tests pass** (test101–109: 2–4 s each). The 10th (`test101eisnasasmce`) is a cloud-cluster test that SSHes to AWS SMCE — not applicable on Termux, excluded
- Hello-world APK pipeline (`~/Seantinel/android-hello/build.sh`): aapt2 + ecj + dx + openssl + apksigner. Built, signed (v1+v2+v3), installed via Downloads tap, launches "Hello Seantinel" on-screen
- Step A — minimal WebView + JNI spike (`~/Seantinel/android-spike`): WebView loads `assets/index.html`, Java `NativeBridge` + `@JavascriptInterface`, tiny `libspike.so` calls back into JS. 12.8 KB APK, "hello from native (libspike)" rendered on-device
- Step B lib staging — 13 ISSM/PETSc/MPICH/Termux libs patched to plain `lib*.so`, llvm-stripped (165 → 73 MB in-APK), SONAME + NEEDED chain all point to plain names. `libpetsc` NEEDED now includes `libandroid-shmem.so` (fixes `libandroid_shmctl` missing). `libISSMCore` NEEDED now includes `libissmstatics.so` (supplies `IssmComm::{comm,parallel}` + `ToolkitOptions::{toolkittype,toolkitoptions}` statics that `issm.exe` normally defines)
