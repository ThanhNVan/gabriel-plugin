---
name: retrain
description: "Retrain gabriel's ranking weights for one doc set or for all. Usage: /gabriel:retrain [name]"
disable-model-invocation: true
argument-hint: "[name: doc set; none = default set] [--force: keep the new weights even if the score falls]"
---

Before step 1, read `${CLAUDE_PLUGIN_ROOT}/docs/AGENT-GUIDE.md`: the rules, the finish checklist, and the known errors with their fixes.

Run this command with the argument the user gave, if any:

```
node "${CLAUDE_PLUGIN_ROOT}/src/retrain.js" $ARGUMENTS
```

Report the before and after scores. Then say whether the new weights were kept. No name means the default doc set. The new weights are kept only if the strict score does not fall, unless `--force` is set. The old file is saved as `rank.prev.json`: say so, and warn when the strict score fell.
