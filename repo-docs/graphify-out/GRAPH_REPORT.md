# Graph Report - gabriel-plugin  (2026-11-15)

## Corpus Check
- 127 files · ~121,878 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1288 nodes · 1972 edges · 94 communities (80 shown, 14 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 176 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Rationale: a tuned model wins only on scores / tune-embeddin
- Rationale: node:sqlite, not a native package / mk.js / addEx
- Host adapter / W08 Other hosts / claude.js
- Rationale: backup before host hook file write (--apply) / up
- eval-map.js / argv / { defLine }
- retrain.js / casesFile / { execFileSync }
- eslint / @eslint/js / globals
- pdfjs-dist/legacy/build/pdf.mjs / extract.js / adocText()
- index.js / get() / HOSTS
- test-update.js / assert / casesFile
- repo.js / checkRepo() / defLine()
- test-workflow.js / assert / BASE_ENV
- test-add-docs.js / assert / BRAIN
- test-setup.js / assert / before
- migrate-data.js / crypto / { dataDir, checkName }
- contextFile() / pluginRoot() / rules.js
- suggest-cases.js / covered() / esc()
- test-setup-hosts.js / assert / backups()
- history.js / append() / crypto
- test-brain.js / assert / brain
- test-extract.js / assert / check()
- train-rank.js / argv / casesFile
- dbFile() / docsRoot() / effective()
- test-graph.js / assert / cli
- test-tune.js / assert / base
- wide-test.js / brain / BRAINDIR
- Rationale: local only, the hook never downloads / Rationale:
- test-hosts.js / assert / baseEnv()
- check-public.js / DEFAULT_ROOT / escapeRe()
- pinNote() / pin.js / { dataDir }
- getProject() / loadProjects() / projectNames()
- addDocs() / addGabriel() / buildMap()
- test-history.js / assert / fs
- check-docs.js / checkFile() / codeBlockHits()
- brain.js / contextArgs() / { debug }
- eval-model.js / { dataDir } / fs
- test-hook-fresh.js / assert / brain
- Map build / Question index / Eval case format
- measure-hook.js / assert / fs
- dq.js / cache / { dataDir }
- tips.js / fs / path
- test-check-public.js / assert / fs
- test-map.js / assert / fs
- test-tune-pairs.js / assert / base
- Retrain keep rule (0.3.0 entry) / No-name retrain always kee
- Hook fails open / Fallback gate value (1.7 in ARCHITECTURE) 
- Rationale: atomic writes (temp file, then rename) / mk.db (p
- test-projects.js / assert / dir
- learn-reset per doc set / Two links away code names (0.3.0) 
- projects.json (doc set config) / Quiet gate (0.65) / Task 5:
- CI workflow test.yml / Lint and test on Windows and Ubuntu /
- W03 Add docs / W07 Refresh docs / Doc set (project)
- Rationale: session dedupe (save state only after output is w
- graphdb.js / dbFile() / fs
- exportOnnx() / fs / export-onnx.js
- run-all.js / alive() / files
- test-embed-model.js / assert / base
- eval-rules.js / brain / CASES
- 02-business-rules.md (cited, not in chunk) / Repo docs index
- make-corpus.js / clean() / fs
- test-check-docs.js / assert / CHECK
- test-paths.js / assert / fs
- test-plain-docs.js / assert / data
- test-version.js / assert / fs
- search() / searchFull() / touchedHook()
- test-debuglog.js / assert / DATA
- Rationale: rebuild maps in background with locks, old map se
- statusview.js / statusBlock() / test-statusview.js
- test-lint.js / bin / fs
- test-mermaid.js / dom / fs
- test-util.js / brainPath / fs
- Exact code and doc lines (0.3.0) / Dedupe per session / repo
- test-retrieval.js / assert / fs
- Code graph check (wrong-repo warning) / graph not found / R3
- Path / find_transformer_dir() / main()
- train.py / main() / parse_args()
- Code docs layout / Keep it lean rules / Workflow page templa
- Deleting everything / Prompt history redaction / What never 
- Keep rule (tuned model) / Split held-out questions by doc fi
- eslint.config.js / globals
- Default working rules (defaults/preferences.md)
- Copilot cannot get the map on each prompt
- Eval and retrain scripts (eval/eval-map.js, src/retrain.js)
- src/history.js (prompt history owner)
- src/mk.js (doc-set map owner)
- src/rules.js (rules graph owner)
- src/setup.js (setup owner)
- Similar earlier prompt
- Two links away (glossary term)
- Who uses gabriel (developer, doc owner, tuner)
- Rationale: the refresh skill never commits or pushes
- Data folder (GABRIEL_DATA)

## God Nodes (most connected - your core abstractions)
1. `search()` - 23 edges
2. `addDocs()` - 22 edges
3. `main()` - 21 edges
4. `build()` - 21 edges
5. `extractText()` - 18 edges
6. `relinkDocs()` - 17 edges
7. `run()` - 16 edges
8. `update()` - 16 edges
9. `dataDir()` - 14 edges
10. `loadProjects()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Rationale: never block a prompt (time limits, fail open)` --rationale_for--> `hook()`  [EXTRACTED]
  repo-docs/technical/01-architecture.md → src/brain.js
- `W03 Add docs` --references--> `hasFiles()`  [EXTRACTED]
  repo-docs/business/workflows/W03-add-docs.md → src/projects.js
- `embedNodes()` --references--> `vectors.json`  [EXTRACTED]
  src/embed.js → repo-docs/technical/01-architecture.md
- `W03 Add docs` --references--> `checkName()`  [EXTRACTED]
  repo-docs/business/workflows/W03-add-docs.md → src/paths.js
- `W03 Add docs` --references--> `addDocs()`  [EXTRACTED]
  repo-docs/business/workflows/W03-add-docs.md → src/setup.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Why no map flow** — skills_why_skill_why, skills_why_skill_next_steps, docs_troubleshooting_no_map, docs_architecture_gate, docs_architecture_session_gate, docs_superpowers_plans_task_5_why [INFERRED 0.75]
- **Hook fails open** — docs_architecture_fail_open, repo_docs_business_02_business_rules_hook_never_blocks, docs_workflows_one_prompt, docs_superpowers_plans_global_constraints [INFERRED 0.85]
- **Retrain keep rule** — repo_docs_business_02_business_rules_r26_retrain_keep, docs_eval_retrain_keep_rule, skills_retrain_skill_retrain, repo_docs_business_workflows_w06_eval_and_retrain_flow, repo_docs_technical_02_modules_src_retrain_js, changelog_retrain_guard [INFERRED 0.85]

## Communities (94 total, 14 thin omitted)

### Community 0 - "Rationale: a tuned model wins only on scores / tune-embeddin"
Cohesion: 0.07
Nodes (48): Rationale: a tuned model wins only on scores, tune-embeddings skill, modelsDir(), ask(), bar(), BRAIN, capture(), copyIfThere() (+40 more)

### Community 1 - "Rationale: node:sqlite, not a native package / mk.js / addEx"
Cohesion: 0.07
Nodes (46): Rationale: node:sqlite, not a native package, addExactLines(), addNamedCode(), addNeighbours(), AUTO_SKIP, canon(), CHAIN_DEFAULT, CHAIN_VERBS (+38 more)

### Community 2 - "Host adapter / W08 Other hosts / claude.js"
Cohesion: 0.08
Nodes (25): Host adapter, W08 Other hosts, os, path, { readCommon }, os, path, { readCommon, toolInput, pathsFrom } (+17 more)

### Community 3 - "Rationale: backup before host hook file write (--apply) / up"
Cohesion: 0.09
Nodes (37): Rationale: backup before host hook file write (--apply), update skill, extSet(), isDocName(), OPT_IN, SUPPORTED, ADD_SKIP, CODE_EXT (+29 more)

### Community 4 - "eval-map.js / argv / { defLine }"
Cohesion: 0.10
Nodes (34): argv, { defLine }, evalProject(), exactOf(), flag(), fs, { getEmbedder }, { homeDir } (+26 more)

### Community 5 - "retrain.js / casesFile / { execFileSync }"
Cohesion: 0.06
Nodes (28): casesFile, { execFileSync }, force, fs, { getProject }, keepNew(), mk, os (+20 more)

### Community 6 - "eslint / @eslint/js / globals"
Cohesion: 0.07
Nodes (29): eslint, @eslint/js, globals, @huggingface/transformers, jsdom, mermaid, dependencies, @huggingface/transformers (+21 more)

### Community 7 - "pdfjs-dist/legacy/build/pdf.mjs / extract.js / adocText()"
Cohesion: 0.17
Nodes (28): adocText(), delimited(), docxText(), elems(), ENT, extractText(), fs, htmlText() (+20 more)

### Community 8 - "index.js / get() / HOSTS"
Cohesion: 0.13
Nodes (24): HOSTS, activeHost(), checkName(), dataDir(), defaultRuleFiles(), docsDir(), fs, hostAdapter() (+16 more)

### Community 9 - "test-update.js / assert / casesFile"
Cohesion: 0.07
Nodes (21): assert, casesFile, casesHash, crypto, data, docs, env, filler (+13 more)

### Community 10 - "repo.js / checkRepo() / defLine()"
Cohesion: 0.11
Nodes (21): checkRepo(), defLine(), defLineIn(), defRegexes(), escapeRe(), exactLines(), { execFileSync }, fileLines() (+13 more)

### Community 11 - "test-workflow.js / assert / BASE_ENV"
Cohesion: 0.08
Nodes (21): assert, BASE_ENV, BRAIN, CLAUDE_HOME, CODEX_HOME, DATA, ENV, fs (+13 more)

### Community 12 - "test-add-docs.js / assert / BRAIN"
Cohesion: 0.08
Nodes (20): assert, BRAIN, crypto, data, entry(), env, filler, fixture (+12 more)

### Community 13 - "test-setup.js / assert / before"
Cohesion: 0.08
Nodes (22): assert, before, crypto, d2, d3, docs2, env, filler (+14 more)

### Community 14 - "migrate-data.js / crypto / { dataDir, checkName }"
Cohesion: 0.11
Nodes (21): crypto, { dataDir, checkName }, expand(), fs, hashFile(), migrate(), MOVES, path (+13 more)

### Community 15 - "contextFile() / pluginRoot() / rules.js"
Cohesion: 0.17
Nodes (22): contextFile(), pluginRoot(), addPrivateThesaurus(), blocks(), build(), expand(), fresh(), fs (+14 more)

### Community 16 - "suggest-cases.js / covered() / esc()"
Cohesion: 0.13
Nodes (20): covered(), esc(), fs, { getProject }, headingKeys(), mk, newSuggestions(), norm() (+12 more)

### Community 17 - "test-setup-hosts.js / assert / backups()"
Cohesion: 0.09
Nodes (15): assert, codexFile, crypto, env, fs, geminiFile, home, originalHash (+7 more)

### Community 18 - "history.js / append() / crypto"
Cohesion: 0.16
Nodes (17): append(), crypto, embedHistory(), entryId(), forget(), fs, hasUnembedded(), load() (+9 more)

### Community 19 - "test-brain.js / assert / brain"
Cohesion: 0.10
Nodes (17): assert, brain, { brainPath, tempHome, runBrain }, dims(), fake(), fs, g, h1 (+9 more)

### Community 20 - "test-extract.js / assert / check()"
Cohesion: 0.11
Nodes (19): assert, check(), data, DOCX, ex, fs, home, main() (+11 more)

### Community 21 - "train-rank.js / argv / casesFile"
Cohesion: 0.10
Nodes (15): argv, casesFile, EXCLUDE, fs, { getEmbedder }, { getProject }, { homeDir }, LAMBDA (+7 more)

### Community 22 - "dbFile() / docsRoot() / effective()"
Cohesion: 0.18
Nodes (19): dbFile(), docsRoot(), effective(), graphOnDisk(), graphPathOf(), hadMap(), hasMap(), integrate() (+11 more)

### Community 23 - "test-graph.js / assert / cli"
Cohesion: 0.11
Nodes (18): assert, cli, { DatabaseSync }, filler, fs, gdb, history, home (+10 more)

### Community 24 - "test-tune.js / assert / base"
Cohesion: 0.11
Nodes (15): assert, base, BASE_SRC, BRAIN, CFG, DOCS, fs, GDATA (+7 more)

### Community 25 - "wide-test.js / brain / BRAINDIR"
Cohesion: 0.11
Nodes (15): brain, BRAINDIR, FILL, FILL_S, FILL_T, fs, history, MAY_HIT (+7 more)

### Community 26 - "Rationale: local only, the hook never downloads / Rationale:"
Cohesion: 0.16
Nodes (16): Rationale: local only, the hook never downloads, Rationale: never block a prompt (time limits, fail open), vectors.json, crypto, { dataDir, writeAtomic }, ehash(), embedders, { embedModel, DEFAULT_EMBED_MODEL } (+8 more)

### Community 27 - "test-hosts.js / assert / baseEnv()"
Cohesion: 0.12
Nodes (15): assert, baseEnv(), BRAIN, codexHome, data, fakeHome, fs, hosts (+7 more)

### Community 28 - "check-public.js / DEFAULT_ROOT / escapeRe()"
Cohesion: 0.19
Nodes (16): DEFAULT_ROOT, escapeRe(), findWordsFile(), fs, gitLines(), isSkipped(), kindsForLine(), listFiles() (+8 more)

### Community 29 - "pinNote() / pin.js / { dataDir }"
Cohesion: 0.17
Nodes (14): pinNote(), { dataDir }, fs, getPin(), parsePin(), path, seenFile(), setPin() (+6 more)

### Community 30 - "getProject() / loadProjects() / projectNames()"
Cohesion: 0.19
Nodes (14): getProject(), loadProjects(), projectNames(), casesFile(), { embedText }, exportPairs(), fs, { loadProjects, getProject } (+6 more)

### Community 31 - "addDocs() / addGabriel() / buildMap()"
Cohesion: 0.20
Nodes (16): addDocs(), addGabriel(), buildMap(), checkRepoArg(), countLine(), expandHome(), graphRel(), hasCodeFiles() (+8 more)

### Community 32 - "test-history.js / assert / fs"
Cohesion: 0.16
Nodes (14): assert, fs, histDir(), history, historyPath, home(), path, runForget() (+6 more)

### Community 33 - "check-docs.js / checkFile() / codeBlockHits()"
Cohesion: 0.23
Nodes (13): checkFile(), codeBlockHits(), codeMask(), fenceBlocks(), fs, lineNumberHits(), linkHits(), path (+5 more)

### Community 34 - "brain.js / contextArgs() / { debug }"
Cohesion: 0.14
Nodes (13): contextArgs(), { debug }, flagValue(), fs, { getProject }, history, { homeDir, graphFile, dataDir, tokens, build, fresh, loadThesaurus, wordScores, rank, query }, hosts (+5 more)

### Community 35 - "eval-model.js / { dataDir } / fs"
Cohesion: 0.15
Nodes (12): { dataDir }, fs, gi, grid, home, judge(), mk, MODELS (+4 more)

### Community 36 - "test-hook-fresh.js / assert / brain"
Cohesion: 0.14
Nodes (11): assert, brain, cwd, dataDir, env, fs, home, os (+3 more)

### Community 37 - "Map build / Question index / Eval case format"
Cohesion: 0.15
Nodes (13): Map build, Question index, Eval case format, Strict and quiet scores, Building a map flow, The full setup is big, gabriel README, Graph your code, then write its docs (+5 more)

### Community 38 - "measure-hook.js / assert / fs"
Cohesion: 0.15
Nodes (12): assert, fs, GENERIC, mk, owner, ownFile, path, paths (+4 more)

### Community 39 - "dq.js / cache / { dataDir }"
Cohesion: 0.24
Nodes (12): cache, { dataDir }, embedAll(), { embedModel, DEFAULT_EMBED_MODEL }, files(), fs, load(), path (+4 more)

### Community 40 - "tips.js / fs / path"
Cohesion: 0.18
Nodes (11): fs, path, paths, tipFor(), TIPS, assert, DATA, fs (+3 more)

### Community 41 - "test-check-public.js / assert / fs"
Cohesion: 0.22
Nodes (12): assert, fs, J(), made, main(), makeTree(), mkTmp(), os (+4 more)

### Community 42 - "test-map.js / assert / fs"
Cohesion: 0.15
Nodes (11): assert, fs, home, links, mk, nodes, os, path (+3 more)

### Community 43 - "test-tune-pairs.js / assert / base"
Cohesion: 0.15
Nodes (10): assert, base, DATA, DOCS, fs, HOME, os, path (+2 more)

### Community 44 - "Retrain keep rule (0.3.0 entry) / No-name retrain always kee"
Cohesion: 0.30
Nodes (12): Retrain keep rule (0.3.0 entry), No-name retrain always keeps (earlier 0.3.0 entry), Leave-one-area-out score, Retrain keeps weights only when strict score holds, Task 8: same retrain guard for all runs, Skills and commands table, R26 Retrain keeps new weights only when strict score does not fall, Eval and retrain flow (+4 more)

### Community 45 - "Hook fails open / Fallback gate value (1.7 in ARCHITECTURE) "
Cohesion: 0.23
Nodes (12): Hook fails open, Fallback gate value (1.7 in ARCHITECTURE), How a prompt is handled, Routing and fallback, The hook runs twice, One prompt flow, Install and first setup flow, R01 Hook never blocks a prompt (+4 more)

### Community 46 - "Rationale: atomic writes (temp file, then rename) / mk.db (p"
Cohesion: 0.20
Nodes (12): Rationale: atomic writes (temp file, then rename), mk.db (project map store), build(), camel(), chunkDoc(), clean(), listDocs(), roleWords() (+4 more)

### Community 47 - "test-projects.js / assert / dir"
Cohesion: 0.17
Nodes (9): assert, dir, fs, later, m, os, path, ps (+1 more)

### Community 48 - "learn-reset per doc set / Two links away code names (0.3.0) "
Cohesion: 0.22
Nodes (11): learn-reset per doc set, Two links away code names (0.3.0), Learning from use, Session gate (opt-in), Spreading search, Two links away, Task 11: split search(), R25 A file counts once per map, within 45 minutes (+3 more)

### Community 49 - "projects.json (doc set config) / Quiet gate (0.65) / Task 5:"
Cohesion: 0.27
Nodes (11): projects.json (doc set config), Quiet gate (0.65), Task 5: gabriel why, The map shows only one project, No map is shown for a prompt, Pin one doc set per session, src/pin.js (session pin owner), R35 Session pin (+3 more)

### Community 50 - "CI workflow test.yml / Lint and test on Windows and Ubuntu /"
Cohesion: 0.29
Nodes (10): CI workflow test.yml, Lint and test on Windows and Ubuntu, gabriel 0.3.0 release notes, CHANGELOG version history, Global constraints of the plan, Review improvements plan (2026-11-14), Task 10: CI workflow, Task 12: release 0.3.0 (+2 more)

### Community 51 - "W03 Add docs / W07 Refresh docs / Doc set (project)"
Cohesion: 0.22
Nodes (10): W03 Add docs, W07 Refresh docs, Doc set (project), Code graph (graphify graph.json), Meaning model (embedding model), projects.json, add-docs skill, setup skill (+2 more)

### Community 52 - "Rationale: session dedupe (save state only after output is w"
Cohesion: 0.24
Nodes (10): Rationale: session dedupe (save state only after output is written), buildNote(), capText(), contextText(), dedupe(), emit(), hook(), humanize() (+2 more)

### Community 53 - "graphdb.js / dbFile() / fs"
Cohesion: 0.24
Nodes (7): dbFile(), fs, history, lexical(), open(), path, sync()

### Community 54 - "exportOnnx() / fs / export-onnx.js"
Cohesion: 0.22
Nodes (8): exportOnnx(), fs, os, path, SCRIPT, { spawnSync }, TOKEN_FILES, venvPython()

### Community 55 - "run-all.js / alive() / files"
Cohesion: 0.20
Nodes (7): files, fs, LOCK, path, ROOT, scan, { spawnSync }

### Community 56 - "test-embed-model.js / assert / base"
Cohesion: 0.20
Nodes (8): assert, base, embed, { embedModel, DEFAULT_EMBED_MODEL }, fs, os, path, ROOT

### Community 57 - "eval-rules.js / brain / CASES"
Cohesion: 0.22
Nodes (7): brain, CASES, fs, home, mk, path, PRIVATE_CASES

### Community 58 - "02-business-rules.md (cited, not in chunk) / Repo docs index"
Cohesion: 0.28
Nodes (9): 02-business-rules.md (cited, not in chunk), Repo docs index, Architecture (01), Build lock (mk.lock), Project map, Session pin, Findings (known gaps), Technical docs index (+1 more)

### Community 59 - "make-corpus.js / clean() / fs"
Cohesion: 0.25
Nodes (8): clean(), fs, LICENSE, out, path, paths, SKIP_DIR, walk()

### Community 60 - "test-check-docs.js / assert / CHECK"
Cohesion: 0.22
Nodes (7): assert, CHECK, fs, os, path, ROOT, { spawnSync }

### Community 61 - "test-paths.js / assert / fs"
Cohesion: 0.22
Nodes (7): assert, fs, old, os, p, path, tmpHome

### Community 62 - "test-plain-docs.js / assert / data"
Cohesion: 0.22
Nodes (8): assert, data, fs, home, mk, os, path, tmp

### Community 63 - "test-version.js / assert / fs"
Cohesion: 0.22
Nodes (7): assert, fs, market, path, pkg, plugin, ROOT

### Community 64 - "search() / searchFull() / touchedHook()"
Cohesion: 0.25
Nodes (7): search(), searchFull(), touchedHook(), debug(), fs, path, paths

### Community 65 - "test-debuglog.js / assert / DATA"
Cohesion: 0.25
Nodes (7): assert, DATA, { debug }, file, fs, os, path

### Community 66 - "Rationale: rebuild maps in background with locks, old map se"
Cohesion: 0.33
Nodes (7): Rationale: rebuild maps in background with locks, old map serves, format(), gather(), mapFor(), refreshInBackground(), refreshMapInBackground(), registerNewDocFolders()

### Community 67 - "statusview.js / statusBlock() / test-statusview.js"
Cohesion: 0.33
Nodes (5): statusBlock(), assert, built, gone, { statusBlock }

### Community 68 - "test-lint.js / bin / fs"
Cohesion: 0.29
Nodes (6): bin, fs, path, r, ROOT, { spawnSync }

### Community 69 - "test-mermaid.js / dom / fs"
Cohesion: 0.29
Nodes (5): dom, fs, path, ROOT, SKIP

### Community 70 - "test-util.js / brainPath / fs"
Cohesion: 0.29
Nodes (6): brainPath, fs, homes, os, path, { spawnSync }

### Community 71 - "Exact code and doc lines (0.3.0) / Dedupe per session / repo"
Cohesion: 0.40
Nodes (6): Exact code and doc lines (0.3.0), Dedupe per session, repo refused, R07 An item is not sent twice in one session, R36 Exact code lines, One-prompt flow (W01)

### Community 72 - "test-retrieval.js / assert / fs"
Cohesion: 0.33
Nodes (5): assert, fs, mk, os, path

### Community 73 - "Code graph check (wrong-repo warning) / graph not found / R3"
Cohesion: 0.40
Nodes (5): Code graph check (wrong-repo warning), graph not found, R33 A code graph must exist and match the docs, Code graph (glossary term), status skill

### Community 74 - "Path / find_transformer_dir() / main()"
Cohesion: 0.60
Nodes (4): Path, find_transformer_dir(), main(), Export a trained sentence-transformers model to ONNX and quantize it to 8 bit.…

### Community 75 - "train.py / main() / parse_args()"
Cohesion: 0.60
Nodes (3): main(), parse_args(), read_pairs()

### Community 76 - "Code docs layout / Keep it lean rules / Workflow page templa"
Cohesion: 0.67
Nodes (3): Code docs layout, Keep it lean rules, Workflow page template

### Community 77 - "Deleting everything / Prompt history redaction / What never "
Cohesion: 0.67
Nodes (3): Deleting everything, Prompt history redaction, What never leaves the machine

## Ambiguous Edges - Review These
- `Retrain keep rule (0.3.0 entry)` → `No-name retrain always keeps (earlier 0.3.0 entry)`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `No-name retrain always keeps (earlier 0.3.0 entry)` → `Task 8: same retrain guard for all runs`  [AMBIGUOUS]
  docs/superpowers/plans/2026-11-14-review-improvements.md · relation: references
- `Fallback gate value (1.7 in ARCHITECTURE)` → `One prompt flow`  [AMBIGUOUS]
  docs/WORKFLOWS.md · relation: references

## Knowledge Gaps
- **655 isolated node(s):** `CHECK`, `argv`, `{ defLine }`, `fs`, `{ getEmbedder }` (+650 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Retrain keep rule (0.3.0 entry)` and `No-name retrain always keeps (earlier 0.3.0 entry)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `No-name retrain always keeps (earlier 0.3.0 entry)` and `Task 8: same retrain guard for all runs`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Fallback gate value (1.7 in ARCHITECTURE)` and `One prompt flow`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `W08 Other hosts` connect `Host adapter / W08 Other hosts / claude.js` to `02-business-rules.md (cited, not in chunk) / Repo docs index`, `Rationale: backup before host hook file write (--apply) / up`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `Architecture (01)` connect `02-business-rules.md (cited, not in chunk) / Repo docs index` to `Rationale: a tuned model wins only on scores / tune-embeddin`, `Rationale: node:sqlite, not a native package / mk.js / addEx`, `brain.js / contextArgs() / { debug }`, `Rationale: backup before host hook file write (--apply) / up`, `retrain.js / casesFile / { execFileSync }`, `Rationale: local only, the hook never downloads / Rationale:`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `update()` connect `Rationale: backup before host hook file write (--apply) / up` to `Rationale: node:sqlite, not a native package / mk.js / addEx`, `index.js / get() / HOSTS`, `suggest-cases.js / covered() / esc()`, `getProject() / loadProjects() / projectNames()`, `addDocs() / addGabriel() / buildMap()`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `CHECK`, `argv`, `{ defLine }` to the rest of the system?**
  _655 weakly-connected nodes found - possible documentation gaps or missing edges._