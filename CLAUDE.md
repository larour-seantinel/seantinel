# Seantinel

## How Claude talks here

Simple language. Direct. No verbiage. As short as possible.

Applies to everything: answers, discussions, status, errors, and anything written.

- Short sentences. Plain words. No filler.
- Say the fact, then the consequence, then the question. Nothing else.
- No hedging. If something is unverified, say "unverified" and stop.
- Do not restate what Eric just said back to him.
- Do not explain reasoning unless he asks why.
- No bold, no bullet padding, no markdown decoration in conversation.
- Never write three sentences where one works.

## Purpose

Seantinel is a web application that renders sea level rise projections in 3D using NASA data and WebGL. Users can explore different regions of the world and visualize how coastlines change under various sea level rise scenarios.

## Environment

- Hardware: Samsung Android phone running Samsung DeX with external screen (Chromebook display)
- Terminal: Termux
- Runtime: Browser (no server-side rendering)
- Language: JavaScript (plain JS, no TypeScript)
- Rendering: Three.js (same stack as VESL/ISSM)
- ISSM: cloned to `~/issm` — mesh engine, BAMG mesher, JS model classes, Emscripten WASM wrappers
- NASA data sources: altimetry DEM (ICESat-2 / SRTM / Copernicus) — to be finalized
- Dev server: Vite (not yet scaffolded)
- How to run: `npm run dev` (unverified — package.json not yet created)

Open questions:
- Which altimetry dataset? (ICESat-2, SRTM, Copernicus DEM)
- Get `issm-binaries.js` from VESL server or compile via Emscripten?
- Target browsers / mobile support?

## Layout

Tracked (source):
- `src/` — application code
- `public/` — static assets
- `CLAUDE.md`, `LEARNINGS.md`, `TODO.md`
- `package.json`, config files

Ignored:
- `node_modules/`
- `dist/`, `build/`
- `data/` — downloaded NASA datasets
- `output/`

## Current Status

APK `android-spike/build/spike.apk` v31 (~23 MB) ships with eight ISSM test datasets (101/106 2D SSA, 102/103/104 3D SSA/HO/FS, 105 2D DG, 107 3D Masstransport, 110 2D transient SSA) **plus the first real-world glacier: Haig (Alberta, 30 yr transient, 10 steps, nvtx=867/nelt=1610)**. HUD has five controls — Test, Field, np, Step (auto-shows for transient), Z-exag log-slider (auto-shows for 3D meshes AND draped 2D meshes, default ×100) — plus Run/Kill/Read-log buttons. Solve runs as a fork+exec child process (`issm.exe` as `lib/arm64-v8a/libissmexe.so`); np≥2 via `mpiexec.hydra` → `libmpiexec.so` + `hydra_pmi_proxy` → `libhydrapmi.so` with in-place byte-patch. After each solve, JS reads the `.outbin` via base64, parses with `parseresults.js`, swaps `md.results[sol]`, and re-renders via `plotmodel.js`. 2D paths use `processmesh.js` (triangles); when `md.geometry.surface` is present and `md.geometry.surface.length === nvtx`, vertices drape onto surface elevation with relief-centered z-exag `(z[i]-zMean)*zExag + zMean` — amplifies relief, not absolute altitude. Camera auto-framing for draped meshes uses `max(size.x, size.y)` only so zExag can't push the camera off into the sky. 3D paths dispatch to `processmesh3d.js` (outer skin of the extruded shelf) with the same relief-centering idea. Scene uses `logarithmicDepthBuffer` + per-scene `camera.near/far` sized to the bounding box. Colorbar range is frozen across transient steps. `scripts/dump_haig.py` parses VESL's `scripts/haig_src/md.js` (232 `md.X.Y = …;` lines + 8 toolkits) into a Python `model()` with legacy→modern renames (`trans→transient`, `priv→private`, `mask.groundedice_levelset→ocean_levelset`, skip `slr`/`gia`), fixes up `settings.results_on_nodes=[]` + `geometry.thickness`, solves transient on MPICH's `mpiexec` (NOT Termux's OpenMPI — prepend `$ISSM_DIR/externalpackages/mpich/install/bin` to PATH), and dumps `.bin`/`.toolkits`/JSON into `android-spike/assets/testHaig/` and `android-spike/assets/data/testHaig.json`. JSON also carries `overlay.{xlim,ylim,outerindex,outerx,outery,outerheight,image}` from `md.radaroverlay` for a future 3D textured DEM backdrop. `scripts/dump_test.py` parametric (`TEST=101|102|103|104|105|106|107|110 MESH_AREA=... python3 ...`); `scripts/bench_transient.py` sweeps mesh sizes for on-device timing. `android-spike/build.sh` now auto-syncs Vite `dist/` into `android-spike/assets/` so HUD edits actually ship. **On-device bench (Samsung ARM64, 2D SSA 10-yr, 1-yr step)**: np=4 has a ~3 s mpiexec startup floor; np=1 wins below ~10k elements. ~4k elements ≈ 1.8 s = interactive sweet spot. Install cycle: manual Downloads tap-install (wireless adb blocked by Samsung firewall); bump `versionCode` on every rebuild. Next: Haig Stage 2 — replace the flat PlaneGeometry overlay in `addOverlayPlane(md)` with a BufferGeometry built from `md.overlay.outerindex`+`outerx/outery/outerheight`, UV-mapped against `xlim`/`ylim`, radar.png as `MeshBasicMaterial.map`. Then Stage 3 — SMB anomaly slider via JNI.

## Screenshots

Samsung DeX screenshots land at `~/storage/shared/DCIM/Screenshots/`. Read the latest with:
```
ls -lt ~/storage/shared/DCIM/Screenshots/ | head -3
```
Then `Read` the full path to view it.

## Conventions

- Scripts named by function: `fetch-nasa-data.sh`, `process-tiles.py`, etc.
- Outputs go in `output/` (ignored by git)
- NASA data goes in `data/` (ignored by git)

## Tracking Files

Read LEARNINGS.md and TODO.md at the start of every session.

- [LEARNINGS.md](LEARNINGS.md) — bugs, fixes, decisions
- [TODO.md](TODO.md) — task queue
