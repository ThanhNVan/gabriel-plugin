---
name: setup
description: Install or repair gabriel: packages, model, data folder, maps. Run after install or update.
disable-model-invocation: true
---

Run this command and wait for it to finish:

```
node "${CLAUDE_PLUGIN_ROOT}/src/setup.js" $ARGUMENTS
```

Flags:

- `--dry-run`: show what would change, change nothing.
- `--skip-model`: do not download the meaning model.
- `--skip-test`: do not run the self-tests.
- `--yes`: setup copies old data from `~/.claude/brain` (step 6). Add-docs also accepts a very large folder (over 20000 files or 500 MB).
- `--tune`: install the optional Python packages for the tune run (see `docs/TUNING.md`). It only does this step: it finds Python 3.10 or newer, makes the venv in the data folder, installs torch (CPU) and the tune packages, and prints the install size. A normal setup never does this. Works with `--dry-run`.

Report the summary lines the command prints. Keep them as they are.
