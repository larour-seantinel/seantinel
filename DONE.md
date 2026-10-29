# Done

Shipped work. Not auto-loaded. Reach for it if you need to know whether a
milestone has been crossed; otherwise ignore.

## Infra & environment
- Project initialized
- `/start`, `/close`, `/debug` commands set up (global + project)
- GNU screen configured: `~/.screenrc` with window tab caption and Claude stats hardstatus
- VESL tech stack identified: Three.js + litegl + d3 + gl-matrix + proj4
- Tech stack decision: Three.js + Vite + plain JS (no TypeScript, no Deck.gl)
- ISSM repo cloned to `~/issm`; JS layer fully explored

## ISSM native build on Android/Termux
- MPICH 5.0.0 built with Android patches → `~/issm/externalpackages/mpich/install/`
- PETSc 3.25.4 built and installed → `~/issm/externalpackages/petsc/install/` (ScaLAPACK, METIS, ParMETIS, MUMPS)
- `install-3.25-android.sh` + `patch-mpich-android.sh` committed
- Triangle built → `~/issm/externalpackages/triangle/install/lib/`
- ISSM autoreconf + configure + `make -j5 && make install` succeeded on Android
- Fixed `libISSMCore.so` missing `dbesj0_`/`dbesj1_` NEEDED (SLATEC stubs)
- Diagnosed test 101 blocker: MPI double-link; patched mpicxx wrapper for C++17; clean rebuild
- Test 101 **passes** np=1 (62/61 ms); np=2 (83/135 ms) after MPICH ch3:sock rebuild
- Permanent ScaLAPACK/`issm.exe` OpenMPI-leak fix via `patchelf`
- `test10*.py` np=4 regression suite: 9/9 local tests pass

## APK stack
- Hello-world APK pipeline (`android-hello/build.sh`): aapt2 + ecj + dx + openssl + apksigner
- Minimal WebView + JNI spike (`android-spike`), 12.8 KB APK
- 13 ISSM/PETSc/MPICH libs patched to plain `lib*.so`, llvm-stripped (73 MB in-APK)
- `libissmstatics.so` provides 5 symbols issm.exe would otherwise require (statics + ApiPrintf)
- Verified on-device: 15/15 libs load; `nativeHello` returns `MPI: MPICH Version: 5.0.0`
- test101 StressbalanceSolution runs on-device inside the APK via JNI (np=1, in-process)
- Live native solve drives the WebView plot inside the APK (v14)
- Rebuilt test101 model with finer mesh (3015 nvtx / 5797 nelt); parametric `dump_test.py`
- Field dropdown rebuilt dynamically from parsed outbin; test selector 101/105/106
- Child-process solve (fork+exec): `issm.exe` as `libissmexe.so`; MPI_Init no longer one-shot
- np≥2 via mpiexec inside APK: `libmpiexec.so` + `libhydrapmi.so` with in-place byte-patch
- Test 110 (2D transient SSA) + step slider + frozen colorbar
- 3D prism plotter + four 3D tests (102/103/104/107)
- 3D z-exaggeration slider + tilted camera; log depth-buffer; `camera.near/far` from scene box
- On-device bench driver `scripts/bench_transient.py`; numbers in `project_bench_phone.md`

## Haig glacier (first real-world model)
- `scripts/dump_haig.py` parses VESL `md.js` → Python ISSM `model()` → Transient solve (30 yr, 10 steps, nvtx=867/nelt=1610)
- Legacy renames + fixups; `md.radaroverlay` captured into JSON
- 2D surface drape + relief-centered z-exag in `processmesh.js`
- Haig Stage 2 (APK v37): 3D textured BufferGeometry terrain overlay around glacier
- Vite dist/ → APK asset sync in `android-spike/build.sh`

## Website
- Scaffolded Seantinel browser app with Vite + Three.js; `src/plot/` ports VESL's ISSM→Three.js pipeline
- **Live on Cloudflare Pages** at `seantinel.pages.dev`; repo `github.com/larour-seantinel/seantinel`
- `.gitignore` whitelists for `public/data/` + `*.png` (ordering gotcha fixed in `a2f6e0f`)
- gh CLI auth on Termux via `gh auth login` + `gh auth setup-git`
- Voice input via FUTO Voice Input (Play Store, on-device)
- GNU screen touch-scroll via `altscreen off` + `termcapinfo xterm* ti@:te@`
- Website narrowed to Haig only (dropped test101–110 from dropdown + public/data)
