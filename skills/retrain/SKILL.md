---
name: retrain
description: Retrain gabriel's ranking weights for one doc set or for all. Usage: /gabriel:retrain [name]
disable-model-invocation: true
argument-hint: [name: doc set; none = default set, always replace weights]
---

Run this command with the argument the user gave, if any:

```
node "${CLAUDE_PLUGIN_ROOT}/src/retrain.js" $ARGUMENTS
```

Report the before and after scores. Then say whether the new weights were kept. With no name, they always replace the old ones (saved as `rank.prev.json`): say so, and warn when the strict score fell.
