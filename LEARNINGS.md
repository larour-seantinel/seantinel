# Learnings

Live notes. Shipped ISSM native-stack / APK / 3D rendering details live in
[LEARNINGS-archive.md](LEARNINGS-archive.md) — pull in on demand.

## Open bugs

| Symptom | Cause | Status | Date |
|---------|-------|--------|------|
| `from netCDF4 import Dataset` fails: `cannot locate symbol H5get_libversion` | Termux's `_netCDF4.cpython-313.so` references HDF5 symbols but has no `libhdf5.so` in `DT_NEEDED` (packaging bug) | **Parked.** `LD_PRELOAD=libhdf5.so` works for the import but breaks subprocess exec. Options: `patchelf --add-needed libhdf5.so` on the wrapper, or lazy-import in `loadmodel.py` | 2026-10-23 |
| `adb pair <ip>:<port>` on Samsung One UI fails with `protocol fault / Connection refused` | Samsung's wireless-debugging pairing listener refuses connections from the same device (likely Knox rule). The long-lived adbd port is reachable after granting "Nearby devices" permission to Termux, but pairing itself is blocked. Not fixed by newer adb (37.0.0p1), fresh keys, or loopback | **Parked.** No on-device pairing possible. Use manual Downloads tap-install, or pair from an external device once and copy `~/.android/adbkey*` into Termux | 2026-10-26 |
| ISSM Restart tests 125/126/129 fail at np=4 — velocities blow up to ~1e4 while TotalSmb/Volume3 OK | Likely restart I/O or MPI-ordering issue; reproduces with runme.py | **Parked.** Not blocking Seantinel; investigate when ISSM native-stack regression testing matters | 2026-10-28 |

## Claude Code / Termux environment

- 2026-10-22: `/start`, `/close`, `/debug` custom commands require `CLAUDE_CODE_USE_NATIVE_FILE_SEARCH=1` in `~/.claude/settings.json` because Claude Code's bundled ripgrep (`vendor/ripgrep/arm64-android/rg`) doesn't exist on Android. Command `.md` files also need YAML frontmatter with a `description:` field or they won't be picked up.
- 2026-10-22: `statusline-command.sh` must use `python3` (already installed) for JSON parsing, not `jq` (not installed by default on Termux). Silent failure if you use `jq`.
- 2026-10-22: Eric runs Samsung DeX on Android (Termux). No desktop browser tools (F12, Ctrl+U). GNU screen hardstatus/caption is the right place for session info on DeX.
- 2026-10-22: Global commands live in `~/.claude/commands/`. Project commands in `.claude/commands/`. Both need frontmatter with `description:`.

## ISSM / VESL references

- 2026-10-22: VESL (vesl.jpl.nasa.gov) is the reference site for visualization style. Tech stack confirmed via `curl` + grep: Three.js r94, litegl, d3, gl-matrix, proj4, no bundler, plain script tags. No Deck.gl, no Cesium.
- 2026-10-22: ISSM repo cloned to `~/issm`. Eric is the lead developer.
- 2026-10-22: ISSM has two JS compilation targets: (1) Emscripten/WASM (`issm-binaries.js`) for browser use — this is what VESL loads for sea-level pages; (2) native C++ for server/local computation. Both are needed.
- 2026-10-22: ISSM JS rendering pipeline: `processmesh(md)` → `scaleMesh` → `new Node(canvas, ...)` → `node.patch(Faces, Vertices)` → Three.js geometry. The `Node` class lives in VESL (not ISSM repo).
- 2026-10-22: DEM → mesh pipeline in ISSM JS: `InterpFromGridToMesh(xGrid, yGrid, dem, xMesh, yMesh)` → elevation at vertices; `bamg(md, field=elevation, err=tol)` → adaptive triangulation (finer where terrain changes fast).
- 2026-10-22: Seantinel rendering concept: fetch altimetry DEM → BAMG adaptive triangulation → drape satellite/street imagery as texture overlay → render sea level rise as rising water plane over realistic terrain.
- 2026-10-28: VESL is actually two architectures. Sea-level pages run ISSM client-side via Emscripten `issm-binaries.js`; glacier/ice-sheet pages are static Three.js and POST to the JPL ISSM compute server. Our Android path replaces the server with native `issm.exe`.

