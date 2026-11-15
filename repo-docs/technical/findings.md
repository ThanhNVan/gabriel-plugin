# Findings

Known gaps, and places where the docs and the code disagree. Checked in the code on 2026-11-15: items 1 to 3 and 6 were read again and still hold. Items 4 and 5 were not run again.

## Open gaps

1. **The Mermaid test uses a package that is not declared.** `test/test-mermaid.js` requires `dompurify`. `package.json` does not list it. It works only because `mermaid` pulls it in. Fix: add `dompurify` to `devDependencies`.
2. **With 2 or more pins, the session gate checks only the top set.** `searchAll()` in `src/mk.js` drops the top set when the gate hides it. The next set becomes the top and is not gated, even if it also has `sessionGate`. Fix: run the gate in a loop while the top set is gated.
3. **`brain.js context` does not read pin commands.** `contextText()` in `src/brain.js` has no `parsePin()` check, so `gabriel use a b` is searched as a question there. A pin set in a Claude session still applies through `mapFor()`. Fix: decide if hosts without a hook need pin commands.
4. **The chain setting rests on 12 questions.** The `chain` defaults ([R34](../business/02-business-rules.md#r34-two-links-away-code-names)) were chosen on 12 private questions, so one question is about 8 points. Add more cases before tuning again.
5. **The map often does not show the asked function.** In the exact eval, most misses say `no code line for <fn>`. Then no line can be checked. The strict scores were 5/15 (gabriel-dev) and 3/20 (Makillez). Fix: not planned yet. Look at how `search()` picks code names.
6. **A very slow disk can leave lines unchecked.** `exactLines()` stops at 5 s (`BUDGET_MS` in `src/repo.js`). Items not reached keep the graph's line, with no mark. The old 450 ms limit was hit once on a cold run (458 ms). Fix: none needed unless it shows again.
7. **gabriel-dev questions route to gabriel when nothing is pinned.** Both sets use the same code graph. In the private baseline (2026-11-15, meaning model on), only about 1 in 4 gabriel-dev questions picks gabriel-dev, though its own map holds the right doc for about 95%. Fix: not planned yet. Try a `cwdHints` or prior change, then compare with `node private/tests/baseline.js --compare`.
