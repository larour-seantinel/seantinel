# TODO

## In Progress

- (empty)

## Next Up
- Add test 110 (2D transient Masstransport): needs a step slider in the HUD (per-step picking in `parseresults` output) and the existing field dropdown wires to the selected step. Builder shape in `scripts/dump_test.py` is already parametric — add `build_test110` + default area.
- Add 3D tests (102/103/104/107): requires a `processmesh3d.js` + `Node3D.js` that handles prisms (6-vertex elements, 3 quad side faces + 2 triangle caps). Current `processmesh.js` only handles 2D triangles. Big-ish — defer until 2D transient works.
- Begin ISSM-WASM path (browser build of Seantinel): extract `issm-binaries.js` from VESL or compile via Emscripten. Current native-stack path is Android-only.
- Automatic APK install from Termux is BLOCKED on Samsung — pairing listener refuses same-device connections even with adb 37.0.0p1 and local-network permission granted (traced 2026-10-26, see LEARNINGS). Use (a) copy APK into `~/storage/shared/Download/` for Files app tap-install, or (b) pair from an external device once and copy keys.
- Decide longer-term fix for Termux netCDF4 missing `libhdf5` NEEDED: `pkg install patchelf` + patch wrapper, or lazy-import in `loadmodel.py` so tests that don't need netCDF4 skip it.
- Investigate 125/126/129 Restart test failures (velocities blow up to ~1e4; TotalSmb/Volume3 OK). Likely restart I/O or MPI-ordering issue; reproduces at np=4 with runme.py
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
- Step B **verified on-device** (2026-10-26 21:32): spike.apk v2 loads all **15/15 libs OK** (libc++_shared, libz, libandroid-shmem, libopenblas, libmpi, libmpifort, libmpicxx, libmetis, libparmetis, libslatec, libscalapack, libpetsc, libissmstatics, libISSMCore, libspike). Native call returns `MPI: MPICH Version: 5.0.0` + `ISSM dlamch('E') = 1.110223e-16`. Full ISSM/PETSc/MPICH native stack runs inside a stock Android app via JNI → WebView bridge. Added `ApiPrintf(const char*)` as 5th symbol in `libissmstatics.so`; bumped versionCode to 2 so Android treats reinstall as a true upgrade (same code was a silent-skip trap)
- Step C — **test101 StressbalanceSolution runs on-device inside the APK via JNI (np=1)**. Added `nativeRunTest101(filesDir)` to `libspike.so` that mirrors `issm.cpp`'s `main()`; assets `test101.bin`/`test101.toolkits` ship with the APK and get copied to `getFilesDir()` on first run; stdout/stderr `dup2`'d to a log file read back through a `Read log` button. Added `<uses-permission android:name="android.permission.INTERNET"/>` so MPICH ch3:sock can `listen()` on loopback. versionCode=4. On-device timings: FemModel init 37 ms, Solve 18 ms. Second-call guard in place because MPI_Init is one-shot per process
- Scaffolded Seantinel browser app with Vite + Three.js. `src/plot/` hosts the ISSM → Three.js plot pipeline ported from VESL: `colorbars.js` (verbatim from ISSM), `processmesh.js` (2D), `processdata.js` (node/element classifier), `Node.js` (`patch({Faces, Vertices, FaceVertexCData, FaceColor, EdgeColor})` with per-vertex `interp` and per-element `flat` modes), `plotmodel.js` orchestrator. Mesh is 1-indexed on the ISSM side; Node subtracts 1 before writing the Three.js index buffer. Dev server: `npm run dev` at `http://localhost:5173`.
- **Live native solve drives the WebView plot inside the APK (v14).** Added `readOutbinBase64()` `@JavascriptInterface` + `parseresults.js` (DataView port of ISSM's `parseresultsfrombuffer.js`, handles type 1/2/3/4 records, unit conversion m/s → m/year, strips trailing `\x00` from field names). Flow: Run test101 → load libs → native Solve → read outbin → parse → swap `md.results.StressbalanceSolution` → re-render. Single tap, one-on-one testable (bundled auto-render disabled when `window.Native` present).
- Rebuilt test101 model with finer mesh (3015 nvtx / 5797 nelt, up from 340/614). `scripts/dump_test101.py` is parametric: `MESH_AREA=16500` env var controls `triangle(..., maxarea)`. Also sets `md.miscellaneous.name = 'test101'` so the output filename matches what the Android app reads.
- Removed `Load libs` button from the HUD. Run test101 auto-loads libs; one button for the full native cycle.
- **Field dropdown** — rebuilt dynamically from the parsed outbin after each solve. Filters to Float64Array keys whose length matches `md.mesh.numberofvertices` or `numberofelements`; default comes from `TESTS[id].defaultField`. Instant swap: pick a field, re-render.
- **Test selector (101/105/106)** — all three 2D steady tests packaged in the APK. 101 = Stressbalance SSA minimal (Vel/Vx/Vy/Pressure). 105 = Masstransport 2D DG (Thickness, nvtx=44/nelt=68, matches real NightlyRun test105). 106 = Stressbalance SSA with full outputs (Vel/Vx/Vy/Pressure + DeviatoricStress{xx,yy,xy} + MassFlux1–6, nvtx=340/nelt=614). Test dropdown locks after Run because `MPI_Init` is one-shot per process.
- `scripts/dump_test.py` replaces `dump_test101.py`. Parametric via `TEST=101|105|106` + optional `MESH_AREA` override. Writes JSON for both the Vite/public path and the APK asset path, and copies `.bin`/`.toolkits` from the fresh execution dir into `android-spike/assets/test{N}/` in one shot.
- JNI generalized: `nativeRunTest(dir, testName, solution)` replaces `nativeRunTest101(dir)`. Java mirror methods accept `testName`. APK v16 shipped (22.2 MB).
- **Child-process solve (fork+exec)**: `issm.exe` ships as `lib/arm64-v8a/libissmexe.so` with plain-name NEEDED chain; `NativeBridge.execRunTest()` runs it via `ProcessBuilder` with `LD_LIBRARY_PATH=nativeLibraryDir`. Each Run is a fresh process → MPI_Init one-shot is no longer a constraint. Test selector no longer locks after Run; 101/105/106 can be switched and re-run in any order. APK v17 (22 MB).
- **np≥2 via mpiexec**: `mpiexec.hydra` → `libmpiexec.so`, `hydra_pmi_proxy` → `libhydrapmi.so` staged in `lib/arm64-v8a/`. In-place byte-patched `libmpiexec.so` so hydra's hardcoded `hydra_pmi_proxy` string → `libhydrapmi.so` (16-byte slot, single occurrence). HUD has np=1/2/4 selector; solve runs on a background thread with live log tail + Kill button so the UI stays responsive while hydra does its thing. test101 confirmed working at np=2 and np=4. APK v20 (23 MB).
