# Workflows

What gabriel does, step by step. Each section has a summary, the code to check, and one diagram that follows the code, not the plans.

Read [ARCHITECTURE.md](ARCHITECTURE.md) first for the parts.

Diamonds are decisions. Boxes with a file name are files gabriel reads or writes. "Fail open" means an error prints nothing and the prompt goes on. Terms (rules graph, map, meaning numbers): see [ARCHITECTURE](ARCHITECTURE.md).

## 1. Install and first setup

You add the plugin, install it, and run `/gabriel:setup`. Setup runs 10 steps. Then `add-docs` adds a doc set and builds its first map.

Code: `skills/setup/SKILL.md` runs `src/setup.js`. The 10 steps are in `run()` in `src/setup.js`. `skills/add-docs/SKILL.md` runs `addDocs()` in `src/setup.js`.

On a first install (or with `--onboard`), the setup skill then offers four optional steps, each asked first: install helper skills, graph a project, write its docs in the [DOC-LAYOUT](DOC-LAYOUT.md) layout, and download stack docs into `docs/stack/`. These run in Claude, not in `setup.js`.

```mermaid
flowchart TD
  A["Add the marketplace: /plugin marketplace add"] --> B["Install: /plugin install gabriel@gabriel"]
  B --> C["/gabriel:setup runs src/setup.js"]
  C --> S1["Step 1: check Node 22.5 or newer"]
  S1 --> D1{"Node new enough?"}
  D1 -- "no" --> X1["Stop: install Node 22.5 or newer"]
  D1 -- "yes" --> S2["Step 2: npm ci --omit=dev when the pinned package differs"]
  S2 --> S3["Step 3: create data folder with docs, docs/stack, private, models"]
  S3 --> S4["Step 4: add starter docs/README.md when there are no doc sets"]
  S4 --> S5["Step 5: download the meaning model once"]
  S5 --> D5{"Model on disk?"}
  D5 -- "no" --> W["Words-only mode. Retry: setup --only model"]
  D5 -- "yes" --> S6
  W --> S6["Step 6: old data/mk.db found and new mk.db missing?"]
  S6 -- "yes, with --yes: copy old data, see workflow 10" --> S7
  S6 -- "no" --> S7
  S7["Step 7: brain.js build writes graph.json"] --> S8["Step 8: brain.js build-mk writes mk.db for each doc set"]
  S8 --> S9["Steps 9 and 10: npm test, a failure is printed only, then summary"]
  S9 --> AD["/gabriel:add-docs name folder"]
  AD --> D2{"Folder has doc files?"}
  D2 -- "no" --> X2["Stop: 0 docs found, projects.json unchanged"]
  D2 -- "yes" --> D3{"--code given and its graphify-out/graph.json missing?"}
  D3 -- "yes" --> X3["Stop: no graph in the repo, nothing written"]
  D3 -- "no" --> P["Write projects.json, atomic write"]
  P --> F["build-mk writes the first map rows for this doc set"]
```

## 2. One prompt

On each prompt, the host runs `brain.js hook`. Short prompts and slash commands get no context. Other prompts get rule notes, a map block, and similar earlier prompts. Items this session already got are removed.

Code: `hook()`, `gather()`, `dedupe()` and `searchFull()` in `src/brain.js`. `readInput` and `writeOutput` in `src/hosts/*.js`. `searchAll()`, `search()` and `format()` in `src/mk.js`.

```mermaid
sequenceDiagram
  participant H as Host
  participant B as brain.js hook
  participant A as Host adapter
  participant R as Rules graph
  participant M as Map mk.db
  participant D as Dedupe
  H->>B: Prompt as JSON on stdin
  B->>A: readInput
  A-->>B: prompt, session, folder, transcript path
  alt "gabriel use <set>" or "gabriel use auto"
    B->>B: Save or clear the pin in data/seen/<session>.pin
    B-->>H: One-line note only
  else Slash command, under 4 words, or automated message
    B-->>H: Setup hint only, or empty output
  else Normal prompt
    B->>R: searchFull: words, synonyms, meaning if the model is on disk
    R-->>B: Best rule notes, at most 6, and up to 2 similar earlier prompts
    B->>B: Save prompt to history
    B->>B: Start background refresh if due, detached
    B->>M: searchAll over every doc set, or only the pinned one
    M->>M: Score = best match + prior + alias bonus + folder bonus
    M->>M: Quiet gate: best match under 0.65 gives no map
    M->>M: Session gate: weak unnamed match outside the project folder needs an earlier map this session
    M->>M: Fallback general docs only when the project best is under 1.6
    M-->>B: Doc lines and code lines, or nothing
    B->>D: Drop items this session already got
    D-->>B: New items only
    B->>A: writeOutput with text and note
    A-->>H: JSON with additionalContext
  end
  Note over B,H: While pinned, every note starts with the 📌 pinned line. Any error: nothing printed, prompt goes on. Fail open.
```

