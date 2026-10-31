---
description: Start a session — read project state and summarize status, bugs, and next actions
---

First, sync with the remote. The phone TO-DO app writes directly to GitHub master, so local may be behind:

1. `git fetch origin master`
2. If working tree is clean AND local is behind: `git pull --ff-only`. Report what came in.
3. If working tree is dirty OR local has diverged: do NOT pull. Report the state and stop; let the user resolve.

Then read CLAUDE.md, LEARNINGS.md, TODO.md, and the last 10 git commits (`git log --oneline -10`).

Then give a short summary:
- Where we are (current status, one sentence)
- Open bugs from LEARNINGS.md
- Top 3 next actions from TODO.md
