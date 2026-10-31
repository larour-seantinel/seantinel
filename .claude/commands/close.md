---
description: Close a session — update tracking files and commit
---

Review this session's work, then:

1. Append new bugs, fixes, and insights to LEARNINGS.md with today's date.
2. Update TODO.md: move finished items to Done, add newly discovered tasks.
3. Update "Current Status" in CLAUDE.md to reflect where the project stands now.
4. Stage and commit all tracked changes with a clear message describing what changed.
5. Report anything deliberately left out of the commit (large files, secrets, etc.).
6. Back up Claude Code config and dotfiles: `~/CloudConfig/sync.sh`, then in `~/CloudConfig` run `git add -A`, commit with a message like "sync YYYY-MM-DD", and `git push`. Skip if nothing changed.
