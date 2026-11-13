# Architecture

For the step-by-step flows, with diagrams, see [WORKFLOWS.md](WORKFLOWS.md).

This page explains how gabriel works inside. Read the [README](../README.md) first.

gabriel has two parts:

- **Rules graph.** Short rules and memory notes from your host's rules folder (`~/.claude` for Claude Code).
- **Map.** Doc sections and code names from your doc folders.

A graph is a set of nodes joined by links. gabriel calls each node a "neuron" in its code and in its map search.

## How a prompt is handled

Each time you send a prompt, Claude Code runs the `UserPromptSubmit` hook (`hooks/hooks.json`). The hook runs `src/brain.js hook`.

```mermaid
flowchart TD
  P["User prompt"] --> H["UserPromptSubmit hook: brain.js hook"]
  H --> S{"Slash command, under 4 words, or automated message?"}
  S -- "yes" --> N["No context. Setup hint, if due"]
  S -- "no" --> R["Rules graph: words, synonyms, meaning"]
  S -- "no" --> M["Map search over doc sets"]
  M --> RT["Route: score each project"]
  RT --> GT{"Best score passes the gate?"}
  GT -- "yes" --> PB["Project block: doc sections and code names"]
  GT -- "no" --> FB{"Fallback project passes its own gate?"}
  FB -- "yes" --> FBB["Fallback block: background reading"]
  FB -- "no" --> NB["No map block"]
  S -- "no" --> HI["Up to 2 similar earlier prompts"]
  R --> DD["Dedupe: drop items already sent in this session"]
  PB --> DD
  FBB --> DD
  NB --> DD
  HI --> DD
  DD --> OUT["additionalContext to Claude. Short systemMessage to you"]
```

Prompts that start with `/`, have fewer than 4 words, or look like harness messages skip the search.

Codex CLI, Gemini CLI and other tools run the same steps through their own adapter in `src/hosts/`. Each adapter reads the host's input and writes the host's output. See [HOSTS](HOSTS.md).

The hook never blocks a prompt. Any error means it prints nothing. The hook timeout is 60 seconds. The map search is skipped when the hook is already past 11 seconds. The meaning step gives up after 9 seconds.

## Rules graph

- **Sources.** The files named in `ruleFiles` in `projects.json`. With no setting, the host's default file: `CLAUDE.md` in `~/.claude` (Claude Code), `AGENTS.md` in `~/.codex` (Codex CLI), `GEMINI.md` in `~/.gemini` (Gemini CLI). It also reads memory notes under `projects/*/memory/` in the same folder, except `MEMORY.md`.
- **Nodes.** Each bullet or paragraph is one node. The nearest heading is its section.
- **Note headers.** A note can set `valid-until: YYYY-MM-DD` to drop out after that day. It can set `supersedes: <note name>` to drop an older note.
- **Skipped lines.** A line with `key`, `token`, `secret` or `password` and a long value is never stored.
- **Already in context.** Nodes from the host's always-loaded file (`CLAUDE.md`, `AGENTS.md` or `GEMINI.md`) and files it imports are loaded every session. gabriel never injects them again.
- **Matching.** Words count with an inverse-frequency weight. Synonyms from `src/thesaurus.json` count half. A node needs 2 or more matching words, or one strong exact term such as a long name with a dash or dot.
- **Meaning.** A small local model scores each node against the prompt. A meaning score needs to reach 0.3 unless words already matched.
- **Output.** Up to 6 rules. The block stays under 2400 characters. Each rule line is cut at 320 characters.
- **Storage.** `graph.json` in the data folder for Claude Code, and `graph.<host>.json` for the other hosts. It is rebuilt when a source file changes.

## Map build

The map is built from each doc set (a "project") in `projects.json`.

```mermaid
flowchart LR
  D["Doc folder: Markdown files"] --> CH["Chunks: up to 450 characters, with heading path"]
  G["graphify-out/graph.json (optional)"] --> CN["Code nodes and links"]
  CH --> DB["mk.db: doc neurons, code neurons, links, word index"]
  CN --> DB
  CH --> V["Meaning numbers per chunk, stored in mk.db"]
  V --> DB
```

