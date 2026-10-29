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

## Things that didn't work

- 2026-10-22: Claude Code `statusLine` config in `settings.json` outputs to Claude Code's own TUI — not to GNU screen's hardstatus. Different mechanisms; don't conflate.
