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

1. **Website** — live at `seantinel.pages.dev` (repo `github.com/larour-seantinel/seantinel`, Cloudflare Pages autobuild on `git push`). Currently shows only the Haig glacier (30 yr transient on a 3D textured mountain landscape).
2. **Android APKs** — `android-spike/build/spike.apk` runs the full ISSM native stack on-device: fork+exec `issm.exe` via `libissmexe.so`, np≥2 via patched `libmpiexec.so`, 2D + 3D meshes, draped surfaces, transient step slider, z-exag slider, frozen colorbar. `android-todo/build/todo.apk` is a 5-tile home screen (TO-DO + MAIL/NEWS/LEARN/CLAUDE) with TO-DO reading/writing `TODO.md` on GitHub via Contents API. Install via Downloads tap (wireless adb blocked on Samsung).
3. **Seantinel pipeline bootstrapped**: `scripts/runme.py` is a Python port of the MATLAB `runme.m` using the local ISSM trunk's Python layer (`bamg`, `InterpFromGridToMesh`, `organizer`). Step `ReadHermosaDEM` fetches USGS 3DEP 1m DEM for Hermosa Beach pier (33.8625476, -118.4019461) ±500 m, meshes with BAMG + 3 refine passes, fetches NAIP 1m aerial for the same bbox, and drops two snapshots into `public/dev/`: `hermosa_topo` (elevation-colored) and `hermosa_draped` (satellite-textured). The `/dev` viewer at `dev.html` renders them in Three.js with a rising-water-plane slider, Z-up orbit controls, and `focus_radius`-based initial framing around the lat/lon anchor.

Next step: **QR code location encoding** → one QR → one scene flow. Also multi-site (port MATLAB Naples/MergedLongBeach), widen bbox options, and decide on a custom domain.

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
