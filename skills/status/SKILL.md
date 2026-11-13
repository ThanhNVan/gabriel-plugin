---
name: status
description: Show whether each gabriel doc set has a current map.
disable-model-invocation: true
---

Run this command:

```
node "${CLAUDE_PLUGIN_ROOT}/src/brain.js" mk-status all
```

Report one line per doc set, with its name and its state (map built, stale, or no map).
