# Findings

Known gaps, and places where the docs and the code disagree. Each item was checked in the code.

## Open gaps

1. **The Mermaid test uses a package that is not declared.** `test/test-mermaid.js` requires `dompurify`. `package.json` does not list it. It works only because `mermaid` pulls it in. Fix: add `dompurify` to `devDependencies`.
2. **Skipped checks count as passed.** `test/test-mermaid.js` and `test/test-lint.js` print a skip line and exit 0 when their dev packages are missing. `test/run-all.js` reads exit 0 as PASS. So a machine without dev packages shows "all checks passed" with no Mermaid or lint check. Fix: print SKIP in `run-all.js`, or fail.
3. **The question-index rescue is off.** `Q_GATE` in `src/mk.js` is 9 and no caller passes `qGate`. The option is dead code until it is measured. Remove it, or keep it documented as off.
