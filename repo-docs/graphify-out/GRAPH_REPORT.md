# Graph Report - gabriel-plugin  (2026-11-14)

## Corpus Check
- 114 files · ~96,952 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1218 nodes · 2075 edges · 66 communities (65 shown, 1 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 132 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Doc Folder Discovery
- Model Tuning and Embeddings
- Prompt History Graph DB
- Host Adapters
- Brain Test Harness
- Atomic Writes and Map Build
- Document Text Extraction
- Lint and Package Dependencies
- Eval Map Runner
- Update Test Cases
- Hook Prompt Pipeline
- Search and Synonyms
- Workflow Tests
- Data Migration
- Add-Docs Tests
- Setup Tests
- Doc Layout and Tuning Docs
- Case Suggestions
- Host Setup Tests
- Extract Tests
- Architecture Doc and Brain Core
- Train Ranking Scripts
- Learning and Dedupe Rules
- Tune Tests
- Wide Brain Test
- Host Hook Files and Rules
- Host Tests
- Train Tests
- Public Check Script
- Doc Set Layout Rules
- Retrain Script
- Background Refresh and Embeddings
- Core Docs Index
- Eval Cases
- Eval Model Grid
- Learned Links and Map Rules
- Hook Freshness Tests
- Architecture and Ranking Docs
- Hook Measure Script
- Map Background Refresh
- Check Public Tests
- Map Tests
- Tune Pairs Tests
- Tips
- Doc Embedding Cache
- Project Tests
- Preferences and Meaning Model
- Changelog and Hosts
- Map Skill and Ranking
- Chunking and Ranking
- ONNX Export
- Run-All Test Runner
- Embed Model Tests
- Eval Rules
- Corpus Maker
- Path Tests
- Plain Docs Tests
- Version Tests
- Map Rebuild Rules
- Lint Tests
- Mermaid Tests
- Transformer ONNX Export
- Train Script
- ESLint Config

## God Nodes (most connected - your core abstractions)
1. `build()` - 25 edges
2. `search()` - 24 edges
3. `getProject()` - 22 edges
4. `main()` - 21 edges
5. `extractText()` - 20 edges
6. `update()` - 20 edges
7. `Architecture doc` - 20 edges
8. `loadProjects()` - 18 edges
9. `dataDir()` - 18 edges
10. `addDocs()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `map skill (reads the map block)` --references--> `search()`  [AMBIGUOUS]
  skills/map/SKILL.md → src/mk.js
- `src/hosts/codex.js` --calls--> `hook()`  [EXTRACTED]
  repo-docs/business/workflows/W08-other-hosts.md → src/brain.js
- `src/paths.js` --calls--> `get()`  [EXTRACTED]
  repo-docs/business/workflows/W03-add-docs.md → src/hosts/index.js
- `search()` --references--> `R24 Learned links never start a search`  [EXTRACTED]
  src/mk.js → repo-docs/business/workflows/W05-learning-from-use.md
- `brain.js registerNewDocFolders()` --calls--> `update()`  [EXTRACTED]
  repo-docs/business/workflows/W04-update-and-auto-add.md → src/setup.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Per-prompt hook flow** — src_brain, src_rules, src_mk, src_history, src_embed, src_hosts_claude [EXTRACTED 1.00]
- **Map build flow** — src_mk, src_extract, graphify_out_graph, src_embed, src_brain [EXTRACTED 1.00]
- **Keep new weights or model only if score does not fall** — src_retrain, src_train_rank, eval_eval_map, src_tune_tune, docs_tuning_keep_rule, repo_docs_business_02_business_rules_r26_retrain_keeps_better [INFERRED 0.85]
- **Refresh, update and retrain loop** — skills_refresh_docs_skill_refresh_docs_skill, skills_update_skill_update_skill, skills_retrain_skill_retrain_skill, src_retrain_retrain, src_setup_update [INFERRED 0.85]
- **Map build path** — src_setup_add_docs, src_brain_build_mk, src_mk_build, mk_db, projects_json [INFERRED 0.85]
- **Learning from use** — src_mk_remember, src_brain_touched_hook, src_hosts_claude_read_touched, src_mk_touched, src_mk_search [INFERRED 0.85]

## Communities (66 total, 1 thin omitted)

### Community 0 - "Doc Folder Discovery"
Cohesion: 0.06
Nodes (78): registerNewDocFolders(), extSet(), isDocName(), skipName(), HOSTS, activeHost(), checkName(), dataDir() (+70 more)

### Community 1 - "Model Tuning and Embeddings"
Cohesion: 0.05
Nodes (60): R27 Model tune keeps the tuned model only when it wins, A tuned model wins only on scores, getEmbedder(), modelsDir(), casesFile(), { embedText }, exportPairs(), fs (+52 more)

### Community 2 - "Prompt History Graph DB"
Cohesion: 0.06
Nodes (43): Prompt history, dbFile(), fs, history, lexical(), open(), path, sync() (+35 more)

### Community 3 - "Host Adapters"
Cohesion: 0.07
Nodes (26): Any other tool (gabriel context), Claude Code host, src/hosts/ (host adapters), os, path, { readCommon }, os, path (+18 more)

### Community 4 - "Brain Test Harness"
Cohesion: 0.06
Nodes (36): assert, brain, { brainPath, tempHome, runBrain }, dims(), fake(), fs, g, h1 (+28 more)

### Community 5 - "Atomic Writes and Map Build"
Cohesion: 0.09
Nodes (30): Atomic writes: temp file then rename or one transaction, AUTO_SKIP, build(), camel(), canon(), CODE_FILLER, CODE_SYN, coreRe (+22 more)

### Community 6 - "Document Text Extraction"
Cohesion: 0.16
Nodes (29): adocText(), delimited(), docxText(), elems(), ENT, extractText(), fs, htmlText() (+21 more)

### Community 7 - "Lint and Package Dependencies"
Cohesion: 0.07
Nodes (29): eslint, @eslint/js, globals, @huggingface/transformers, jsdom, dependencies, @huggingface/transformers, description (+21 more)

### Community 8 - "Eval Map Runner"
Cohesion: 0.11
Nodes (27): argv, evalProject(), flag(), fs, { getEmbedder }, { homeDir }, judge(), judgeRendered() (+19 more)

### Community 9 - "Update Test Cases"
Cohesion: 0.07
Nodes (21): assert, casesFile, casesHash, crypto, data, docs, env, filler (+13 more)

### Community 10 - "Hook Prompt Pipeline"
Cohesion: 0.11
Nodes (26): Never block a prompt: every step fails open with time limits, Session dedupe: save state only after output is written, capText(), contextArgs(), contextText(), dedupe(), emit(), flagValue() (+18 more)

### Community 11 - "Search and Synonyms"
Cohesion: 0.15
Nodes (25): search(), searchFull(), withTimeout(), mkSynonyms(), contextFile(), addPrivateThesaurus(), blocks(), build() (+17 more)

### Community 12 - "Workflow Tests"
Cohesion: 0.08
Nodes (21): assert, BASE_ENV, BRAIN, CLAUDE_HOME, CODEX_HOME, DATA, ENV, fs (+13 more)

### Community 13 - "Data Migration"
Cohesion: 0.11
Nodes (22): R32 Old data is copied, never deleted, crypto, { dataDir, checkName }, expand(), fs, hashFile(), migrate(), MOVES (+14 more)

### Community 14 - "Add-Docs Tests"
Cohesion: 0.08
Nodes (20): assert, BRAIN, crypto, data, entry(), env, filler, fixture (+12 more)

### Community 15 - "Setup Tests"
Cohesion: 0.08
Nodes (22): assert, before, crypto, d2, d3, docs2, env, filler (+14 more)

### Community 16 - "Doc Layout and Tuning Docs"
Cohesion: 0.12
Nodes (22): docs/DOC-LAYOUT.md (doc layout and lean rules), docs/TUNING.md (tune guide), graphify (external code-graph tool), graphify-out/graph.json (code graph), projects.json (data folder), R12 A named doc set gets the prompt first, R20 Without projects.json every folder with files is a doc set, R21 Folder names are short and plain (+14 more)

### Community 17 - "Case Suggestions"
Cohesion: 0.13
Nodes (20): covered(), esc(), fs, { getProject }, headingKeys(), mk, newSuggestions(), norm() (+12 more)

### Community 18 - "Host Setup Tests"
Cohesion: 0.09
Nodes (15): assert, codexFile, crypto, env, fs, geminiFile, home, originalHash (+7 more)

### Community 19 - "Extract Tests"
Cohesion: 0.11
Nodes (19): assert, check(), data, DOCX, ex, fs, home, main() (+11 more)

### Community 20 - "Architecture Doc and Brain Core"
Cohesion: 0.24
Nodes (20): Architecture doc, Local only: the hook never downloads, node:sqlite, not a native package: no build step on user machine, Vectors keyed by text hash: embed only new or changed text, src/brain.js, src/dq.js, src/embed.js, src/extract.js (+12 more)

### Community 21 - "Train Ranking Scripts"
Cohesion: 0.10
Nodes (15): argv, casesFile, EXCLUDE, fs, { getEmbedder }, { getProject }, { homeDir }, LAMBDA (+7 more)

### Community 22 - "Learning and Dedupe Rules"
Cohesion: 0.12
Nodes (17): Dedupe (no repeat per session), Learning from use, Tune keep rule (keep only if it wins), R01 Hook never blocks a prompt, R03 Rules block: 6 rules, 2400 characters, R07 Item not sent twice per session, R08 Map block: 6 doc hits, 6 code hits, 2200 characters, R10 General docs answer only when no doc set does (+9 more)

### Community 23 - "Tune Tests"
Cohesion: 0.11
Nodes (15): assert, base, BASE_SRC, BRAIN, CFG, DOCS, fs, GDATA (+7 more)

### Community 24 - "Wide Brain Test"
Cohesion: 0.11
Nodes (15): brain, BRAINDIR, FILL, FILL_S, FILL_T, fs, history, MAY_HIT (+7 more)

### Community 25 - "Host Hook Files and Rules"
Cohesion: 0.13
Nodes (18): graph.json (rules graph, per host), hooks/hooks.json, R03 Rules block at most 6 rules and 2400 characters, R04 Rules already in context are not repeated, R31 Host hook files change only with --apply after a backup, W08 Other hosts workflow, One engine, many hosts: each host has its own graph file, brain.js context mode (+10 more)

### Community 26 - "Host Tests"
Cohesion: 0.12
Nodes (15): assert, baseEnv(), BRAIN, codexHome, data, fakeHome, fs, hosts (+7 more)

### Community 27 - "Train Tests"
Cohesion: 0.12
Nodes (14): assert, base, cli(), CORPUS, DATA, EMPTY, env, fs (+6 more)

### Community 28 - "Public Check Script"
Cohesion: 0.19
Nodes (16): DEFAULT_ROOT, escapeRe(), findWordsFile(), fs, gitLines(), isSkipped(), kindsForLine(), listFiles() (+8 more)

### Community 29 - "Doc Set Layout Rules"
Cohesion: 0.18
Nodes (9): Doc set, projects.json, Data folder, Lean rules for code docs, Workflow page layout, Eval case, Leave-one-area-out score, Retrain (keep better weights) (+1 more)

### Community 30 - "Retrain Script"
Cohesion: 0.12
Nodes (12): casesFile, { execFileSync }, fs, { getProject }, keepNew(), mk, os, P (+4 more)

### Community 31 - "Background Refresh and Embeddings"
Cohesion: 0.21
Nodes (14): refreshInBackground(), crypto, { dataDir, writeAtomic }, ehash(), embedders, { embedModel, DEFAULT_EMBED_MODEL }, embedNodes(), embedText() (+6 more)

### Community 32 - "Core Docs Index"
Cohesion: 0.19
Nodes (14): docs/ARCHITECTURE.md (lead doc for matching), docs/HOSTS.md (host table), docs/TROUBLESHOOTING.md (plugin cache note), Modules doc, Dev workflow doc, Findings doc, Question-index rescue is off (Q_GATE unused), Rules matching score floor missing from ARCHITECTURE doc (+6 more)

### Community 33 - "Eval Cases"
Cohesion: 0.19
Nodes (14): eval-cases.json (per doc set, user-reviewed), eval-cases.suggested.json, eval/eval-map.js, suggest-cases.js newSuggestions(), eval/suggest-cases.js, rank.json (per doc set ranking weights), rank.prev.json (backup of weights), R26 Retrain keeps new weights only when strict score does not fall (+6 more)

### Community 34 - "Eval Model Grid"
Cohesion: 0.15
Nodes (12): { dataDir }, fs, gi, grid, home, judge(), mk, MODELS (+4 more)

### Community 35 - "Learned Links and Map Rules"
Cohesion: 0.21
Nodes (14): mk.db (all doc-set maps, one file), R23 A learned link needs two confirmations and fades, R24 Learned links never start a search, R25 A file counts once per map within 45 minutes, W01 One prompt workflow (referenced), W05 Learning from use workflow, effective(), integrate() (+6 more)

### Community 36 - "Hook Freshness Tests"
Cohesion: 0.14
Nodes (11): assert, brain, cwd, dataDir, env, fs, home, os (+3 more)

### Community 37 - "Architecture and Ranking Docs"
Cohesion: 0.17
Nodes (12): Code graph links, Fail open (hook never blocks a prompt), Question index (optional), Quiet gate (0.65 threshold), Ranking (trained weights), Routing and fallback, Session gate, Setup steps (10 steps) (+4 more)

### Community 38 - "Hook Measure Script"
Cohesion: 0.15
Nodes (12): assert, fs, GENERIC, mk, owner, ownFile, path, paths (+4 more)

### Community 39 - "Map Background Refresh"
Cohesion: 0.27
Nodes (13): refreshMapInBackground(), dbFile(), docsRoot(), graphOnDisk(), graphPathOf(), hadMap(), hasMap(), learnShow() (+5 more)

### Community 40 - "Check Public Tests"
Cohesion: 0.22
Nodes (12): assert, fs, J(), made, main(), makeTree(), mkTmp(), os (+4 more)

### Community 41 - "Map Tests"
Cohesion: 0.15
Nodes (11): assert, fs, home, links, mk, nodes, os, path (+3 more)

### Community 42 - "Tune Pairs Tests"
Cohesion: 0.15
Nodes (10): assert, base, DATA, DOCS, fs, HOME, os, path (+2 more)

### Community 43 - "Tips"
Cohesion: 0.17
Nodes (10): Tips, fs, path, paths, assert, DATA, fs, os (+2 more)

### Community 44 - "Doc Embedding Cache"
Cohesion: 0.27
Nodes (11): cache, { dataDir }, embedAll(), { embedModel, DEFAULT_EMBED_MODEL }, files(), fs, load(), path (+3 more)

### Community 45 - "Project Tests"
Cohesion: 0.17
Nodes (9): assert, dir, fs, later, m, os, path, ps (+1 more)

### Community 46 - "Preferences and Meaning Model"
Cohesion: 0.24
Nodes (6): Map (doc-set map), Meaning model, Neuron, Rules graph, graphify-out/graph.json, W01 One prompt

### Community 47 - "Changelog and Hosts"
Cohesion: 0.24
Nodes (7): Version 0.1.0 (first public version), Version 0.2.0 (2026-11-13), Codex CLI host, Gemini CLI host, GitHub Copilot host, Redaction of prompt history, hooks/hooks.json

### Community 48 - "Map Skill and Ranking"
Cohesion: 0.27
Nodes (10): map skill (reads the map block), coreDoc(), expand(), f32(), isFallback(), loadRank(), namedProjects(), search() (+2 more)

### Community 49 - "Chunking and Ranking"
Cohesion: 0.20
Nodes (9): chunkDoc(), clean(), rankDocs(), assert, fs, main(), mk, os (+1 more)

### Community 50 - "ONNX Export"
Cohesion: 0.22
Nodes (8): exportOnnx(), fs, os, path, SCRIPT, { spawnSync }, TOKEN_FILES, venvPython()

### Community 51 - "Run-All Test Runner"
Cohesion: 0.20
Nodes (7): files, fs, LOCK, path, ROOT, scan, { spawnSync }

### Community 52 - "Embed Model Tests"
Cohesion: 0.20
Nodes (8): assert, base, embed, { embedModel, DEFAULT_EMBED_MODEL }, fs, os, path, ROOT

### Community 53 - "Eval Rules"
Cohesion: 0.22
Nodes (7): brain, CASES, fs, home, mk, path, PRIVATE_CASES

### Community 54 - "Corpus Maker"
Cohesion: 0.25
Nodes (8): clean(), fs, LICENSE, out, path, paths, SKIP_DIR, walk()

### Community 55 - "Path Tests"
Cohesion: 0.22
Nodes (7): assert, fs, old, os, p, path, tmpHome

### Community 56 - "Plain Docs Tests"
Cohesion: 0.22
Nodes (8): assert, data, fs, home, mk, os, path, tmp

### Community 57 - "Version Tests"
Cohesion: 0.22
Nodes (7): assert, fs, market, path, pkg, plugin, ROOT

### Community 58 - "Map Rebuild Rules"
Cohesion: 0.29
Nodes (7): R16 A doc-set map is rebuilt when its sources change, R17 The old map serves until the new one is ready, R18 Background builds: one at a time, checked each minute, R19 New doc folders join only when they hold files, W04 Update and auto-add workflow, /gabriel:status skill, brain.js mk-status mode

### Community 59 - "Lint Tests"
Cohesion: 0.29
Nodes (6): bin, fs, path, r, ROOT, { spawnSync }

### Community 60 - "Mermaid Tests"
Cohesion: 0.29
Nodes (5): dom, fs, path, ROOT, SKIP

### Community 61 - "Transformer ONNX Export"
Cohesion: 0.60
Nodes (4): Path, find_transformer_dir(), main(), Export a trained sentence-transformers model to ONNX and quantize it to 8 bit.…

### Community 62 - "Train Script"
Cohesion: 0.60
Nodes (3): main(), parse_args(), read_pairs()

## Ambiguous Edges - Review These
- `search()` → `map skill (reads the map block)`  [AMBIGUOUS]
  skills/map/SKILL.md · relation: references

## Knowledge Gaps
- **595 isolated node(s):** `globals`, `fs`, `path`, `{ homeDir }`, `paths` (+590 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `search()` and `map skill (reads the map block)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `brain.js build-mk mode` connect `Doc Layout and Tuning Docs` to `Core Docs Index`, `Eval Cases`, `Atomic Writes and Map Build`, `Doc Folder Discovery`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `update()` connect `Doc Folder Discovery` to `Eval Cases`, `Atomic Writes and Map Build`, `Map Background Refresh`, `Doc Layout and Tuning Docs`, `Case Suggestions`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `hook()` connect `Hook Prompt Pipeline` to `Doc Layout and Tuning Docs`, `Host Hook Files and Rules`, `Architecture Doc and Brain Core`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `globals`, `fs`, `path` to the rest of the system?**
  _595 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Doc Folder Discovery` be split into smaller, more focused modules?**
  _Cohesion score 0.05583308845136644 - nodes in this community are weakly interconnected._
- **Should `Model Tuning and Embeddings` be split into smaller, more focused modules?**
  _Cohesion score 0.050595238095238096 - nodes in this community are weakly interconnected._