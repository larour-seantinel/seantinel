# TODO

Shipped work moved to [DONE.md](DONE.md). Pull in on demand.

## Next Up — Seantinel core

- **Assistant app v0 shipped this session.** CLAUDE tile lists claude-running
  screen tabs, opens read-only polling transcript, SPEAK button records via
  `termux-microphone-record` → ffmpeg → whisper.cpp (base multilingual, 142 MB)
  → `screen -X stuff` with a trailing CR. Both blink + enter bugs fixed.
  Follow-ups listed below.

- **Fine-tune whisper on Eric's voice (Phase 2).** v0 uses generic
  `ggml-base.bin` multilingual; handles French-accented English OK but not
  great. Record ~30–60 min of dictated prompts + ground-truth transcripts,
  LoRA on whisper-small, train on Oracle ARM free-tier VM (no GPU needed).
  Swap point is `transcribe()` in `android-todo/bridge.py`.
- **Bridge autostart.** Today the bridge must be hand-started in Termux
  (`python3 ~/Seantinel/android-todo/bridge.py &`). Wrap in a Termux:Boot
  script so it survives reboot / Termux restart. Also add a watchdog
  endpoint `/ping` so the WebView can tell "bridge is dead" from "no claude
  sessions".
- **New-session / delete-session actions in the Assistant app.** v0 only
  attaches to existing tabs. Add: `NEW SESSION` button → spawn
  `screen -dmS claude-<slug> claude` in `~/Seantinel`. Row long-press →
  `DELETE SESSION` → `screen -S <sid> -X quit`.
- **SUMMARY + REPEAT tiles under SPEAK.** Reference app has a 3-tile row
  (SESSIONS done, SUMMARY + REPEAT TODO). REPEAT = pull last assistant
  turn from `hardcopy`, feed to `termux-tts-speak` (Piper later for a
  nicer voice). SUMMARY = ask Claude in the active session to summarize
  the transcript.
- **Scroll-position lock in transcript.** Current logic always auto-scrolls
  to bottom when the user was at the bottom. If the user scrolls up to read
  older output, don't jerk them back on the next poll (works today, but UX
  is jittery on long sessions — verify under load).
- **~~Mic routing when DeX disconnects~~. DONE 2026-11-05.** Root cause was
  Android 10+ foreground-exclusive-mic (not DeX routing). Fixed by moving
  capture into the APK itself (`MediaRecorder` behind
  `@JavascriptInterface AndroidRecorder`). Bridge `/transcribe` endpoint
  now accepts raw m4a bytes; old `/record/start|stop` kept for shell tests.
  Also: threaded the bridge (`ThreadingHTTPServer`) so whisper doesn't
  starve `/hardcopy` polls.
- **Landing page redesign review (Guillermo brief, `web design.docx`).**
  Local preview lives at `index-v2.html` — centered "FIND YOUR CITY" card,
  right-column QR tile + "How to be involved", Guillermo's SEANTINEL wordmark
  up top, hand-sketch mockup as background placeholder. Decide: promote to
  `index.html` (and retire the current ocean-gradient version) once Guillermo
  signs off and delivers the real hill-with-us painting.
- **Real background painting from Guillermo.** The brief calls for a fixed
  image of "you and me on top of a hill seeing the sea in the horizon, you
  are pointing something." Current `public/mockup_bg.jpeg` is his hand-drawn
  sketch — fine as placeholder, needs the finished art.
- **Deferred V2 features (Guillermo brief).** Not built yet: top nav
  (THE PROJECT / ABOUT US / COLLECT US / PREVIOUS PROJECTS); interactive
  Earth replacing the city list (tap a place to open it); account / art-
  exchange flow ("like Pokémon GO" — collect magnets from real-world
  installations); sealine in the background connected to real sea-level
  (past / present / projected). Project-specific typography still TBD.
- **Rerun Mar del Plata when Overpass is up** for a proper coastline mask.
  Current build fell back to the blanket `z<1→-5` heuristic because
  `overpass-api.de` was returning 502. The resulting beach line is less
  precise than Hermosa/Redondo/Manhattan (which have real OSM `.exp` pairs).
  `python3 scripts/runme.py 4` — all caches hot, should finish in a minute.
- **Residual OSM river-mouth false-ocean cells at super-far.** Hermosa
  super-far still shows a few blue specks ~20 km inland near Dana Point /
  Mission Viejo because the OSM `natural=coastline` chain follows river
  upstream a few km. DP simplification helps but doesn't erase 15 km-deep
  lobes. Options if we care: (a) GSHHS or Natural Earth coarse polygon
  (pre-cleaned, no river-mouth tags); (b) stricter inland cutoff on the
  super-far part of the chain.
