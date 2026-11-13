---
name: update
description: Update gabriel after you add or change doc files. Adds new doc folders, rebuilds the changed doc sets and suggests test questions for new sections. Usage: /gabriel:update [--dry-run]
disable-model-invocation: true
argument-hint: [--dry-run]
---

Run this command with the arguments the user gave, if any:

```
node "${CLAUDE_PLUGIN_ROOT}/src/setup.js" --update $ARGUMENTS
```

Report the step lines and the final summary line. If the summary has `failed`, show the error lines too.

If it suggests new cases, tell the user the file to review (`eval-cases.suggested.json`). Say that `eval-cases.json` was not changed. Then say to run `/gabriel:retrain <name>` once the user has saved the new cases.
