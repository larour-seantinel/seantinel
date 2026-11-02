# Learnings

Live notes. Shipped ISSM native-stack / APK / 3D rendering details live in
[LEARNINGS-archive.md](LEARNINGS-archive.md) — pull in on demand.

## Open bugs

| Symptom | Cause | Status | Date |
|---------|-------|--------|------|
| `from netCDF4 import Dataset` fails: `cannot locate symbol H5get_libversion` | Termux's `_netCDF4.cpython-313.so` references HDF5 symbols but has no `libhdf5.so` in `DT_NEEDED` (packaging bug) | **Parked.** `LD_PRELOAD=libhdf5.so` works for the import but breaks subprocess exec. Options: `patchelf --add-needed libhdf5.so` on the wrapper, or lazy-import in `loadmodel.py` | 2026-10-23 |
| `adb pair <ip>:<port>` on Samsung One UI fails with `protocol fault / Connection refused` | Samsung's wireless-debugging pairing listener refuses connections from the same device (likely Knox rule). The long-lived adbd port is reachable after granting "Nearby devices" permission to Termux, but pairing itself is blocked. Not fixed by newer adb (37.0.0p1), fresh keys, or loopback | **Parked.** No on-device pairing possible. Use manual Downloads tap-install, or pair from an external device once and copy `~/.android/adbkey*` into Termux | 2026-10-26 |
| ISSM Restart tests 125/126/129 fail at np=4 — velocities blow up to ~1e4 while TotalSmb/Volume3 OK | Likely restart I/O or MPI-ordering issue; reproduces with runme.py | **Parked.** Not blocking Seantinel; investigate when ISSM native-stack regression testing matters | 2026-10-28 |
| Visible blue "water bands" between inner mesh / far-field / super-far-field on Hermosa + Redondo | Hole-cut uses "any vertex strictly inside hole bbox" → straddling cells get culled → the next-outer kept cell's edge sits ~one cell-size past the inner-mesh edge. Gap ≈ 160 m at inner↔farfield seam, ≈ 170 m at farfield↔superfar seam. | **Fixed (ocean side).** Hole-cut now culls a cell only when it both overlaps the (shrunk) hole AND has at least one dry-land corner. Hole shrunk by one cell width, capped at `(holeWidth × 0.25)` to avoid the empty-hole trap. All-ocean straddling cells are kept; water plane hides them → ocean-side seam closed. Residual thin gap on inland side intentional. | 2026-10-31 |

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

## Buildings scaled to 5 km × 5 km

- 2026-10-31: **HAG p95 picks lidar artifacts.** `3dep-lidar-hag` raster for Hermosa has pixels up to 287 m (antennas, overhanging trees, bounce, birds). Over small polygons the 95th percentile grabs one of these → turned ~1.3% of residential houses into 60–250 m glass spires. **Fix:** clip pixel values to `[0.5, 40]` before stats and use median instead of p95. Median+cap gives Hermosa: median 6.6 m, max 39.4 m, 3 buildings > 25 m — realistic for the area.
- 2026-10-31: **HAG tile coverage ≈ 8 km × 3 km (Microsoft Planetary Computer 3dep-lidar-hag item).** The pipeline fetches `items[0]` only. For a 5 km × 5 km box this is partial: Hermosa 70% hit rate, Redondo 32% (same tile covers the north edge of Redondo but not most of it). Buildings outside coverage fall back to 7 m. Multi-tile mosaic needed to fully cover 5 km+ boxes.
- 2026-10-31: **20k separate `ExtrudeGeometry` + Mesh objects is a mobile killer.** Each polygon's `new THREE.ExtrudeGeometry(shape, opts)` adds ~1 ms of construction overhead. On a phone that stacks to ~20 s before first render. **Fix:** build one merged `BufferGeometry` manually — walls as per-edge quads (4 verts + 6 indices), roof as `THREE.ShapeUtils.triangulateShape(contour, [])` (earcut). One draw call. Load went from "takes a while" to feeling instant.
- 2026-10-31: **Ground-Z lookup per building was O(n_mesh_verts) nearest-neighbor.** 20k buildings × 5 ring verts × 10k mesh verts = 1 billion ops in JS. **Fix:** precompute a 128×128 regular grid of ground Z (max over verts falling in each cell), then per-building lookup at centroid is O(1).
- 2026-10-31: **JSON ring coord rounding to 0.1 m cuts payload ~57%.** Hermosa 12 MB → 5.1 MB; Redondo 11 MB → 4.7 MB. 10 cm precision is overkill for city-scale viz. Over Cloudflare gzip, down to ~1.5–2 MB on the wire.
- 2026-10-31: **Overpass over 5 km × 5 km dense residential returns ~20k polygons.** Hermosa 20,430 ways, Redondo 18,608. Raw OSM JSON is ~24 MB per site; after parse + trim it's manageable. Shoelace area filter at 20 m² only drops ~1.5% of polygons — OSM is already fairly clean.

