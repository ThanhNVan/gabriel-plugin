# Graph Report - gabriel-plugin  (2026-11-14)

## Corpus Check
- 118 files · ~104,091 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1238 nodes · 2021 edges · 82 communities (80 shown, 2 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 157 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Prompt Hook Tuning Model
- PDF and Document Extraction
- Eval Map Runner
- Node Runtime Utilities
- Retrain Pipeline
- ESLint and ML Dependencies
- Graph DB Storage
- Setup Options and Skips
- Update Tests
- Hook Rules and Brain
- Workflow Tests
- Add-Docs Tests
- Setup Tests
- Data Migration
- Project Map Core
- Context Rules Loader
- Case Suggestions
- Host Setup Tests
- Host Index
- Rank Training Script
- Background Refresh
- Graph Tests
- Tune Tests
- Wide Brain Test
- Search and Embeddings
- Brain Tests
- Public Privacy Check
- Docs Checker
- Pin Notes
- History Tests
- Setup Steps and Doc Guides
- Tips
- Eval Model
- Hook Freshness Tests
- Hook Measurement
- Public Check Tests
- Map Tests
- Tune Pairs Tests
- Business Rules and Map Docs
- Setup and Build Map
- Eval and Retrain Docs
- Dq Cache
- Map Database Helpers
- Projects Tests
- Paths and Hosts
- Doc Set Guides
- Ranking and Eval Docs
- Embedding Model
- Host Hook Adapters
- Architecture Docs
- Doc Path Helpers
- Map Builder
- ONNX Export
- Test Runner
- Embed Model Tests
- Dedupe and Hook Rules
- Eval Rules
- Corpus Maker
- Doc Family Builder
- Check-Docs Tests
- Test Utilities
- Paths Tests
- Plain Docs Tests
- Version Tests
- Prompt History Docs
- Domain Map Docs
- Workflow Guide
- Build Lock and Refresh
- Atomic Writes and Rules
- Eval and Doc Readers
- Lint Tests
- Mermaid Tests
- Changelog and Pinning
- Transformer Export Script
- Learned Link Weights
- Training Script
- Default Rules and Preferences
- Doc File Discovery
- ESLint Config
- Map Skill Docs

## God Nodes (most connected - your core abstractions)
1. `build()` - 29 edges
2. `addDocs()` - 23 edges
3. `getProject()` - 22 edges
4. `update()` - 21 edges
5. `main()` - 21 edges
6. `extractText()` - 20 edges
7. `search()` - 20 edges
8. `dataDir()` - 20 edges
9. `loadProjects()` - 19 edges
10. `run()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Setup steps (10 steps)` --references--> `hostSetup()`  [INFERRED]
  docs/ARCHITECTURE.md → src/setup.js
- `R17 the old map serves until the new one is ready` --semantically_similar_to--> `Hook never blocks a prompt (fail open)`  [INFERRED] [semantically similar]
  repo-docs/business/02-business-rules.md → docs/ARCHITECTURE.md
- `Workflows guide (step by step flows)` --references--> `searchFull()`  [EXTRACTED]
  docs/WORKFLOWS.md → src/brain.js
- `W01 one prompt` --references--> `searchFull()`  [EXTRACTED]
  repo-docs/business/workflows/W01-one-prompt.md → src/brain.js
- `Workflows guide (step by step flows)` --references--> `registerNewDocFolders()`  [EXTRACTED]
  docs/WORKFLOWS.md → src/brain.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **One prompt flow through the hook and the map** — src_brain_hook, src_brain_gather, src_brain_searchfull, src_mk_searchall, src_mk_format, src_brain_dedupe, src_history_append, src_hosts_claude_writeoutput [EXTRACTED 1.00]
- **Keep new weights only when they score no worse** — repo_docs_business_02_business_rules_r26_retrain_keep, repo_docs_business_02_business_rules_r27_tune_keep, docs_tuning_keep_rule, docs_eval_retrain_keep_rule, src_retrain_keepnew, src_tune_tune_decide [INFERRED 0.75]
- **A failed step keeps the old working state** — docs_architecture_fail_open, repo_docs_business_02_business_rules_r01_hook_never_blocks, repo_docs_business_02_business_rules_r17_old_map_serves, src_brain_hook, src_mk_build [INFERRED 0.75]
- **Map rebuild flow** — repo_docs_business_workflows_w04_update_and_auto_add_update, repo_docs_business_workflows_w04_update_and_auto_add_refreshmapinbackground, repo_docs_business_workflows_w04_update_and_auto_add_registernewdocfolders, repo_docs_business_workflows_w04_update_and_auto_add_mkstale, repo_docs_business_workflows_w03_add_docs_buildmk [EXTRACTED 1.00]
- **Retrain keep loop** — repo_docs_business_workflows_w06_eval_and_retrain_retrainjs, repo_docs_business_workflows_w06_eval_and_retrain_trainrank, repo_docs_business_workflows_w06_eval_and_retrain_evalmap, repo_docs_business_workflows_w06_eval_and_retrain_keeprule [INFERRED 0.85]
- **Host adapters** — repo_docs_business_workflows_w08_other_hosts_hostsindex, repo_docs_business_workflows_w08_other_hosts_codexadapter, repo_docs_business_workflows_w08_other_hosts_geminiadapter, repo_docs_business_workflows_w08_other_hosts_copilotadapter, repo_docs_business_workflows_w08_other_hosts_genericadapter [EXTRACTED 1.00]

## Communities (82 total, 2 thin omitted)

### Community 0 - "Prompt Hook Tuning Model"
Cohesion: 0.05
Nodes (57): R27 tuned model is kept only when it wins, casesFile(), { embedText }, exportPairs(), fs, { loadProjects, getProject }, mk, mulberry32() (+49 more)

### Community 1 - "PDF and Document Extraction"
Cohesion: 0.08
Nodes (47): adocText(), delimited(), docxText(), elems(), ENT, extractText(), fs, htmlText() (+39 more)

### Community 2 - "Eval Map Runner"
Cohesion: 0.09
Nodes (38): argv, evalProject(), flag(), fs, { getEmbedder }, { homeDir }, judge(), judgeRendered() (+30 more)

### Community 3 - "Node Runtime Utilities"
Cohesion: 0.07
Nodes (23): os, path, { readCommon }, os, path, { readCommon, toolInput, pathsFrom }, readTouched(), path (+15 more)

### Community 4 - "Retrain Pipeline"
Cohesion: 0.06
Nodes (26): casesFile, { execFileSync }, fs, { getProject }, mk, os, P, path (+18 more)

### Community 5 - "ESLint and ML Dependencies"
Cohesion: 0.07
Nodes (29): eslint, @eslint/js, globals, @huggingface/transformers, jsdom, dependencies, @huggingface/transformers, description (+21 more)

### Community 6 - "Graph DB Storage"
Cohesion: 0.11
Nodes (25): R06 prompt history hides secrets, dbFile(), fs, history, lexical(), open(), path, sync() (+17 more)

### Community 7 - "Setup Options and Skips"
Cohesion: 0.10
Nodes (29): OPT_IN, SUPPORTED, ADD_SKIP, addGabriel(), CODE_EXT, dirBytes(), fetchModel(), findPython() (+21 more)

### Community 8 - "Update Tests"
Cohesion: 0.07
Nodes (21): assert, casesFile, casesHash, crypto, data, docs, env, filler (+13 more)

### Community 9 - "Hook Rules and Brain"
Cohesion: 0.13
Nodes (26): R01 hook never blocks a prompt, R07 an item is not sent twice in one session, W01 one prompt, capText(), contextArgs(), contextText(), dedupe(), emit() (+18 more)

### Community 10 - "Workflow Tests"
Cohesion: 0.08
Nodes (21): assert, BASE_ENV, BRAIN, CLAUDE_HOME, CODEX_HOME, DATA, ENV, fs (+13 more)

### Community 11 - "Add-Docs Tests"
Cohesion: 0.08
Nodes (20): assert, BRAIN, crypto, data, entry(), env, filler, fixture (+12 more)

### Community 12 - "Setup Tests"
Cohesion: 0.08
Nodes (22): assert, before, crypto, d2, d3, docs2, env, filler (+14 more)

### Community 13 - "Data Migration"
Cohesion: 0.11
Nodes (21): crypto, { dataDir, checkName }, expand(), fs, hashFile(), migrate(), MOVES, path (+13 more)

### Community 14 - "Project Map Core"
Cohesion: 0.10
Nodes (23): AUTO_SKIP, canon(), CHAIN_VERBS, chunkDoc(), clean(), CODE_FILLER, CODE_SYN, coreRe (+15 more)

### Community 15 - "Context Rules Loader"
Cohesion: 0.17
Nodes (22): contextFile(), addPrivateThesaurus(), blocks(), build(), expand(), fresh(), fs, graphFile() (+14 more)

### Community 16 - "Case Suggestions"
Cohesion: 0.13
Nodes (20): covered(), esc(), fs, { getProject }, headingKeys(), mk, newSuggestions(), norm() (+12 more)

### Community 17 - "Host Setup Tests"
Cohesion: 0.09
Nodes (15): assert, codexFile, crypto, env, fs, geminiFile, home, originalHash (+7 more)

### Community 18 - "Host Index"
Cohesion: 0.11
Nodes (16): HOSTS, assert, baseEnv(), BRAIN, codexHome, data, fakeHome, fs (+8 more)

### Community 19 - "Rank Training Script"
Cohesion: 0.10
Nodes (15): argv, casesFile, EXCLUDE, fs, { getEmbedder }, { getProject }, { homeDir }, LAMBDA (+7 more)

### Community 20 - "Background Refresh"
Cohesion: 0.19
Nodes (18): pinNote(), refreshMapInBackground(), registerNewDocFolders(), touchedHook(), dataDir(), projectsFile(), { dataDir, projectsFile, privateDir, checkName, defaultRuleFiles }, DEFAULTS (+10 more)

### Community 21 - "Graph Tests"
Cohesion: 0.11
Nodes (18): assert, cli, { DatabaseSync }, filler, fs, gdb, history, home (+10 more)

### Community 22 - "Tune Tests"
Cohesion: 0.11
Nodes (15): assert, base, BASE_SRC, BRAIN, CFG, DOCS, fs, GDATA (+7 more)

### Community 23 - "Wide Brain Test"
Cohesion: 0.11
Nodes (15): brain, BRAINDIR, FILL, FILL_S, FILL_T, fs, history, MAY_HIT (+7 more)

### Community 24 - "Search and Embeddings"
Cohesion: 0.18
Nodes (17): refreshInBackground(), search(), searchFull(), crypto, { dataDir, writeAtomic }, ehash(), embedders, { embedModel, DEFAULT_EMBED_MODEL } (+9 more)

### Community 25 - "Brain Tests"
Cohesion: 0.12
Nodes (15): assert, brain, { brainPath, tempHome, runBrain }, dims(), fake(), fs, g, h1 (+7 more)

### Community 26 - "Public Privacy Check"
Cohesion: 0.19
Nodes (16): DEFAULT_ROOT, escapeRe(), findWordsFile(), fs, gitLines(), isSkipped(), kindsForLine(), listFiles() (+8 more)

### Community 27 - "Docs Checker"
Cohesion: 0.23
Nodes (13): checkFile(), codeBlockHits(), codeMask(), fenceBlocks(), fs, lineNumberHits(), linkHits(), path (+5 more)

### Community 28 - "Pin Notes"
Cohesion: 0.18
Nodes (13): { dataDir }, fs, getPin(), parsePin(), path, seenFile(), setPin(), assert (+5 more)

### Community 29 - "History Tests"
Cohesion: 0.16
Nodes (13): hook(), assert, fs, histDir(), history, historyPath, path, runForget() (+5 more)

### Community 30 - "Setup Steps and Doc Guides"
Cohesion: 0.19
Nodes (14): Setup steps (10 steps), business and technical doc folders, Lean rules for code docs, Doc layout for a code base, Workflow page parts (trigger, steps, diagram, rules, result), expandHome(), main(), parseArgs() (+6 more)

### Community 31 - "Tips"
Cohesion: 0.16
Nodes (12): Tips: one per session, user view only, fs, path, paths, tipFor(), TIPS, assert, DATA (+4 more)

### Community 32 - "Eval Model"
Cohesion: 0.15
Nodes (12): { dataDir }, fs, gi, grid, home, judge(), mk, MODELS (+4 more)

### Community 33 - "Hook Freshness Tests"
Cohesion: 0.14
Nodes (11): assert, brain, cwd, dataDir, env, fs, home, os (+3 more)

### Community 34 - "Hook Measurement"
Cohesion: 0.15
Nodes (12): assert, fs, GENERIC, mk, owner, ownFile, path, paths (+4 more)

### Community 35 - "Public Check Tests"
Cohesion: 0.22
Nodes (12): assert, fs, J(), made, main(), makeTree(), mkTmp(), os (+4 more)

### Community 36 - "Map Tests"
Cohesion: 0.15
Nodes (11): assert, fs, home, links, mk, nodes, os, path (+3 more)

### Community 37 - "Tune Pairs Tests"
Cohesion: 0.15
Nodes (10): assert, base, DATA, DOCS, fs, HOME, os, path (+2 more)

### Community 38 - "Business Rules and Map Docs"
Cohesion: 0.20
Nodes (12): A map is a lead, not proof, Pros and cons: the setup pays off later, Business rules (R01 to R33), R13 a map is a lead, not proof, R16 a map is rebuilt when its sources change, R17 the old map serves until the new one is ready, R23 a learned link needs two confirmations and fades, R30 nothing leaves the machine after setup (+4 more)

### Community 39 - "Setup and Build Map"
Cohesion: 0.20
Nodes (10): setup.js addDocs(), brain.js build-mk step, Code graph must exist before any write, W03 Add docs, add-docs --relink mode, add-docs skill, Helper tools (graphify, superpowers, ponytail), First-run onboarding (+2 more)

### Community 40 - "Eval and Retrain Docs"
Cohesion: 0.18
Nodes (12): eval/eval-map.js, W06 Eval and retrain, retrain.js, train-rank.js, Find the docs a code change touches, graphify update step, W07 Refresh docs, Shrink docs while keeping every key idea (+4 more)

### Community 41 - "Dq Cache"
Cohesion: 0.27
Nodes (11): cache, { dataDir }, embedAll(), { embedModel, DEFAULT_EMBED_MODEL }, files(), fs, load(), path (+3 more)

### Community 42 - "Map Database Helpers"
Cohesion: 0.30
Nodes (12): dbFile(), hadMap(), hasMap(), learnReset(), learnShow(), legacyProject(), openMain(), openRw() (+4 more)

### Community 43 - "Projects Tests"
Cohesion: 0.17
Nodes (9): assert, dir, fs, later, m, os, path, ps (+1 more)

### Community 44 - "Paths and Hosts"
Cohesion: 0.24
Nodes (9): activeHost(), defaultRuleFiles(), fs, hostAdapter(), hosts, os, path, pluginRoot() (+1 more)

### Community 45 - "Doc Set Guides"
Cohesion: 0.24
Nodes (10): --code needs graphify-out/graph.json, no fallback to docs folder, Doc set: one folder of docs, Adding doc sets guide, projects.json fields (aliases, cwdHints, sessionGate), Map build (doc sets and code links), Routing and fallback doc set, graph not found error when a map is built, Troubleshooting guide (+2 more)

### Community 46 - "Ranking and Eval Docs"
Cohesion: 0.22
Nodes (10): Question index (optional), Ranking and trained rank weights, Eval case format, Leave-one-area-out honest score, Eval and training guide, Retrain keeps new weights only when strict count is not lower, Tuned model keep rule, Tuning the meaning model guide (+2 more)

### Community 47 - "Embedding Model"
Cohesion: 0.20
Nodes (10): Keep new weights only if strict score does not fall, src/embed.js meaning model, Local only, no download in the hook, src/setup.js, Tuning scripts (src/tune, retrain, train-rank), A tuned model wins only on scores, eval/suggest-cases.js, setup skill (+2 more)

### Community 48 - "Host Hook Adapters"
Cohesion: 0.20
Nodes (10): Host hook files change only with --apply after a backup, hosts/codex.js adapter, hosts/copilot.js adapter, hosts/gemini.js adapter, hosts/generic.js adapter, setup.js hostSetup(), hosts/index.js get(), W08 Other hosts (+2 more)

### Community 49 - "Architecture Docs"
Cohesion: 0.31
Nodes (10): Architecture page, tools/check-public.js privacy scan, Modules page, Dev workflow page, Release steps, test/run-all.js, Undeclared dompurify dependency, Findings page (+2 more)

### Community 50 - "Doc Path Helpers"
Cohesion: 0.27
Nodes (10): coreDoc(), docsRoot(), expand(), f32(), graphOnDisk(), graphPathOf(), loadRank(), mkSynonyms() (+2 more)

### Community 51 - "Map Builder"
Cohesion: 0.31
Nodes (10): checkName(), docsDir(), addDocs(), buildMap(), codeHintName(), countLine(), graphRel(), hasCodeFiles() (+2 more)

### Community 52 - "ONNX Export"
Cohesion: 0.22
Nodes (8): exportOnnx(), fs, os, path, SCRIPT, { spawnSync }, TOKEN_FILES, venvPython()

### Community 53 - "Test Runner"
Cohesion: 0.20
Nodes (7): files, fs, LOCK, path, ROOT, scan, { spawnSync }

### Community 54 - "Embed Model Tests"
Cohesion: 0.20
Nodes (8): assert, base, embed, { embedModel, DEFAULT_EMBED_MODEL }, fs, os, path, ROOT

### Community 55 - "Dedupe and Hook Rules"
Cohesion: 0.31
Nodes (9): Dedupe: an item is not sent twice per session, Hook never blocks a prompt (fail open), Learning from use, gabriel architecture, Quiet gate: best score must reach 0.65, Spreading search (map firing), Neuron (one doc section or code name in the map), Glossary (+1 more)

### Community 56 - "Eval Rules"
Cohesion: 0.22
Nodes (7): brain, CASES, fs, home, mk, path, PRIVATE_CASES

### Community 57 - "Corpus Maker"
Cohesion: 0.25
Nodes (8): clean(), fs, LICENSE, out, path, paths, SKIP_DIR, walk()

### Community 58 - "Doc Family Builder"
Cohesion: 0.31
Nodes (9): build(), camel(), families(), listDocs(), roleWords(), slug(), sources(), spansOf() (+1 more)

### Community 59 - "Check-Docs Tests"
Cohesion: 0.22
Nodes (7): assert, CHECK, fs, os, path, ROOT, { spawnSync }

### Community 60 - "Test Utilities"
Cohesion: 0.22
Nodes (8): home(), brainPath, fs, homes, os, path, { spawnSync }, tempHome()

### Community 61 - "Paths Tests"
Cohesion: 0.22
Nodes (7): assert, fs, old, os, p, path, tmpHome

### Community 62 - "Plain Docs Tests"
Cohesion: 0.22
Nodes (8): assert, data, fs, home, mk, os, path, tmp

### Community 63 - "Version Tests"
Cohesion: 0.22
Nodes (7): assert, fs, market, path, pkg, plugin, ROOT

### Community 64 - "Prompt History Docs"
Cohesion: 0.29
Nodes (8): Prompt history and similar earlier prompts, Host adapter (reads input, writes output per tool), Copilot ignores hook output, so it must call gabriel itself, Hosts guide, Shared data folder across hosts, Nothing leaves the machine after setup, Privacy guide, Prompt history redaction patterns

### Community 65 - "Domain Map Docs"
Cohesion: 0.25
Nodes (8): Domain map, Ten parts, each with one owner file, R26 retrain keeps new weights only when strict score is not lower, Business docs index, W02 first setup and onboarding, gabriel repo docs index, writeOutput(), keepNew()

### Community 66 - "Workflow Guide"
Cohesion: 0.38
Nodes (7): Workflows guide (step by step flows), effective(), integrate(), isFallback(), mapFile(), remember(), touched()

### Community 67 - "Build Lock and Refresh"
Cohesion: 0.38
Nodes (7): Background build lock (one build at a time), mk.js stale(), W04 Update and auto-add, refreshMapInBackground(), registerNewDocFolders(), setup.js update(), Rebuild in the background with locks

### Community 68 - "Atomic Writes and Rules"
Cohesion: 0.29
Nodes (7): Atomic writes (temp file then rename), src/brain.js entry, Never block a prompt, src/rules.js rules graph, Session dedupe, hooks/hooks.json, status skill

### Community 69 - "Eval and Doc Readers"
Cohesion: 0.29
Nodes (7): eval/ scoring scripts, src/extract.js doc readers, src/mk.js project map, node:sqlite, not a native package, src/projects.js, src/dq.js question index, Q_GATE dead option in mk.js

### Community 70 - "Lint Tests"
Cohesion: 0.29
Nodes (6): bin, fs, path, r, ROOT, { spawnSync }

### Community 71 - "Mermaid Tests"
Cohesion: 0.29
Nodes (5): dom, fs, path, ROOT, SKIP

### Community 72 - "Changelog and Pinning"
Cohesion: 0.60
Nodes (5): gabriel changelog, Pin one doc set per session (gabriel use), R12 a named doc set gets the prompt first, namedProjects(), searchAll()

### Community 73 - "Transformer Export Script"
Cohesion: 0.60
Nodes (4): Path, find_transformer_dir(), main(), Export a trained sentence-transformers model to ONNX and quantize it to 8 bit.…

### Community 74 - "Learned Link Weights"
Cohesion: 0.40
Nodes (5): Learned link weight update, mk.js remember() and last table, mk.js touched(), W05 Learning from use, brain.js touchedHook()

### Community 75 - "Training Script"
Cohesion: 0.60
Nodes (3): main(), parse_args(), read_pairs()

### Community 76 - "Default Rules and Preferences"
Cohesion: 0.50
Nodes (4): Default working rules used when no preferences.md exists, Default preferences file, Rules graph, R03 rules block caps (6 rules, 2400 characters)

### Community 77 - "Doc File Discovery"
Cohesion: 0.67
Nodes (4): extSet(), isDocName(), countDocs(), listDocFiles()

## Knowledge Gaps
- **622 isolated node(s):** `globals`, `fs`, `path`, `{ homeDir }`, `paths` (+617 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `writeOutput()` connect `Domain Map Docs` to `Hook Rules and Brain`, `Node Runtime Utilities`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `Workflows guide (step by step flows)` connect `Workflow Guide` to `Eval Map Runner`, `Graph DB Storage`, `Setup Options and Skips`, `Changelog and Pinning`, `Hook Rules and Brain`, `Data Migration`, `Ranking and Eval Docs`, `Background Refresh`, `Dedupe and Hook Rules`, `Search and Embeddings`, `Doc Family Builder`, `Setup Steps and Doc Guides`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `addDocs()` connect `Map Builder` to `PDF and Document Extraction`, `Business Rules and Map Docs`, `Setup Options and Skips`, `Paths and Hosts`, `Doc Set Guides`, `Doc File Discovery`, `Background Refresh`, `Doc Family Builder`, `Setup Steps and Doc Guides`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `build()` (e.g. with `refreshMapInBackground()` and `mk.js`) actually correct?**
  _`build()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `globals`, `fs`, `path` to the rest of the system?**
  _622 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Prompt Hook Tuning Model` be split into smaller, more focused modules?**
  _Cohesion score 0.053005464480874315 - nodes in this community are weakly interconnected._
- **Should `PDF and Document Extraction` be split into smaller, more focused modules?**
  _Cohesion score 0.07686274509803921 - nodes in this community are weakly interconnected._