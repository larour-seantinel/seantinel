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

APK `android-spike/build/spike.apk` v25 (~23 MB) ships with eight ISSM test datasets: 101/106 (Stressbalance SSA 2D), 102/103/104 (Stressbalance 3D prisms — SSA / HO / FS), 105 (Masstransport 2D DG), 107 (Masstransport 3D), 110 (Transient SSA 2D, 3 steps). HUD has four dropdowns — Test, Field, np, Step (auto-shows for transient tests) — plus Run/Kill/Read-log buttons. Solve runs as a fork+exec child process (`issm.exe` shipped as `lib/arm64-v8a/libissmexe.so`); np≥2 via `mpiexec.hydra` → `libmpiexec.so` + `hydra_pmi_proxy` → `libhydrapmi.so` with in-place byte-patch so Hydra's hardcoded proxy-lookup finds the renamed binary. Native solve runs on a background Java thread; JS polls `execRunning()` with live log tail and can Kill. After each solve, JS reads the `.outbin` via base64, parses with `parseresults.js`, swaps `md.results[sol]` (list for transient, single dict for steady), and re-renders via `plotmodel.js`. 2D paths use `processmesh.js` (triangles); 3D paths dispatch to `processmesh3d.js` which extracts the outer skin of the extruded shelf (top + bottom tri caps per base-mesh element + side quads along base-mesh boundary edges × prism layers) — one triangle buffer, interp-colored by any per-vertex 3D field. Colorbar range is frozen across transient steps (computed per field over all steps). Vite build at project root; `scripts/dump_test.py` is parametric (`TEST=101|102|103|104|105|106|107|110 MESH_AREA=... python3 ...`) and now also emits `elements2d`/`numberoflayers`/`z`/`numberofvertices2d` when the mesh is 3D. Install cycle is manual Downloads tap-install (wireless adb blocked by Samsung firewall); bump `versionCode` on every rebuild. Next: pivot to the real Seantinel goal — load a NASA DEM for a coastal location, drape satellite texture, add a rising-water plane.

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