## Website / deploy

- 2026-10-29: **Website live on Cloudflare Pages** at `seantinel.pages.dev`. Repo: `github.com/larour-seantinel/seantinel`. Autobuild on `git push` (Vite preset, `npm run build` → `dist/`). Free tier: unlimited bandwidth, HTTPS auto. Deploy cycle: edit → push → Cloudflare rebuilds → live in ~90 s.
- 2026-10-29: **`.gitignore` rule ordering gotcha.** A whitelist like `!public/data/*.png` placed *before* `*.png` is overridden by the later catch-all — later rules win in git. Put the whitelist *after* the broad ignore. Confirm with `git check-ignore -v <path>`.
- 2026-10-29: `gh auth login` sets up `gh` CLI auth but NOT git's own HTTPS credentials — `git push` then fails with `could not read Username`. Run `gh auth setup-git` once; registers gh as git's credential helper.
- 2026-10-29: `android-spike/assets/data/` is deliberately kept under git — overrode the parent `data/` ignore with `!android-spike/assets/data/`. Same mechanism used for `public/data/` on the website.

## Termux voice input & terminal

- 2026-10-29: Play Store Termux + voice input: **Termux:API is NOT on Play Store** — only F-Droid and GitHub Releases. Signing certs differ so you can't mix a Play Store Termux with an F-Droid Termux:API. Use **FUTO Voice Input** (Play Store, on-device model, works in any text field).
- 2026-10-29: GNU screen scrollback via touch on Termux: add `altscreen off` + `termcapinfo xterm* ti@:te@` to `~/.screenrc`. `altscreen off` stops screen from switching to the alt-screen buffer; `ti@:te@` strips smcup/rmcup so Termux's native scroll buffer catches everything. Requires a **fresh** screen session.

## On-device performance

- 2026-10-28: **ISSM 2D SSA transient bench, Samsung ARM64** (`scripts/bench_transient.py`). np=4 (mpiexec/hydra) has ~3 s mpiexec startup floor; np=1 wins below ~10k elements. At np=1: nelt=4067 → 1.80 s (interactive sweet spot). Rule: default np=1, target ≤5k elts for interactive. Full numbers in auto-memory `project_bench_phone.md`.

## Hardware / cloud

- 2026-10-31: **Dev phone CPU** — Samsung Galaxy S24 FE (SM-S721U), Exynos 2400 (s5e9945), 8 GB RAM. 10 cores ARMv9.2: 1× Cortex-X4 prime @ ~3.2 GHz + 5× Cortex-A720 mid + 4× Cortex-A520 little. SVE2, bf16, i8mm, SHA3. Burst matches AWS `c7g.2xlarge`; sustained closer to `c7g.xlarge`. The X4 alone is a Graviton-class core — explains why np=1 at 4k elts in 1.8 s feels snappy.
- 2026-10-31: **Cloudflare Pages ≠ compute.** Workers / Pages Functions free tier is 10 ms CPU + 128 MB RAM per request — unusable for ISSM. Containers are paid. Hosting pays for bandwidth, not FLOPs.
- 2026-10-31: **Oracle Cloud Always Free ARM** is the only real free compute: 4× Ampere Altra cores + 24 GB RAM, no 12-month cutoff. Home region is **sticky at signup** — pick a region with ARM-A1 availability (Querétaro, Hyderabad, São Paulo, Jerusalem). Cloudflare's CDN decouples VM region from user latency, so a far region only costs SSH latency.
- 2026-10-31: **Phone is the dev box.** Cloud not needed as persistent infra; rent `c7g.2xlarge` by the hour for one-off DEM/mesh preprocessing when RAM exceeds 8 GB. Output lands in Cloudflare, instance destroyed.

## Backup / recovery

