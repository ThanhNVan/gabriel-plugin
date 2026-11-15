# Changelog

## Unreleased

## 0.3.0 (2026-11-15)

- README: a new "Quick start (5 minutes)" section, four steps from install to a first map. The setup warning now points to it.
- `search()` in `src/mk.js` runs ten helper steps in order. No behavior change.
- `mk-status all` shows each doc set as a short block: a header with its state (`ok`, `STALE`, `no map`, `GRAPH MISSING` or `REPO MISSING`), then its map, graph, repo and fix lines. A blank line separates the sets. The block code is in `src/statusview.js`.
- Each map note has at most one 💡 line. The setup hint or tip wins over the pin hint. `buildNote()` in `src/brain.js` builds the note.
- `/gabriel:why "<prompt>"` (`brain.js why`) says why no map was shown for a prompt, one line per doc set. It writes nothing. `skipReason()` gives the reason a short or automated prompt is skipped.
- Map build: edge keys use the node count, not a fixed base; no behavior change.
- `learn-reset [name]` clears the learned links of one doc set only. An unknown name prints `unknown doc set: <name>`, deletes nothing and exits with 1. `mk-status` counts learned links per doc set.
- Debug log: set `GABRIEL_DEBUG=1` to write each caught error to `<data>/debug.log`. Off by default. Prompt text is never written. The file starts again past 1 MB.
- `/gabriel:refresh-docs <doc set name>` uses the set's code folder and docs folder (from `projects.json`), asks for them if missing, and asks before retrain: skip, keep only if better, or replace anyway. `retrain --force` (`node src/retrain.js <name> --force`) keeps the new weights even when the strict score falls.
- Setup keeps the code repo clean: onboarding makes `<name>-code-docs/` next to the code, moves the graph into `graphify-out/` there, writes the docs in `docs/` and registers the set with `--code` and `--repo` by itself.
- A code name whose file moved inside the repo is found again and shows `(<file>:<line> ✓ moved)`; a set with a graph but no repo folder gets a `mk-status all` hint (`no repo (add-docs ...)`) and a tip.
- Exact code lines and doc lines. A doc line shows its section's heading line: `doc <file>:<line>` (Markdown, MDX and text files; other formats keep the old text). `add-docs <name> --repo <folder>` checks the code folder against the graph and saves it. Then each code name and `↔` neighbour shows its line in that folder on each prompt: `(<file>:<line> ✓)`, or `(<file>, not found in repo)`. Measured 2026-11-14: 6 of 6 doc lines match their headings. Graph line drift: 3.5% at the graph's own commit, 10.6% at 20 commits, 26.5% at 100 commits. Exact eval on `fn` cases: gabriel-dev 2/15 to 3/15, Makillez 3/20 to 3/20. Makillez gate 523/569 and quiet 30/31 unchanged; average block 2230 characters; average search 338 ms. Layer p95 was 62 ms in the timing run (one cold run hit the 450 ms cap). Kept on: no gain on a fresh graph, but it fixes lines as the graph ages, at no gate cost.

- Code graph path: a missing `graph` file now fails the build with `graph not found: <path>` and keeps the old map. `mk-status all` shows each graph path and `GRAPH MISSING`. `add-docs` asks for the code repo when `--code` is missing. The background check now rebuilds any stale doc set, not only the default one (skipping a set whose graph is missing).
- Skills show a short hint for each argument.
- The CLI modes live in one table (`MODES` in `src/brain.js`), and the usage line is built from it. Each mode runs as before. `touched-files`, `build-dq` and `mk-status all` now show in the usage line.
- Plainer words for the tips, the setup hint and the `gabriel use` replies. The 📌 pinned line now has a blank line before it. Not pinned, with 2 or more doc sets, each map note ends with a 💡 line that suggests `gabriel use <set>`.

- Pin one doc set per session: the prompt `gabriel use <set>` (a name or alias) makes this session's map search only that set; `gabriel use auto` undoes it; an unknown name lists the sets. While pinned, every gabriel note starts with `📌 pinned: <set>`. Three new tips explain it (`src/pin.js`, `searchAll` `opts.pin`).

