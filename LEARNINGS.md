# Learnings

## Bugs and Fixes

| Symptom | Cause | Fix | Date |
|---------|-------|-----|------|
| `/start`, `/close`, `/debug` not found in Claude sessions | Claude Code uses bundled rg at `vendor/ripgrep/arm64-android/rg` which doesn't exist — Android platform not shipped | Set `CLAUDE_CODE_USE_NATIVE_FILE_SEARCH=1` in `~/.claude/settings.json` env | 2026-10-22 |
| Custom commands not recognized even with correct directory | Command `.md` files require YAML frontmatter (`description:` field) to be picked up | Added frontmatter to all command files | 2026-10-22 |
| `statusline-command.sh` produced empty output — statusline.txt always blank | `jq` is not installed in Termux by default; script failed silently on every call | Rewrote script to use `python3` (already installed) for JSON parsing | 2026-10-22 |

## Things That Didn't Work

- 2026-10-22: Claude Code `statusLine` config in `settings.json` outputs to Claude Code's own TUI — not to GNU screen's hardstatus. Don't conflate the two.

## Insights and Decisions

- 2026-10-22: Eric runs Samsung DeX on Android (Termux). No desktop browser tools (F12, Ctrl+U) available. Do not give those instructions.
- 2026-10-22: VESL (vesl.jpl.nasa.gov) is the reference site for visualization style. Stack not yet identified — need to view page source to find JS libraries.
- 2026-10-22: Claude Code on Android/Termux requires `CLAUDE_CODE_USE_NATIVE_FILE_SEARCH=1` for custom commands to load. This is set globally in `~/.claude/settings.json` and survives updates. Commands also need frontmatter with `description:` field.
- 2026-10-22: Global commands live in `~/.claude/commands/`. Project commands in `.claude/commands/`. Both need frontmatter. Global ones apply to all projects.
- 2026-10-22: GNU screen hardstatus/caption is the right place for session info on DeX. `~/.screenrc` uses `backtick` to poll `~/.claude/statusline.txt` (written by `~/.claude/statusline-command.sh` after each Claude response). Caption shows window tabs; hardstatus shows Claude stats.
- 2026-10-22: VESL tech stack confirmed via `curl` + grep: Three.js r94, litegl, d3, gl-matrix, proj4, no bundler, plain script tags. No Deck.gl, no Cesium.
- 2026-10-22: ISSM repo cloned to `~/issm`. Eric is the lead developer — this is his lifelong project. ISSM is the computational backbone of Seantinel.
- 2026-10-22: ISSM has two JS compilation targets: (1) Emscripten/WASM (`issm-binaries.js`) for browser use — this is what VESL loads; (2) native C++ for server/local computation. Both are needed.
- 2026-10-22: ISSM JS rendering pipeline: `processmesh(md)` → `scaleMesh` → `new Node(canvas, ...)` → `node.patch(Faces, Vertices)` → Three.js geometry. The `Node` class lives in VESL (not ISSM repo).
- 2026-10-22: DEM → mesh pipeline in ISSM JS: `InterpFromGridToMesh(xGrid, yGrid, dem, xMesh, yMesh)` → elevation at vertices; `bamg(md, field=elevation, err=tol)` → adaptive triangulation (finer where terrain changes fast).
- 2026-10-22: ISSM native build on Android: all Termux deps installed (openmpi, openblas, hdf5, netcdf-c, autoconf, automake, libtool, cmake, flang). No gfortran in Termux — use `flang` (LLVM Fortran, aarch64-android30). Need custom PETSc install script with `FC=flang`.
- 2026-10-22: ISSM Jenkins configs are the build reference. Closest targets: `mac-silicon-python` (aarch64) and `ross-debian_linux-python` (Linux). Standard external package order: autotools → cmake → petsc → triangle → shell2junit. PETSc script downloads its own MPICH, MUMPS, METIS, ScaLAPACK, BLAS/LAPACK.
- 2026-10-22: Seantinel rendering concept: fetch altimetry DEM → BAMG adaptive triangulation → drape satellite/street imagery as texture overlay → render sea level rise as rising water plane over realistic terrain. Scenes of specific coastal locations.
