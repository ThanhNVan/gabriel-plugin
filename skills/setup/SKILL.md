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
- `--yes`: answer yes to every question.

Report the summary lines the command prints. Keep them as they are.
