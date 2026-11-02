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

1. **Website** — live at `seantinel.org` (custom domain, auto-renew Oct 2 2027) and `seantinel.pages.dev` (Cloudflare Pages autobuild on `git push` to `github.com/larour-seantinel/seantinel`). Landing page (`index.html`): ocean-gradient background, lighthouse `/icon.png`, tagline "Sea + sentinel — watching the coast as the ocean rises", two paragraphs of public-friendly explainer, four city cards (**Hermosa Beach**, **Redondo Beach**, **Manhattan Beach Pier**, **Mar del Plata**) with region subtitles, author credit footer (Dr. Eric Larour & Guillermo Anselmo Vezzosi, `seantinel.org@gmail.com`). **EN/ES language toggle** (top-right, persists via `localStorage['seantinel_lang']`, reload-on-switch) wired across both pages via `src/i18n.js`. Generic viewer at `site.html?loc=<slug>` loads `public/data/<slug>.json` + draped NAIP/Esri imagery; features Z-up orbit (pitch capped at 85°), **1:1 Z (no vertical exaggeration)**, opaque blue water, vertical sea-level slider (0–10 m or 0–33 ft by locale) with IPCC-ish scenario text, red "You are here" marker, home-icon button, sky gradient background. Slider panel width-locked (150 px).
2. **Android APKs** — `android-spike/build/spike.apk` runs the full ISSM native stack on-device: fork+exec `issm.exe` via `libissmexe.so`, np≥2 via patched `libmpiexec.so`, 2D + 3D meshes, draped surfaces, transient step slider, z-exag slider, frozen colorbar. `android-todo/build/todo.apk` is a 5-tile home screen (TO-DO + MAIL/NEWS/LEARN/CLAUDE) with TO-DO reading/writing `TODO.md` on GitHub via Contents API. Install via Downloads tap (wireless adb blocked on Samsung).
3. **Seantinel pipeline**: `scripts/runme.py` iterates `SITES` (`hermosa`, `redondo`, `hermosa_closeup`, `manhattan`, `mardelplata`) and runs DEM + imagery fetches per site at aspect-matched pixel sizes. CONUS sites: USGS 3DEP DEM + Esri `World_Imagery` aerial. Non-CONUS: Copernicus GLO-30 DSM + Esri `World_Imagery`. (USGSNAIPPlus was tilted ~5° in SoCal — see LEARNINGS "NAIP vs Esri alignment"; `_fetch_naip` now always uses Esri.) Meshes with BAMG using an `hVertices` gradient (hmin near center → hmax at edges). Coastal sites: 5 km × 5 km, hmin=4, hmax=150, `"buildings": True`. Close-up: 500 m × 500 m, hmin=2, hmax=30. Buildings path (CONUS only for height): Overpass `way["building"]` + Microsoft Planetary Computer `3dep-lidar-hag` (2 m HAG COG) → per-polygon height = median HAG with pixels clipped to [0.5, 40] m. Non-CONUS buildings fall back to 7 m default. Polygons < 20 m² dropped, ring coords rounded to 0.1 m. `site.js` builds **one merged `BufferGeometry` across all buildings** (walls as per-edge quads, roof via `ShapeUtils.triangulateShape` earcut), with a precomputed 128×128 ground-Z grid for O(1) per-building lookup.
4. **Three-layer context stack** (`_build_grid_layer` in `scripts/runme.py`): inner BAMG mesh at 5 km × 5 km → far-field regular grid (`farfield`, 80×80 over 20 km × 20 km, 1024² Esri drape) → super-far-field (`superfarfield`, 60×60 over 400 km × 400 km, Esri — **CONUS only**; non-CONUS ships with 2 layers only). Each outer layer sunk 1 m / 2 m under the next inner one. Ocean-side hole-cut closes layer seams.

**Live now on `seantinel.org`**: five sites — Hermosa, Redondo, Hermosa close-up, Manhattan Beach Pier (CONUS, full 3-layer stack with ~17k buildings), Mar del Plata (Argentina, 2-layer stack with buildings at fallback height). All at 1:1 Z. Zoom clamped to 20–4000 m. Linear depth with per-frame near/far keyed to camera distance. Building walls on `DoubleSide`. Landing page author credit + EN/ES toggle + ocean background + lighthouse icon.

**Payload**: all five sites now ship as `<slug>.json` (1–1.5 KB header) + `<slug>.bin` (Int16-quantized sidecar, 140 KB – 1.34 MB) + `<slug>_naip.webp` (2.1–2.9 MB at q=80 vs 3.5–4.5 MB JPG) — ~4× smaller than the original nested-array JSON, ~40% smaller imagery than JPG, 5 cm round-trip precision. Hermosa total wire size: ~9.4 MB → ~3.7 MB.

**Legal/UX**: viewer pages carry a two-pill `#info-strip` in the lower-left — orange `⚠ Disclaimer` + blue `Data & credits`. Each opens a modal with a three-paragraph disclaimer (slider-set level is not a projection; list of unmodeled processes; as-is / no-warranty / no-reliance) or data sources + authors + contact. Shared `.info-modal` CSS, `wireModal(teaserId, modalId)` JS helper, EN + ES.

**Ocean mask**: per-layer `.exp` polygon(s) built from OSM `natural=coastline`. Multi-chain assembly — every closed chain classified by signed shoelace area (CCW → island / land interior, CW → water interior) using OSM's "land-on-left" convention. Open chains clipped via Liang-Barsky, closed CW along the box perimeter using arc-length comparisons. Douglas-Peucker simplification at tol=H/100 flattens sub-cell wiggles. **Hierarchy mask**: `_apply_hierarchy_mask` classifies each far-layer cell by the finest polygon whose bbox contains it (inner → farfield → super). Finer coastline wins where it exists. Far-layer ocean cells → z=0 (water plane hides them); land cells keep DEM z so mountains show. Hole-cut switched to `allInHole && anyLand → drop` to close the one-cell blue ring at seams. Residual OSM river-mouth artifacts at super-far scale produce a few inland blue specks ~20 km inland near Dana Point — tolerated. Only Hermosa rebuilt; Redondo/Manhattan/close-up/Mar del Plata still on the single-chain polygon.

Next step: roll multi-chain + hierarchy mask through the other 4 sites, multi-tile HAG mosaicing (fix Redondo + Manhattan coverage), QR codes, landing-page disclaimer link, more coastal sites — see TODO.md.

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

## Screenshot shortcuts

When Eric types one of these, read screenshots from
`~/storage/shared/DCIM/Screenshots/` sorted by mtime:

- `SC` — read the latest screenshot
- `SCn` where n is a digit — read the latest `n` screenshots (e.g. `SC2` = last 2, `SC5` = last 5)

Just view them with the Read tool and respond to what they show; no extra confirmation needed.

## Open-page shortcut

When Eric types `op`, open the web page for the task just completed in this session — e.g. if we just built the `manhattan` site, run `termux-open-url "http://localhost:5173/site.html?loc=manhattan"`. If Vite isn't running, start it first. No confirmation needed.

When Eric types `ops`, open the live production Seantinel site on Cloudflare Pages: `termux-open-url "https://seantinel.org/"`. No local server needed. No confirmation needed.

## Shared-file sync discipline

The phone TO-DO app (`android-todo`) writes directly to `TODO.md` on GitHub master. Local checkout may be behind at any time.

- `/start` pulls (fast-forward only) if clean.
- Before editing TODO.md (or any file the app writes) mid-session, re-run `git fetch origin master` and `git pull --ff-only` if clean. Never auto-merge; if diverged, stop and ask.
- Same rule applies if we add more app-writable files later (DONE.md, etc.).
