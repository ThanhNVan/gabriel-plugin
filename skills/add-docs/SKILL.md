---
name: add-docs
description: Add a doc set to gabriel. Usage: /gabriel:add-docs <name> <folder>
disable-model-invocation: true
argument-hint: <name> <folder>
---

Run this command with the arguments the user gave (`<name> <folder>`):

```
node "${CLAUDE_PLUGIN_ROOT}/src/setup.js" add-docs $ARGUMENTS
```

Report the result lines the command prints.

Tip: a code repo gives better results with a graphify graph. Run `/graphify <repo>` first. It makes `graphify-out/graph.json` in that repo.