## 3. Learning from use

When a map is shown, gabriel saves the prompt's strongest seeds for the session. If a file is read or edited soon after, gabriel links those seeds to the file's main types. Links fade and never start a search. Code: `remember()`, `touched()`, `learnShow()` and `learnReset()` in `src/mk.js`. `touchedHook()` in `src/brain.js`. `readTouched` in `src/hosts/*.js`. The hook matchers are in `hooks/hooks.json`.

```mermaid
flowchart TD
  A["A map was shown: remember() saves the top 10 seeds, the session and the project"] --> B["Agent reads or edits a file"]
  B --> H["PostToolUse or AfterTool hook runs brain.js touched"]
  H --> D1{"mk.db exists?"}
  D1 -- "no" --> N1["Nothing learned"]
  D1 -- "yes" --> R["host.readTouched gives the file path"]
  R --> D2{"A map was shown for this session in the last 45 minutes?"}
  D2 -- "no" --> N2["Ignored: no recent map"]
  D2 -- "yes" --> D3{"File is in this project map and not counted yet?"}
  D3 -- "no" --> N3["Ignored: not in map, or already counted"]
  D3 -- "yes" --> T["Targets: up to 3 code types in the file, with 600 links or fewer"]
  T --> SD["Seeds: up to 8 seeds that are not in this file"]
  SD --> L["learn row in mk.db: weight grows by 0.2 times the seed strength, capped at 1"]
  L --> C["Count the file in the done list, so it counts once per map"]
  L --> U["Use at search time only when seen 2 or more times and weight is 0.02 or more"]
  U --> CAP["Learned light is capped at 45 percent of the strongest unlearned activation"]
  L --> F["Fade: half-life 45 days"]
  F --> P["Rebuild: integrate() drops links whose nodes are gone or too faded"]
```

## 4. Building a map

A build reads one doc set and its optional `graph.json`. It splits the docs into chunks and reads the code names. It writes a temp file, then copies only that doc set's rows into `mk.db`, in one transaction. The old map serves until then. Code: `build()`, `chunkDoc()` and `integrate()` in `src/mk.js`. `extractText()` in `src/extract.js`. `build-mk` mode in `src/brain.js`. The question index is built by `embedAll()` in `src/dq.js`.

```mermaid
flowchart TD
  A["build-mk for one doc set, settings from projects.json"] --> G{"graph.json set and missing?"}
  G -- "yes" --> E1["Stop: graph not found, the old map stays"]
  G -- "no" --> L["listDocs: technical-docs folder if present, else every doc file"]
  L --> X["extractText: Markdown, Word, PDF, HTML and more. JSON, JSONL, YAML only when opted in"]
  X --> T{"File has text?"}
  T -- "no" --> SK["Count as skipped"]
  T -- "yes" --> C["chunkDoc: split at headings, about 450 characters each"]
  C --> CN["Code neurons from graph nodes, with communities"]
  CN --> CS["Code synapses from graph edges, weight by relation type"]
  C --> DC["Doc to code links: cited file paths and class names"]
  C --> DD["Doc to doc links: Markdown links, shared names, same section"]
  DC --> WN["Warning line if under 1 percent of doc sections link to code. Build goes on"]
  CS --> TMP["Write temp file mk.db.PID.tmp: nodes, words, edges, df"]
  DC --> TMP
  DD --> TMP
  TMP --> M{"Embedding model on disk?"}
  M -- "no" --> W["No meaning numbers: words only"]
  M -- "yes" --> V["Meaning numbers: chunks vec, headings vech, class names vecc"]
  V --> ST["Stamp meta: graph and doc file times and sizes"]
  W --> ST
  ST --> I["integrate: one transaction, replace this doc set rows only"]
  I --> K["Keep learned links when both neurons exist and weight is 0.02 or more"]
  K --> DEL["Delete the temp file"]
```

## 5. Add docs later

You add or change doc files. Then you run `/gabriel:update`. It registers new folders, rebuilds stale maps, and suggests test questions for new sections. It never changes your saved questions. You often do not need to run it: the hook starts the same update in the background when it sees a new doc folder with files (`registerNewDocFolders()` in `src/brain.js`, at most once every 10 minutes). After code changes, `/gabriel:refresh-docs` updates the graph and the docs, then runs this update and asks whether to retrain. Code: `update()` in `src/setup.js`. `newSuggestions()` in `eval/suggest-cases.js`. `stale()` and `hasMap()` in `src/mk.js`.