- **Which files.** `layout: "auto"` reads `technical-docs/` when it exists. Otherwise it reads every `.md` file, except tool folders (`graphify-out`, `node_modules`, `.git`, `atlas`, `_tools`). `layout: "technical-docs"` reads only that folder. `layout: "all-md"` reads every `.md` file except `skipDirs`.
- **Chunks.** Text is split at headings and at spaces. Each chunk is at most 450 characters and keeps its heading path.
- **Code nodes.** When a project sets `graph`, the file is read from the project root. Links get a weight by relation: `calls` and `implements` 1.0, `method` 0.7, `defines` 0.6, `contains` 0.5, `references` 0.3, `imports` 0.2.
- **One file.** All projects share `mk.db`. Each row has a project tag. A build writes a temporary file, then replaces only the rows of the project it builds. Rows of a removed project stay until `mk.db` is deleted.
- **Learned links.** A rebuild keeps learned links that still point to a node. It drops the rest.
- **Build command.** `node src/brain.js build-mk [name|all]`. Setup runs it for each project.
- **Background rebuild.** The hook checks for changes at most once a minute. If a doc or the graph changed, it starts a rebuild. The old map keeps serving until the new one is ready. A lock stops a second rebuild for 10 minutes.

## Firing: the spreading search

For each prompt, the map search does this:

1. **Seeds.** Doc chunks and code nodes get a score from matching words (with synonyms). Doc chunks also get a score from meaning. Up to 30 doc seeds and 30 code seeds are kept. Code nodes with more than 800 links are never seeds.
2. **Spread.** The score moves along links for 3 rounds. Each step keeps the damping factor 0.55. Each step keeps at most 300 neurons.
3. **Gate.** The best score must reach 0.65. Otherwise the map shows nothing. A question close in meaning to a section title (0.52 or more) can pass the gate alone.
4. **Output.** Up to 6 doc chunks and 6 code names, in at most 2200 characters.
   - A doc line shows the file, the section and the text (cut at 210 characters).
   - A code line shows the name and the file, with its line.
   - For the top 3 code names, up to 4 neighbours each appear as `↔` lines. A `↔` line is one hop along a graph link. It has no direction.

A "session gate" applies only to a project with `"sessionGate": true` in `projects.json` (off by default). A weak match is a match that is not named in the prompt and is outside the project folder. For that project it shows only when this session already had a map for it. See [ADDING-DOCS](ADDING-DOCS.md), section 10.

## Ranking

- **Default.** Docs are ranked by their activation score.
- **Trained weights (optional).** If a project has `private/<name>/rank.json`, docs are ranked with its weights (key `w`). Signals include word and meaning scores, heading match, file depth and file size.
- **Picking.** At most 6 docs. At most 2 per file. One per section. Only docs within 3 points of the top score.
- **Training.** `node src/train-rank.js --project <name>` trains the weights from your own questions, for any doc set. See [EVAL](EVAL.md).

## Routing and fallback

Each project in `projects.json` is scored for a prompt:

- its best map score;
- its `prior` (a fixed number you set);
- plus 1.2 when one of its `aliases` appears as a whole word in the prompt;
- plus 0.3 when the working folder path contains the project name or one of its `cwdHints`.

The top project answers. A second project within 0.4 of the top adds a short block.

A project with `fallback: true` is the general docs. It answers only when no other project does, or when it is clearly stronger. Its block says it is background reading, not a rule of your repo. Its own stricter gate (1.7) applies.

## Learning

Learning links a prompt to the code you open next. It works like this:

1. A map is shown for a session. gabriel saves the prompt's top seeds for 45 minutes.
2. You read or edit a code file in the map within those 45 minutes. The hook for `Read`, `Edit`, `Write`, `MultiEdit` and `NotebookEdit` runs. Its timeout is 5 seconds.
3. The seeds (up to 8) get a link to the file's main types (up to 3).
4. Each file counts once per map.
5. A link shows in search only after 2 confirmations.
6. A link fades by half every 45 days. Links under 0.02 are removed.

A learned link never starts a search and never passes the gate. It only adds a small push to nodes that already fit. Use `node src/brain.js learn-show` to see the strongest links. Use `node src/brain.js learn-reset` to clear them.

## Dedupe

An item sent once in a session is not sent again in that session.

- Each item is keyed by its text line.
- The state lives in `seen/<session>.json`. Files older than 7 days are removed.
- The state resets when the transcript shows a compaction. It also resets every 30 prompts.
- Saving happens only after the output is written. An error never marks unsent items as sent.
- When items are skipped, a note says how many. For example: `(2 items already in context, not repeated)`.

