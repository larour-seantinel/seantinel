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

1. **Website** — live at `seantinel.pages.dev` (repo `github.com/larour-seantinel/seantinel`, Cloudflare Pages autobuild on `git push`). Landing page (`index.html`) is a two-card chooser into Hermosa Beach and Redondo Beach scenes. Haig glacier removed. Generic viewer at `site.html?loc=<slug>` loads `public/data/<slug>.json` + draped NAIP; features Z-up orbit (pitch capped at 85°), ×5 vertical exaggeration, opaque blue water, vertical sea-level slider (0–10 m or 0–33 ft by locale) with IPCC-ish scenario text, red "You are here" marker, home-icon button, sky gradient background.
2. **Android APKs** — `android-spike/build/spike.apk` runs the full ISSM native stack on-device: fork+exec `issm.exe` via `libissmexe.so`, np≥2 via patched `libmpiexec.so`, 2D + 3D meshes, draped surfaces, transient step slider, z-exag slider, frozen colorbar. `android-todo/build/todo.apk` is a 5-tile home screen (TO-DO + MAIL/NEWS/LEARN/CLAUDE) with TO-DO reading/writing `TODO.md` on GitHub via Contents API. Install via Downloads tap (wireless adb blocked on Samsung).
3. **Seantinel pipeline**: `scripts/runme.py` iterates `SITES` (`hermosa`, `redondo`, `hermosa_closeup`) and runs USGS 3DEP DEM (1000²) + NAIPPlus aerial (**4000²**, ArcGIS cap) fetches per site, meshes with BAMG using an `hVertices` gradient (hmin near the center → hmax at edges, both per-site), masks NoData with `[-200, elev_max]` per site (500 m for coastal LA) and sinks ocean floor (`topo < 1 m → -5 m`) so no near-shore vertices poke through the water plane. Writes `public/data/<slug>.json` + `public/data/<slug>_naip.jpg`. Coastal sites: 5 km × 5 km, hmin=4, hmax=150, ~1.25 m/px NAIP. Close-up `hermosa_closeup`: 500 m × 500 m, hmin=2, hmax=30, 0.125 m/px NAIP, 4319 verts. `/dev` viewer at `dev.html` still available for snapshot debugging.

Next step: **buildings layer** — 3DEP ImageServer confirmed bare-earth DTM (zero cliff pixels in close-up gradient analysis), so structures must come from OSM `building=*` polygons via Overpass API. First pass: flat polygons on terrain. Second pass: extrude by `building:levels × 3 m`. Also pending: QR codes, more sites, custom-domain decision.

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
