# TODO

Shipped work moved to [DONE.md](DONE.md). Pull in on demand.

## Next Up — Seantinel core

  replaced with ⌘ CMD → modal with ESC, `/start`, `/close`, `/clear`. CMD
  and SPEAK bumped to 34 px padding / 24–26 px bold. Back arrow + session
  label recolored bright green (24–32 px) for at-a-glance header reads.
  → Claude → Android TTS → next SPEAK cycle. Toggle 🔇/🔊 bell in the session
  topbar: on → bridge stuffs a one-shot kickoff instructing Claude to answer
  in ≤50 spoken words plain prose for the session. After each transcribe the
  WebView watches the hardcopy poll for 3 identical frames (~4.5s, gated by
  3s post-transcribe), skips busy-spinner frames, then POSTs `/speak` which
  extracts the last assistant turn from hardcopy (stops at `───` box borders,
  `❯` prompt, `⏵` hint, `Opus … ctx:` footer, `✻ Brewed for Ns` annotation,
  and tool-call `●/⏺ Name(...)` lines) and pipes it to `termux-tts-speak -s
  MUSIC`. SPEAK button cycles 🎤 SPEAK → ■ STOP → ⏳ TRANSCRIBING… with
  distinct colors. PAUSE moved to left, SPEAK to right and ~10% taller.
  Bridge endpoints added: `/speak`, `/speak/stop`, `/stuff`, `/resize`.
  the APK (at Termux's native 46 cols) used to need horizontal scroll in the
  WebView. `/resize` POST on attach runs `stty -F /proc/<claude_pid>/fd/0 cols
  38 rows 30` to resize claude's slave PTY directly — bypasses screen (whose
  `-X width` is a no-op while a display is attached). Kernel SIGWINCHes
  claude → TUI redraws narrow.

  `ggml-base.bin` multilingual; handles French-accented English OK but not
  great. Record ~30–60 min of dictated prompts + ground-truth transcripts,
  LoRA on whisper-small, train on Oracle ARM free-tier VM (no GPU needed).
  Swap point is `transcribe()` in `android-todo/bridge.py`.
  is already in place, waiting for the Termux:Boot app. RUN_COMMAND pathway
  needs Termux:API (already installed for mic). On first APK launch after
  reinstall, accept the Termux "allow external app" dialog.
  "bridge dead" from "no claude sessions" without tripping the full
  `/sessions` scan.
  flow; a manual REPEAT button would still be nice for replays without
  going through another SPEAK. SUMMARY = ask Claude in the active session
  to summarize the transcript, auto-speak the answer.
  on-device gives a natural voice at ~100 MB model cost. Swap in
  `speak_last_turn()` — replace `termux-tts-speak` with `piper` pipe to
  `aplay` or similar.
  same screen and triggers a redraw, the stty-forced 38 cols can snap
  back to the display's size. Current mitigation: close + reopen the
  session in the APK to re-fire `/resize`. Cleaner fix: detach the Termux
  terminal, or make `/resize` idempotent on every hardcopy poll (cheap).
  to bottom when the user was at the bottom. If the user scrolls up to read
  older output, don't jerk them back on the next poll (works today, but UX
  is jittery on long sessions — verify under load).
  Android 10+ foreground-exclusive-mic (not DeX routing). Fixed by moving
  capture into the APK itself (`MediaRecorder` behind
  `@JavascriptInterface AndroidRecorder`). Bridge `/transcribe` endpoint
  now accepts raw m4a bytes; old `/record/start|stop` kept for shell tests.
  Also: threaded the bridge (`ThreadingHTTPServer`) so whisper doesn't
  starve `/hardcopy` polls.
  Local preview lives at `index-v2.html` — centered "FIND YOUR CITY" card,
  right-column QR tile + "How to be involved", Guillermo's SEANTINEL wordmark
  up top, hand-sketch mockup as background placeholder. Decide: promote to
  `index.html` (and retire the current ocean-gradient version) once Guillermo
  signs off and delivers the real hill-with-us painting.
  image of "you and me on top of a hill seeing the sea in the horizon, you
  are pointing something." Current `public/mockup_bg.jpeg` is his hand-drawn
  sketch — fine as placeholder, needs the finished art.
  (THE PROJECT / ABOUT US / COLLECT US / PREVIOUS PROJECTS); interactive
  Earth replacing the city list (tap a place to open it); account / art-
  exchange flow ("like Pokémon GO" — collect magnets from real-world
  installations); sealine in the background connected to real sea-level
  (past / present / projected). Project-specific typography still TBD.
  Current build fell back to the blanket `z<1→-5` heuristic because
  `overpass-api.de` was returning 502. The resulting beach line is less
  precise than Hermosa/Redondo/Manhattan (which have real OSM `.exp` pairs).
  `python3 scripts/runme.py 4` — all caches hot, should finish in a minute.
  super-far still shows a few blue specks ~20 km inland near Dana Point /
  Mission Viejo because the OSM `natural=coastline` chain follows river
  upstream a few km. DP simplification helps but doesn't erase 15 km-deep
  lobes. Options if we care: (a) GSHHS or Natural Earth coarse polygon
  (pre-cleaned, no river-mouth tags); (b) stricter inland cutoff on the
  super-far part of the chain.
  `items[0]` from `3dep-lidar-hag` STAC search, which is one ~8×3 km tile.
  Hermosa gets 70% coverage, Redondo only 32% (rest default to 7 m). Fetch
  all overlapping items, build an in-memory mosaic keyed by UTM extent, then
  look up per-building height.
  still tracked: `hermosa_closeup.*`, `tesg.*`, and the old
  `*_farfield_img.webp` / `*_superfarfield_img.webp` for hermosa/manhattan/
  redondo (TESG uses `*_naip_mid.webp` / `*_naip_outer.webp`). Mar del Plata
  still uses the old farfield file — leave those alone.
  502s wasted 3 Manhattan rebuilds last session. See LEARNINGS "Flaky
  upstream services".
  Beach Pier done — 29 photos in `data/manhattan_pier/photos/`, gitignored).
  Data & credits modals, but landing page still shows the raw author line
  only — add the same two pills (or at least a disclaimer link in the
  footer) so visitors see the legal disclosure before entering a viewer.
  ~13 MB because `hydrateBinary` reconstructs `buildings` as array of
  `{ring: [[x,y],...], h}` objects. Rewrite `buildBuildings()` to iterate
  `rings` / `ring_offsets` / `heights` typed arrays directly — cuts steady
  memory to ~3 MB. Not blocking; do when memory shows up as a problem on
  low-end phones.
  4000² base — base is now ~1.25 m/px, but a sharper pier-area tile would
  still help.
  as float garbage. Would unlock higher-res DEMs. Likely rasterio solves it.
  lat/lon entries in `SITES` in `scripts/runme.py` (remember `elev_max` and
  `"buildings": True`).

