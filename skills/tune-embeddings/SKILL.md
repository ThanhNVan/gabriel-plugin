---
name: tune-embeddings
description: "Optional. Fine-tune gabriel's meaning model on your own eval questions, score the copy, keep it only if it wins. Usage: /gabriel:tune-embeddings --venv <dir> [--yes] or --rollback"
disable-model-invocation: true
argument-hint: "[--venv <dir: tune venv, default the first <data>/tune-venv* that sees a GPU, else <data>/tune-venv>] [--projects a,b: only these doc sets] [--yes: start without the prompt] [--force: keep the tuned model even if the keep rule fails] | --rollback: back to the default model"
---

Before step 1, read `${CLAUDE_PLUGIN_ROOT}/docs/AGENT-GUIDE.md`: the rules, the finish checklist, and the known errors with their fixes.

Run this command with the arguments the user gave:

```
node "${CLAUDE_PLUGIN_ROOT}/src/tune/tune.js" $ARGUMENTS
```

Report the before and after table. Say whether the tuned model was kept or rolled back, and which numbers fell.
If it stopped, report the step and the message. Real data is unchanged after a stop.
