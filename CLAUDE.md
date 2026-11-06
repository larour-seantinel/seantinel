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
2. **Android APKs** — `android-spike/build/spike.apk` runs the full ISSM native stack on-device: fork+exec `issm.exe` via `libissmexe.so`, np≥2 via patched `libmpiexec.so`, 2D + 3D meshes, draped surfaces, transient step slider, z-exag slider, frozen colorbar. `android-todo/build/assistant.apk` (app label **Assistant**, package still `com.seantinel.todo`) is a 5-tile home screen (TO-DO + MAIL/NEWS/LEARN/CLAUDE). TO-DO reads/writes `TODO.md` on GitHub via Contents API. **CLAUDE tile (2026-11-06)**: lists every screen window running `node claude`, read-only polling transcript (1.5 s), SPEAK records in-APK via `MediaRecorder` + `@JavascriptInterface AndroidRecorder` → bridge `/transcribe` → ffmpeg → whisper.cpp base multilingual → `screen -X stuff`. Session management: `+ NEW SESSION` (new screen master + Tab1 claude), per-row `+ TAB` (new window in existing screen), per-row `×` (kills just that tab; full screen only when it's the last tab). Tabs numbered by screen's `$WINDOW` (read from `/proc/<shell_pid>/environ` — stable across Android PID wrap). Topbar restored in transcript view (`←` back + refresh); `body.in-claude-session { zoom: 1 }` cancels the global 1.3× zoom so the transcript doesn't overflow. Bridge `android-todo/bridge.py` on `127.0.0.1:8787` is a `ThreadingHTTPServer`. **Autostart via Termux `RUN_COMMAND` intent** fired from `MainActivity.onCreate` (needs `com.termux.permission.RUN_COMMAND` in manifest + `allow-external-apps=true` in `~/.termux/termux.properties`); covers "Termux got killed" case. **Boot-time autostart** at `~/.termux/boot/start-bridge` waits on Termux:Boot app install. Diagnostic logging: every `/record/stop` and `/transcribe` appends `src/bytes/max_db/text` to `~/tmp/bridge-mic.log`. Shell test scripts: `android-todo/mic-test.sh`, `android-todo/mic-test-bridge.sh`. Install via Downloads tap (wireless adb blocked on Samsung). Font scaled 1.3× via `body { zoom }`.
3. **Seantinel pipeline (TESG single-mesh)**: `scripts/runme.py` iterates `SITES` (`hermosa`, `redondo`, `manhattan`, `mardelplata`) and builds each site as one continuous BAMG mesh over 400 km × 400 km via `_build_tesg_site(site)` — no inner / farfield / superfar tiers. 5 progressive refinement passes with piecewise concave h(r) (hmin=4 m core → hmax_inner=150 m at r=2500 → hmax=30 km at r=200 km) → ~65k verts / ~130k tris. Three-layer imagery drape (inner 5 km hi-res + mid 50 km + outer 400 km Esri). Dual DEM: fine 3DEP (CONUS) or Copernicus (non-CONUS) at 5 km, coarse 3DEP (CONUS) or Copernicus (non-CONUS) at 400 km. Binary writer auto-upgrades `x`/`y` to `f32` when extent exceeds the i16 ±3276 m range. Ocean triangles (any vert z ≤ -2.5) dropped entirely; water plane sized 3× mesh bbox fills the gap. Buildings path (CONUS only for height): Overpass `way["building"]` + Microsoft Planetary Computer `3dep-lidar-hag` → median HAG with pixels clipped to [0.5, 40] m. Non-CONUS buildings fall back to 7 m default. `_fetch_naip` always uses Esri `World_Imagery` (USGSNAIPPlus was tilted ~5° in SoCal — see LEARNINGS "NAIP vs Esri alignment").

**Live now on `seantinel.org`**: four sites, all TESG single-mesh — **Hermosa, Redondo, Manhattan Beach Pier (CONUS, 65k verts + ~17k buildings), Mar del Plata (Argentina, 65k verts, 520 OSM buildings at 7 m fallback height)**. `hermosa_closeup` retired. All at 1:1 Z, zoom clamped to 20–4000 m. Linear depth with per-frame near/far keyed to camera distance. Building walls on `DoubleSide`. Landing page author credit + EN/ES toggle + ocean background + lighthouse icon.

**Local preview `index-v2.html`** (not deployed): Guillermo redesign from `web design.docx` — SEANTINEL wordmark + night-sky-mountains icon, hand-sketch hill background (placeholder for real painting), centered "FIND YOUR CITY" card with vertical city list, right column with dashed "SCAN YOUR QR" tile + "How to be involved" button. V2 features (top nav / interactive Earth / art-collection account / real-data sealine) deferred. Promotion to `index.html` waits on Guillermo's sign-off and the finished painting.

**Non-CONUS note**: `_build_tesg_site` picks `outer_half=50_000, hmax=7_500` for non-CONUS (vs. `200_000, 30_000` for CONUS) because a 400 km × 400 km Copernicus GLO-30 tile loads as ~1.7 GB and OOMs Termux. Mar del Plata's outer horizon is 100 km × 100 km — mostly Atlantic anyway.

**Payload (TESG sites)**: `<slug>.json` (1–2 KB header) + `<slug>.bin` (quantized sidecar, ~2–3 MB for 65k-vert mesh) + three WebP tiles — `<slug>_naip.webp` (inner 5 km, 2.1–2.9 MB at q=80) + `<slug>_naip_mid.webp` (mid context) + `<slug>_naip_outer.webp` (outer context).

**Legal/UX**: viewer pages carry a two-pill `#info-strip` in the lower-left — orange `⚠ Disclaimer` + blue `Data & credits`. Each opens a modal with a three-paragraph disclaimer (slider-set level is not a projection; list of unmodeled processes; as-is / no-warranty / no-reliance) or data sources + authors + contact. Shared `.info-modal` CSS, `wireModal(teaserId, modalId)` JS helper, EN + ES.

**Ocean mask**: one `(ocean, land)` `.exp` pair per site, built from OSM `natural=coastline` fetched once at the outermost (400 km) scale. Multi-chain assembly — every closed chain classified by signed shoelace area (CCW → island / land interior, CW → water interior) using OSM's "land-on-left" convention. Open chains clipped via Liang-Barsky, closed CW along the box perimeter using arc-length comparisons. **Adaptive Douglas-Peucker**: per-point tol = `max(25, min(20000, (r−5000)·0.1))` — holds 25 m through the farfield box (so DP can't cut chords across jetties), ramps at 10% of radius, caps at 20 km near the horizon. `_apply_ocean_mask` tolerates missing `.exp` (Overpass 502 fallback = blanket `z<1→-5`). Ocean cells go to z=−5 everywhere (single sentinel), land floored at 0.1 m. **Straddling-triangle filter** in `site.js`: any triangle mixing an ocean-sentinel vert (z ≤ -2.5) with a land vert is dropped. Residual OSM river-mouth artifacts at outer scale produce a few inland blue specks ~20 km inland near Dana Point — tolerated.

Next step: rerun Mar del Plata when Overpass is up for a real ocean mask (currently blanket `z<1` fallback); multi-tile HAG mosaicing; delete orphaned `hermosa_closeup.*` / `tesg.*` / old `*_farfield_img.webp` from `public/data/`; QR codes; landing-page disclaimer link — see TODO.md.

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
