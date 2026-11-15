# Findings

Known gaps, and places where the docs and the code disagree. Checked in the code at 9380b0f2 (2026-11-15): items 1, 3 to 7 and 10 to 12 were read again and still hold. Items 2, 8 and 9 were not run again.

## Open gaps

1. **The Mermaid test uses a package that is not declared.** `test/test-mermaid.js` requires `dompurify`. `package.json` does not list it. It works only because `mermaid` pulls it in. Fix: add `dompurify` to `devDependencies`.
2. **Skipped checks count as passed.** `test/test-mermaid.js` and `test/test-lint.js` print a skip line and exit 0 when their dev packages are missing. `test/run-all.js` reads exit 0 as PASS. So a machine without dev packages shows "all checks passed" with no Mermaid or lint check. Fix: print SKIP in `run-all.js`, or fail.
3. **The question-index rescue is off.** `Q_GATE` in `src/mk.js` is 9 and no caller passes `qGate`. The option is dead code until it is measured. Remove it, or keep it documented as off.
4. **The pin file expires after 7 days.** `dedupe()` `save()` in `src/brain.js` deletes every file in `seen/` older than 7 days by its last write. A pin is written once, so it ends 7 days after it was set, not with the session. Fix: skip `*.pin` in that cleanup, or refresh the pin file's time on each prompt.
5. **A pin for a removed set still shows the 📌 line.** `searchAll()` ignores a pin whose set is gone from `projects.json`, but `withPin()` in `src/brain.js` still shows the line. Fix: check the set name in `withPin()`.
6. **The pin reply has no 📌 line.** `pinNote()` output goes out as it is. Every other user note gets the line. Fix: pass the reply through `withPin()`.
7. **`gabriel use auto` says "cleared" with no session id.** `pinNote()` returns the cleared text before it checks the session id. Fix: check the id first.
8. **The chain setting rests on 12 questions.** The `chain` defaults ([R34](../business/02-business-rules.md#r34-two-links-away-code-names)) were chosen on 12 private questions, so one question is about 8 points. Add more cases before tuning again.
9. **The map often does not show the asked function.** In the exact eval, most misses say `no code line for <fn>`. Then no line can be checked. The strict scores were 5/15 (gabriel-dev) and 3/20 (Makillez). Fix: not planned yet. Look at how `search()` picks code names.
10. **`--repo` with `--code --relink` checks the old graph.** `relinkDocs()` in `src/setup.js` checks the folder against the set's current graph (`graphPathOf()`) before it links the new `--code` graph. A folder that fits only the new graph is refused. Fix: check against the new graph file.
11. **A cold first run can leave lines unchecked.** `exactLines()` stops at 450 ms (`BUDGET_MS` in `src/repo.js`). One cold run took 458 ms and left 3 items unchecked. Those keep the graph's line, with no mark. Fix: none yet. Add a disk cache if this happens often.
12. **A neighbour with no file prints `(external)`.** `exactLines()` sets `exact = false` for a neighbour with no `file`. `format()` still prints `(external)`, as it did before the layer. The text does not say "not found in repo". Fix: decide which text is right.