- 2026-10-31: **CloudConfig repo** at `github.com/larour-seantinel/CloudConfig` (private) backs up `~/.claude/{commands, settings*.json, statusline*, plugins/*.json, projects/*/memory}` + `~/.bashrc`, `~/.screenrc`. `sync.sh` pulls live → repo; `restore.sh` writes repo → live. Marketplace cache + session history + telemetry deliberately excluded (regeneratable). `/close` now runs sync as step 6.
- 2026-10-31: **Seantinel repo scope check** — pushing to Cloudflare Pages ships the entire tracked tree to GitHub, not just the website. All of `android-spike/`, `CLAUDE.md`, `LEARNINGS*.md`, `TODO.md`, `.claude/commands/` are mirrored on `origin/master`. Only phone-local gaps were `Letter/` (docs → Google Drive), `~/.claude/` (now CloudConfig), and gitignored build artifacts (rebuildable).

## ISSM Python on-device

- 2026-10-31: **ISSM Python wrappers need `libtriangle.so` on `LD_LIBRARY_PATH`** at dlopen time. Even `IssmConfig_python.so` pulls it. Fix: `runme.py` self-reexecs once with `LD_LIBRARY_PATH=$ISSM_DIR/externalpackages/triangle/install/lib:$ISSM_DIR/lib` injected via `os.execvp`, so plain `python3 runme.py` works without a shell wrapper.
- 2026-10-31: **Don't `import devpath`.** `devpath.py` imports `plotmodel` → `plot_manager` → `plot_gridded` → `InterpFromMeshToGrid` (needs `libtriangle.so`) → GDAL. Entire plotting chain breaks on Android. Sidestep: walk `$ISSM_DIR/src/m` yourself, skip the `plot/` dir, append any dir containing `.py` to `sys.path`. Then `bamg`, `model`, `InterpFromGridToMesh` import clean.
- 2026-10-31: **Verified on-device**: `bamg(model(), 'domain', exp, 'hmax', 20)` + `InterpFromGridToMesh(xg, yg, data, md.mesh.x, md.mesh.y, 0)` work. 1 km² at hmax=20 → 3019 verts initial; refine (hmax=100, hmin=4, err=0.5) ×3 → 755 verts.

## Geo on Termux

- 2026-10-31: **pyproj install needs native PROJ** (`pkg install proj` first). Not worth it for small jobs — inline WGS84→local-tangent math is fine for ≤10 km boxes: `m_per_deg_lon = 110540 * cos(lat0)`, `m_per_deg_lat = 110540`.
- 2026-10-31: **USGS 3DEP ImageServer** gives free CONUS 1m DEMs with no auth. URL: `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage`. Params: `bbox` (WGS84 or any SR), `bboxSR=4326`, `size=1000,1000`, `format=tiff`, `pixelType=F32`, `f=image`. Response is a plain GeoTIFF readable by PIL — since you set the bbox, you already know the geotransform.

## Dev viewer (local plot pipeline)

- 2026-10-31: **`/dev` viewer** at `dev.html` + `src/dev.js`. Reads `public/dev/index.json` for the snapshot list, renders selected snapshot (verts + 1-indexed elements + optional field) in Three.js. Auto-refresh checkbox polls index every 1.5 s and jumps to the newest.
- 2026-10-31: **`plot_web(md, name, field, field_name)`** writes `public/dev/<name>.json` + updates `index.json` (dedupe by name, sort by mtime). Keep both out of git (regenerable).
- 2026-10-31: **Vite multi-page**: add `rollupOptions.input = { main, dev }` so `vite build` ships both `index.html` and `dev.html`. Dev server auto-serves either without config.
- 2026-10-31: **Snapshot schema extended** with optional `center`, `focus_radius`, `imagery`, `bbox`. `center` sets OrbitControls target (lat/lon anchor at sea level, not DEM-bbox midpoint which floats mid-air). `focus_radius` sets initial camera distance via `camDist = focusR / tan(fov/2)` so the view frames the anchor, not the whole mesh. `imagery` + `bbox` enables planar top-down texture drape.
- 2026-10-31: **`camera.up` default is Y but our world is Z-up** (DEM z = elevation). Without `camera.up.set(0,0,1)` OrbitControls rolls the horizon when you drag — set up=Z and orbit stays around the vertical axis.
- 2026-10-31: **Cloudflare Pages 308-redirects `/dev.html` → `/dev`** (strips `.html`). `curl -s https://.../dev.html` returns empty body; must use `curl -sL` to follow. Not a build-propagation issue even if it looks like one.

## Satellite drape

