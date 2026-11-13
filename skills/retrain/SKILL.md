---
name: retrain
description: Retrain gabriel's ranking weights for one doc set or for all. Usage: /gabriel:retrain [name]
disable-model-invocation: true
argument-hint: [name]
---

Run this command with the argument the user gave, if any:

```
node "${CLAUDE_PLUGIN_ROOT}/src/retrain.js" $ARGUMENTS
```

Report the before and after scores. Then say whether the new weights were kept.
