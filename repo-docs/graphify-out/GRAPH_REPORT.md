# Graph Report - gabriel-plugin  (2026-11-14)

## Corpus Check
- 95 files · ~82,627 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1105 nodes · 1741 edges · 56 communities (54 shown, 2 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 141 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Project Folder Setup
- Doc Chunking and Build
- Document Text Extraction
- Release Notes and Docs Guide
- Setup and Doc Install
- Eval Map Runner
- Claude Host Integration
- Lint and Package Config
- Graph Database Store
- Update Tests
- Brain Context Engine
- Workflow Tests
- Synonym and Thesaurus
- Add-Docs Tests
- Setup Tests
- Data Migration
- Release Notes 0.1.0
- Case Suggestion
- Host Setup Tests
- Hosts Index and Tests
- Ranking Training
- Graph Tests
- Tune Tests
- Wide Fill Tests
- Search and Refresh
- Brain Tests
- Train Tests
- Public Check Script
- Retrain Script
- Prompt History Hook
- Model Eval Script
- Hook Freshness Tests
- Hook Measure Script
- Public Check Tests
- Map Tests
- Tune Pairs Tests
- Embedding Cache
- Tips Module
- Projects Tests
- ONNX Export
- Run-All Tests
- Embed Model Tests
- Rules Eval
- Corpus Builder
- Home Path Tests
- Path Tests
- Version Tests
- Lint Tests
- Mermaid Tests
- ONNX Export Python
- Model Training Python
- Preferences Doc
- Prompt History Redaction
- ESLint Config

## God Nodes (most connected - your core abstractions)
1. `build()` - 22 edges
2. `getProject()` - 21 edges
3. `main()` - 21 edges
4. `extractText()` - 20 edges
5. `search()` - 20 edges
6. `dataDir()` - 18 edges
7. `dataDir()` - 17 edges
8. `loadProjects()` - 17 edges
9. `addDocs()` - 17 edges
10. `update()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `map skill (how to read the map block)` --references--> `Map build from doc sets`  [INFERRED]
  skills/map/SKILL.md → docs/ARCHITECTURE.md
- `judgeRendered()` --calls--> `defaultProject()`  [EXTRACTED]
  eval/eval-map.js → src/mk.js
- `judgeRendered()` --calls--> `format()`  [EXTRACTED]
  eval/eval-map.js → src/mk.js
- `evalProject()` --calls--> `search()`  [EXTRACTED]
  eval/eval-map.js → src/mk.js
- `evalProject()` --calls--> `searchAll()`  [EXTRACTED]
  eval/eval-map.js → src/mk.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Per-prompt pipeline** — docs_architecture_prompt_hook, docs_architecture_rules_graph, docs_architecture_map, docs_architecture_dedupe, docs_architecture_spreading_search [INFERRED 0.85]
- **Keep new weights or model only if scores improve** — docs_eval_retrain, docs_tuning_keep_rule, docs_workflows_retrain, docs_workflows_tune [INFERRED 0.75]
- **Host adapters on one engine** — docs_hosts_claude_code, docs_hosts_codex_cli, docs_hosts_gemini_cli, docs_hosts_github_copilot, docs_hosts_generic_context [INFERRED 0.85]

## Communities (56 total, 2 thin omitted)

### Community 0 - "Project Folder Setup"
Cohesion: 0.05
Nodes (76): registerNewDocFolders(), activeHost(), checkName(), dataDir(), defaultRuleFiles(), docsDir(), fs, hostAdapter() (+68 more)

### Community 1 - "Doc Chunking and Build"
Cohesion: 0.06
Nodes (68): AUTO_SKIP, build(), camel(), canon(), chunkDoc(), clean(), CODE_FILLER, CODE_SYN (+60 more)

### Community 2 - "Document Text Extraction"
Cohesion: 0.07
Nodes (49): adocText(), delimited(), docxText(), elems(), ENT, extractText(), fs, htmlText() (+41 more)

### Community 3 - "Release Notes and Docs Guide"
Cohesion: 0.06
Nodes (46): CHANGELOG, Version 0.2.0 release notes, ADDING-DOCS doc, Add docs later with update, Doc set, Step 7: make test questions with suggest-cases, ARCHITECTURE doc, Data folder (~/.gabriel) (+38 more)

### Community 4 - "Setup and Doc Install"
Cohesion: 0.09
Nodes (45): extSet(), isDocName(), ADD_SKIP, addDocs(), addGabriel(), CODE_EXT, countDocs(), countLine() (+37 more)

### Community 5 - "Eval Map Runner"
Cohesion: 0.07
Nodes (41): argv, evalProject(), flag(), fs, { getEmbedder }, { homeDir }, judge(), judgeRendered() (+33 more)

### Community 6 - "Claude Host Integration"
Cohesion: 0.07
Nodes (23): os, path, { readCommon }, os, path, { readCommon, toolInput, pathsFrom }, readTouched(), path (+15 more)

### Community 7 - "Lint and Package Config"
Cohesion: 0.07
Nodes (29): eslint, @eslint/js, globals, @huggingface/transformers, jsdom, dependencies, @huggingface/transformers, description (+21 more)

### Community 8 - "Graph Database Store"
Cohesion: 0.11
Nodes (24): dbFile(), fs, history, lexical(), open(), path, sync(), append() (+16 more)

### Community 9 - "Update Tests"
Cohesion: 0.07
Nodes (21): assert, casesFile, casesHash, crypto, data, docs, env, filler (+13 more)

### Community 10 - "Brain Context Engine"
Cohesion: 0.12
Nodes (25): capText(), contextArgs(), contextText(), dedupe(), emit(), flagValue(), format(), fs (+17 more)

### Community 11 - "Workflow Tests"
Cohesion: 0.08
Nodes (21): assert, BASE_ENV, BRAIN, CLAUDE_HOME, CODEX_HOME, DATA, ENV, fs (+13 more)

### Community 12 - "Synonym and Thesaurus"
Cohesion: 0.15
Nodes (24): mkSynonyms(), contextFile(), pluginRoot(), addPrivateThesaurus(), blocks(), build(), expand(), fresh() (+16 more)

### Community 13 - "Add-Docs Tests"
Cohesion: 0.08
Nodes (20): assert, BRAIN, crypto, data, entry(), env, filler, fixture (+12 more)

### Community 14 - "Setup Tests"
Cohesion: 0.08
Nodes (22): assert, before, crypto, d2, d3, docs2, env, filler (+14 more)

### Community 15 - "Data Migration"
Cohesion: 0.11
Nodes (21): crypto, { dataDir, checkName }, expand(), fs, hashFile(), migrate(), MOVES, path (+13 more)

### Community 16 - "Release Notes 0.1.0"
Cohesion: 0.09
Nodes (22): Version 0.1.0 release notes, sessionGate field in projects.json, Dedupe per session, Quiet gate (best score must reach 0.65), Learning from use (links prompt seeds to opened files), Map build from doc sets, UserPromptSubmit hook (brain.js hook), Question index (optional) (+14 more)

### Community 17 - "Case Suggestion"
Cohesion: 0.13
Nodes (20): covered(), esc(), fs, { getProject }, headingKeys(), mk, newSuggestions(), norm() (+12 more)

### Community 18 - "Host Setup Tests"
Cohesion: 0.09
Nodes (15): assert, codexFile, crypto, env, fs, geminiFile, home, originalHash (+7 more)

### Community 19 - "Hosts Index and Tests"
Cohesion: 0.11
Nodes (16): HOSTS, assert, baseEnv(), BRAIN, codexHome, data, fakeHome, fs (+8 more)

### Community 20 - "Ranking Training"
Cohesion: 0.10
Nodes (15): argv, casesFile, EXCLUDE, fs, { getEmbedder }, { getProject }, { homeDir }, LAMBDA (+7 more)

### Community 21 - "Graph Tests"
Cohesion: 0.11
Nodes (18): assert, cli, { DatabaseSync }, filler, fs, gdb, history, home (+10 more)

### Community 22 - "Tune Tests"
Cohesion: 0.11
Nodes (15): assert, base, BASE_SRC, BRAIN, CFG, DOCS, fs, GDATA (+7 more)

### Community 23 - "Wide Fill Tests"
Cohesion: 0.11
Nodes (15): brain, BRAINDIR, FILL, FILL_S, FILL_T, fs, history, MAY_HIT (+7 more)

### Community 24 - "Search and Refresh"
Cohesion: 0.18
Nodes (17): refreshInBackground(), search(), searchFull(), crypto, { dataDir, writeAtomic }, ehash(), embedders, { embedModel, DEFAULT_EMBED_MODEL } (+9 more)

### Community 25 - "Brain Tests"
Cohesion: 0.12
Nodes (15): assert, brain, { brainPath, tempHome, runBrain }, dims(), fake(), fs, g, h1 (+7 more)

### Community 26 - "Train Tests"
Cohesion: 0.12
Nodes (14): assert, base, cli(), CORPUS, DATA, EMPTY, env, fs (+6 more)

### Community 27 - "Public Check Script"
Cohesion: 0.19
Nodes (16): DEFAULT_ROOT, escapeRe(), findWordsFile(), fs, gitLines(), isSkipped(), kindsForLine(), listFiles() (+8 more)

### Community 28 - "Retrain Script"
Cohesion: 0.13
Nodes (11): casesFile, { execFileSync }, fs, { getProject }, mk, os, P, path (+3 more)

### Community 29 - "Prompt History Hook"
Cohesion: 0.16
Nodes (13): hook(), assert, fs, histDir(), history, historyPath, path, runForget() (+5 more)

### Community 30 - "Model Eval Script"
Cohesion: 0.15
Nodes (12): { dataDir }, fs, gi, grid, home, judge(), mk, MODELS (+4 more)

### Community 31 - "Hook Freshness Tests"
Cohesion: 0.14
Nodes (11): assert, brain, cwd, dataDir, env, fs, home, os (+3 more)

### Community 32 - "Hook Measure Script"
Cohesion: 0.15
Nodes (12): assert, fs, GENERIC, mk, owner, ownFile, path, paths (+4 more)

### Community 33 - "Public Check Tests"
Cohesion: 0.22
Nodes (12): assert, fs, J(), made, main(), makeTree(), mkTmp(), os (+4 more)

### Community 34 - "Map Tests"
Cohesion: 0.15
Nodes (11): assert, fs, home, links, mk, nodes, os, path (+3 more)

### Community 35 - "Tune Pairs Tests"
Cohesion: 0.15
Nodes (10): assert, base, DATA, DOCS, fs, HOME, os, path (+2 more)

### Community 36 - "Embedding Cache"
Cohesion: 0.27
Nodes (11): cache, { dataDir }, embedAll(), { embedModel, DEFAULT_EMBED_MODEL }, files(), fs, load(), path (+3 more)

### Community 37 - "Tips Module"
Cohesion: 0.18
Nodes (10): fs, path, paths, TIPS, assert, DATA, fs, os (+2 more)

### Community 38 - "Projects Tests"
Cohesion: 0.17
Nodes (9): assert, dir, fs, later, m, os, path, ps (+1 more)

### Community 39 - "ONNX Export"
Cohesion: 0.22
Nodes (8): exportOnnx(), fs, os, path, SCRIPT, { spawnSync }, TOKEN_FILES, venvPython()

### Community 40 - "Run-All Tests"
Cohesion: 0.20
Nodes (7): files, fs, LOCK, path, ROOT, scan, { spawnSync }

### Community 41 - "Embed Model Tests"
Cohesion: 0.20
Nodes (8): assert, base, embed, { embedModel, DEFAULT_EMBED_MODEL }, fs, os, path, ROOT

### Community 42 - "Rules Eval"
Cohesion: 0.22
Nodes (7): brain, CASES, fs, home, mk, path, PRIVATE_CASES

### Community 43 - "Corpus Builder"
Cohesion: 0.25
Nodes (8): clean(), fs, LICENSE, out, path, paths, SKIP_DIR, walk()

### Community 44 - "Home Path Tests"
Cohesion: 0.22
Nodes (8): home(), brainPath, fs, homes, os, path, { spawnSync }, tempHome()

### Community 45 - "Path Tests"
Cohesion: 0.22
Nodes (7): assert, fs, old, os, p, path, tmpHome

### Community 46 - "Version Tests"
Cohesion: 0.22
Nodes (7): assert, fs, market, path, pkg, plugin, ROOT

### Community 47 - "Lint Tests"
Cohesion: 0.29
Nodes (6): bin, fs, path, r, ROOT, { spawnSync }

### Community 48 - "Mermaid Tests"
Cohesion: 0.29
Nodes (5): dom, fs, path, ROOT, SKIP

### Community 49 - "ONNX Export Python"
Cohesion: 0.60
Nodes (4): Path, find_transformer_dir(), main(), Export a trained sentence-transformers model to ONNX and quantize it to 8 bit.…

### Community 50 - "Model Training Python"
Cohesion: 0.60
Nodes (3): main(), parse_args(), read_pairs()

### Community 51 - "Preferences Doc"
Cohesion: 0.67
Nodes (3): Default preferences file, Project docs first rule, Rules graph

## Knowledge Gaps
- **591 isolated node(s):** `globals`, `fs`, `path`, `{ homeDir }`, `paths` (+586 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run()` connect `Setup and Doc Install` to `Search and Refresh`, `Project Folder Setup`, `Data Migration`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `update()` connect `Setup and Doc Install` to `Project Folder Setup`, `Case Suggestion`, `Doc Chunking and Build`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `tokens()` connect `Synonym and Thesaurus` to `Search and Refresh`, `Doc Chunking and Build`, `Brain Context Engine`, `Graph Tests`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `globals`, `fs`, `path` to the rest of the system?**
  _591 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Folder Setup` be split into smaller, more focused modules?**
  _Cohesion score 0.051189400782896716 - nodes in this community are weakly interconnected._
- **Should `Doc Chunking and Build` be split into smaller, more focused modules?**
  _Cohesion score 0.06459627329192547 - nodes in this community are weakly interconnected._
- **Should `Document Text Extraction` be split into smaller, more focused modules?**
  _Cohesion score 0.07256894049346879 - nodes in this community are weakly interconnected._