- 2026-10-31: **USGS NAIPPlus 1m aerial** via same ArcGIS ExportImage pattern as 3DEP. URL: `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage`. Params: `bbox`, `bboxSR=4326`, `imageSR=4326`, `size=1024,1024`, `format=jpg`, `f=image`. CONUS-only, no auth, ~250 KB JPG.
- 2026-10-31: **`curl -o /tmp/foo` silently truncates to 0 bytes on Termux** (/tmp not writable for app) but still returns HTTP 200. Write to `~/` instead. Not a server/content issue.
- 2026-10-31: **Planar top-down drape**: `u = (x-xmin)/(xmax-xmin)`, `v = (y-ymin)/(ymax-ymin)`. Three.js `TextureLoader` default `flipY=true` so image top (north edge in NAIP) maps to V=1 which equals y=ymax — the orientation lines up without any extra flip.

## Site viewer (public page)

- 2026-10-31: **Site routing** = one `site.html` + `src/site.js` reads `?loc=<slug>` → fetches `/data/<slug>.json`. The JSON carries its own `title`, so the viewer is site-agnostic. Landing page `index.html` is just cards linking to `site.html?loc=…`. Natural shape for the future QR flow.
- 2026-10-31: **Three.js sky backdrop** — `scene.background = new THREE.CanvasTexture(c)` where `c` is a 2×512 vertical gradient (zenith → horizon). Three.js stretches a 2D texture as a screen-space quad, so a 1-pixel-wide canvas becomes the whole viewport.
- 2026-10-31: **Camera pitch lock for planar DEMs** — `camera.up.set(0,0,1)` + `controls.maxPolarAngle = (85*Math.PI)/180`. Below ~90° polar the camera dips under the mesh and the back face shows; 85° leaves a 5° safety margin.
- 2026-10-31: **Opaque water hides submerged terrain correctly** without any shoreline logic. Flat water plane at z=sealevel + default depthTest: wherever terrain z > plane z, terrain wins (dry); wherever terrain z < plane z, water wins (wet). No z-fighting since the two meshes only intersect along the shoreline curve (a 1-D set), not an area.
- 2026-10-31: **Locale → feet detection**: `new Intl.Locale(navigator.language).maximize().region ∈ ['US','LR','MM']`. `maximize()` fills in region from a base language (`en` → `en-Latn-US`). Reliable enough for sliders; don't rely on it for compliance.
- 2026-10-31: **Camera-facing text label**: canvas-drawn text → `THREE.CanvasTexture` → `THREE.SpriteMaterial({depthTest:false, transparent:true})` → `THREE.Sprite`. `depthTest:false` + `renderOrder: 10` keeps the label readable even when behind terrain. Scale is in world units.

## Multi-scale coastal viewer

- 2026-10-31: **BAMG graded mesh via `hVertices`**. Build an initial coarse mesh over the full domain (`bamg(model(), 'domain', exp, 'hmax', 150)`), compute per-vertex target size as `h_i = clamp(hmin, hmax, hmin + growth * max(r_i - fine_r, 0))`, then `bamg(md, 'hVertices', hv, 'hmin', hmin, 'hmax', hmax)`. One remesh pass. For 10 km × 10 km with fine_r=500, hmin=4, hmax=150 → ~30k verts, 60k elements, 3 MB JSON. ISSM Python wrappers accept `hVertices` the same way MATLAB does.
- 2026-10-31: **3DEP ExportImage TIFF corruption at 2000×2000**. PIL reads it as float garbage (max 4.8e33). 1000×1000 comes back uncompressed and is fine. Likely the server LZW-compresses larger F32 TIFFs and PIL mis-decodes. Workaround: cap size at 1000×1000 and let the pixel resolution degrade; interpolation onto the mesh is still smooth. Still TODO: try rasterio if we ever need higher res.
- 2026-10-31: **3DEP NoData sentinels slip through naive masks**. Off-coast pixels can come back as weird values that still fall in a loose `[-500, 5000]` range. Observed max=805 m near Palos Verdes where real max is ~460 m. Tighten to `[-200, 1200]` for coastal LA; even then a few sentinels survive. Not fatal for visualization but keep in mind for anything quantitative.
- 2026-10-31: **NAIP ExportImage scales fine**. `size=2048,2048` for 10 km × 10 km → ~5 m/px tile, ~900 KB JPG. One tile, one texture, drape works unchanged.

