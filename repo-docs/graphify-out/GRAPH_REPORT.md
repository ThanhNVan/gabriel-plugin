# Graph Report - gabriel-plugin  (2026-11-15)

## Corpus Check
- 132 files · ~130,784 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1372 nodes · 2175 edges · 103 communities (89 shown, 14 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 189 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0e54fc6a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- tune.js
- mk.js
- codex.js
- setup.js
- eval-map.js
- retrain.js
- package.json
- extract.js
- projects.js
- test-update.js
- repo.js
- test-workflow.js
- test-add-docs.js
- test-setup.js
- migrate-data.js
- rules.js
- suggest-cases.js
- test-setup-hosts.js
- history.js
- test-brain.js
- test-extract.js
- train-rank.js
- eval-rerank.js
- test-graph.js
- test-tune.js
- wide-test.js
- embed.js
- test-hosts.js
- check-public.js
- pin.js
- dbFile
- test-repo.js
- test-history.js
- check-docs.js
- brain.js
- eval-model.js
- test-hook-fresh.js
- Map build
- measure-hook.js
- dataDir
- test-tips.js
- test-check-public.js
- test-map.js
- test-tune-pairs.js
- R26 Retrain keeps new weights only when strict score does not fall
- How a prompt is handled
- check-claims.js
- test-projects.js
- Spreading search
- R35 Session pin
- gabriel 0.3.0 release notes
- paths.js
- key-ideas.js
- search
- export-onnx.js
- run-all.js
- test-embed-model.js
- eval-rules.js
- Architecture (01)
- make-corpus.js
- test-check-docs.js
- test-paths.js
- test-plain-docs.js
- test-version.js
- addDocs
- test-debuglog.js
- W03 Add docs
- test-statusview.js
- test-lint.js
- test-mermaid.js
- test-util.js
- R36 Exact code lines
- build
- R33 A code graph must exist and match the docs
- find_transformer_dir
- train.py
- Code docs layout
- Prompt history redaction
- Keep rule (tuned model)
- eslint.config.js
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
- run
- getProject
- test-key-ideas.js
- AGENT GUIDE: read this before you run a gabriel step
- rankDocRows
- test-check-claims.js
- test-graph-stats.js
- graph-stats.js
- test-retrieval.js

## God Nodes (most connected - your core abstractions)
1. `build()` - 25 edges
2. `getProject()` - 25 edges
3. `search()` - 24 edges
4. `dataDir()` - 24 edges
5. `addDocs()` - 22 edges
6. `main()` - 21 edges
7. `extractText()` - 20 edges
8. `dataDir()` - 20 edges
9. `loadProjects()` - 19 edges
10. `relinkDocs()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Rationale: never block a prompt (time limits, fail open)` --rationale_for--> `hook()`  [EXTRACTED]
  repo-docs/technical/01-architecture.md → src/brain.js
- `Rationale: rebuild maps in background with locks, old map serves` --rationale_for--> `refreshMapInBackground()`  [EXTRACTED]
  repo-docs/technical/01-architecture.md → src/brain.js
- `Rationale: session dedupe (save state only after output is written)` --rationale_for--> `dedupe()`  [EXTRACTED]
  repo-docs/technical/01-architecture.md → src/brain.js
- `Findings (known gaps)` --references--> `dedupe()`  [EXTRACTED]
  repo-docs/technical/findings.md → src/brain.js
- `embedNodes()` --references--> `vectors.json`  [EXTRACTED]
  src/embed.js → repo-docs/technical/01-architecture.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Why no map flow** — skills_why_skill_why, skills_why_skill_next_steps, docs_troubleshooting_no_map, docs_architecture_gate, docs_architecture_session_gate, docs_superpowers_plans_task_5_why [INFERRED 0.75]
- **Hook fails open** — docs_architecture_fail_open, repo_docs_business_02_business_rules_hook_never_blocks, docs_workflows_one_prompt, docs_superpowers_plans_global_constraints [INFERRED 0.85]
- **Retrain keep rule** — repo_docs_business_02_business_rules_r26_retrain_keep, docs_eval_retrain_keep_rule, skills_retrain_skill_retrain, repo_docs_business_workflows_w06_eval_and_retrain_flow, repo_docs_technical_02_modules_src_retrain_js, changelog_retrain_guard [INFERRED 0.85]

## Communities (103 total, 14 thin omitted)

### Community 0 - "tune.js"
Cohesion: 0.05
Nodes (57): Rationale: a tuned model wins only on scores, tune-embeddings skill, casesFile(), { embedText }, exportPairs(), fs, { loadProjects, getProject }, mk (+49 more)

### Community 1 - "mk.js"
Cohesion: 0.09
Nodes (26): Rationale: node:sqlite, not a native package, AUTO_SKIP, canon(), CHAIN_DEFAULT, CHAIN_VERBS, chunkDoc(), clean(), CODE_FILLER (+18 more)

### Community 2 - "codex.js"
Cohesion: 0.08
Nodes (25): Host adapter, W08 Other hosts, os, path, { readCommon }, os, path, { readCommon, toolInput, pathsFrom } (+17 more)

### Community 3 - "setup.js"
Cohesion: 0.09
Nodes (30): Rationale: backup before host hook file write (--apply), update skill, ADD_SKIP, addGabriel(), CODE_EXT, codeHintName(), dirBytes(), fetchModel() (+22 more)

### Community 4 - "eval-map.js"
Cohesion: 0.19
Nodes (16): argv, { defLine }, evalProject(), exactOf(), flag(), fs, { getEmbedder }, { homeDir } (+8 more)

### Community 5 - "retrain.js"
Cohesion: 0.06
Nodes (28): casesFile, { execFileSync }, force, fs, { getProject }, keepNew(), mk, os (+20 more)

### Community 6 - "package.json"
Cohesion: 0.07
Nodes (29): eslint, @eslint/js, globals, @huggingface/transformers, jsdom, dependencies, @huggingface/transformers, description (+21 more)

### Community 7 - "extract.js"
Cohesion: 0.15
Nodes (31): isRepoCodeFile(), adocText(), delimited(), docxText(), elems(), ENT, extractText(), fs (+23 more)

### Community 8 - "projects.js"
Cohesion: 0.20
Nodes (20): pinNote(), registerNewDocFolders(), checkName(), dataDir(), docsDir(), privateDir(), projectsFile(), { dataDir, projectsFile, privateDir, checkName, defaultRuleFiles } (+12 more)

### Community 9 - "test-update.js"
Cohesion: 0.07
Nodes (21): assert, casesFile, casesHash, crypto, data, docs, env, filler (+13 more)

### Community 10 - "repo.js"
Cohesion: 0.22
Nodes (14): checkRepo(), defLine(), defLineIn(), defRegexes(), escapeRe(), exactLines(), { execFileSync }, fileLines() (+6 more)

### Community 11 - "test-workflow.js"
Cohesion: 0.08
Nodes (21): assert, BASE_ENV, BRAIN, CLAUDE_HOME, CODEX_HOME, DATA, ENV, fs (+13 more)

### Community 12 - "test-add-docs.js"
Cohesion: 0.08
Nodes (20): assert, BRAIN, crypto, data, entry(), env, filler, fixture (+12 more)

### Community 13 - "test-setup.js"
Cohesion: 0.08
Nodes (22): assert, before, crypto, d2, d3, docs2, env, filler (+14 more)

### Community 14 - "migrate-data.js"
Cohesion: 0.11
Nodes (21): crypto, { dataDir, checkName }, expand(), fs, hashFile(), migrate(), MOVES, path (+13 more)

### Community 15 - "rules.js"
Cohesion: 0.14
Nodes (27): search(), searchFull(), withTimeout(), mkSynonyms(), contextFile(), pluginRoot(), addPrivateThesaurus(), blocks() (+19 more)

### Community 16 - "suggest-cases.js"
Cohesion: 0.13
Nodes (20): covered(), esc(), fs, { getProject }, headingKeys(), mk, newSuggestions(), norm() (+12 more)

### Community 17 - "test-setup-hosts.js"
Cohesion: 0.09
Nodes (15): assert, codexFile, crypto, env, fs, geminiFile, home, originalHash (+7 more)

### Community 18 - "history.js"
Cohesion: 0.11
Nodes (24): dbFile(), fs, history, lexical(), open(), path, sync(), append() (+16 more)

### Community 19 - "test-brain.js"
Cohesion: 0.11
Nodes (17): assert, brain, { brainPath, tempHome, runBrain }, dims(), fake(), fs, g, h1 (+9 more)

### Community 20 - "test-extract.js"
Cohesion: 0.11
Nodes (19): assert, check(), data, DOCX, ex, fs, home, main() (+11 more)

### Community 21 - "train-rank.js"
Cohesion: 0.10
Nodes (15): argv, casesFile, EXCLUDE, fs, { getEmbedder }, { getProject }, { homeDir }, LAMBDA (+7 more)

### Community 22 - "eval-rerank.js"
Cohesion: 0.16
Nodes (17): judge(), judgeRendered(), argv, fs, { getEmbedder }, { homeDir }, { judge, judgeRendered }, main() (+9 more)

### Community 23 - "test-graph.js"
Cohesion: 0.11
Nodes (18): assert, cli, { DatabaseSync }, filler, fs, gdb, history, home (+10 more)

### Community 24 - "test-tune.js"
Cohesion: 0.11
Nodes (15): assert, base, BASE_SRC, BRAIN, CFG, DOCS, fs, GDATA (+7 more)

### Community 25 - "wide-test.js"
Cohesion: 0.11
Nodes (15): brain, BRAINDIR, FILL, FILL_S, FILL_T, fs, history, MAY_HIT (+7 more)

### Community 26 - "embed.js"
Cohesion: 0.16
Nodes (17): Rationale: local only, the hook never downloads, Rationale: never block a prompt (time limits, fail open), vectors.json, refreshInBackground(), crypto, { dataDir, writeAtomic }, ehash(), embedders (+9 more)

### Community 27 - "test-hosts.js"
Cohesion: 0.12
Nodes (15): assert, baseEnv(), BRAIN, codexHome, data, fakeHome, fs, hosts (+7 more)

### Community 28 - "check-public.js"
Cohesion: 0.19
Nodes (16): DEFAULT_ROOT, escapeRe(), findWordsFile(), fs, gitLines(), isSkipped(), kindsForLine(), listFiles() (+8 more)

### Community 29 - "pin.js"
Cohesion: 0.18
Nodes (13): { dataDir }, fs, getPin(), parsePin(), path, seenFile(), setPin(), assert (+5 more)

### Community 30 - "dbFile"
Cohesion: 0.22
Nodes (15): codeFiles(), dbFile(), effective(), hadMap(), hasMap(), integrate(), learnReset(), learnShow() (+7 more)

### Community 31 - "test-repo.js"
Cohesion: 0.14
Nodes (10): commitsSince(), graphDrift(), lastCommitTime(), assert, { checkRepo, defLine, exactLines, graphDrift, lastCommitTime, commitsSince }, { execFileSync }, fs, os (+2 more)

### Community 32 - "test-history.js"
Cohesion: 0.16
Nodes (13): hook(), assert, fs, histDir(), history, historyPath, path, runForget() (+5 more)

### Community 33 - "check-docs.js"
Cohesion: 0.23
Nodes (13): checkFile(), codeBlockHits(), codeMask(), fenceBlocks(), fs, lineNumberHits(), linkHits(), path (+5 more)

### Community 34 - "brain.js"
Cohesion: 0.08
Nodes (39): Rationale: rebuild maps in background with locks, old map serves, Rationale: session dedupe (save state only after output is written), buildNote(), capText(), contextArgs(), contextText(), { debug }, dedupe() (+31 more)

### Community 35 - "eval-model.js"
Cohesion: 0.15
Nodes (12): { dataDir }, fs, gi, grid, home, judge(), mk, MODELS (+4 more)

### Community 36 - "test-hook-fresh.js"
Cohesion: 0.14
Nodes (11): assert, brain, cwd, dataDir, env, fs, home, os (+3 more)

### Community 37 - "Map build"
Cohesion: 0.15
Nodes (13): Map build, Question index, Eval case format, Strict and quiet scores, Building a map flow, The full setup is big, gabriel README, Graph your code, then write its docs (+5 more)

### Community 38 - "measure-hook.js"
Cohesion: 0.15
Nodes (12): assert, fs, GENERIC, mk, owner, ownFile, path, paths (+4 more)

### Community 39 - "dataDir"
Cohesion: 0.27
Nodes (11): cache, { dataDir }, embedAll(), { embedModel, DEFAULT_EMBED_MODEL }, files(), fs, load(), path (+3 more)

### Community 40 - "test-tips.js"
Cohesion: 0.18
Nodes (10): fs, path, paths, TIPS, assert, DATA, fs, os (+2 more)

### Community 41 - "test-check-public.js"
Cohesion: 0.22
Nodes (12): assert, fs, J(), made, main(), makeTree(), mkTmp(), os (+4 more)

### Community 42 - "test-map.js"
Cohesion: 0.15
Nodes (11): assert, fs, home, links, mk, nodes, os, path (+3 more)

### Community 43 - "test-tune-pairs.js"
Cohesion: 0.15
Nodes (10): assert, base, DATA, DOCS, fs, HOME, os, path (+2 more)

### Community 44 - "R26 Retrain keeps new weights only when strict score does not fall"
Cohesion: 0.30
Nodes (12): Retrain keep rule (0.3.0 entry), No-name retrain always keeps (earlier 0.3.0 entry), Leave-one-area-out score, Retrain keeps weights only when strict score holds, Task 8: same retrain guard for all runs, Skills and commands table, R26 Retrain keeps new weights only when strict score does not fall, Eval and retrain flow (+4 more)

### Community 45 - "How a prompt is handled"
Cohesion: 0.23
Nodes (12): Hook fails open, Fallback gate value (1.7 in ARCHITECTURE), How a prompt is handled, Routing and fallback, The hook runs twice, One prompt flow, Install and first setup flow, R01 Hook never blocks a prompt (+4 more)

### Community 46 - "check-claims.js"
Cohesion: 0.19
Nodes (13): buildIndex(), checkFile(), CODE_DIRS, esc(), found(), fs, judge(), path (+5 more)

### Community 47 - "test-projects.js"
Cohesion: 0.17
Nodes (9): assert, dir, fs, later, m, os, path, ps (+1 more)

### Community 48 - "Spreading search"
Cohesion: 0.22
Nodes (11): learn-reset per doc set, Two links away code names (0.3.0), Learning from use, Session gate (opt-in), Spreading search, Two links away, Task 11: split search(), R25 A file counts once per map, within 45 minutes (+3 more)

### Community 49 - "R35 Session pin"
Cohesion: 0.27
Nodes (11): projects.json (doc set config), Quiet gate (0.65), Task 5: gabriel why, The map shows only one project, No map is shown for a prompt, Pin one doc set per session, src/pin.js (session pin owner), R35 Session pin (+3 more)

### Community 50 - "gabriel 0.3.0 release notes"
Cohesion: 0.29
Nodes (10): CI workflow test.yml, Lint and test on Windows and Ubuntu, gabriel 0.3.0 release notes, CHANGELOG version history, Global constraints of the plan, Review improvements plan (2026-11-14), Task 10: CI workflow, Task 12: release 0.3.0 (+2 more)

### Community 51 - "paths.js"
Cohesion: 0.19
Nodes (9): HOSTS, activeHost(), defaultRuleFiles(), fs, hostAdapter(), hosts, os, path (+1 more)

### Community 52 - "key-ideas.js"
Cohesion: 0.20
Nodes (7): esc(), fs, pairs(), path, present(), SKIP_DIRS, walk()

### Community 53 - "search"
Cohesion: 0.18
Nodes (11): addExactLines(), addNeighbours(), chainNum(), expand(), gateAndNormalize(), namedProjects(), pickResults(), search() (+3 more)

### Community 54 - "export-onnx.js"
Cohesion: 0.22
Nodes (8): exportOnnx(), fs, os, path, SCRIPT, { spawnSync }, TOKEN_FILES, venvPython()

### Community 55 - "run-all.js"
Cohesion: 0.20
Nodes (7): files, fs, LOCK, path, ROOT, scan, { spawnSync }

### Community 56 - "test-embed-model.js"
Cohesion: 0.20
Nodes (8): assert, base, embed, { embedModel, DEFAULT_EMBED_MODEL }, fs, os, path, ROOT

### Community 57 - "eval-rules.js"
Cohesion: 0.22
Nodes (7): brain, CASES, fs, home, mk, path, PRIVATE_CASES

### Community 58 - "Architecture (01)"
Cohesion: 0.28
Nodes (9): 02-business-rules.md (cited, not in chunk), Repo docs index, Architecture (01), Build lock (mk.lock), Project map, Session pin, Findings (known gaps), Technical docs index (+1 more)

### Community 59 - "make-corpus.js"
Cohesion: 0.25
Nodes (8): clean(), fs, LICENSE, out, path, paths, SKIP_DIR, walk()

### Community 60 - "test-check-docs.js"
Cohesion: 0.22
Nodes (7): assert, CHECK, fs, os, path, ROOT, { spawnSync }

### Community 61 - "test-paths.js"
Cohesion: 0.22
Nodes (7): assert, fs, old, os, p, path, tmpHome

### Community 62 - "test-plain-docs.js"
Cohesion: 0.22
Nodes (8): assert, data, fs, home, mk, os, path, tmp

### Community 63 - "test-version.js"
Cohesion: 0.22
Nodes (7): assert, fs, market, path, pkg, plugin, ROOT

### Community 64 - "addDocs"
Cohesion: 0.31
Nodes (11): addDocs(), buildMap(), checkRepoArg(), countLine(), expandHome(), graphRel(), hasCodeFiles(), main() (+3 more)

### Community 65 - "test-debuglog.js"
Cohesion: 0.17
Nodes (10): fs, path, paths, assert, DATA, { debug }, file, fs (+2 more)

### Community 66 - "W03 Add docs"
Cohesion: 0.22
Nodes (10): W03 Add docs, W07 Refresh docs, Doc set (project), Code graph (graphify graph.json), Meaning model (embedding model), projects.json, add-docs skill, setup skill (+2 more)

### Community 67 - "test-statusview.js"
Cohesion: 0.33
Nodes (5): statusBlock(), assert, built, gone, { statusBlock }

### Community 68 - "test-lint.js"
Cohesion: 0.29
Nodes (6): bin, fs, path, r, ROOT, { spawnSync }

### Community 69 - "test-mermaid.js"
Cohesion: 0.29
Nodes (5): dom, fs, path, ROOT, SKIP

### Community 70 - "test-util.js"
Cohesion: 0.22
Nodes (8): home(), brainPath, fs, homes, os, path, { spawnSync }, tempHome()

### Community 71 - "R36 Exact code lines"
Cohesion: 0.40
Nodes (6): Exact code and doc lines (0.3.0), Dedupe per session, repo refused, R07 An item is not sent twice in one session, R36 Exact code lines, One-prompt flow (W01)

### Community 72 - "build"
Cohesion: 0.24
Nodes (10): Rationale: atomic writes (temp file, then rename), mk.db (project map store), build(), camel(), listDocs(), roleWords(), slug(), sources() (+2 more)

### Community 73 - "R33 A code graph must exist and match the docs"
Cohesion: 0.40
Nodes (5): Code graph check (wrong-repo warning), graph not found, R33 A code graph must exist and match the docs, Code graph (glossary term), status skill

### Community 74 - "find_transformer_dir"
Cohesion: 0.60
Nodes (4): Path, find_transformer_dir(), main(), Export a trained sentence-transformers model to ONNX and quantize it to 8 bit.…

### Community 75 - "train.py"
Cohesion: 0.60
Nodes (3): main(), parse_args(), read_pairs()

### Community 76 - "Code docs layout"
Cohesion: 0.67
Nodes (3): Code docs layout, Keep it lean rules, Workflow page template

### Community 77 - "Prompt history redaction"
Cohesion: 0.67
Nodes (3): Deleting everything, Prompt history redaction, What never leaves the machine

### Community 94 - "run"
Cohesion: 0.27
Nodes (10): extSet(), isDocName(), countDocs(), listDocFiles(), readJson(), run(), runNode(), step() (+2 more)

### Community 95 - "getProject"
Cohesion: 0.36
Nodes (10): defaultProject(), docsRoot(), format(), graphOnDisk(), graphPathOf(), stale(), status(), where() (+2 more)

### Community 96 - "test-key-ideas.js"
Cohesion: 0.20
Nodes (7): assert, fs, KEY, os, path, ROOT, { spawnSync }

### Community 97 - "AGENT GUIDE: read this before you run a gabriel step"
Cohesion: 0.22
Nodes (8): AGENT GUIDE: read this before you run a gabriel step, Before step 1, Finish checklist, Known errors and fixes, Run each skill, Save tokens: let scripts check, The 7 rules, When you edit docs

### Community 98 - "rankDocRows"
Cohesion: 0.28
Nodes (9): addNamedCode(), coreDoc(), f32(), families(), isFallback(), loadRank(), rankDocRows(), remember() (+1 more)

### Community 99 - "test-check-claims.js"
Cohesion: 0.22
Nodes (7): assert, CHECK, fs, os, path, ROOT, { spawnSync }

### Community 100 - "test-graph-stats.js"
Cohesion: 0.22
Nodes (7): assert, fs, os, path, ROOT, { spawnSync }, STATS

### Community 101 - "graph-stats.js"
Cohesion: 0.29
Nodes (3): fs, path, { spawnSync }

### Community 102 - "test-retrieval.js"
Cohesion: 0.33
Nodes (5): assert, fs, mk, os, path

## Ambiguous Edges - Review These
- `Retrain keep rule (0.3.0 entry)` → `No-name retrain always keeps (earlier 0.3.0 entry)`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to
- `No-name retrain always keeps (earlier 0.3.0 entry)` → `Task 8: same retrain guard for all runs`  [AMBIGUOUS]
  docs/superpowers/plans/2026-11-14-review-improvements.md · relation: references
- `Fallback gate value (1.7 in ARCHITECTURE)` → `One prompt flow`  [AMBIGUOUS]
  docs/WORKFLOWS.md · relation: references

## Knowledge Gaps
- **693 isolated node(s):** `globals`, `fs`, `path`, `{ homeDir }`, `paths` (+688 more)
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
- **Why does `W08 Other hosts` connect `codex.js` to `Architecture (01)`, `setup.js`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `Architecture (01)` connect `Architecture (01)` to `tune.js`, `mk.js`, `brain.js`, `setup.js`, `retrain.js`, `embed.js`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `relinkDocs()` connect `addDocs` to `mk.js`, `W03 Add docs`, `setup.js`, `projects.js`, `paths.js`, `Architecture (01)`, `getProject`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `globals`, `fs`, `path` to the rest of the system?**
  _693 weakly-connected nodes found - possible documentation gaps or missing edges._