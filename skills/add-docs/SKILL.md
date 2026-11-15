---
name: add-docs
description: Add a doc set to gabriel. Usage: /gabriel:add-docs <name> <folder>
disable-model-invocation: true
argument-hint: <name: doc set name> <folder: docs path> [--code <repo with graphify-out/graph.json>] [--copy: copy into data folder] [--yes: allow huge folder] [--relink: change only the code graph of an existing set]
---

Before step 1, read `${CLAUDE_PLUGIN_ROOT}/docs/AGENT-GUIDE.md`: the rules, the finish checklist, and the known errors with their fixes.

If the user gave no `--code`, ask once before you run anything: "Is there a code repo for these docs? Give its folder, or say no."

- If they give a folder: check that `<folder>\graphify-out\graph.json` exists. If it does, add `--code <folder>` to the command. If it does not, offer `/graphify <folder>` first, and wait.
- If they say no: run the command without `--code`.

Run this command with the arguments the user gave (`<name> <folder>`, plus `--code <folder>` when set):

```
node "${CLAUDE_PLUGIN_ROOT}/src/setup.js" add-docs $ARGUMENTS
```

Report the result lines the command prints.

To change only the code repo of a doc set that already exists, use `--relink`: `node "${CLAUDE_PLUGIN_ROOT}/src/setup.js" add-docs <name> --code <repo> --relink`. It needs `<repo>\graphify-out\graph.json`, sets that set's graph, and rebuilds its map. The docs and the other settings stay the same.

Tip: a code repo gives better results with a graphify graph. Run `/graphify <repo>` first. It makes `graphify-out/graph.json` in that repo.