- The map adds up to 3 code names two strong graph links from the top 4 code hits, marked `2 links away`, when they share the hit's name stem (a leading verb dropped). Per set, the `chain` setting in `projects.json` sets the counts (default seeds 4, max 3, stem 3). It finds the rest of a flow through a shared type (an event base class, say). On 12 Makillez questions: chain off 9/12, seeds 3 max 3 stem 3 10/12, seeds 4 max 3 stem 3 (the default) 11/12. Makillez main gate unchanged (strict 523/569, quiet 30/31); the block grows about 54 characters on average.

- Retrain rule changed: no name now means the default doc set under the same guard. The new weights are kept only when the strict count is not lower. `--force` keeps the new weights anyway. Whenever an existing rank file is replaced, the old one is saved as `rank.prev.json`.
- CI: `.github/workflows/test.yml` runs lint and tests on Windows and Ubuntu for each push to `master` and each pull request.

- New doc sets (`add-docs`, `/gabriel:update`) get `aliases: [<name>]`, so naming the set in a prompt routes to it. The map header now says "docs + code graph" instead of "technical-docs + code graph". When one alias sits inside a longer one ("gabriel" in "gabriel-dev"), only the longer one counts as named (`namedProjects()` in `src/mk.js`).

- Code docs from setup and refresh-docs follow one layout (`docs/DOC-LAYOUT.md`): `business/` (domain map, rules, states, glossary, `workflows/W<nn>-*.md`) and `technical/` (architecture, modules, dev workflow, findings), with an index. Lean rules: one fact in one place, name the code instead of copying it, no per-method docs, no line numbers, size limits. Refresh-docs lists what it cuts as over-detail.

## 0.2.0 (2026-11-13)

- Hosts: Codex CLI and Gemini CLI hooks (`node src/setup.js --host <name> [--apply]`, `--remove-host`), GitHub Copilot through its instructions file (`--host copilot` prints the lines), and `brain.js context` for any other tool. Data folder `~/.gabriel` by default; `--data <dir>` for hosts that do not see your env.
- First run of `/gabriel:setup`: a warning that the full setup is big, then optional steps, each asked first: install graphify, superpowers and ponytail; graph a project; write technical, business, architecture and workflow docs with Mermaid diagrams; download docs for your stack from well-known, high-trust sources. `--onboard` runs these steps again later.
- `/gabriel:update --stack` fetches the stack docs again.
- `/gabriel:refresh-docs <code folder> [docs folder]`: `graphify update`, then update the docs the code change touches, then shrink them with a key-idea check (N/N kept), then rebuild the map and retrain the ranking.
- New folders under `<data>/docs/` are added in the background; setup makes `docs/stack/`.
- Tips: one short tip per session in the hook note. Off with `"tips": false` in `projects.json`.
- Default preferences (`defaults/preferences.md`), used only when your rules folder has no `preferences.md`.
- Optional fine-tune of the meaning model (`/gabriel:tune-embeddings`, `node src/setup.js --tune`), kept only when it scores better.
- More doc formats: Word, PowerPoint, OpenDocument, Excel, CSV, TSV, PDF (optional `pdfjs-dist`); JSON, JSON Lines and YAML opt-in.
- Tests: one test run at a time (a lock file), the tune keep branch, the tune fixture run.
- `/gabriel:update` (`node src/setup.js --update`): adds new doc folders, rebuilds only the stale doc sets, and suggests eval cases for new sections (merged into `eval-cases.suggested.json`; `eval-cases.json` is never touched). `--dry-run` changes nothing. Safe to run again.

## 0.1.0 (2026-11-13)

First public version.

- `UserPromptSubmit` hook: adds the matching rules, doc sections and code names to each prompt.
- Rules graph from `CLAUDE.md` and memory notes, with words, synonyms and a local meaning model.
- Map over one or more doc sets, with routing by name, alias and working folder, and an optional fallback doc set.
- Code names from a graphify graph (`graphify-out/graph.json`) as optional map links.
- Learning from the files you open after a map, with links that fade over time.
- Dedupe: an item is not sent twice in one session.
- Setup script with 10 steps, safe to run again.
- Skills: `setup`, `status`, `map`, `add-docs`, `retrain`.
- `add-docs`, `suggest-cases`, `eval-map`, `train-rank` and `retrain` per doc set.
- Known gaps: only Markdown (`.md`) is read. A very small doc set may show no map.
