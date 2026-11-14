---
name: tune-embeddings
description: Optional. Fine-tune gabriel's meaning model on your own eval questions, score the copy, keep it only if it wins. Usage: /gabriel:tune-embeddings --venv <dir> [--yes] or --rollback
disable-model-invocation: true
argument-hint: [--venv <dir: tune venv, default <data>/tune-venv>] [--yes: start without the prompt] | --rollback: back to the default model
---

Run this command with the arguments the user gave:

```
node "${CLAUDE_PLUGIN_ROOT}/src/tune/tune.js" $ARGUMENTS
```

Report the before and after table. Say whether the tuned model was kept or rolled back, and which numbers fell.
If it stopped, report the step and the message. Real data is unchanged after a stop.