## CSS / UI

- 2026-10-31: **Flex-column panel without fixed width reflows as its text content changes.** The sea-level slider's context label swings between "Today's sea level" (1 line) and "2100+ with ice-sheet loss" (2 lines); the panel grew/shrank in width as the user moved the slider. **Fix:** `width: 150px; box-sizing: border-box;` on `#water-panel`.
- 2026-11-01: **Vertical `<input type=range>` thumb geometry maps weirdly under `writing-mode: vertical-lr`.** With a vertical track, `width:` on `::-webkit-slider-thumb` becomes the dimension *along the track* and `height:` becomes the dimension *across* it. So a wide-horizontal thumb crossing a vertical bar is written `width: 24px; height: 12px` (not the other way around). `margin-left: -(thumbHeight - trackWidth) / 2` centers the thumb across the track. Observed on Chromium 141 and Firefox 134 — Firefox needs the same values duplicated under `::-moz-range-{track,thumb}`.

## Domain research

- 2026-10-31: **`seantinel.com` is squatted** (registered 2025-12-10 via Tucows, not in active use). Available shortlist for `seantinel.<tld>`: `.app` ($15), `.org` ($10), `.earth` ($70), `.io` ($35), `.ai` ($70–100), `.co` ($30), `.dev` ($15), plus most other newer TLDs. **Buy via Cloudflare Registrar at-cost** — already share the account with Pages, auto-wires DNS. Free WHOIS privacy, DNS, SSL, DDoS, CDN, and 200-address email forwarding bundled.
- 2026-10-31: **Termux has whois in `pkg install whois`.** For Google TLDs (`.app`, `.dev`, `.page`) that use HTTPS-only whois.nic.<tld> servers not resolvable from Termux, use `curl -sL https://www.rdap.net/domain/<name>.<tld>` — follows redirects to the right registry RDAP endpoint and returns JSON (`"ldhName"` → taken, `"errorCode": 404` → available).

## Multi-scale layer stacking (far-field + super-far-field)

- 2026-10-31: **Three-layer scene = inner BAMG mesh + far-field (10 km half) regular grid + super-far-field (200 km half) regular grid.** Each outer layer renders through its own low-res NAIP texture, sunk 1 m / 2 m under what covers it so inner always wins by depth test. Hermosa far-field adds ~200 KB JSON + 170 KB JPG; super-far adds ~100 KB JSON + 104 KB JPG. Total JSON per site ~5.4 MB.
- 2026-10-31: **USGS NAIPPlus ExportImage happily serves a 400 km × 400 km request** at `size=1024,1024` (~400 m/px) with no error. Esri `World_Imagery/MapServer/export` is wired as a defensive fallback in `_build_grid_layer` but hasn't been triggered yet. 3DEP ElevationServer handles the same extent (returns 3 MB TIFF at 1000×830).
- 2026-10-31: **Hole-cut artifact: blue water bands between layers.** The "cull if any vertex strictly inside the hole bbox" rule culls straddling cells, so the next-outer kept cell's edge sits one cell-width past the inner bbox. Visible gap ≈ 160 m at inner↔farfield seam, ≈ 170 m at farfield↔superfar seam. See Open bugs.
- 2026-10-31: **Shrink-the-hole fix is a trap.** `sxmin = ixmin + cellX` works for farfield (253 m cell, 5 km inner) but collapses when `cellX > (ixmax - ixmin)/2` — super-far cell is 6.8 km, inner half-width 2.5 km, so shrunken bbox is empty → "any inside" is always false → no cells culled → entire super-far draws over the inner scene (confirmed visually: whole upper screen washes out to coarse NAIP). Reverted.
- 2026-10-31: **Pipeline helper generalized.** `_build_grid_layer(site, cfg, key)` builds either farfield or superfarfield from `cfg = {half_m, grid_n, naip_px}`; filenames keyed by `slug_<key>_(dem|img)_h<half_m>.(tif|jpg)` for cache; published imagery lands at `public/data/<slug>_<key>_img.jpg`. Old `_farfield_naip.jpg` naming retired.