## Deploy observations

- 2026-10-31: **Cloudflare Pages build time** varies ~15–200 s. Most of this session's deploys were 16–19 s; one took 195 s. Not a progress-propagation issue, just build-queue load. Poll via `curl -sL` and `grep` for a known new string in the deployed JS or HTML.
- 2026-10-31: **`public/data/*.jpg` must be whitelisted in `.gitignore`** because `*.jpg` is caught by the global image ignore. `!public/data/*.jpg` goes *after* the broad ignore (gitignore order rule). `public/data/*.json` is unaffected.

## Buildings / DSM

- 2026-10-31: **3DEP ExportImage is bare-earth DTM, confirmed.** Hermosa 500 m box at 0.5 m/px: max gradient 0.88 m/px, zero pixels with >2 m/px jumps. Buildings would show 3–5 m single-pixel cliffs; there are none. Max elevation 22 m is the natural mesa ridge inland. Residential rooftops are stripped before the raster leaves the server. Need a DSM source (OSM/MS building footprints extruded, or an alternate 3DEP service) to render structures.
- 2026-10-31: **Per-site `hmin`/`hmax` override.** `_build_site` now reads `site.get("hmin", 4.0)` and `site.get("hmax", 150.0)` so close-up sites can push to hmin=2. `hermosa_closeup` uses hmin=2, hmax=30 → 4319 verts in a 500 m box, plenty for building footprints.

## Coastal scene data cleanup

- 2026-10-31: **3DEP returns small positive values (~0 – 1 m) for ocean floor sampling**, not 0 or NoData sentinel. So the beach-side `v <= 0 → ocean` filter leaves hundreds of near-shore vertices barely above the water plane, which render as thin dark strips (NAIP shows dark blue/green ocean texture at ~world z=2.5). Fix at pipeline: `topo[topo < 1] = -5` after `InterpFromGridToMesh`. Rule of thumb for the Hermosa/Redondo distribution: 621 vertices at 0 < z < 1 m vs 110 at 1 < z < 3 m — the ratio is the signature of 3DEP ocean noise vs real beach gradient.
- 2026-10-31: **Isolated conical "spikes" above the water plane aren't always NoData — can be real terrain at bbox edge rendered on a coarse mesh.** For Hermosa with half_m=5000, the south edge of the bbox clipped the north slope of the Palos Verdes peninsula (real 100 m terrain). BAMG at r=5000 m has hmax=150 m target size, so a single high-elevation vertex with ocean neighbors becomes a sharp pyramid. Lesson: inspect the actual field distribution (`np.percentile`, spatial coords of high-z verts) before adding more NoData clipping. The real fix was to shrink the bbox, not clip harder.
- 2026-10-31: **Shrinking half_m is a cheap resolution upgrade.** Dropped from 5000 m to 2500 m: NAIP tile is still 2048², so NAIP res doubles (5 m/px → 2.5 m/px); DEM is still 1000², so DEM res doubles (10 m/px → 5 m/px). No pixel-budget change, 2× sharper rendering, and the smaller bbox naturally avoids distant real-terrain spike artifacts.
- 2026-10-31: **3DEP NoData sentinels that pass a loose [-200, 1200] mask**. Observed max=312 m in Redondo bbox where real max within 2.5 km is ~50 m. Fix: per-site `elev_max` (set to 500 m for coastal LA). Replace bad pixels with -10 (not 0) so they sit cleanly below the water plane.
- 2026-10-31: **Water plane 5× wider than terrain** so its visible edge never shows in the viewport — avoids the "ocean ending in a square" artifact.
- 2026-10-31: **Tukey outer fence (q75 + 5·IQR) in site.js** sinks residual positive outliers to -5 m instead of clamping them to a ceiling (clamping leaves them as visible flat plateaus; sinking makes them disappear below water).
- 2026-10-31: **ArcGIS ExportImage caps at ~4000 px per side**. `size=4096,4096` returns a 400 JSON error: `"The requested image exceeds the size limit."`. `size=4000,4000` works. At 5 km × 5 km extent → ~1.25 m/px, essentially native NAIP resolution. Tile grows to ~4 MB JPG (vs 1 MB at 2048²), well within Cloudflare's free-tier bandwidth. Also: ArcGIS error responses are JSON (not an image), so the fetch pipeline needs a `content.startswith(b"{")` guard before writing to the cache file, else the error poisons subsequent runs.