## Question index (optional)

The question index helps the map match a question that uses different words from the doc.

- You write a few questions for each section in `private/<name>/doc-questions.json`.
- `node src/brain.js build-dq --project <name>` writes `dq.<name>.bin` and `dq.<name>.idx.json` in the data folder.

The index is used in two ways:

- When a project has the index, its 15 closest sections join the candidate pool.
- A trained ranking (`rank.json`) can use the match as one signal.

The rescue step is off. It lets a strong match pass the gate alone, but its threshold is 9 (`Q_GATE` in `src/mk.js`), and a meaning score cannot reach 9. Nothing sets a lower value, so the rescue never fires.

## Prompt history

Each prompt that reaches the search (4 words or more, not a slash command, not automated) is saved. Secrets are cut out first by pattern. Similar earlier prompts (score 0.6 or more) can appear as "Earlier prompts of yours that look related". At most 2 appear. Details are in [PRIVACY](PRIVACY.md).

## Setup steps

`node src/setup.js` (or `/gabriel:setup`) runs 10 steps and shows a progress bar.

1. Check Node.js (22.5 or newer).
2. Install npm packages with `npm ci --omit=dev`.
3. Create the data folder.
4. If there are no doc sets, create the starter file `docs/README.md` (a file, not a doc set).
5. Download the meaning model.
6. Copy data from an old brain folder. Copies only, and only with `--yes`.
7. Build the rules graph.
8. Build each doc set's map.
9. Run `npm test`.
10. Print a summary.

Flags: `--dry-run`, `--skip-model`, `--skip-test`, `--yes`, `--data <dir>`, `--only model|build|test`. Setup is safe to run again.

## Files and data

The plugin folder holds code only. It is replaced on update. Your data lives in one folder, `~/.gabriel`. Older installs keep `~/.claude/gabriel-data` while it exists. Set `GABRIEL_DATA` to use another folder.

```mermaid
flowchart TD
  DATA["gabriel-data folder"] --> PJ["projects.json: doc sets"]
  DATA --> DOCS["docs/name/: your Markdown"]
  DATA --> MK["mk.db: the map (SQLite)"]
  DATA --> VEC["vectors.json: meaning numbers for rules"]
  DATA --> GR["graph.json: rules graph"]
  DATA --> MOD["models/: the meaning model"]
  DATA --> HIS["history/: prompts, vectors, graph.db"]
  DATA --> SEEN["seen/: dedupe state, 7 days"]
  DATA --> PRI["private/name/: rank.json, doc-questions.json"]
  DATA --> DQ["dq.NAME.bin, dq.NAME.idx.json: question index"]
```

| Path (in the data folder) | What it holds |
|---|---|
| `projects.json` | Doc sets, aliases, routing, fallback. Shape: see `projects.example.json` in the plugin folder. With no file, each folder under `docs/` is a project. |
| `docs/<name>/` | Your Markdown files for one doc set. |
| `mk.db` | The map: doc chunks, code names, links, word index, learned links, last map per session. |
| `vectors.json` | Meaning numbers for the rules graph nodes. |
| `graph.json` | The rules graph (Claude Code). Other hosts: `graph.<host>.json`. |
| `models/` | The meaning model files. |
| `history/` | Your prompts (one `YYYY-MM.<machine>.jsonl` file per month), their meaning numbers, and `graph.db`. |
| `seen/` | Dedupe state per session. Removed after 7 days. |
| `private/<name>/` | Optional files for ranking and questions: `rank.json`, `doc-questions.json`, `eval-cases.json`. Also `privacy-words.txt` and `thesaurus.local.json` for your own word lists. `notes/EVAL-MK.md` is the eval report. |
| `dq.<name>.bin`, `dq.<name>.idx.json` | The question index for one doc set. Optional. |
| `*.lock`, `mk-check`, `history-check` | Small lock and timing files. |

The plugin's code reads the rules files of the host (for Claude Code: `CLAUDE.md` and memory files in `~/.claude`). It never writes there.

## Related

- [PRIVACY](PRIVACY.md): what is stored and what is sent.
- [TROUBLESHOOTING](TROUBLESHOOTING.md): common problems.