## Depth-buffer precision

- 2026-10-31: **`logarithmicDepthBuffer: true` + wide near/far ratio = severe z-fight at close zoom.** Scene spans ~400 km (super-far-field) but user can zoom to 20 m. With `near=1.5`, `far=4e7` (`maxDim * 100`), log depth has ~5 bits of spare precision across the whole range → ~1–3 m precision at the water/building interface. When sea-level slider is up and water is within a meter of roofs or terrain, GPU alternates between the two → horizontal stripey depth-contour bands across the whole screen. **Fix:** drop `logarithmicDepthBuffer` and use **linear depth with per-frame near/far** keyed to `camDist = distance(camera, controls.target)`: `near = max(camDist * 0.1, 1)`, `far = max(camDist * 50, 10000)`. At camDist=100: ratio=1000 → excellent precision; at camDist=4000: ratio=500. Trade-off: super-far-field (200 km) clips at close zooms, which is fine — at zoom-in the user isn't looking at the horizon anyway.
- 2026-10-31: **`polygonOffset: 1,1` on the water plane made z-fight WORSE, not better.** Hypothesis: polygonOffset interacts badly with `logarithmicDepthBuffer` (known Three.js edge case). Didn't retest after disabling log depth; the dynamic linear near/far fixed the symptom without needing offset.

## Camera / orbit controls

