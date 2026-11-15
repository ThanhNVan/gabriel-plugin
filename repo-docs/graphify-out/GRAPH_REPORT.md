# Graph Report - gabriel-plugin  (2026-11-16)

## Corpus Check
- 135 files · ~148,112 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 1379 nodes · 2562 edges · 94 communities (78 shown, 16 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 194 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `96ca7354`
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
- getProject
- test-update.js
- repo.js
- test-workflow.js
- test-add-docs.js
- test-setup.js
- migrate-data.js
- rules.js
- suggest-cases.js
- test
- history.js
- test-brain.js
- ref_path
- train-rank.js
- test-setup-hosts.js
- test-graph.js
- test-tune.js
- wide-test.js
- embed.js
- test-hosts.js
- check-public.js
- pin.js
- build
- graphdb.js
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
- retrain skill
- How a prompt is handled
- check-claims.js
- test-projects.js
- why skill
- R35 Session pin
- gabriel 0.3.0 release notes
- progress.md
- key-ideas.js
- test-tune-keep.js
- export-onnx.js
- run-all.js
- test-embed-model.js
- eval-rules.js
- test-plugin-cache.js
- make-corpus.js
- test-check-docs.js
- test-paths.js
- test-plain-docs.js
- test-version.js
- Learning from use
- ref_node_path
- Architecture (01)
- dbFile
- ref_node_fs
- test-util.js
- R36 Exact code lines
- R33 A code graph must exist and match the docs
- train.py
- Code docs layout
- Prompt history redaction
- Default working rules (defaults/preferences.md)
- Eval and retrain scripts (eval/eval-map.js, src/retrain.js)
- src/history.js (prompt history owner)
- src/mk.js (doc-set map owner)
- src/rules.js (rules graph owner)
- src/setup.js (setup owner)
- Similar earlier prompt
- Two links away (glossary term)
- Who uses gabriel (developer, doc owner, tuner)
- Data folder (GABRIEL_DATA)
- migrate-data.js
- codex.js
- test-key-ideas.js
- AGENT GUIDE: read this before you run a gabriel step
- test-check-claims.js
- test-graph-stats.js

## God Nodes (most connected - your core abstractions)
1. `dataDir()` - 30 edges
2. `search()` - 28 edges
3. `build()` - 27 edges
4. `getProject()` - 25 edges
5. `addDocs()` - 24 edges
6. `update()` - 22 edges
7. `main()` - 21 edges
8. `extractText()` - 20 edges
9. `dataDir()` - 20 edges
10. `run()` - 20 edges

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
- **Retrain keep rule** — repo_docs_business_02_business_rules_r26_retrain_keep, docs_eval_retrain_keep_rule, skills_retrain_skill_retrain, repo_docs_business_workflows_w06_eval_and_retrain_flow, repo_docs_technical_02_modules_src_retrain_js, changelog_retrain_guard [INFERRED 0.85]

## Communities (94 total, 16 thin omitted)

### Community 0 - "tune.js"
Cohesion: 0.08
Nodes (42): tune-embeddings skill, casesFile(), exportPairs(), fs, mulberry32(), path, projectsWithCases(), seededShuffle() (+34 more)

### Community 1 - "mk.js"
Cohesion: 0.08
Nodes (38): addNamedCode(), addNeighbours(), AUTO_SKIP, canon(), CHAIN_DEFAULT, CHAIN_ROLES, CHAIN_VERBS, chainNum() (+30 more)

### Community 2 - "codex.js"
Cohesion: 0.27
Nodes (6): readTouched(), pathsFrom(), toolInput(), os, path, readTouched()

### Community 3 - "setup.js"
Cohesion: 0.05
Nodes (87): W03 Add docs, W07 Refresh docs, Doc set (project), Code graph (graphify graph.json), Meaning model (embedding model), projects.json, add-docs skill, setup skill (+79 more)

### Community 4 - "eval-map.js"
Cohesion: 0.16
Nodes (22): argv, evalProject(), exactOf(), flag(), fs, judge(), judgeRendered(), main() (+14 more)

### Community 5 - "retrain.js"
Cohesion: 0.07
Nodes (25): casesFile, { execFileSync }, force, fs, keepNew(), os, P, path (+17 more)

### Community 6 - "package.json"
Cohesion: 0.06
Nodes (38): globals, js, dependencies, @huggingface/transformers@4.3.2, description, devDependencies, dompurify@^3.4.17, eslint@^9.17.0 (+30 more)

### Community 7 - "extract.js"
Cohesion: 0.08
Nodes (48): isRepoCodeFile(), adocText(), delimited(), docxText(), elems(), ENT, extractText(), fs (+40 more)

### Community 8 - "getProject"
Cohesion: 0.33
Nodes (10): addExactLines(), docsRoot(), format(), graphOnDisk(), graphPathOf(), stale(), status(), where() (+2 more)

### Community 9 - "test-update.js"
Cohesion: 0.07
Nodes (21): assert, casesFile, casesHash, crypto, data, docs, env, filler (+13 more)

### Community 10 - "repo.js"
Cohesion: 0.11
Nodes (22): checkRepo(), commitsSince(), defLineIn(), defRegexes(), escapeRe(), exactLines(), { execFileSync }, fileLines() (+14 more)

### Community 11 - "test-workflow.js"
Cohesion: 0.08
Nodes (21): assert, BASE_ENV, BRAIN, CLAUDE_HOME, CODEX_HOME, DATA, ENV, fs (+13 more)

### Community 12 - "test-add-docs.js"
Cohesion: 0.08
Nodes (21): moveIntoPlace(), assert, BRAIN, crypto, data, entry(), env, filler (+13 more)

### Community 13 - "test-setup.js"
Cohesion: 0.08
Nodes (22): assert, before, crypto, d2, d3, docs2, env, filler (+14 more)

### Community 14 - "migrate-data.js"
Cohesion: 0.15
Nodes (11): MOVES, assert, crypto, fs, listing(), os, path, RANK_TO (+3 more)

### Community 15 - "rules.js"
Cohesion: 0.17
Nodes (22): contextFile(), pluginRoot(), addPrivateThesaurus(), blocks(), build(), expand(), fresh(), fs (+14 more)

### Community 16 - "suggest-cases.js"
Cohesion: 0.17
Nodes (16): covered(), esc(), fs, headingKeys(), newSuggestions(), norm(), path, sectionCases() (+8 more)

### Community 17 - "test"
Cohesion: 0.10
Nodes (20): jobs, test, os, name, on, pull_request, push, permissions (+12 more)

### Community 18 - "history.js"
Cohesion: 0.18
Nodes (17): append(), crypto, embedHistory(), entryId(), forget(), fs, hasUnembedded(), load() (+9 more)

### Community 19 - "test-brain.js"
Cohesion: 0.12
Nodes (15): assert, brain, dims(), fake(), fs, g, h1, h2 (+7 more)

### Community 20 - "ref_path"
Cohesion: 0.16
Nodes (12): Host adapter, W08 Other hosts, os, path, path, readCommon(), os, path (+4 more)

### Community 21 - "train-rank.js"
Cohesion: 0.13
Nodes (10): argv, casesFile, EXCLUDE, fs, LAMBDA, NAMES, P, path (+2 more)

### Community 22 - "test-setup-hosts.js"
Cohesion: 0.09
Nodes (15): assert, codexFile, crypto, env, fs, geminiFile, home, originalHash (+7 more)

### Community 23 - "test-graph.js"
Cohesion: 0.13
Nodes (14): assert, cli, { DatabaseSync }, filler, fs, home, links, lx (+6 more)

### Community 24 - "test-tune.js"
Cohesion: 0.11
Nodes (15): assert, base, BASE_SRC, BRAIN, CFG, DOCS, fs, GDATA (+7 more)

### Community 25 - "wide-test.js"
Cohesion: 0.11
Nodes (15): brain, BRAINDIR, FILL, FILL_S, FILL_T, fs, history, MAY_HIT (+7 more)

### Community 26 - "embed.js"
Cohesion: 0.18
Nodes (13): vectors.json, refreshInBackground(), crypto, ehash(), embedders, embedNodes(), embedText(), fs (+5 more)

### Community 27 - "test-hosts.js"
Cohesion: 0.13
Nodes (14): assert, baseEnv(), BRAIN, codexHome, data, fakeHome, fs, os (+6 more)

### Community 28 - "check-public.js"
Cohesion: 0.19
Nodes (16): DEFAULT_ROOT, escapeRe(), findWordsFile(), fs, gitLines(), isSkipped(), kindsForLine(), listFiles() (+8 more)

### Community 29 - "pin.js"
Cohesion: 0.16
Nodes (16): pinNote(), distance(), fs, getPins(), nearName(), parsePin(), path, seenFile() (+8 more)

### Community 30 - "build"
Cohesion: 0.19
Nodes (12): mk.db (project map store), extSet(), build(), camel(), chunkDoc(), clean(), listDocs(), roleWords() (+4 more)

### Community 31 - "graphdb.js"
Cohesion: 0.24
Nodes (6): dbFile(), fs, lexical(), open(), path, sync()

### Community 32 - "test-history.js"
Cohesion: 0.16
Nodes (14): hook(), assert, fs, histDir(), history, historyPath, home(), path (+6 more)

### Community 33 - "check-docs.js"
Cohesion: 0.23
Nodes (14): checkFile(), codeBlockHits(), codeMask(), fenceBlocks(), fs, lineNumberHits(), linkHits(), path (+6 more)

### Community 34 - "brain.js"
Cohesion: 0.11
Nodes (31): buildNote(), capText(), contextArgs(), contextText(), dedupe(), driftNote(), emit(), everyNth() (+23 more)

### Community 35 - "eval-model.js"
Cohesion: 0.22
Nodes (9): fs, gi, grid, home, judge(), MODELS, os, path (+1 more)

### Community 36 - "test-hook-fresh.js"
Cohesion: 0.14
Nodes (11): assert, brain, cwd, dataDir, env, fs, home, os (+3 more)

### Community 37 - "Map build"
Cohesion: 0.17
Nodes (11): Map build, Question index, Eval case format, Strict and quiet scores, Building a map flow, Graph your code, then write its docs, Quick start (5 minutes), R18 Background builds: one at a time (+3 more)

### Community 38 - "measure-hook.js"
Cohesion: 0.18
Nodes (10): assert, fs, GENERIC, owner, ownFile, path, rows, RUN (+2 more)

### Community 39 - "dataDir"
Cohesion: 0.42
Nodes (8): cache, embedAll(), files(), fs, load(), path, embedModel(), dataDir()

### Community 40 - "test-tips.js"
Cohesion: 0.22
Nodes (9): fs, path, tipFor(), TIPS, assert, DATA, fs, os (+1 more)

### Community 41 - "test-check-public.js"
Cohesion: 0.22
Nodes (12): assert, fs, J(), made, main(), makeTree(), mkTmp(), os (+4 more)

### Community 42 - "test-map.js"
Cohesion: 0.12
Nodes (16): mapFor(), learnReset(), namedProjects(), pairHandlers(), remember(), searchAll(), assert, fs (+8 more)

### Community 43 - "test-tune-pairs.js"
Cohesion: 0.15
Nodes (10): assert, base, DATA, DOCS, fs, HOME, os, path (+2 more)

### Community 44 - "retrain skill"
Cohesion: 0.36
Nodes (9): Retrain keeps weights only when strict score holds, Skills and commands table, R26 Retrain keeps new weights only when strict score does not fall, Eval and retrain flow, src/retrain.js module, Four refresh steps, refresh-docs skill, retrain skill (+1 more)

### Community 45 - "How a prompt is handled"
Cohesion: 0.23
Nodes (11): Fallback gate value (1.7 in ARCHITECTURE), How a prompt is handled, Routing and fallback, The hook runs twice, One prompt flow, Install and first setup flow, R01 Hook never blocks a prompt, Onboarding steps (optional) (+3 more)

### Community 46 - "check-claims.js"
Cohesion: 0.19
Nodes (13): buildIndex(), checkFile(), CODE_DIRS, esc(), found(), fs, judge(), path (+5 more)

### Community 47 - "test-projects.js"
Cohesion: 0.17
Nodes (9): assert, dir, fs, later, m, os, path, ps (+1 more)

### Community 48 - "why skill"
Cohesion: 0.53
Nodes (6): Quiet gate (0.65), Session gate (opt-in), Spreading search, No map is shown for a prompt, Next step per why line, why skill

### Community 49 - "R35 Session pin"
Cohesion: 0.40
Nodes (6): projects.json (doc set config), The map shows only one project, Pin one doc set per session, src/pin.js (session pin owner), R35 Session pin, Session pin (glossary term)

### Community 50 - "gabriel 0.3.0 release notes"
Cohesion: 0.18
Nodes (11): CI workflow test.yml, Lint and test on Windows and Ubuntu, gabriel 0.3.0 release notes, learn-reset per doc set, Retrain keep rule (0.3.0 entry), No-name retrain always keeps (earlier 0.3.0 entry), Two links away code names (0.3.0), CHANGELOG version history (+3 more)

### Community 52 - "key-ideas.js"
Cohesion: 0.20
Nodes (7): esc(), fs, pairs(), path, present(), SKIP_DIRS, walk()

### Community 53 - "test-tune-keep.js"
Cohesion: 0.13
Nodes (12): statusBlock(), assert, built, gone, assert, BASE, DATA, fs (+4 more)

### Community 54 - "export-onnx.js"
Cohesion: 0.20
Nodes (8): exportOnnx(), fs, os, path, SCRIPT, { spawnSync }, TOKEN_FILES, venvPython()

### Community 55 - "run-all.js"
Cohesion: 0.24
Nodes (9): fs, lastLine(), main(), path, ROOT, { spawnSync }, statusOf(), summaryLine() (+1 more)

### Community 56 - "test-embed-model.js"
Cohesion: 0.20
Nodes (8): assert, base, embed, { embedModel, DEFAULT_EMBED_MODEL }, fs, os, path, ROOT

### Community 57 - "eval-rules.js"
Cohesion: 0.25
Nodes (7): CASES, fs, home, path, PRIVATE_CASES, search(), searchFull()

### Community 58 - "test-plugin-cache.js"
Cohesion: 0.07
Nodes (23): assert, block(), BRAIN, cacheHome, crypto, data, entry(), env (+15 more)

### Community 59 - "make-corpus.js"
Cohesion: 0.29
Nodes (7): clean(), fs, LICENSE, out, path, SKIP_DIR, walk()

### Community 60 - "test-check-docs.js"
Cohesion: 0.20
Nodes (7): assert, CHECK, fs, os, path, ROOT, { spawnSync }

### Community 61 - "test-paths.js"
Cohesion: 0.22
Nodes (7): assert, fs, old, os, p, path, tmpHome

### Community 62 - "test-plain-docs.js"
Cohesion: 0.22
Nodes (7): assert, data, fs, home, os, path, tmp

### Community 63 - "test-version.js"
Cohesion: 0.22
Nodes (7): assert, fs, market, path, pkg, plugin, ROOT

### Community 64 - "Learning from use"
Cohesion: 0.67
Nodes (4): Learning from use, R25 A file counts once per map, within 45 minutes, Learned link states, Learning window (45 minutes)

### Community 65 - "ref_node_path"
Cohesion: 0.15
Nodes (10): assert, DATA, file, fs, os, path, assert, fs (+2 more)

### Community 66 - "Architecture (01)"
Cohesion: 0.33
Nodes (9): 02-business-rules.md (cited, not in chunk), Repo docs index, Architecture (01), Build lock (mk.lock), Project map, Session pin, Findings (known gaps), Technical docs index (+1 more)

### Community 67 - "dbFile"
Cohesion: 0.25
Nodes (14): codeFiles(), dbFile(), defaultProject(), effective(), hadMap(), hasMap(), integrate(), learnShow() (+6 more)

### Community 68 - "ref_node_fs"
Cohesion: 0.13
Nodes (9): bin, fs, path, r, ROOT, { spawnSync }, fs, path (+1 more)

### Community 70 - "test-util.js"
Cohesion: 0.18
Nodes (8): fs, path, brainPath, fs, homes, os, path, { spawnSync }

### Community 71 - "R36 Exact code lines"
Cohesion: 0.40
Nodes (6): Exact code and doc lines (0.3.0), Dedupe per session, repo refused, R07 An item is not sent twice in one session, R36 Exact code lines, One-prompt flow (W01)

### Community 73 - "R33 A code graph must exist and match the docs"
Cohesion: 0.50
Nodes (3): graph not found, R33 A code graph must exist and match the docs, Code graph (glossary term)

### Community 74 - "train.py"
Cohesion: 0.14
Nodes (8): find_transformer_dir(), main(), __init__(), main(), on_step_end(), parse_args(), progress_line(), read_pairs()

### Community 77 - "Prompt history redaction"
Cohesion: 0.67
Nodes (3): Deleting everything, Prompt history redaction, What never leaves the machine

### Community 93 - "migrate-data.js"
Cohesion: 0.33
Nodes (8): crypto, expand(), fs, hashFile(), migrate(), path, walk(), writeJsonOnce()

### Community 96 - "test-key-ideas.js"
Cohesion: 0.20
Nodes (7): assert, fs, KEY, os, path, ROOT, { spawnSync }

### Community 97 - "AGENT GUIDE: read this before you run a gabriel step"
Cohesion: 0.17
Nodes (10): AGENT GUIDE: read this before you run a gabriel step, Before step 1, Finish checklist, `/gabriel:setup`, step by step, Known errors and fixes, Run each skill, Save tokens: let scripts check, The 7 rules (+2 more)

### Community 99 - "test-check-claims.js"
Cohesion: 0.20
Nodes (7): assert, CHECK, fs, os, path, ROOT, { spawnSync }

### Community 100 - "test-graph-stats.js"
Cohesion: 0.20
Nodes (7): assert, fs, os, path, ROOT, { spawnSync }, STATS

## Ambiguous Edges - Review These
- `Fallback gate value (1.7 in ARCHITECTURE)` → `One prompt flow`  [AMBIGUOUS]
  docs/WORKFLOWS.md · relation: references
- `Retrain keep rule (0.3.0 entry)` → `No-name retrain always keeps (earlier 0.3.0 entry)`  [AMBIGUOUS]
  CHANGELOG.md · relation: conceptually_related_to

## Knowledge Gaps
- **32 isolated node(s):** `tune-embeddings skill`, `vectors.json`, `update skill`, `The hook runs twice`, `Onboarding steps (optional)` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 751 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@huggingface/transformers` connect `eval-map.js` to `eval-model.js`, `package.json`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `tune-embeddings skill`, `vectors.json`, `update skill` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `tune.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07955596669750231 - nodes in this community are weakly interconnected._
- **Why does `build()` connect `build` to `mk.js`, `setup.js`, `dbFile`, `eval-model.js`, `eval-map.js`, `extract.js`, `getProject`, `dataDir`, `test-map.js`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `mk.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Fallback gate value (1.7 in ARCHITECTURE)` and `One prompt flow`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Retrain keep rule (0.3.0 entry)` and `No-name retrain always keeps (earlier 0.3.0 entry)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._