- **Multi-tile HAG mosaicing for 5 km+ boxes.** Current pipeline grabs
  `items[0]` from `3dep-lidar-hag` STAC search, which is one ~8×3 km tile.
  Hermosa gets 70% coverage, Redondo only 32% (rest default to 7 m). Fetch
  all overlapping items, build an in-memory mosaic keyed by UTM extent, then
  look up per-building height.
- **Delete orphaned public/data assets.** Retired by the TESG promotion but
  still tracked: `hermosa_closeup.*`, `tesg.*`, and the old
  `*_farfield_img.webp` / `*_superfarfield_img.webp` for hermosa/manhattan/
  redondo (TESG uses `*_naip_mid.webp` / `*_naip_outer.webp`). Mar del Plata
  still uses the old farfield file — leave those alone.
- Retry wrapper for Overpass + USGS 3DEP (2^n backoff, 3 tries) — transient
  502s wasted 3 Manhattan rebuilds last session. See LEARNINGS "Flaky
  upstream services".
- Take pictures of Long Beach, Torrance, Redondo and Hermosa Beach (Manhattan
  Beach Pier done — 29 photos in `data/manhattan_pier/photos/`, gitignored).
- Generate QR codes for existing sites (`site.html?loc=hermosa` / `?loc=redondo` / `?loc=manhattan` / `?loc=mardelplata`). URL shape is already settled on slug.
- **Landing page disclaimer link.** Viewer pages now have the ⚠ Disclaimer /
  Data & credits modals, but landing page still shows the raw author line
  only — add the same two pills (or at least a disclaimer link in the
  footer) so visitors see the legal disclosure before entering a viewer.
- **Flat-array `buildBuildings()`.** Steady memory for the viewer is still
  ~13 MB because `hydrateBinary` reconstructs `buildings` as array of
  `{ring: [[x,y],...], h}` objects. Rewrite `buildBuildings()` to iterate
  `rings` / `ring_offsets` / `heights` typed arrays directly — cuts steady
  memory to ~3 MB. Not blocking; do when memory shows up as a problem on
  low-end phones.
- Layer a 1 m/px inner NAIP tile (±500 m around center) over the current
  4000² base — base is now ~1.25 m/px, but a sharper pier-area tile would
  still help.
- Investigate 3DEP ExportImage TIFF corruption at ≥2000×2000 — PIL reads it
  as float garbage. Would unlock higher-res DEMs. Likely rasterio solves it.
- Add more coastal sites (Long Beach, Torrance, Palos Verdes) — just needs
  lat/lon entries in `SITES` in `scripts/runme.py` (remember `elev_max` and
  `"buildings": True`).

## Nice to have

- Mesh JSON is 3 MB per site. If sites multiply, switch to a binary payload (positions as base64 Float32Array) or gzip-friendly packing.
- Fix `android-spike/build.sh` key-wipe bug the same way as `android-todo` (move signing keys to `.keys/` so `rm -rf build` doesn't change the APK cert).
- Expose np=1/np=4 bench finding in APK HUD: default np=1 for ≤10k elt meshes, auto-upgrade to np=4 only for larger.
- 3D flat-shading support in `processmesh3d.js`: need triangle→prism index map for per-element 3D fields.
- Clean fix for Termux netCDF4 missing `libhdf5` NEEDED: `patchelf --add-needed` on the wrapper, or lazy-import.
- Investigate ISSM Restart tests 125/126/129 (velocities blow up at np=4).
- Sign up Oracle Cloud Always Free (home region: Querétaro or Hyderabad for ARM-A1 availability) — 4-core / 24 GB ARM VM for NASA DEM preprocessing when needed.
- Move `Letter/*.docx` to Google Drive (currently phone-only, not in any repo).
- `pkg install proj` + `pip install pyproj` on Termux if we need proper geodetic transforms (UTM, EPSG) beyond local tangent plane.

## Aspirational

- Define scope for high-res pier-photo texture overlay (photogrammetry? planar drape?) — 29 Manhattan Pier photos already staged in `data/manhattan_pier/photos/`, EXIF GPS clustered around pier center.
- Time slider for year-based projections (2025–2100)
- Region selector / zoom to coastline
- Multiple scenario overlays (1.5°C, 2°C, 4°C)
- Animated inundation visualization
- Specific coastal location scenes (Miami, NYC, Jakarta)
