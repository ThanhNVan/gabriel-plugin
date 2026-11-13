# Findings

Known gaps, and places where the docs and the code disagree. Each item was checked in the code.

## Open gaps

1. **The Mermaid test uses a package that is not declared.** `test/test-mermaid.js` requires `dompurify`. `package.json` does not list it. It works only because `mermaid` pulls it in. Fix: add `dompurify` to `devDependencies`.
2. **Skipped checks count as passed.** `test/test-mermaid.js` and `test/test-lint.js` print a skip line and exit 0 when their dev packages are missing. `test/run-all.js` reads exit 0 as PASS. So a machine without dev packages shows "all checks passed" with no Mermaid or lint check. Fix: print SKIP in `run-all.js`, or fail.
3. **The question-index rescue is off.** `Q_GATE` in `src/mk.js` is 9 and no caller passes `qGate`. The option is dead code until it is measured. Remove it, or keep it documented as off.

## Doc and code disagree

5. **Background rebuild covers only the default project.** `refreshMapInBackground()` in `src/brain.js` calls `mk.stale(home)` and spawns `build-mk` with no name. Both fall back to `defaultProject()`. So changed docs in any other doc set are not rebuilt until `/gabriel:update` or `build-mk <name>`. `docs/ADDING-DOCS.md` §2 and §9 and `docs/ARCHITECTURE.md` (Background rebuild) say changed docs rebuild in the background, with no such limit. Fix: check every project in the background, or say the limit in those docs.

4. **Rules matching leaves out the score floor.** `docs/ARCHITECTURE.md` (Rules graph, Matching) says a node needs 2 or more matching words. `wordScores` in `src/rules.js` also needs a score of at least `MIN_SCORE` (2.5). One exact term passes alone only when it is 8 or more characters, has a dash or dot, and has an idf of 3 or more. Fix: add both to the doc.
