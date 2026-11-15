---
name: why
description: Say why gabriel showed no map for a prompt, one line per doc set.
argument-hint: "<prompt>"
disable-model-invocation: true
---

Run this command:

```
node "${CLAUDE_PLUGIN_ROOT}/src/brain.js" why "$ARGUMENTS"
```

Show the lines as they are. Do not change their words.

Then name the next step that each line gives:
- `shown`: a map was shown for this set. Confirm the answer in the code.
- `matched ..., not shown`: this set fits, but another set ranked higher, or the session gate hid it. To get this set's map, type `gabriel use <name>`.
- `no map, best match ... is under the gate`: the prompt is not close enough to this set. Ask a question that uses the words of the docs, or pick a set with `gabriel use <name>`.
- `no map, no word of this prompt is in these docs`: the docs do not use these words. Use the names of the code or the docs.
- `no map file yet`: run `/gabriel:setup`.
- `map format is old`: run `/gabriel:update`.
- `an error stopped the search`: set `GABRIEL_DEBUG=1`, try again, and read `debug.log`.
- `pinned:`: only the pinned set is searched. Type `gabriel use auto` to undo.
- `session gate:`: a weak match was hidden. Ask again inside the repo folder, or ask a clearer question.
- `gabriel skips this prompt`: the prompt is too short, a slash command or an automated prompt. Ask a full question.

Do not run any build or setup command without asking.