```mermaid
flowchart TD
  A["Add doc files: copy a folder into docs, or run add-docs"] --> U["Run /gabriel:update"]
  U --> S1{"projects.json exists?"}
  S1 -- "no" --> S1N["Step 1 skipped: no projects.json, so auto mode reads the docs folders"]
  S1 -- "yes" --> S1Y["Step 1: add folders under docs as new doc sets"]
  S1N --> S2{"Map missing or stale?"}
  S1Y --> S2
  S2 -- "yes" --> R["Step 2: build-mk rebuilds this doc set"]
  S2 -- "no" --> UP["Step 2: up to date, map kept"]
  R --> S3{"Saved eval-cases.json exists?"}
  UP --> S3
  S3 -- "yes" --> SG["Step 3: write eval-cases.suggested.json for new sections only"]
  S3 -- "no" --> SK["Step 3: no suggestions"]
  SG --> NX["Step 4: print next steps: retrain, and tune if a local model is set"]
  SK --> NX
  NX --> SM["Step 5: summary. Exit code 1 if a rebuild failed"]
```

## 6. Measure and retrain

Your saved questions show how well the map finds answers. `retrain` trains new ranking weights from them. With a doc set name, it keeps the new weights only when the strict pass count does not fall, unless you add `--force`. With no name (the default set), it always keeps them and saves the old file as `rank.prev.json`. Code: `eval/suggest-cases.js`, `eval/eval-map.js`, `src/train-rank.js` and `src/retrain.js`. The weights are read by `loadRank()` and used by `rankDocs()` in `src/mk.js`.

```mermaid
flowchart TD
  A["/gabriel:retrain name"] --> D1{"Saved eval-cases.json exists?"}
  D1 -- "no" --> SU["suggest-cases writes eval-cases.suggested.json: heading and first sentence"]
  SU --> HW["You rewrite each question in your own words and save eval-cases.json"]
  HW --> A
  D1 -- "yes" --> B["build-mk: rebuild the map"]
  B --> E1["eval-map: score the current weights, strict and quiet"]
  E1 --> TR["train-rank --out temp file: listwise training, needs the local meaning model"]
  TR --> D2{"Training worked?"}
  D2 -- "no" --> K0["Keep current weights"]
  D2 -- "yes" --> E2["eval-map --rank temp file: score the new weights"]
  E2 --> D3{"Name given? New strict count at least the old one? (no name: always yes)"}
  D3 -- "yes" --> SV["Old file to rank.prev.json if no name. Copy temp file to private rank.json for this doc set"]
  D3 -- "no" --> K1["Keep current weights: the count fell"]
```

## 7. Fine-tune the meaning model (optional)

You train a copy of the meaning model on your own questions. Then you score the copy and the current model on a copy of your data. The copy becomes the meaning model only when the keep rule passes. `--rollback` removes the setting.

Code: `runTune()` in `src/setup.js`. `src/tune/tune.js` holds `stage()`, `measure()`, `decide()`, `keepModel()` and `rollBackModel()`. `src/tune/export-pairs.js`, `src/tune/train.py` and `src/tune/export_onnx.py` do the other steps.

```mermaid
flowchart TD
  A["setup --tune: find Python 3.10 or newer"] --> D1{"Python found?"}
  D1 -- "no" --> X1["Stop: install Python 3.10 or newer"]
  D1 -- "yes" --> V["Create tune-venv in the data folder"]
  V --> PK["pip install requirements: torch from the CPU index, then tune packages"]
  PK --> T["tune.js: venv, eval questions and mk.db must exist, no embedModel set"]
  T --> D2{"--yes given or you typed y?"}
  D2 -- "no" --> X2["Cancelled, nothing changed"]
  D2 -- "yes" --> ST["Stage a copy in data/tune/work: copy written files, link models and docs"]
  ST --> P1["Step 1: export-pairs: one pair per question, split 20 percent by file"]
  P1 --> P2["Step 2: train.py: 2 epochs, batch 32, learning rate 2e-5"]
  P2 --> P3["Step 3: export-onnx.js runs export_onnx.py: ONNX, then 8-bit quantized"]
  P3 --> P4["Step 4: rebuild maps in the copy, score base and tuned"]
  P4 --> D3{"Keep rule: held-out total up, no project down by more than 1, full and quiet not lower?"}
  D3 -- "yes" --> KP["Copy model to models local gabriel-tuned, set embedModel, rebuild question index"]
  D3 -- "no" --> RB["Delete the copy model. Real data unchanged"]
  KP --> CL["Delete the work folder"]
  RB --> CL
```

