---
name: status
description: Show whether each gabriel doc set has a current map.
disable-model-invocation: true
---

Run this command:

```
node "${CLAUDE_PLUGIN_ROOT}/src/brain.js" mk-status all
```

Report one block per doc set, with its name and its state (map built, stale, or no map).
If a block shows `GRAPH MISSING`, say the code graph file is missing. If the graph moved, its `fix:` line relinks it; if it was never made, suggest `/graphify <repo>` first.
Show each `fix:` line as the next step for that set. Do not run it without asking.
