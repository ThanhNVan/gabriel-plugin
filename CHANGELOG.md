# Changelog

## Unreleased

- Code graph path: a missing `graph` file now fails the build with `graph not found: <path>` and keeps the old map. `mk-status all` shows each graph path and `GRAPH MISSING`. `add-docs` asks for the code repo when `--code` is missing. The background check now rebuilds any stale doc set, not only the default one (skipping a set whose graph is missing).
- Skills show a short hint for each argument.

- `/gabriel:retrain` with no name always keeps the new weights for the default doc set, and saves the old file as `rank.prev.json`. With a name, the score guard stays.

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