## Buildings layer

- 2026-10-31: **Overpass API returns 406 to default `python-requests` UA.** Add any custom `User-Agent` header (e.g. `seantinel/0.1 (email)`) and it works. Doesn't need an API key. Query shape: `[out:json];(way["building"](south,west,north,east););out body;>;out skel qt;` to get buildings + their referenced nodes in one call. 206 polygons for a 500 m box in Hermosa.
- 2026-10-31: **ArcGIS ExportImage aspect-ratio trap.** If `size=WxH` is square but `bbox` is non-square in degrees, the server expands the smaller degree dimension so the bbox matches the pixel aspect. Observed: 500 m × 500 m bbox at lat 33.86° (0.00544° × 0.00452°) with `size=4000,4000` → returned extent 0.00544° × 0.00544°, i.e. ~51 m extra north and south. Terrain and NAIP both suffer; OSM polygons sit at true lat/lon → appear offset from the stretched NAIP. **Fix:** compute `w_px/h_px = (east-west)/(north-south)` and pass matching pixel size. Verify with `f=json` to see the returned `extent`. Hermosa close-up at `size=4000x3322` for DEM `1000x830`.
- 2026-10-31: **Microsoft Planetary Computer `3dep-lidar-hag` is the easiest free building-height source for CONUS.** 2 m HAG (height-above-ground) COG tiles, no PDAL / lidar point-cloud wrangling. Query via plain `requests` to `/api/stac/v1/search` (no `pystac-client` needed — `pydantic-core` won't build on Termux), then sign via `/api/sas/v1/sign`. 2016 LA tile covers Hermosa at ~5 MB.
- 2026-10-31: **Planetary Computer COGs are LERC-compressed.** PIL and plain `tifffile` can't decode (LERC = compression code 34887, needs `imagecodecs` which has no Termux wheel). Workaround: `pkg install gdal openexr`, then `gdal_translate -co COMPRESS=NONE in.tif out.tif` as a subprocess → PIL opens the uncompressed version. GDAL on Termux also needs `openexr` as a runtime dep (missing from `pkg install gdal` deps as of 3.12.4).
- 2026-10-31: **Per-building height from HAG raster.** For each OSM polygon: project vertices WGS84→UTM 11N (`pip install utm`, pure Python, no PROJ needed for 500 m boxes), bbox the polygon in pixel coords, generate a pixel grid with `np.mgrid`, use `matplotlib.path.Path.contains_points` for the mask, take 95th-percentile of HAG values > 0.5 m. Hermosa close-up: 205/206 buildings got real heights, median 8.6 m, max 23.4 m — consistent with 2-3 story residential + one small apartment.
- 2026-10-31: **Three.js `ExtrudeGeometry` default UVs are shape-local**, not planar top-down. Override them with `pos.getX/Y → (x-xmin)/xspan, (y-ymin)/yspan` so the NAIP texture drapes from the roof down. Rooftops render their real aerial pixels; walls show the column of texture at their (x,y) footprint — same trick that makes simple city viz readable without wall imagery.
- 2026-10-31: **Z exaggeration applies to terrain only, not buildings.** Terrain uses `z * Z_EXAG` (×5) to make coastal relief visible; buildings should extrude at true 1:1 (`depth: h`, not `h * Z_EXAG`) or multistory buildings look like skyscrapers. Base position still goes to `groundZ * Z_EXAG` (terrain-exaggerated world), only the extrusion depth stays real.
- 2026-10-31: **`MeshLambertMaterial` + HemisphereLight(1.2) renders very dark under Three.js physical lighting mode.** NAIP texture barely visible. Fix: `MeshBasicMaterial({map: tex})` — no lighting needed, textures render at native brightness. Loses face shading as a 3D cue, but the silhouette from the extrusion is enough depth signal.

## Things that didn't work

- 2026-10-22: Claude Code `statusLine` config in `settings.json` outputs to Claude Code's own TUI — not to GNU screen's hardstatus. Different mechanisms; don't conflate.