## 8. Other agent hosts

Codex CLI and Gemini CLI get gabriel through their own hook file. `--host` shows the change. `--apply` writes it, after a backup. Other tools call `brain.js context`. Removing a host deletes only gabriel's hooks.

Code: `hostSetup()`, `addGabriel()` and `removeGabriel()` in `src/setup.js`. Host adapters in `src/hosts/codex.js`, `src/hosts/gemini.js`, `src/hosts/generic.js` and `src/hosts/claude.js`.

```mermaid
flowchart TD
  A["setup --host codex or gemini"] --> C1{"Host has a hook file?"}
  C1 -- "no" --> P0["Claude: a plugin, setup writes nothing. Other tools: call brain.js context"]
  C1 -- "yes" --> R["Read the file: codex hooks.json or gemini settings.json"]
  R --> C2{"File is valid JSON?"}
  C2 -- "no" --> E1["Stop: nothing changed"]
  C2 -- "yes" --> M["addGabriel: add missing hooks, update changed ones, no duplicates"]
  M --> C3{"--apply given?"}
  C3 -- "no" --> DR["Print the hooks and the changes. Write nothing"]
  C3 -- "yes" --> C4{"Any change?"}
  C4 -- "no" --> AL["Already set up: no change"]
  C4 -- "yes" --> CK["Check the new JSON"]
  CK --> BK["Copy the file to a backup with a time stamp"]
  BK --> W["Write the new file, atomic write"]
  W --> RM["--remove-host with --apply: remove only gabriel hooks for that host, same backup and write"]
```

## 9. Data and privacy

Code lives in the plugin folder. Your docs, maps and prompt history live in one data folder. Setup downloads packages and one model, once. The prompt hook never downloads anything.

Code: `src/paths.js` (`dataDir()`, `rulesHome()`), `src/history.js` (`redact()`), `src/embed.js` (`getEmbedder()`, downloads off in the hook), `tools/check-public.js` (skips `private`).

```mermaid
flowchart LR
  subgraph PLUG ["Plugin folder: code only"]
    P1["src, hooks, skills, eval"]
    P2["node_modules from npm ci"]
  end
  subgraph DATA ["Data folder: GABRIEL_DATA, or the old folder, or the home gabriel folder"]
    D1["mk.db: map chunks, code names, learned links"]
    D2["vectors.json and dq bin: meaning numbers"]
    D3["graph.json and per-host graphs: rule text"]
    D4["history: prompts by month and machine, redacted"]
    D5["docs and private: your files"]
    D6["models: the meaning model"]
    D7["tune-venv and tune work: only with --tune"]
  end
  subgraph RULES ["Rules home: read only"]
    R1["CLAUDE.md, AGENTS.md or GEMINI.md"]
    R2["projects memory notes"]
  end
  N1["Setup step 2: npm registry, once"] --> P2
  N2["Setup step 5: model host, once"] --> D6
  N3["Only with --tune: pip and torch CPU index"] --> D7
  R1 & R2 --> D3
  H1["Prompt hook: no network calls"] --> D1 & D4
  H2["Redaction: keys, tokens and bearer values replaced"] --> D4
  X1["tools check-public skips the private folder"] --> D5
```

## 10. Owner migration from the old brain folder

`migrate-data.js` copies data from the old brain folder into the data folder. It never deletes or changes the source. It hashes every file. A second run finishes what is left. Code: `migrate()` and `MOVES` in `src/migrate-data.js`. Step 6 in `run()` in `src/setup.js` plans the copy. It copies only with `--yes`.

```mermaid
flowchart TD
  A["Setup step 6: old data/mk.db exists and new mk.db missing?"] --> D1{"Yes?"}
  D1 -- "no" --> N["Nothing to copy"]
  D1 -- "yes" --> P["Plan: one pair per file from MOVES, project name fills the placeholder"]
  P --> SC["Pre-scan: missing target = copy, same SHA-256 = done, different = conflict"]
  SC --> D2{"Any conflict?"}
  D2 -- "yes" --> E1["Stop before copying: conflict list printed"]
  D2 -- "no" --> D3{"--yes given?"}
  D3 -- "no" --> DR["Dry run: list the files. Copy later with --yes"]
  D3 -- "yes" --> CP["Copy each file with exclusive create"]
  CP --> HC{"Hash of the copy matches the source?"}
  HC -- "no" --> E2["Delete the bad copy, stop with a hash error"]
  HC -- "yes" --> LG["Append one line to migration.log: source, target, hash, size"]
  LG --> JS["JSON files: written once, never overwritten"]
  JS --> DN["Done. Source folder unchanged. Run again to resume"]
```
