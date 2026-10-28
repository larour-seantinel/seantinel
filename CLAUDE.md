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

Live native ISSM solve drives the WebView plot inside the Android app. One-tap flow in `android-spike/build/spike.apk` v14 (~21 MB): load 15/15 libs → JNI runs StressBalance on `test101.bin` (3015 nvtx / 5797 nelt, EnvInit 21 ms, FemModel 65 ms, Solve 42 ms, Output 5 ms) → Java reads `test101.outbin` as base64 → JS `parseresults.js` (DataView port of ISSM's `parseresultsfrombuffer.js`) extracts 15 fields including Vel/Vx/Vy/Pressure/DeviatoricStress{xx,yy,xy}/MassFlux1–6 → `plotmodel.js` renders a Three.js mesh with per-vertex jet colormap + auto-scaled colorbar. Vite build lives at project root (`src/` + `index.html` + `scripts/dump_test101.py`), bundled into `android-spike/assets/`. `scripts/dump_test101.py` is parametric (`MESH_AREA=16500 python3 ...`); sets `md.miscellaneous.name='test101'` so the outbin name matches. Install cycle is manual Downloads tap-install (wireless adb blocked by Samsung firewall); bump `versionCode` on every rebuild. Next: field dropdown (trivial, data already parsed) and test 101–110 selector (needs 3D plotter + multi-step UI).

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
