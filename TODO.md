# TODO

## In Progress

- **Haig terrain overlay — Stage 2**: replace the flat `PlaneGeometry` in `addOverlayPlane(md)` with a `BufferGeometry` built from `md.overlay.outerindex` + `outerx`/`outery`/`outerheight`, UV-mapped against `xlim`/`ylim` so `radar.png` textures the surrounding terrain (match VESL's 3D DEM look, not a flat sheet). Then re-run `dump_haig.py` (MPICH PATH prelude!) to ship a `testHaig.json` with the full `overlay.outer*` arrays, re-fetch `radar.png` to `android-spike/assets/data/testHaig_radar.png`, apply current `zExag` to the terrain mesh z coords with the same mean-centered pattern, rebuild APK v32.

## Next Up
- Haig Stage 3: SMB anomaly slider in the HUD — JNI entry point that mutates `md.smb` in-place and re-solves transient without a full relaunch. Dependency: Haig terrain overlay (Stage 2) landed.
- Pivot to Seantinel core: load a NASA DEM for a coastal location, drape satellite texture, add rising-water plane. The ISSM spike is now feature-complete (2D steady + 2D DG + 2D transient + 3D prisms with z-exag + in-APK solve + step slider + frozen colorbar + on-device bench numbers + Haig real-world glacier). This is the actual project goal.
- Begin ISSM-WASM path (browser build of Seantinel): extract `issm-binaries.js` from VESL or compile via Emscripten. VESL's sea-level pages already use it; glacier/ice-sheet pages use a backend server. Current Seantinel native-stack path is Android-only.
- Expose np=1/np=4 bench finding in the HUD: default np=1 for ≤10k elt meshes, auto-upgrade to np=4 only for larger. Mpiexec startup is ~3 s on this phone — don't pay it for small models.
- 3D flat-shading support in `processmesh3d.js`: current port only handles per-vertex (interp) coloring. For per-element 3D fields (none in current tests but likely in future stress-tensor-per-prism outputs) need a triangle→prism index map so FaceColor='flat' can broadcast one prism value across its skin triangles.
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
- **Test 110 (2D transient SSA)** packaged + wired to step slider. `build_test110` + list-of-steps collection added to `scripts/dump_test.py` (handles `md.results.TransientSolution` as a `solution` wrapper exposing `__len__`+`__getitem__`). Flattened JSON preserves 3 timesteps with Vel/Vx/Vy/Thickness/Pressure/Base/Surface per step (nvtx=44/nelt=68). `main.js` reads an array for transient / single dict for steady via `getSteps()` + `currentStepIdx`. Step slider row auto-hides when `steps.length <= 1`. Colorbar range is frozen across steps (computed once per field over all steps, passed to `plotmodel` as `opts.caxis`) so the color scale doesn't rescale as you drag. Status + colorbar title show `step N/M t=X.XX` for visual confirmation. APK v23 (23 MB).
- **3D prism plotter** (`src/plot/processmesh3d.js`) and **four 3D tests shipped** in the APK: 102 (SSA 3D), 103 (HO 3D + StressTensor fields), 104 (FS full-Stokes 3D), 107 (Masstransport 3D, 5 layers). Skin extraction: top + bottom tri caps per base-mesh element + side quads along base-mesh boundary edges × prism layers. `plotmodel.js` dispatches on `md.mesh.numberoflayers > 1 || elements[0].length === 6`. `scripts/dump_test.py` now also emits `elements2d` / `numberoflayers` / `z` / `numberofvertices2d` when the mesh is 3D. APK v25 (23 MB). Interp (per-vertex) coloring only for now — per-element flat for 3D deferred.
- **3D z-exaggeration slider + tilted camera** (APK v26). HUD gets a log-scale `×1..×1000` dial (default ×100) that only appears for 3D meshes; `processmesh3d.js` multiplies the vertex z by the factor. For 3D meshes, initial camera placed at a 3/4 angle `(center + d*(0.6, -0.9, 0.6))` instead of pure top-down so depth is visible on first render. 2D path unchanged.
- **3D render jitter fix** (APK v27). Enabled `logarithmicDepthBuffer: true` on the WebGLRenderer and set `camera.near/far` dynamically from the scene bounding box (`near=max(maxDim*1e-3, 0.1)`, `far=maxDim*100`). Killed Z-fighting shimmer on ice-shelf-scale meshes.
- **On-device bench, 2D SSA 10-yr transient** (`scripts/bench_transient.py`). Env: `NP`, `FINAL`, `STEP`, `AREAS`. Key numbers at np=1: 4k elt → 1.8 s (sweet spot), 7k → 2.95 s, 11k → 4.87 s. np=4 has a 3 s mpiexec startup floor so it only wins above ~10k elements. Full numbers in auto-memory `project_bench_phone.md`.
- **Haig glacier (first real-world model)** packaged + wired. `scripts/dump_haig.py` parses VESL's `md.js` dump → Python ISSM `model()` → Transient solve (30 yr, 10 steps, nvtx=867/nelt=1610) → `.bin`/`.toolkits`/JSON into APK assets. Legacy field renames (`trans→transient`, `priv→private`, `mask.groundedice_levelset→ocean_levelset`), skip `slr`/`gia`, fix `settings.results_on_nodes=[]`, recompute `geometry.thickness`. HUD dropdown gains "Haig — Alberta glacier (30 yr, 10 steps)". APK v31 (23 MB).
- **2D surface drape + relief-centered z-exag**. `processmesh.js` now accepts `opts.vertexZ`/`opts.drapeOnSurface`/`opts.zExaggeration`; for Haig it drapes vertices onto `md.geometry.surface` and multiplies **relief** (deviation from mean altitude), not absolute altitude. Camera framing for draped meshes uses `max(size.x, size.y)` only — cranking zExag no longer backs the camera off and flattens the view.
- **Vite dist → APK asset sync** in `android-spike/build.sh`. `rm -f assets/assets/index-*.js && cp ../dist/index.html assets/index.html && cp -r ../dist/assets/* assets/assets/` before aapt2 compile. Fixes stale hashed-JS references after `npm run build`; new HUD options show up on the first APK rebuild without manual asset edits.
