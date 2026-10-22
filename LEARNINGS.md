# Learnings

## Bugs and Fixes

| Symptom | Cause | Fix | Date |
|---------|-------|-----|------|
| `/start`, `/close`, `/debug` not found in Claude sessions | Claude Code uses bundled rg at `vendor/ripgrep/arm64-android/rg` which doesn't exist — Android platform not shipped | Set `CLAUDE_CODE_USE_NATIVE_FILE_SEARCH=1` in `~/.claude/settings.json` env | 2026-10-22 |
| Custom commands not recognized even with correct directory | Command `.md` files require YAML frontmatter (`description:` field) to be picked up | Added frontmatter to all command files | 2026-10-22 |

## Things That Didn't Work

- 2026-10-22: Claude Code `statusLine` config in `settings.json` outputs to Claude Code's own TUI — not to GNU screen's hardstatus. Don't conflate the two.

## Insights and Decisions

- 2026-10-22: Eric runs Samsung DeX on Android (Termux). No desktop browser tools (F12, Ctrl+U) available. Do not give those instructions.
- 2026-10-22: VESL (vesl.jpl.nasa.gov) is the reference site for visualization style. Stack not yet identified — need to view page source to find JS libraries.
- 2026-10-22: Claude Code on Android/Termux requires `CLAUDE_CODE_USE_NATIVE_FILE_SEARCH=1` for custom commands to load. This is set globally in `~/.claude/settings.json` and survives updates. Commands also need frontmatter with `description:` field.
- 2026-10-22: Global commands live in `~/.claude/commands/`. Project commands in `.claude/commands/`. Both need frontmatter. Global ones apply to all projects.
- 2026-10-22: GNU screen hardstatus/caption is the right place for session info on DeX. `~/.screenrc` uses `backtick` to poll `~/.claude/statusline.txt` (written by `~/.claude/statusline-command.sh` after each Claude response). Caption shows window tabs; hardstatus shows Claude stats.
