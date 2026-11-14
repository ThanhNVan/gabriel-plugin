# Graph Report - gabriel-plugin  (2026-11-14)

## Corpus Check
- 120 files · ~112,680 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1250 nodes · 2059 edges · 80 communities (78 shown, 2 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 173 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Eval Map Runner
- Tuned Model Training
- Host Setup and Backup
- Other Hosts Adapters
- PDF and Doc Extraction
- ESLint Tooling
- Update Tests
- Session Status and Brain
- Workflow Tests
- Add-Docs Tests
- Setup Tests
- Map Core (mk.js)
- Data Migration
- Eval Model
- Search and Synonyms
- Eval Case Suggestions
- Host Hook Tests
- Extract Tests
- Pin and Project Search
- Hosts Index
- Train Ranking
- Hook Local Refresh
- History Storage
- Graph Tests
- Tune Tests
- Wide Brain Tests
- Reason and Train Tests
- Brain Tests
- Judge and Learned Links
- Hook History Tests
- Public Check Script
- Retrain
- Docs Checker
- Hooks and Architecture Docs
- Add-Docs Workflow and Project Store
- Pin Notes
- Map DB Helpers
- Hook Freshness Tests
- Hook Measure
- Atomic Build Writes
- Paths and Active Host
- Public Check Tests
- Map Tests
- Tune Pairs Tests
- Embedding Cache
- Tips
- Projects Tests
- Doc Set Config and Routing
- Prompt Dedupe and Fail Open
- Eval and Refresh Workflows
- Retrain Scores
- Graph DB
- Doc Chunks and Retrieval
- ONNX Export
- Run-All Tests
- Embed Model Tests
- Doc-Set Map Model
- Eval Rules
- Check-Docs Tests
- Path Tests
- Plain Docs Tests
- Version Tests
- Background Map Rebuild
- Default Rules
- Lint Tests
- Mermaid Tests
- Util Tests
- Code Docs Layout
- Code Graph Check
- Quiet Gate and Search
- Setup Steps and Privacy
- Learning from Use
- Prompt History Redaction
- ONNX Export Script
- Train Script
- Keep-Better Weights
- ESLint Config
- Data Folder

## God Nodes (most connected - your core abstractions)
1. `build()` - 25 edges
2. `search()` - 25 edges
3. `getProject()` - 23 edges
4. `addDocs()` - 22 edges
5. `main()` - 21 edges
6. `extractText()` - 20 edges
7. `dataDir()` - 20 edges
8. `update()` - 20 edges
9. `loadProjects()` - 19 edges
10. `dataDir()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `W01 One prompt (cited, not in chunk)` --references--> `hook()`  [EXTRACTED]
  repo-docs/business/workflows/W05-learning-from-use.md → src/brain.js
- `Rationale: never block a prompt (time limits, fail open)` --rationale_for--> `hook()`  [EXTRACTED]
  repo-docs/technical/01-architecture.md → src/brain.js
- `build()` --references--> `mk.db (project map store)`  [EXTRACTED]
  src/mk.js → repo-docs/technical/01-architecture.md
- `newSuggestions()` --shares_data_with--> `eval-cases.json (user-reviewed test questions)`  [EXTRACTED]
  eval/suggest-cases.js → repo-docs/business/workflows/W06-eval-and-retrain.md
- `W04 Update and auto-add` --references--> `newSuggestions()`  [EXTRACTED]
  repo-docs/business/workflows/W04-update-and-auto-add.md → eval/suggest-cases.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Prompt hook pipeline** — docs_architecture_hook, docs_architecture_rules_graph, docs_architecture_map, docs_architecture_dedupe, docs_architecture_prompt_history [EXTRACTED 1.00]
- **Keep new weights only when the score holds** — docs_eval_retrain, docs_tuning_keep_rule, repo_docs_business_02_business_rules_r26_retrain_keep_rule, repo_docs_business_02_business_rules_r27_tune_keep_rule [INFERRED 0.75]
- **Learning loop** — docs_architecture_learning, docs_architecture_map, repo_docs_business_02_business_rules_r23_learned_two_confirmations, repo_docs_business_02_business_rules_r24_learned_never_start_search, repo_docs_business_02_business_rules_r25_file_counts_once [INFERRED 0.85]
- **Background map rebuild flow** — src_brain_refreshmapinbackground, src_brain_registernewdocfolders, src_mk_stale, src_brain_build_mk, src_setup_update, repo_docs_technical_01_architecture_mk_lock [EXTRACTED 1.00]
- **Retrain keep-only-if-not-lower flow** — src_retrain, src_train_rank, eval_eval_map, repo_docs_business_workflows_w06_eval_and_retrain_rank_json, repo_docs_business_workflows_w06_eval_and_retrain_keep_rule [EXTRACTED 1.00]
- **Learning from use loop** — src_brain_touchedhook, src_mk_touched, repo_docs_business_workflows_w05_learning_from_use_learned_link, src_mk_search, src_mk_remember [EXTRACTED 1.00]

## Communities (80 total, 2 thin omitted)

### Community 0 - "Eval Map Runner"
Cohesion: 0.05
Nodes (54): argv, { defLine }, evalProject(), exactOf(), flag(), fs, { getEmbedder }, { homeDir } (+46 more)

### Community 1 - "Tuned Model Training"
Cohesion: 0.05
Nodes (56): Rationale: a tuned model wins only on scores, casesFile(), { embedText }, exportPairs(), fs, { loadProjects, getProject }, mk, mulberry32() (+48 more)

### Community 2 - "Host Setup and Backup"
Cohesion: 0.09
Nodes (41): Rationale: backup before host hook file write (--apply), skipName(), ADD_SKIP, addGabriel(), buildMap(), CODE_EXT, dirBytes(), expandHome() (+33 more)

### Community 3 - "Other Hosts Adapters"
Cohesion: 0.08
Nodes (25): W08 Other hosts, Host adapter, os, path, { readCommon }, os, path, { readCommon, toolInput, pathsFrom } (+17 more)

### Community 4 - "PDF and Doc Extraction"
Cohesion: 0.16
Nodes (29): adocText(), delimited(), docxText(), elems(), ENT, extractText(), fs, htmlText() (+21 more)

### Community 5 - "ESLint Tooling"
Cohesion: 0.07
Nodes (29): eslint, @eslint/js, globals, @huggingface/transformers, jsdom, dependencies, @huggingface/transformers, description (+21 more)

### Community 6 - "Update Tests"
Cohesion: 0.07
Nodes (21): assert, casesFile, casesHash, crypto, data, docs, env, filler (+13 more)

### Community 7 - "Session Status and Brain"
Cohesion: 0.11
Nodes (26): Rationale: session dedupe (save state only after output is written), status skill, capText(), contextArgs(), contextText(), dedupe(), emit(), flagValue() (+18 more)

### Community 8 - "Workflow Tests"
Cohesion: 0.08
Nodes (21): assert, BASE_ENV, BRAIN, CLAUDE_HOME, CODEX_HOME, DATA, ENV, fs (+13 more)

### Community 9 - "Add-Docs Tests"
Cohesion: 0.08
Nodes (20): assert, BRAIN, crypto, data, entry(), env, filler, fixture (+12 more)

### Community 10 - "Setup Tests"
Cohesion: 0.08
Nodes (22): assert, before, crypto, d2, d3, docs2, env, filler (+14 more)

### Community 11 - "Map Core (mk.js)"
Cohesion: 0.09
Nodes (23): Rationale: node:sqlite, not a native package, AUTO_SKIP, canon(), CHAIN_DEFAULT, CHAIN_VERBS, CODE_FILLER, CODE_SYN, coreRe (+15 more)

### Community 12 - "Data Migration"
Cohesion: 0.11
Nodes (21): crypto, { dataDir, checkName }, expand(), fs, hashFile(), migrate(), MOVES, path (+13 more)

### Community 13 - "Eval Model"
Cohesion: 0.09
Nodes (20): { dataDir }, fs, gi, grid, home, judge(), mk, MODELS (+12 more)

### Community 14 - "Search and Synonyms"
Cohesion: 0.18
Nodes (22): searchFull(), mkSynonyms(), contextFile(), addPrivateThesaurus(), blocks(), build(), expand(), fresh() (+14 more)

### Community 15 - "Eval Case Suggestions"
Cohesion: 0.13
Nodes (20): covered(), esc(), fs, { getProject }, headingKeys(), mk, newSuggestions(), norm() (+12 more)

### Community 16 - "Host Hook Tests"
Cohesion: 0.09
Nodes (15): assert, codexFile, crypto, env, fs, geminiFile, home, originalHash (+7 more)

### Community 17 - "Extract Tests"
Cohesion: 0.11
Nodes (19): assert, check(), data, DOCX, ex, fs, home, main() (+11 more)

### Community 18 - "Pin and Project Search"
Cohesion: 0.19
Nodes (19): pinNote(), registerNewDocFolders(), namedProjects(), searchAll(), dataDir(), projectsFile(), { dataDir, projectsFile, privateDir, checkName, defaultRuleFiles }, DEFAULTS (+11 more)

### Community 19 - "Hosts Index"
Cohesion: 0.11
Nodes (16): HOSTS, assert, baseEnv(), BRAIN, codexHome, data, fakeHome, fs (+8 more)

### Community 20 - "Train Ranking"
Cohesion: 0.10
Nodes (15): argv, casesFile, EXCLUDE, fs, { getEmbedder }, { getProject }, { homeDir }, LAMBDA (+7 more)

### Community 21 - "Hook Local Refresh"
Cohesion: 0.15
Nodes (18): Rationale: local only, the hook never downloads, Rationale: never block a prompt (time limits, fail open), vectors.json, refreshInBackground(), crypto, { dataDir, writeAtomic }, ehash(), embedders (+10 more)

### Community 22 - "History Storage"
Cohesion: 0.18
Nodes (17): append(), crypto, embedHistory(), entryId(), forget(), fs, hasUnembedded(), load() (+9 more)

### Community 23 - "Graph Tests"
Cohesion: 0.11
Nodes (18): assert, cli, { DatabaseSync }, filler, fs, gdb, history, home (+10 more)

### Community 24 - "Tune Tests"
Cohesion: 0.11
Nodes (15): assert, base, BASE_SRC, BRAIN, CFG, DOCS, fs, GDATA (+7 more)

### Community 25 - "Wide Brain Tests"
Cohesion: 0.11
Nodes (15): brain, BRAINDIR, FILL, FILL_S, FILL_T, fs, history, MAY_HIT (+7 more)

### Community 26 - "Reason and Train Tests"
Cohesion: 0.12
Nodes (15): reason(), assert, base, cli(), CORPUS, DATA, EMPTY, env (+7 more)

### Community 27 - "Brain Tests"
Cohesion: 0.12
Nodes (15): assert, brain, { brainPath, tempHome, runBrain }, dims(), fake(), fs, g, h1 (+7 more)

### Community 28 - "Judge and Learned Links"
Cohesion: 0.17
Nodes (17): judgeRendered(), W01 One prompt (cited, not in chunk), W05 Learning from use, Learned link, Rationale: learned links never start a search, touchedHook(), chainNum(), defaultProject() (+9 more)

### Community 29 - "Hook History Tests"
Cohesion: 0.15
Nodes (15): hook(), assert, fs, histDir(), history, historyPath, home(), path (+7 more)

### Community 30 - "Public Check Script"
Cohesion: 0.19
Nodes (16): DEFAULT_ROOT, escapeRe(), findWordsFile(), fs, gitLines(), isSkipped(), kindsForLine(), listFiles() (+8 more)

### Community 31 - "Retrain"
Cohesion: 0.12
Nodes (12): casesFile, { execFileSync }, force, fs, { getProject }, mk, os, P (+4 more)

### Community 32 - "Docs Checker"
Cohesion: 0.23
Nodes (13): checkFile(), codeBlockHits(), codeMask(), fenceBlocks(), fs, lineNumberHits(), linkHits(), path (+5 more)

### Community 33 - "Hooks and Architecture Docs"
Cohesion: 0.21
Nodes (15): hooks/hooks.json (Claude Code plugin hooks), 02-business-rules.md (cited, not in chunk), W04 Update and auto-add, Architecture (01), Meaning model (embedding model), Build lock (mk.lock), Project map, Session pin (+7 more)

### Community 34 - "Add-Docs Workflow and Project Store"
Cohesion: 0.20
Nodes (15): W03 Add docs, Doc set (project), mk.db (project map store), projects.json, add-docs skill, setup skill, brain.js build-mk mode, checkName() (+7 more)

### Community 35 - "Pin Notes"
Cohesion: 0.18
Nodes (13): { dataDir }, fs, getPin(), parsePin(), path, seenFile(), setPin(), assert (+5 more)

### Community 36 - "Map DB Helpers"
Cohesion: 0.26
Nodes (14): dbFile(), effective(), hadMap(), hasMap(), integrate(), learnReset(), learnShow(), legacyProject() (+6 more)

### Community 37 - "Hook Freshness Tests"
Cohesion: 0.14
Nodes (11): assert, brain, cwd, dataDir, env, fs, home, os (+3 more)

### Community 38 - "Hook Measure"
Cohesion: 0.15
Nodes (12): assert, fs, GENERIC, mk, owner, ownFile, path, paths (+4 more)

### Community 39 - "Atomic Build Writes"
Cohesion: 0.22
Nodes (13): Rationale: atomic writes (temp file, then rename), extSet(), isDocName(), build(), camel(), families(), listDocs(), roleWords() (+5 more)

### Community 40 - "Paths and Active Host"
Cohesion: 0.21
Nodes (11): activeHost(), defaultRuleFiles(), fs, hostAdapter(), hosts, os, path, pluginRoot() (+3 more)

### Community 41 - "Public Check Tests"
Cohesion: 0.22
Nodes (12): assert, fs, J(), made, main(), makeTree(), mkTmp(), os (+4 more)

### Community 42 - "Map Tests"
Cohesion: 0.15
Nodes (11): assert, fs, home, links, mk, nodes, os, path (+3 more)

### Community 43 - "Tune Pairs Tests"
Cohesion: 0.15
Nodes (10): assert, base, DATA, DOCS, fs, HOME, os, path (+2 more)

### Community 44 - "Embedding Cache"
Cohesion: 0.27
Nodes (11): cache, { dataDir }, embedAll(), { embedModel, DEFAULT_EMBED_MODEL }, files(), fs, load(), path (+3 more)

### Community 45 - "Tips"
Cohesion: 0.18
Nodes (10): fs, path, paths, TIPS, assert, DATA, fs, os (+2 more)

### Community 46 - "Projects Tests"
Cohesion: 0.17
Nodes (9): assert, dir, fs, later, m, os, path, ps (+1 more)

### Community 47 - "Doc Set Config and Routing"
Cohesion: 0.20
Nodes (11): projects.json (doc set config), Routing and fallback, Session gate, Doc set, Pin one doc set per session, src/pin.js (session pin owner), R10 General docs answer only when no doc set does, R12 A named doc set gets the prompt first (+3 more)

### Community 48 - "Prompt Dedupe and Fail Open"
Cohesion: 0.27
Nodes (10): Dedupe (seen list), Fail open (hook never blocks a prompt), UserPromptSubmit hook (brain.js hook), Copilot cannot get the map on each prompt, Host adapter, R01 Hook never blocks a prompt, R02 Short and slash prompts get no context, R07 An item is not sent twice in one session (+2 more)

### Community 49 - "Eval and Refresh Workflows"
Cohesion: 0.27
Nodes (10): docs/DOC-LAYOUT.md (cited, not in chunk), W06 Eval and retrain, eval-cases.json (user-reviewed test questions), W07 Refresh docs, Rationale: the refresh skill never commits or pushes, Code graph (graphify graph.json), refresh-docs skill, retrain skill (+2 more)

### Community 50 - "Retrain Scores"
Cohesion: 0.22
Nodes (10): Leave-one-area-out score, Retrain (keep better weights), Strict score, Keep rule (tuned model), Split held-out questions by doc file, refresh-docs command, Skills (/gabriel: commands), Eval and retrain scripts (eval/eval-map.js, src/retrain.js) (+2 more)

### Community 51 - "Graph DB"
Cohesion: 0.24
Nodes (7): dbFile(), fs, history, lexical(), open(), path, sync()

### Community 52 - "Doc Chunks and Retrieval"
Cohesion: 0.20
Nodes (9): chunkDoc(), clean(), rankDocs(), assert, fs, main(), mk, os (+1 more)

### Community 53 - "ONNX Export"
Cohesion: 0.22
Nodes (8): exportOnnx(), fs, os, path, SCRIPT, { spawnSync }, TOKEN_FILES, venvPython()

### Community 54 - "Run-All Tests"
Cohesion: 0.20
Nodes (7): files, fs, LOCK, path, ROOT, scan, { spawnSync }

### Community 55 - "Embed Model Tests"
Cohesion: 0.20
Nodes (8): assert, base, embed, { embedModel, DEFAULT_EMBED_MODEL }, fs, os, path, ROOT

### Community 56 - "Doc-Set Map Model"
Cohesion: 0.31
Nodes (9): Map (doc-set map), Meaning model, Neuron (map node), Question index, src/mk.js (doc-set map owner), R13 A map is a lead, not proof, R16 A doc set map is rebuilt when its sources change, R17 The old map serves until the new one is ready (+1 more)

### Community 57 - "Eval Rules"
Cohesion: 0.22
Nodes (7): brain, CASES, fs, home, mk, path, PRIVATE_CASES

### Community 58 - "Check-Docs Tests"
Cohesion: 0.22
Nodes (7): assert, CHECK, fs, os, path, ROOT, { spawnSync }

### Community 59 - "Path Tests"
Cohesion: 0.22
Nodes (7): assert, fs, old, os, p, path, tmpHome

### Community 60 - "Plain Docs Tests"
Cohesion: 0.22
Nodes (8): assert, data, fs, home, mk, os, path, tmp

### Community 61 - "Version Tests"
Cohesion: 0.22
Nodes (7): assert, fs, market, path, pkg, plugin, ROOT

### Community 62 - "Background Map Rebuild"
Cohesion: 0.32
Nodes (8): Rationale: rebuild maps in background with locks, old map serves, refreshMapInBackground(), coreDoc(), docsRoot(), graphOnDisk(), graphPathOf(), loadRank(), getProject()

### Community 63 - "Default Rules"
Cohesion: 0.29
Nodes (7): Default working rules (defaults/preferences.md), Rules graph, gabriel plugin, src/rules.js (rules graph owner), R03 Rules block limits (6 rules, 2400 characters), R05 Rule lines with a secret are never stored, R15 Default preferences only without a preferences.md

### Community 64 - "Lint Tests"
Cohesion: 0.29
Nodes (6): bin, fs, path, r, ROOT, { spawnSync }

### Community 65 - "Mermaid Tests"
Cohesion: 0.29
Nodes (5): dom, fs, path, ROOT, SKIP

### Community 66 - "Util Tests"
Cohesion: 0.29
Nodes (6): brainPath, fs, homes, os, path, { spawnSync }

### Community 67 - "Code Docs Layout"
Cohesion: 0.40
Nodes (6): Code docs layout (DOC-LAYOUT), Code docs layout, Keep it lean rules, Workflow page template, Best results: graph the code, then write its docs, Optional onboarding steps

### Community 68 - "Code Graph Check"
Cohesion: 0.40
Nodes (6): Exact code and doc lines, Code graph check (wrong-repo warning), Wrong code repo warning, R33 A code graph must exist and match the docs, R36 Exact code lines, Code graph (glossary term)

### Community 69 - "Quiet Gate and Search"
Cohesion: 0.33
Nodes (6): Quiet gate (best score 0.65), Spreading search, Two links away, R08 Map block limits (6 doc hits, 6 code hits, 2200 characters), R34 Two links away: code names, Two links away (glossary term)

### Community 70 - "Setup Steps and Privacy"
Cohesion: 0.33
Nodes (6): No network calls after setup, Setup steps (10 steps), src/setup.js (setup owner), R30 Nothing leaves the machine after setup, R32 Old data is copied, never deleted, First setup flow (W02)

### Community 71 - "Learning from Use"
Cohesion: 0.70
Nodes (5): Learning from use, R23 A learned link needs two confirmations and fades, R24 Learned links never start a search, R25 A file counts once per map, within 45 minutes, Learned link states (New, Confirmed, Faded, Removed)

### Community 72 - "Prompt History Redaction"
Cohesion: 0.40
Nodes (5): Prompt history, Prompt history redaction, src/history.js (prompt history owner), R06 Prompt history hides secrets, Similar earlier prompt

### Community 73 - "ONNX Export Script"
Cohesion: 0.60
Nodes (4): Path, find_transformer_dir(), main(), Export a trained sentence-transformers model to ONNX and quantize it to 8 bit.…

### Community 74 - "Train Script"
Cohesion: 0.60
Nodes (3): main(), parse_args(), read_pairs()

### Community 75 - "Keep-Better Weights"
Cohesion: 0.67
Nodes (3): Rationale: keep new weights only if strict score does not fall, rank.json (doc ranking weights), keepNew()

## Ambiguous Edges - Review These
- `Question index` → `Meaning model`  [AMBIGUOUS]
  docs/ARCHITECTURE.md · relation: conceptually_related_to

## Knowledge Gaps
- **626 isolated node(s):** `globals`, `fs`, `path`, `{ homeDir }`, `paths` (+621 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Question index` and `Meaning model`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Dev workflow (03)` connect `Hooks and Architecture Docs` to `Host Setup and Backup`, `Add-Docs Workflow and Project Store`, `Other Hosts Adapters`, `Session Status and Brain`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `refresh-docs skill` connect `Eval and Refresh Workflows` to `Docs Checker`, `Retrain`, `Session Status and Brain`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Architecture (01)` connect `Hooks and Architecture Docs` to `Tuned Model Training`, `Host Setup and Backup`, `Session Status and Brain`, `Map Core (mk.js)`, `Hook Local Refresh`, `Retrain`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `globals`, `fs`, `path` to the rest of the system?**
  _626 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Eval Map Runner` be split into smaller, more focused modules?**
  _Cohesion score 0.0523532522474881 - nodes in this community are weakly interconnected._
- **Should `Tuned Model Training` be split into smaller, more focused modules?**
  _Cohesion score 0.05367231638418079 - nodes in this community are weakly interconnected._