- Implemented straight to JPL email in my to do lists
- **CMD menu + driving-friendly footer shipped 2026-11-06.** PAUSE button
- **Assistant app voice-chat loop shipped 2026-11-06.** Full SPEAK → whisper
- **Existing-session TTY resize shipped 2026-11-06.** Sessions born outside
- **Fine-tune whisper on Eric's voice (Phase 2).** v0 uses generic
- **Install Termux:Boot + Termux:API from F-Droid.** `~/.termux/boot/start-bridge`
- **`/ping` watchdog endpoint on the bridge.** So the WebView can distinguish
- **SUMMARY tile.** REPEAT shipped as part of the voice-chat auto-speak
- **Piper for a nicer TTS voice.** Android TTS is the robot default. Piper
- **TTS resize recovery.** If the Termux terminal is attached to the
- **Scroll-position lock in transcript.** Current logic always auto-scrolls
- **~~Mic routing when DeX disconnects~~. DONE 2026-11-05.** Root cause was
- **Landing page redesign review (Guillermo brief, `web design.docx`).**
- **Real background painting from Guillermo.** The brief calls for a fixed
- **Deferred V2 features (Guillermo brief).** Not built yet: top nav
- **Rerun Mar del Plata when Overpass is up** for a proper coastline mask.
- **Residual OSM river-mouth false-ocean cells at super-far.** Hermosa
- **Multi-tile HAG mosaicing for 5 km+ boxes.** Current pipeline grabs
- **Delete orphaned public/data assets.** Retired by the TESG promotion but
- Retry wrapper for Overpass + USGS 3DEP (2^n backoff, 3 tries) — transient
- Take pictures of Long Beach, Torrance, Redondo and Hermosa Beach (Manhattan
- Generate QR codes for existing sites (`site.html?loc=hermosa` / `?loc=redondo` / `?loc=manhattan` / `?loc=mardelplata`). URL shape is already settled on slug.
- **Landing page disclaimer link.** Viewer pages now have the ⚠ Disclaimer /
- **Flat-array `buildBuildings()`.** Steady memory for the viewer is still
- Layer a 1 m/px inner NAIP tile (±500 m around center) over the current
- Investigate 3DEP ExportImage TIFF corruption at ≥2000×2000 — PIL reads it
- Add more coastal sites (Long Beach, Torrance, Palos Verdes) — just needs

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
