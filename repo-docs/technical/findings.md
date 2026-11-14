# Findings

Known gaps, and places where the docs and the code disagree. Each item was checked in the code (2026-11-14).

## Open gaps

1. **The Mermaid test uses a package that is not declared.** `test/test-mermaid.js` requires `dompurify`. `package.json` does not list it. It works only because `mermaid` pulls it in. Fix: add `dompurify` to `devDependencies`.
2. **Skipped checks count as passed.** `test/test-mermaid.js` and `test/test-lint.js` print a skip line and exit 0 when their dev packages are missing. `test/run-all.js` reads exit 0 as PASS. So a machine without dev packages shows "all checks passed" with no Mermaid or lint check. Fix: print SKIP in `run-all.js`, or fail.
3. **The question-index rescue is off.** `Q_GATE` in `src/mk.js` is 9 and no caller passes `qGate`. The option is dead code until it is measured. Remove it, or keep it documented as off.
4. **The pin file expires after 7 days.** `dedupe()` `save()` in `src/brain.js` deletes every file in `seen/` older than 7 days by its last write. A pin is written once, so it ends 7 days after it was set, not with the session. Fix: skip `*.pin` in that cleanup, or refresh the pin file's time on each prompt.
5. **A pin for a removed set still shows the 📌 line.** `searchAll()` ignores a pin whose set is gone from `projects.json`, but `withPin()` in `src/brain.js` still shows the line. Fix: check the set name in `withPin()`.
6. **The pin reply has no 📌 line.** `pinNote()` output goes out as it is. Every other user note gets the line. Fix: pass the reply through `withPin()`.
7. **`gabriel use auto` says "cleared" with no session id.** `pinNote()` returns the cleared text before it checks the session id. Fix: check the id first.
8. **The chain setting rests on 12 questions.** The `chain` defaults ([R34](../business/02-business-rules.md#r34-two-links-away-code-names)) were chosen on 12 private questions, so one question is about 8 points. Add more cases before tuning again.
