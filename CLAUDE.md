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

Three artifacts live, Seantinel core underway.

1. **Website** — live at `seantinel.pages.dev` (repo `github.com/larour-seantinel/seantinel`, Cloudflare Pages autobuild on `git push`). Landing page (`index.html`) is a two-card chooser into Hermosa Beach and Redondo Beach scenes. Generic viewer at `site.html?loc=<slug>` loads `public/data/<slug>.json` + draped NAIP; features Z-up orbit (pitch capped at 85°), **1:1 Z (no vertical exaggeration — realistic)**, opaque blue water, vertical sea-level slider (0–10 m or 0–33 ft by locale) with IPCC-ish scenario text, red "You are here" marker, home-icon button, sky gradient background. Slider panel is width-locked (150 px) so it doesn't reflow as the scenario label line-count changes.
2. **Android APKs** — `android-spike/build/spike.apk` runs the full ISSM native stack on-device: fork+exec `issm.exe` via `libissmexe.so`, np≥2 via patched `libmpiexec.so`, 2D + 3D meshes, draped surfaces, transient step slider, z-exag slider, frozen colorbar. `android-todo/build/todo.apk` is a 5-tile home screen (TO-DO + MAIL/NEWS/LEARN/CLAUDE) with TO-DO reading/writing `TODO.md` on GitHub via Contents API. Install via Downloads tap (wireless adb blocked on Samsung).
3. **Seantinel pipeline**: `scripts/runme.py` iterates `SITES` (`hermosa`, `redondo`, `hermosa_closeup`) and runs USGS 3DEP DEM + NAIPPlus aerial fetches per site at aspect-matched pixel sizes (`_aspect_size`). Meshes with BAMG using an `hVertices` gradient (hmin near the center → hmax at edges, per-site). Coastal sites: 5 km × 5 km, hmin=4, hmax=150, `"buildings": True`. Close-up: 500 m × 500 m, hmin=2, hmax=30. For buildings sites: Overpass `way["building"]` polygons + Microsoft Planetary Computer `3dep-lidar-hag` (2 m HAG COG) → per-polygon height = **median HAG with pixels clipped to [0.5, 40] m** (p95 picked antenna / tree-overhang artifacts up to 287 m — turned houses into 60–250 m spires). Polygons < 20 m² dropped, ring coords rounded to 0.1 m before publish (JSON 12 MB → 5 MB per site). `site.js` builds **one merged `BufferGeometry` across all buildings** (walls as per-edge quads, roof via `ShapeUtils.triangulateShape` earcut), with a precomputed 128×128 ground-Z grid for O(1) per-building lookup — one draw call, mobile-smooth.
4. **Three-layer context stack** (`_build_grid_layer` in `scripts/runme.py`): inner BAMG mesh at 5 km × 5 km → far-field regular grid (`farfield`, 80×80 over 20 km × 20 km, draped with 1024² NAIP) → super-far-field regular grid (`superfarfield`, 60×60 over 400 km × 400 km, still from NAIPPlus — service accepted the extent, Esri `World_Imagery` fallback coded but unused). Each outer layer sunk 1 m / 2 m under the next inner one so depth test wins. Hole cut by "any vertex strictly inside the inner-layer bbox" — produces ~160 m / ~170 m blue water bands at the two seams (**open bug**, see LEARNINGS).

**Live now on `seantinel.pages.dev`**: Hermosa + Redondo at 1:1 Z with the three-layer stack and ~20k buildings each; thinner slider (14 px track + matching round thumb). Payload per site ~5.4 MB JSON + ~4 MB inner NAIP + ~170 KB far-field JPG + ~100 KB super-far JPG.

Next step: fix the blue-band seams between layers without regressing to the shrink-hole trap, multi-tile HAG mosaicing (fix Redondo coverage), QR codes, more coastal sites (Long Beach, Torrance, Palos Verdes), add `hermosa_closeup` card, custom-domain decision — see TODO.md.

Shipped history and build details live in [DONE.md](DONE.md) and
[LEARNINGS-archive.md](LEARNINGS-archive.md) — not auto-loaded.

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

## Config backup

`~/CloudConfig/` → `github.com/larour-seantinel/CloudConfig` (private). Mirrors `~/.claude/` config + memory + dotfiles. `/close` auto-syncs. On a fresh device: `git clone` + `./restore.sh`.

## Showing plots to Eric

Eric does not run `npm run dev` or open URLs manually. When you want him to look
at a plot or page, you do both:

1. If Vite isn't already running, start it: `cd ~/Seantinel && npm run dev`
   with `run_in_background: true`.
2. Open the browser yourself: `termux-open-url "http://localhost:5173/<path>"`.

Applies to `/dev.html` snapshot viewer and the main site. Also applies when you
drop a new snapshot via `plot_web()` — tell Eric to switch to the browser tab,
don't ask him to open it.

## Shared-file sync discipline

The phone TO-DO app (`android-todo`) writes directly to `TODO.md` on GitHub master. Local checkout may be behind at any time.

- `/start` pulls (fast-forward only) if clean.
- Before editing TODO.md (or any file the app writes) mid-session, re-run `git fetch origin master` and `git pull --ff-only` if clean. Never auto-merge; if diverged, stop and ask.
- Same rule applies if we add more app-writable files later (DONE.md, etc.).
