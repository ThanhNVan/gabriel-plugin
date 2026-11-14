# Graph Report - gabriel-plugin  (2026-11-14)

## Corpus Check
- 118 files · ~104,917 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1203 nodes · 1968 edges · 74 communities (71 shown, 3 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 156 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Architecture and Hook Rules
- Doc Name Checks
- Other Hosts Setup
- Setup Onboarding and Tune
- Map Build Helpers
- Module and Dev Docs
- Document Text Extraction
- Lint and Model Deps
- Graph Database Access
- Update Tests
- Workflow Tests
- Add Docs Tests
- Setup Tests
- Data Migration
- Eval Map Runner
- Eval Case Suggestions
- Host Setup Tests
- Doc Folder Registration
- Extract Tests
- Rank Training Script
- Doc Set Guides
- Graph Tests
- Tune Tests
- Wide Test Fixtures
- Train Tests
- Brain Tests
- Host Tests
- Retrain Script
- Doc Link Checker
- Pin File
- History Tests
- Eval Model Grid
- Background Map Rebuild
- Hook Freshness Tests
- Hook Timing Measure
- Chain and Graph Helpers
- Eval Pair Export
- Public Check Tests
- Map Tests
- Tune Pair Tests
- Routing and Architecture Docs
- Tips Feature
- Project Tests
- Host and Privacy Guides
- Host Paths
- Recall and Dedupe Rules
- Eval Rerank
- ONNX Export
- Embed Model Tests
- Rule Eval
- Add and Update Workflows
- Eval and Refresh Workflows
- Corpus Builder
- Doc Check Tests
- Test Utilities
- Path Tests
- Plain Docs Tests
- Keep Tune Tests
- Version Tests
- Business Docs Index
- Learning From Use
- Lint Tests
- Mermaid Tests
- Retrieval Tests
- Changelog and Session Pin
- Default Preferences
- ONNX Export Script
- Training Script
- Learned Links
- ESLint Config
- Map Rules
- Map Skill

## God Nodes (most connected - your core abstractions)
1. `getProject()` - 23 edges
2. `build()` - 22 edges
3. `search()` - 22 edges
4. `addDocs()` - 22 edges
5. `main()` - 21 edges
6. `extractText()` - 20 edges
7. `dataDir()` - 20 edges
8. `loadProjects()` - 19 edges
9. `dataDir()` - 17 edges
10. `update()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `add-docs --relink mode` --references--> `addDocs()`  [EXTRACTED]
  repo-docs/business/workflows/W03-add-docs.md → src/setup.js
- `Workflows guide` --semantically_similar_to--> `W01 one prompt`  [INFERRED] [semantically similar]
  docs/WORKFLOWS.md → repo-docs/business/workflows/W01-one-prompt.md
- `Workflows guide` --semantically_similar_to--> `W02 first setup and onboarding`  [INFERRED] [semantically similar]
  docs/WORKFLOWS.md → repo-docs/business/workflows/W02-first-setup-and-onboarding.md
- `touched()` --references--> `45-minute learning window`  [EXTRACTED]
  src/mk.js → repo-docs/business/workflows/W05-learning-from-use.md
- `W03 Add docs` --references--> `checkName()`  [EXTRACTED]
  repo-docs/business/workflows/W03-add-docs.md → src/paths.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **One prompt flow** — repo_docs_business_workflows_w01_one_prompt, repo_docs_business_workflows_w01_one_prompt_hook, repo_docs_business_02_business_rules_r03_rules_block_limits, repo_docs_business_02_business_rules_r07_item_not_sent_twice, repo_docs_business_02_business_rules_r08_map_block_limits, docs_architecture_spreading_search [INFERRED 0.75]
- **Learning loop** — docs_architecture_learning, repo_docs_business_03_state_machines_learned_link, repo_docs_business_02_business_rules_r23_learned_link_confirmations, repo_docs_business_02_business_rules_r24_learned_never_start_search, docs_architecture_map [INFERRED 0.75]
- **Keep new weights or model only if better** — repo_docs_business_02_business_rules_r26_retrain_keeps_weights, repo_docs_business_02_business_rules_r27_tune_keeps_model, docs_eval_retrain, docs_tuning_keep_rule, docs_eval_strict_score [INFERRED 0.75]
- **Learning from use** — repo_docs_business_workflows_w05_learning_from_use_learn_window, src_mk_remember, src_mk_touched, repo_docs_business_workflows_w05_learning_from_use_learned_link [EXTRACTED 1.00]
- **Background map rebuild** — repo_docs_business_workflows_w04_update_and_auto_add_background_run, src_mk_stale, repo_docs_technical_01_architecture_background_rebuild, src_setup_update [INFERRED 0.85]
- **Host hook writes need --apply** — repo_docs_business_workflows_w08_other_hosts_apply_rule, src_hosts_codex, src_hosts_gemini, src_setup [INFERRED 0.75]

## Communities (74 total, 3 thin omitted)

### Community 0 - "Architecture and Hook Rules"
Cohesion: 0.05
Nodes (79): Architecture doc, Local only: the hook never downloads, Never block a prompt, Session dedupe, status skill, capText(), contextArgs(), contextText() (+71 more)

### Community 1 - "Doc Name Checks"
Cohesion: 0.08
Nodes (50): Code graph must exist before any write, extSet(), isDocName(), skipName(), ADD_SKIP, addDocs(), addGabriel(), buildMap() (+42 more)

### Community 2 - "Other Hosts Setup"
Cohesion: 0.07
Nodes (26): W08 Other hosts, Hook files change only with --apply after a backup, os, path, { readCommon }, os, path, { readCommon, toolInput, pathsFrom } (+18 more)

### Community 3 - "Setup Onboarding and Tune"
Cohesion: 0.08
Nodes (41): setup skill, First-run onboarding (four steps), modelsDir(), Python tune packages (requirements.txt), ask(), bar(), BRAIN, capture() (+33 more)

### Community 4 - "Map Build Helpers"
Cohesion: 0.08
Nodes (35): pinNote(), AUTO_SKIP, build(), camel(), canon(), CHAIN_DEFAULT, CHAIN_VERBS, chunkDoc() (+27 more)

### Community 5 - "Module and Dev Docs"
Cohesion: 0.08
Nodes (30): Modules doc, Dev workflow doc, Findings doc, Chain setting rests on 12 questions, Pin file expires after 7 days, Skipped checks count as passed, Technical docs index, files (+22 more)

### Community 6 - "Document Text Extraction"
Cohesion: 0.16
Nodes (29): adocText(), delimited(), docxText(), elems(), ENT, extractText(), fs, htmlText() (+21 more)

### Community 7 - "Lint and Model Deps"
Cohesion: 0.07
Nodes (29): eslint, @eslint/js, globals, @huggingface/transformers, jsdom, dependencies, @huggingface/transformers, description (+21 more)

### Community 8 - "Graph Database Access"
Cohesion: 0.10
Nodes (25): dbFile(), fs, history, lexical(), open(), path, sync(), append() (+17 more)

### Community 9 - "Update Tests"
Cohesion: 0.07
Nodes (21): assert, casesFile, casesHash, crypto, data, docs, env, filler (+13 more)

### Community 10 - "Workflow Tests"
Cohesion: 0.08
Nodes (21): assert, BASE_ENV, BRAIN, CLAUDE_HOME, CODEX_HOME, DATA, ENV, fs (+13 more)

### Community 11 - "Add Docs Tests"
Cohesion: 0.08
Nodes (20): assert, BRAIN, crypto, data, entry(), env, filler, fixture (+12 more)

### Community 12 - "Setup Tests"
Cohesion: 0.08
Nodes (22): assert, before, crypto, d2, d3, docs2, env, filler (+14 more)

### Community 13 - "Data Migration"
Cohesion: 0.11
Nodes (21): crypto, { dataDir, checkName }, expand(), fs, hashFile(), migrate(), MOVES, path (+13 more)

### Community 14 - "Eval Map Runner"
Cohesion: 0.18
Nodes (21): argv, evalProject(), flag(), fs, { getEmbedder }, { homeDir }, judge(), judgeRendered() (+13 more)

### Community 15 - "Eval Case Suggestions"
Cohesion: 0.13
Nodes (20): covered(), esc(), fs, { getProject }, headingKeys(), mk, newSuggestions(), norm() (+12 more)

### Community 16 - "Host Setup Tests"
Cohesion: 0.09
Nodes (15): assert, codexFile, crypto, env, fs, geminiFile, home, originalHash (+7 more)

### Community 17 - "Doc Folder Registration"
Cohesion: 0.20
Nodes (20): registerNewDocFolders(), touchedHook(), checkName(), dataDir(), docsDir(), privateDir(), projectsFile(), { dataDir, projectsFile, privateDir, checkName, defaultRuleFiles } (+12 more)

### Community 18 - "Extract Tests"
Cohesion: 0.11
Nodes (19): assert, check(), data, DOCX, ex, fs, home, main() (+11 more)

### Community 19 - "Rank Training Script"
Cohesion: 0.10
Nodes (15): argv, casesFile, EXCLUDE, fs, { getEmbedder }, { getProject }, { homeDir }, LAMBDA (+7 more)

### Community 20 - "Doc Set Guides"
Cohesion: 0.16
Nodes (19): Adding doc sets guide, Code graph link in add-docs (--code), Doc layout guide, Lean doc rules, Eval and training guide, Leave-one-area-out score, Retrain (keep better weights), Strict score (+11 more)

### Community 21 - "Graph Tests"
Cohesion: 0.11
Nodes (18): assert, cli, { DatabaseSync }, filler, fs, gdb, history, home (+10 more)

### Community 22 - "Tune Tests"
Cohesion: 0.11
Nodes (15): assert, base, BASE_SRC, BRAIN, CFG, DOCS, fs, GDATA (+7 more)

### Community 23 - "Wide Test Fixtures"
Cohesion: 0.11
Nodes (15): brain, BRAINDIR, FILL, FILL_S, FILL_T, fs, history, MAY_HIT (+7 more)

### Community 24 - "Train Tests"
Cohesion: 0.12
Nodes (15): reason(), assert, base, cli(), CORPUS, DATA, EMPTY, env (+7 more)

### Community 25 - "Brain Tests"
Cohesion: 0.12
Nodes (15): assert, brain, { brainPath, tempHome, runBrain }, dims(), fake(), fs, g, h1 (+7 more)

### Community 26 - "Host Tests"
Cohesion: 0.12
Nodes (15): assert, baseEnv(), BRAIN, codexHome, data, fakeHome, fs, hosts (+7 more)

### Community 27 - "Retrain Script"
Cohesion: 0.12
Nodes (12): casesFile, { execFileSync }, fs, { getProject }, keepNew(), mk, os, P (+4 more)

### Community 28 - "Doc Link Checker"
Cohesion: 0.23
Nodes (13): checkFile(), codeBlockHits(), codeMask(), fenceBlocks(), fs, lineNumberHits(), linkHits(), path (+5 more)

### Community 29 - "Pin File"
Cohesion: 0.18
Nodes (13): { dataDir }, fs, getPin(), parsePin(), path, seenFile(), setPin(), assert (+5 more)

### Community 30 - "History Tests"
Cohesion: 0.16
Nodes (13): hook(), assert, fs, histDir(), history, historyPath, path, runForget() (+5 more)

### Community 31 - "Eval Model Grid"
Cohesion: 0.15
Nodes (12): { dataDir }, fs, gi, grid, home, judge(), mk, MODELS (+4 more)

### Community 32 - "Background Map Rebuild"
Cohesion: 0.24
Nodes (14): Background run from the prompt hook, Rebuild maps in the background with locks, dbFile(), effective(), hadMap(), hasMap(), integrate(), learnShow() (+6 more)

### Community 33 - "Hook Freshness Tests"
Cohesion: 0.14
Nodes (11): assert, brain, cwd, dataDir, env, fs, home, os (+3 more)

### Community 34 - "Hook Timing Measure"
Cohesion: 0.15
Nodes (12): assert, fs, GENERIC, mk, owner, ownFile, path, paths (+4 more)

### Community 35 - "Chain and Graph Helpers"
Cohesion: 0.23
Nodes (13): chainNum(), coreDoc(), docsRoot(), expand(), f32(), graphOnDisk(), graphPathOf(), isFallback() (+5 more)

### Community 36 - "Eval Pair Export"
Cohesion: 0.22
Nodes (11): casesFile(), { embedText }, exportPairs(), fs, { loadProjects, getProject }, mk, mulberry32(), path (+3 more)

### Community 37 - "Public Check Tests"
Cohesion: 0.22
Nodes (12): assert, fs, J(), made, main(), makeTree(), mkTmp(), os (+4 more)

### Community 38 - "Map Tests"
Cohesion: 0.15
Nodes (11): assert, fs, home, links, mk, nodes, os, path (+3 more)

### Community 39 - "Tune Pair Tests"
Cohesion: 0.15
Nodes (10): assert, base, DATA, DOCS, fs, HOME, os, path (+2 more)

### Community 40 - "Routing and Architecture Docs"
Cohesion: 0.23
Nodes (12): Architecture guide, Doc-set map, Question index, Routing and fallback, R09 One doc set leads, a close second gets a short block, R10 General docs answer only when no doc set does, R11 Session gate (opt-in), R12 A named doc set gets the prompt first (+4 more)

### Community 41 - "Tips Feature"
Cohesion: 0.18
Nodes (10): fs, path, paths, TIPS, assert, DATA, fs, os (+2 more)

### Community 42 - "Project Tests"
Cohesion: 0.17
Nodes (9): assert, dir, fs, later, m, os, path, ps (+1 more)

### Community 43 - "Host and Privacy Guides"
Cohesion: 0.18
Nodes (11): Hosts guide, Copilot cannot get the map on each prompt, Host adapter (src/hosts), Privacy guide, Nothing leaves the machine after setup, Prompt history redaction, R02 Short and slash prompts get no context, R06 Prompt history hides secrets (+3 more)

### Community 44 - "Host Paths"
Cohesion: 0.24
Nodes (9): activeHost(), defaultRuleFiles(), fs, hostAdapter(), hosts, os, path, pluginRoot() (+1 more)

### Community 45 - "Recall and Dedupe Rules"
Cohesion: 0.22
Nodes (10): projects.json fields, Two links away step, Dedupe per session, Spreading search (firing), R01 Hook never blocks a prompt, R07 An item is not sent twice in one session, R08 Map block: 6 doc hits, 6 code hits, 2200 characters, R34 Two links away: code names (+2 more)

### Community 46 - "Eval Rerank"
Cohesion: 0.20
Nodes (9): argv, fs, { getEmbedder }, { homeDir }, { judge, judgeRendered }, mk, opt(), path (+1 more)

### Community 47 - "ONNX Export"
Cohesion: 0.22
Nodes (8): exportOnnx(), fs, os, path, SCRIPT, { spawnSync }, TOKEN_FILES, venvPython()

### Community 48 - "Embed Model Tests"
Cohesion: 0.20
Nodes (8): assert, base, embed, { embedModel, DEFAULT_EMBED_MODEL }, fs, os, path, ROOT

### Community 49 - "Rule Eval"
Cohesion: 0.22
Nodes (7): brain, CASES, fs, home, mk, path, PRIVATE_CASES

### Community 50 - "Add and Update Workflows"
Cohesion: 0.22
Nodes (9): W03 Add docs, New projects.json entry for a doc set, add-docs --relink mode, Size limit: over 20000 files or 500 MB needs --yes, W04 Update and auto-add, --dry-run mode, Register new doc folders, add-docs skill (+1 more)

### Community 51 - "Eval and Refresh Workflows"
Cohesion: 0.25
Nodes (9): W06 Eval and retrain, Keep new weights only when strict score does not fall, W07 Refresh docs, graphify update step, Ask before --force when node count falls, Shrink docs and keep every key idea, refresh-docs skill, retrain skill (+1 more)

### Community 52 - "Corpus Builder"
Cohesion: 0.25
Nodes (8): clean(), fs, LICENSE, out, path, paths, SKIP_DIR, walk()

### Community 53 - "Doc Check Tests"
Cohesion: 0.22
Nodes (7): assert, CHECK, fs, os, path, ROOT, { spawnSync }

### Community 54 - "Test Utilities"
Cohesion: 0.22
Nodes (8): home(), brainPath, fs, homes, os, path, { spawnSync }, tempHome()

### Community 55 - "Path Tests"
Cohesion: 0.22
Nodes (7): assert, fs, old, os, p, path, tmpHome

### Community 56 - "Plain Docs Tests"
Cohesion: 0.22
Nodes (8): assert, data, fs, home, mk, os, path, tmp

### Community 57 - "Keep Tune Tests"
Cohesion: 0.22
Nodes (8): assert, BASE, DATA, fs, os, path, ROOT, T

### Community 58 - "Version Tests"
Cohesion: 0.22
Nodes (7): assert, fs, market, path, pkg, plugin, ROOT

### Community 59 - "Business Docs Index"
Cohesion: 0.50
Nodes (8): Domain map, Setup and onboarding part, Business rules, State machines, Glossary, Business docs index, W02 first setup and onboarding, Repo docs index

### Community 60 - "Learning From Use"
Cohesion: 0.32
Nodes (8): W05 Learning from use, 45-minute learning window, Learned link weight and two confirmations, learnReset(), mapFile(), openRw(), remember(), touched()

### Community 61 - "Lint Tests"
Cohesion: 0.29
Nodes (6): bin, fs, path, r, ROOT, { spawnSync }

### Community 62 - "Mermaid Tests"
Cohesion: 0.29
Nodes (5): dom, fs, path, ROOT, SKIP

### Community 63 - "Retrieval Tests"
Cohesion: 0.33
Nodes (5): assert, fs, mk, os, path

### Community 64 - "Changelog and Session Pin"
Cohesion: 0.40
Nodes (5): CHANGELOG, Code docs folder layout, Session pin (gabriel use), R35 Session pin, Onboarding steps (helper tools, graph, docs, stack docs)

### Community 65 - "Default Preferences"
Cohesion: 0.40
Nodes (5): Default preferences file, Default working rules (preferences), Rules graph, R03 Rules block: 6 rules, 2400 characters, R15 Default preferences only without preferences.md

### Community 66 - "ONNX Export Script"
Cohesion: 0.60
Nodes (4): Path, find_transformer_dir(), main(), Export a trained sentence-transformers model to ONNX and quantize it to 8 bit.…

### Community 67 - "Training Script"
Cohesion: 0.60
Nodes (3): main(), parse_args(), read_pairs()

### Community 68 - "Learned Links"
Cohesion: 1.00
Nodes (4): Learning from use, R23 A learned link needs two confirmations and fades, R24 Learned links never start a search, Learned link states

## Knowledge Gaps
- **607 isolated node(s):** `globals`, `fs`, `path`, `{ homeDir }`, `paths` (+602 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Modules doc` connect `Module and Dev Docs` to `Architecture and Hook Rules`, `Doc Name Checks`, `Setup Onboarding and Tune`, `Map Build Helpers`, `Eval Map Runner`, `Eval Case Suggestions`, `Rank Training Script`, `Retrain Script`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Technical docs index` connect `Module and Dev Docs` to `Architecture and Hook Rules`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `globals`, `fs`, `path` to the rest of the system?**
  _607 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Architecture and Hook Rules` be split into smaller, more focused modules?**
  _Cohesion score 0.05289450484866295 - nodes in this community are weakly interconnected._
- **Should `Doc Name Checks` be split into smaller, more focused modules?**
  _Cohesion score 0.0815686274509804 - nodes in this community are weakly interconnected._
- **Should `Other Hosts Setup` be split into smaller, more focused modules?**
  _Cohesion score 0.06553911205073996 - nodes in this community are weakly interconnected._
- **Should `Setup Onboarding and Tune` be split into smaller, more focused modules?**
  _Cohesion score 0.08246225319396051 - nodes in this community are weakly interconnected._