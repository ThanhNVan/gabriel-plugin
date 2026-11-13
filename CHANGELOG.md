# Changelog

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
