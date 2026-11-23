---
description: Show the gabriel map for a question, on demand
argument-hint: "<question>"
allowed-tools: Bash(node:*)
---

Run this command. Show its output as it is. Do not change the words.

```
node "<path-to>/gabriel-plugin/src/brain.js" context "$ARGUMENTS"
```

Then treat the map as a lead, not as proof:
- Name the doc or file that the map gives.
- Confirm the claim in the code before you answer.

If the output is empty, run `/gabriel:why "$ARGUMENTS"` and show its lines.