- 2026-10-31: **`OrbitControls.minDistance` and `.maxDistance` clamp zoom.** Without a max, the user zooms out until the super-far-field layer-seam gaps dominate the view (see layer stacking section). Hermosa / Redondo now cap at `maxDistance = 4000` (4 km from target) + `minDistance = 20` (don't let the camera penetrate a building). Pair with dynamic near/far for best depth precision.

## Buildings — wall rendering

- 2026-10-31: **"Transparent" building walls = OSM ring winding + back-face culling.** Buildings used `MeshBasicMaterial({map: naipTexture})` with default `side: FrontSide`. OSM `way["building"]` rings aren't guaranteed CCW from above; CW rings make the wall front face point INTO the building, back-face culling then hides the wall from any outside camera → roof visible, walls invisible → looks transparent. **Fix:** `side: THREE.DoubleSide` on the buildings mesh (terrain already was). Cheap because walls are a tiny fraction of the pixel budget.

## Non-CONUS data dispatch

- 2026-11-01: **Non-CONUS pipeline split**: `_fetch_dem` dispatches to `_fetch_dem_3dep` (USGS) inside the CONUS bbox (24–50°N, -125 to -66°W), otherwise `_fetch_dem_copernicus` (Microsoft Planetary Computer `cop-dem-glo-30`, 1°×1° tiles, LERC-compressed → `gdal_translate -projwin` to crop to local box). `_fetch_naip` similarly falls through to `_fetch_imagery_esri` (ArcGIS Online `World_Imagery/MapServer/export`). First non-US site **Mar del Plata** (`-37.97, -57.54`) ships end-to-end via this path. Buildings path (Overpass + height) works globally; only the HAG tile fetch skips (no Planetary-Computer 3DEP outside US). Mar del Plata buildings fall back to the 7 m default.
- 2026-11-01: **Esri `World_Imagery` is flaky but reaches 4000 px with retries.** 4096 and 3072 both return 504 Gateway Timeout from `services.arcgisonline.com` intermittently; 4000 works but can still 504 under load (one of five sites failed on first try, succeeded on retry). `_fetch_imagery_esri` now wraps the request in a `for attempt in range(3)` loop with 2^n backoff and caps `px` at 4000. At 5 km × 5 km → ~1.25 m/px, which matches old NAIP sharpness even though Esri's native SoCal source is Maxar 0.3 m.
- 2026-11-01: **Superfarfield skipped for non-CONUS.** 200 km × 200 km from Copernicus would need ~16 tiles stitched; not worth it for the one Argentine site. `_build_site` conditionally skips super-far layer if `_in_conus(center)` is False. Mar del Plata ships with 2-layer stack (inner + farfield).
- 2026-11-01: **Mar del Plata rendering issue (not a bug, a design limitation).** Center is literally on the beach at La Perla — half the inner tile is open Atlantic. DEM returns ~0 for ocean cells; `topo[topo < 1] = -5` sinks them below the water plane. Result looks fine *visually* (ocean is blue) but the system doesn't *know* which cells are water vs low-lying land, so it can't do anything smarter (e.g. preserve beach gradient, keep sand above water at SLR=0). The right fix is an optional per-site `ocean.exp` polygon (ISSM `expread`) that constrains ocean to the right half — TODO.

## NAIP vs Esri alignment

- 2026-11-01: **USGSNAIPPlus returns a ~5° north-south tilted image** vs the WGS84 bbox we request. Verified by overlaying OSM polygons (red) and FEMA USA_Structures polygons (yellow, via `services2.arcgis.com/FiaPA4ga0iQKduv3/.../USA_Structures_View`) on the Hermosa drape: both polygon sources agree with each other and sit on the actual buildings in Esri `World_Imagery`, but drift ~10 m east into the sand against the NAIPPlus tile. The server's `f=json` response correctly reports `extent` in EPSG:4326 matching our bbox, so the metadata is right but the pixel content is rotated — likely a sloppy reprojection in NAIPPlus's internal UTM→4326 pipeline. **Fix:** `_fetch_naip` in `scripts/runme.py` now always calls `_fetch_imagery_esri`. Esri reaches 4000 px (same as old NAIPPlus) via the retry wrapper, and SoCal tiles are Maxar 0.3 m native, so effective sharpness is at parity. Unified CONUS + non-CONUS pipeline as a bonus.
- 2026-11-01: **Diagnostic recipe worth remembering**: when polygon-vs-aerial alignment looks off, fetch an independent polygon source (FEMA USA_Structures via ArcGIS envelope query) and overlay. Two independent polygon sources agreeing is strong evidence the aerial is wrong, not the polygons.

## Flaky upstream services

- 2026-11-01: **Overpass API (`overpass-api.de/api/interpreter`) and USGS 3DEP ExportImage both throw transient 502s** on busy days. Not a client bug — direct `curl -sIL` on the exact failing URL returns 200 within seconds. Retry 1-3× before touching code. Suggested future fix: wrap `requests.get` in `_fetch_dem_3dep` / `_fetch_osm_buildings` with a small 429/502 retry loop (backoff 2^n up to 3 tries).

## Icon / assets

- 2026-11-01: **`scripts/make-icon.py` now also writes `public/icon.png`** (256 px, same Pillow render used for Android launcher). Needed a `.gitignore` whitelist line `!public/icon.png` because the global `*.png` catch-all would otherwise ignore it. Verify fresh additions with `git check-ignore -v <path>`.

## i18n (EN/ES)

- 2026-11-01: **Shared `src/i18n.js` module** holds `STRINGS = {en, es}`, `getLang()` (reads `localStorage['seantinel_lang']`, falls back to `navigator.language.slice(0,2)`), `t(key)`, `applyI18n(root)` (walks `[data-i18n]` and `[data-i18n-html]`), `mountLangToggle(container)` (adds a top-right EN/ES button that calls `setLang(other); location.reload()`). Reload-on-switch is dumb-simple and avoids re-wiring Three.js scene text (sprite label, scenario text). Both `index.html` and `site.html` import the module.
- 2026-11-01: **Which strings got translated**: landing (tagline, 2 intro paragraphs, "Choose a city", country labels, author credit, "Contact" label), viewer (slider title, "You are here" marker, scenario-for-depth text, loading/error/ready status, data credit). Fixed site names (Hermosa Beach, Redondo Beach, Mar del Plata, Manhattan Beach Pier) stay untranslated — they're proper nouns.
- 2026-11-01: **Chrome auto-translate caveat**: Chrome's "offer to translate" bar re-translates the whole page on top of whatever `t()` returns, which can double-translate or garble the UI. For debugging/screenshots, turn off at Settings → Languages → "Offer to translate…" or per-site "Never translate this site".

## Shortcuts (CLAUDE.md)

- 2026-11-01: **`op`** = open the just-built page on `localhost:5173`. **`ops`** = open the live production site `https://seantinel.org/`. **`SC` / `SCn`** = read the latest N screenshots from `~/storage/shared/DCIM/Screenshots/`. Documented in CLAUDE.md "Screenshot shortcuts" + "Open-page shortcut" sections — no need to re-explain each session.

## Pier photos

- 2026-11-01: **Manhattan Beach Pier high-res photo set.** 29 Samsung-camera JPGs taken on-pier (11:54–11:58 Nov 1), copied to `data/manhattan_pier/photos/` (~283 MB total, gitignored under `data/`). EXIF GPS clusters around (33.8838, -118.4133) matching the pier center we passed to `SITES`. Use PIL `_getexif()` + `GPSTAGS` to extract — fast enough to verify a whole batch in one pass. Framing guidance given to Eric: landscape, 4:3, ~1 m above deck, 30° overlap. Scope for a photogrammetry/texture-overlay feature is undefined — park under TODO Aspirational.

## Statusline

- 2026-11-01: **7-day limit reset countdown** in `~/.claude/statusline-command.sh`. Resets Tuesday 03:00 local. Python block computes `secs = (next_Tuesday_03:00 - now).total_seconds()`, splits into `days, hours = divmod(secs, 86400); hours = rem // 3600`. Format: `(Xd Yh)` or `(Yh)` under a day. Appends after `7d:${WEEK}%` as `7d:84% (1d 10h)`. If reset day/time changes, edit the `now.replace(hour=3, minute=0, …)` and `(1 - now.weekday()) % 7` (Tuesday=1).

## Binary site payload

- 2026-11-01: **Int16-quantized `.bin` sidecar** replaces per-site JSON text for hot numeric arrays. Hermosa: 5.37 MB JSON → 1.34 MB `.bin` + 1.5 KB JSON header = **4× smaller download**. Round-trip precision 5 cm at scale=0.1 (half a quantization step), well below 1 m aerial pixel size. Imagery JPGs unchanged — total payload per site 9.4 MB → 5.6 MB.
- 2026-11-01: **Why not Float16.** Half-precision has 10-bit mantissa → precision scales with magnitude. At the ±2500 m mesh edge, Float16 snaps to a ~2 m grid, visible against 1.25 m/px NAIP. Int16 with per-attribute `scale`+`offset` gives uniform ~7.6 cm precision across the full extent regardless of distance from origin (same scheme as glTF `KHR_mesh_quantization`). Same 2 bytes/value.
- 2026-11-01: **Scales chosen per use case.** Inner mesh XY and building rings: 0.1 m (int16 ±3276 m — safe for 2500 m half). Topo / farfield.z: 0.1 m. Farfield XY: 1.0 m (10 km extent). Super-farfield XY: 10.0 m (200 km extent). Building heights: 0.01 m uint16 (0–655 m). Elements: uint32 (0-indexed; convert from ISSM 1-indexed on the Python side).
- 2026-11-01: **Binary layout.** Pure concatenation of typed arrays with 4-byte padding between entries so `new TypedArray(buf, off, n)` is always byte-aligned. Header JSON lists each array as `{off, n, dtype, scale}` under `arrays.<name>`. One `fetch` for `.json`, one for `.bin` — `arrayBuffer()` → `new Int16Array(buf, off, n)` → multiply by scale into a `Float32Array`.
- 2026-11-01: **Backward-compat path kept** in `site.js`. If `snap.binary` is absent, `buildTerrain` falls back to the nested-array `s.elements[j][k] - 1` conversion. Lets JS deploy before all sites are rebuilt through the new pipeline.
- 2026-11-01: **Download is now bottlenecked by the main NAIP JPG** (3.8 MB at 4000² for Hermosa). WebP at same visual quality is typically 30–40% smaller → `~2.5 MB`. Combined with quality=80, could push total payload to ~3.5 MB per site, roughly halving load time on 3G/4G.
- 2026-11-01: **Memory impact is less than download impact.** Peak-during-load drops ~18 MB → ~3 MB (no 5.4 MB JSON string + nested-array parse graph). But steady-state is roughly unchanged (~13 MB vs 18 MB) because `hydrateBinary` reconstructs the `buildings` array as `{ring: [[x,y],...], h}` objects to match the old shape. Rewriting `buildBuildings()` to iterate flat typed arrays directly would cut steady-state to ~3 MB — not done yet, ~40-line patch.

## WebP imagery

- 2026-11-01: **`pkg install libwebp` on Termux gives `cwebp`** — Pillow's Termux build has WebP support disabled, so the simplest encoder path is `subprocess.run(["cwebp", "-q", "80", src, "-o", out, "-quiet"])`. Writing to `/tmp` fails silently on Termux (app sandbox); write anywhere under `~` instead.
- 2026-11-01: **4000² Esri JPG → WebP q=80 saves ~40%**. Hermosa main NAIP: 3.97 MB → 2.40 MB. Super-far 1024² thumbnails: 210 KB → 117 KB (44%). All five sites' main tiles 3.5–4.5 MB JPG → 2.1–2.9 MB WebP. Three.js `TextureLoader` uses the browser's native image decoder — WebP works unchanged in Chrome, Firefox, Safari ≥14.
- 2026-11-01: **Pipeline keeps cached JPG from Esri**, only converts for the public payload. `_publish_imagery(src_jpg, out_webp, quality=80)` shell-outs to `cwebp` at publish time; original JPG stays in `data/<Slug>/` for cache invalidation. Three call sites updated: main NAIP, farfield, superfarfield. `.gitignore` whitelists `!public/data/*.webp`.
- 2026-11-01: **Cloudflare serves `image/webp` content-type correctly** without any config — the extension is enough. `cf-cache-status: MISS` on first hit, then cached per-region.

## Viewer info panels

- 2026-11-01: **Dark-text credit over the ocean renders unreadable** — the `#credit` line sat at `left: 10px; bottom: 10px` with `color: #7a8a99` on top of a blue water plane. Hid under glare at low sun angles and against the opaque water material. Solution: tuck credits + author/contact into a `data-modal`, trigger from a small blue "Data & credits" pill in the lower-left.
- 2026-11-01: **Legal disclaimer pattern**: two-step disclosure. Short pill `⚠ Disclaimer` always visible → click opens full three-paragraph modal (not-a-projection / unmodeled processes / as-is + no-warranty + no-reliance). Standard enough for a public outreach site; the modal covers IPCC/NOAA/NASA non-endorsement, authors + employer + affiliated-institution liability shield, and third-party data pass-through (USGS 3DEP, Copernicus, OSM, MS PC, Esri).
- 2026-11-01: **Teaser pills in horizontal `#info-strip` flex row** at `bottom: 10px; left: 10px`. First attempt stacked them vertically with the orange teaser at `bottom: 42px`; the long "Illustrative only — not a projection" text wrapped on narrow (phone portrait) viewports and the second line slid behind the lower-right `#water-panel`. Shortening the teaser to `⚠ Disclaimer` + a flex-row container is a one-shot fix with no media queries. `white-space: nowrap` on each pill ensures no re-wrap.
- 2026-11-01: **Shared `.info-modal` / `.info-card` / `.info-close` classes** cover both modals; only the teaser pill colors differ (orange for warn, blue for info). Keeps the stylesheet short — ~40 lines for both. `wireModal(teaserId, modalId)` helper in `site.js` handles open/close/Esc/backdrop-click for both.
- 2026-11-01: **Vite dev server can silently die** mid-session (parent shell terminated or OOM); `curl` returns HTTP 000 and `pgrep -af vite` shows nothing. Just `npm run dev` again. Not a code bug; happens occasionally on Termux.

## Ocean mask from OSM coastline

- 2026-11-01: **Rule: polygon is truth.** Inside the ocean polygon → z = −5 m (flat, below any slider). Outside → DEM z kept, floored at 0.1 m. Slider rising only moves the water plane; it does NOT re-flag cells. Never intersect with a DEM threshold — if the polygon is wrong, fix the polygon.
- 2026-11-01: **OSM `natural=coastline` convention**: walking a way in its stored direction, land is on the LEFT and water is on the RIGHT. Consequences for closed chains in a y-up tangent plane:
  - CCW winding (positive shoelace area) → walker has interior on left → interior is LAND → it's an **island**.
  - CW winding (negative area) → interior on right → interior is WATER → it's a **lagoon / enclosed bay**.
  My first implementation had this backward (CCW→ocean, CW→land) and produced 437 "ocean" polygons at super-far scale that were actually Catalina + Channel Islands + every rock OSM has tagged. After the flip: 1 ocean polygon + 437 land polygons, as expected.
- 2026-11-01: **Ocean mask is per-layer, not per-site.** Each layer (inner h=2500, farfield h=10000, super-far h=200000) has its own `.exp` because the box size — and therefore how many OSM ways enter it — differs. Super-far gets 1167 ways; inner gets 6. Cache coastline fetch by `label=f"h{int(half_m)}"` to avoid re-hitting Overpass per layer.
- 2026-11-01: **Multi-ring `.exp` is one block per ring.** ISSM's `.exp` format uses `## Name:X\n## Icon:0\n# Points Count Value\nN 1.\n# X pos Y pos\n` + N lines per ring; multiple rings = repeat the header. `ContourToNodes` flags a node if inside **any** ring (OR, not XOR). So "land hole inside ocean" needs two separate `.exp` files: `ocean = ContourToNodes(ocean.exp) & ~ContourToNodes(land.exp)`.
- 2026-11-01: **`_walk_box` CW-branch wraparound bug.** Old code used `(int(t) - 1)` and `(t_in - 4) >= next_corner` as break conditions. When the exit was on the south edge (t_out ≈ 0.85) and entry on the west edge (t_in ≈ 3.31), CW should walk south→SW corner→entry (one corner). The old break check never fired across the t=0/t=4 wrap, so the walk added 3 extra corners (NW→NE→SE), closing the polygon through 60% of the box = land was labeled ocean. Fix: parameterize by arc length instead of raw t: `arc = (t_in − t_out) mod 4` in the walk direction; for each corner candidate `d = (corner_t − t_out) mod 4` (CCW) or `(t_out − corner_t) mod 4` (CW); include if `0 < d < arc`. Clean, no wraparound special-case.
- 2026-11-01: **Seed test for "which side is ocean" picks the wrong candidate near box corners.** When the chain exits the box ~0.15 units from a corner (south edge x=139 km inside a 200 km half-box), the right-of-tangent vector at the exit point can point nearly along the box edge → seed lands inside the wrong candidate polygon. Fix: compute the seed at the **mid-chain** point, well away from box edges — tangent there is a clean coast tangent and right-of-tangent clearly points offshore.
- 2026-11-01: **Multi-chain assembly.** OSM returns 1167 coastline ways for a 400 km SoCal box. `_chain_ways` joins by endpoint-matching (0.5 m tol) into ~439 chains: 1 open (main CA + Baja Pacific coast, 23676 pts) + 438 closed (islands + rocks). Process **all** chains, not just the longest: open chains → close via box walk (water on right); closed chains → classify by winding; subtract land polys from ocean polys. Catalina (3828 pts, area 1.9e8 m²) was the easy fix; dozens of rocks are correctly marked LAND too, so a vertex that happens to land on a sub-cell rock won't flash blue.
- 2026-11-01: **Polygon-only is still wrong at 400 km scale** if the open-chain closure skips inland regions. On the Hermosa super-far, cells along south-OC like (50800, −37240) = (33.53°N, −117.85°W) [≈ 20 km inland of San Clemente] still flag ocean because the main CA coast chain passes near (33.58, −117.85) and the point sits on the chain's right (ocean) side numerically, even though it's inland from the local coast heading. Partial fix: Douglas-Peucker simplification (tol=H/100 ≈ 2 km at super-far) collapses sub-cell wiggles. Doesn't eliminate 15 km-deep OSM river-mouth lobes — a few 6.7 km cells still show as inland blue specks and are the explicit visual cost of using OSM-only at super-far.
- 2026-11-01: **Far-layer rule change.** For farfield + super-far, ocean cells go to z=0 (not −5) and land cells keep DEM z as-is (so mountains show). Blanket "sink inside polygon, floor outside" is only used for the inner mesh where sea-level inundation matters. Rationale: slider only moves the water plane; blue appears wherever polygon says ocean + z ≤ slider.
- 2026-11-01: **Hierarchy mask (finest polygon wins).** `_apply_hierarchy_mask` takes an ordered list of (half_m, ocean_exp, land_exp) finest→coarsest. Each far-layer grid cell is classified by the first polygon whose bounding box contains it. The super-far polygon only decides for points outside the farfield extent; the farfield polygon only decides for points outside the inner extent. Cleans up small-scale noise in super-far cells that happen to fall inside the farfield box (where the finer orange polygon has a more accurate coastline). Doesn't help points beyond the outer-most finer layer's extent.
- 2026-11-01: **Layer-seam gap on changed hole-cut.** When ocean cells switched from z=−5 to z=0 for far layers, water plane still hid them but the hole-cut criterion `anyInHole && anyLand → drop` created a visible blue ring one super-far cell wide (~6.7 km) around the farfield extent. Fix: switch to `allInHole && anyLand → drop` so cells straddling the hole boundary are kept and the farfield just draws on top of them. No gap, no z-fight (sinkM handles layer stacking).

## Things that didn't work

- 2026-10-22: Claude Code `statusLine` config in `settings.json` outputs to Claude Code's own TUI — not to GNU screen's hardstatus. Different mechanisms; don't conflate.
- 2026-10-31: **Shrink the far-field hole by one cell** to close the water-band gap at layer seams. Works at the 253 m farfield scale, catastrophic at the 6.8 km super-farfield scale (empty hole → full overlay). See Multi-scale layer stacking.
- 2026-10-31: **`polygonOffset` on water material** to break the z-tie with building walls at the waterline. Pushed water the wrong direction in log depth buffer — terrain bled through water in long horizontal stripes. See Depth-buffer precision.
- 2026-10-31: **Fixed `near=0.5, far=50000` on linear depth** to replace dynamic near/far. Pushed speculatively without local test. 1:100000 ratio → severe z-fight flicker on all surfaces at prod. Reverted. Dynamic near/far keyed to camDist is still the right scheme for this scene; don't swap it for static values. Also: never push a render change without `npm run dev` + visual check first.
- 2026-10-31: **Misdiagnosed "transparent" walls as near-plane clipping** (hypothesized `camera.near = camDist * 0.1` was eating fronts of nearby buildings). Real cause was OSM ring winding + back-face culling. The near/far scheme was fine. Lesson: when a symptom could be either depth-buffer OR culling, test winding/`side: DoubleSide` first — it's a one-line change with no z-precision risk.
- 2026-11-01: **DEM-veto as a safety net for a wrong ocean polygon.** Added `ocean = polygon AND dem ≤ 2 m` to the mask when the super-far polygon was flagging LA/Long Beach as ocean. Eric caught it: the super-far 3DEP DEM is garbage anyway (float noise near zero everywhere — see TODO "Investigate 3DEP ExportImage TIFF corruption"), so the veto triggered or didn't based on noise, not reality. Rule reaffirmed: polygon is truth. If it's wrong, fix the polygon, don't paper over with DEM.
