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

APK `android-spike/build/spike.apk` v16 (~22 MB) ships with three ISSM test datasets: 101 (Stressbalance SSA minimal), 105 (Masstransport 2D DG), 106 (Stressbalance SSA full outputs). HUD has two dropdowns — Test (101/105/106) and Field (populated dynamically from the parsed outbin after each solve) — plus one Run button that loads 15/15 libs, runs the native solve via JNI (`nativeRunTest(dir, testName, solution)`), parses the resulting `.outbin` with `parseresults.js`, and re-renders via `plotmodel.js` with per-vertex jet colormap + auto-scaled colorbar. Test101 verified end-to-end on-device; test106 behaves identically with richer field menu (Vel/Vx/Vy/Pressure/DeviatoricStress{xx,yy,xy}/MassFlux1–6); test105 renders a sparse DG mesh (nvtx=44/nelt=68, matches real NightlyRun test105). Test selector locks after Run because `MPI_Init` is one-shot per process — pick test first, then Run. Vite build lives at project root (`src/` + `index.html` + `scripts/dump_test.py`), bundled into `android-spike/assets/`. `scripts/dump_test.py` is parametric (`TEST=101|105|106 MESH_AREA=... python3 ...`) and writes JSON + bin + toolkits for both the browser dev path and the APK in one shot. Install cycle is manual Downloads tap-install (wireless adb blocked by Samsung firewall); bump `versionCode` on every rebuild. Next: child-process solve path (fork+exec `issm.exe` as `libissmexe.so`) to unlock reruns and np≥2, then 2D transient (test110 + step slider), then 3D prism plotter (102/103/104/107).

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
