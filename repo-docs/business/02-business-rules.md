# 02 Business rules

Each rule says what must hold, then where it is enforced. Workflows and states link here. They do not repeat these rules.

## The hook

### R01 Hook never blocks a prompt
Any error in the prompt hook prints nothing.
- Where: `src/brain.js` `hook()` (catch-all) and `touchedHook()`.
- Time limits: the hook timeout is 60 s (`hooks/hooks.json`). The map search is skipped after 11 s (`mapFor`, `MK_BUDGET_MS`). The meaning step gives up after 9 s (`EMBED_TIMEOUT`).

### R02 Short and slash prompts get no context
A prompt that starts with `/`, has fewer than 4 words, or is a harness message gets no rules, map or history. It may still get the setup hint or a tip. A pin command is checked first ([R35](#r35-session-pin)).
- Where: `src/brain.js` `hook()` and `contextText()`; `src/history.js` `isAutomated()`.

### R03 Rules block: at most 6 rules and 2400 characters
- At most 6 rules per prompt. Rules under 35% of the best score are dropped (`MAX_NODES`, `MIN_RATIO`, `rank()`).
- Each rule is cut at 320 characters (`NODE_CHARS`). The block stops at 2400 characters (`MAX_CHARS`, `format()`).
- Codex caps the full block at 9000 characters (`src/hosts/codex.js` `maxChars`, `capText()`).
- Where: `src/rules.js` `rank()`; `src/brain.js` `format()`, `capText()`.

### R04 Rules already in context are not repeated
Notes in the host's always-loaded file (for example `CLAUDE.md`) and files it imports with `@file` are never returned.
- Where: `src/rules.js` `importedByContext()`, `build()` (`inContext`), `rank()` (filter).

### R05 Rule lines with a secret are never stored
A rule block with the word key, token, secret or password, followed by a 24-plus character string, is skipped.
- Where: `src/rules.js` `SECRET`, `build()`.

### R06 Prompt history hides secrets and has a size cap
- `redact()` hides bearer tokens, `sk-` keys, values after key, token, secret, password or license, and long mixed strings that look like keys.
- A prompt over 8000 characters is cut. A prompt equal to the last saved one is not saved again.
- Where: `src/history.js` `redact()`, `append()`.

### R07 An item is not sent twice in one session
Each rule, map block or earlier prompt is sent once per session. A second copy is dropped and the user sees a count.
- The seen list resets on a compaction (the transcript shows one) and every 30 prompts.
- Items are marked sent only after the output is written. Seen files older than 7 days are removed.
- Where: `src/brain.js` `dedupe()` (its `save()` runs after the write).

## The map

### R08 Map block: at most 6 doc hits and 6 code hits, 2200 characters
- Doc hits: `MAX_DOCS`, at most 2 per file, none under 30% of the best hit. Code hits: `MAX_CODE`, same 30% rule. Each doc snippet: `DOC_CHARS` (210).
- Extra "2 links away" lines come on top, up to the set's `max` ([R34](#r34-two-links-away-code-names)). The size limit (`MAX_CHARS`) still applies to all lines.
- Where: `src/mk.js` `format()`.

### R09 One doc set leads; a close second gets a short block
- The doc set with the best score leads. A second doc set within 0.4 points gets a short block (1100 characters, 2 docs, 2 code lines).
- Where: `src/mk.js` `searchAll()` (`ALSO_CLOSE`), `format()` (`ALSO_CHARS`).

### R10 General docs answer only when no doc set does
The fallback doc set (public background docs) answers when no doc set matches. It leads only when it is far stronger than a weak doc-set match. Otherwise it adds a short block. The block says it is background reading, not a rule of this repo.
- Where: `src/mk.js` `searchAll()` (`FALLBACK_IF_WEAKER_THAN`, `FALLBACK_FIRST`, `FALLBACK_MARGIN`), `format()`.

### R11 Session gate (opt-in)
When a doc set sets `sessionGate: true`, a weak match is dropped unless the prompt names the set or the working folder path contains its name. It also shows only when this session already had a map for that set. Default: off.
- Where: `src/mk.js` `searchAll()`, `hadMap()`, `SESSION_STRONG`; `src/projects.js` `DEFAULTS`.

### R12 A named doc set gets the prompt first
A prompt that names a doc set by one of its aliases adds 1.2 points to that set.
- When one alias sits inside a longer alias that also matches (`gabriel` inside `gabriel-dev`), only the longer one counts.
- Where: `src/mk.js` `searchAll()` (`named`, `ROUTE_NAMED`), `namedProjects()`. A `cwdHints` match in `projects.json` adds 0.3. `add-docs --code <repo>` sets `cwdHints` to the repo's lower-case name (or its git repo's name).

### R13 A map is a lead, not proof
The map block says to confirm in the code, and that the map can be old. The `map` skill tells the model to name the doc or file and check it. A `↔` line is a one-hop link with no direction.
- Where: `src/mk.js` `format()`; `skills/map/SKILL.md`.

## Rules graph

### R14 Old and expired memory notes
- A memory note older than 30 days shows `old note: verify`.
- A note with `valid-until: <date>` is dropped after that day. An invalid date keeps the note and gives a warning.
- A note with `supersedes: <name>` drops the older memory note with that name.
- Where: `src/rules.js` `build()` (`STALE_DAYS`, `valid-until`, `supersedes`).

### R15 Default preferences only without a preferences.md
The plugin's `defaults/preferences.md` is used only when the rules folder has no `preferences.md` of its own.
- Where: `src/rules.js` `sources()`.

## Keeping maps current

### R16 A doc set map is rebuilt when its sources change
A map is stale when the graph file, a doc file (its time and size), the map format version or the meaning model changed.
- Where: `src/mk.js` `stale()`, `sources()`, `DB_VERSION`.

### R17 The old map serves until the new one is ready
A build writes a temp file. The new rows replace the old ones in one transaction. A failed build leaves the old map in place.
- Where: `src/mk.js` `build()` (temp file), `integrate()` (`BEGIN IMMEDIATE`).

### R18 Background builds: one at a time, checked each minute
- The hook checks for stale maps at most once a minute, and starts the first stale doc set. A set whose graph file is missing is skipped.
- One background build runs at a time. Its lock file `mk.lock` names the set and counts as held for 10 minutes. A build removes it when it is the default or the named set.
- Where: `src/brain.js` `refreshMapInBackground()` (`mk-check`, `MK_LOCK_MS`), `mk.graphPathOf()`; `src/brain.js` build mode (lock removal).

### R19 New doc folders join only when they hold files
A folder under `docs/` becomes a doc set only when it has at least one file (hidden files do not count). Under `projects.json`, this happens in `/gabriel:update`, or a background run of it, at most once per 10 minutes.
- Where: `src/brain.js` `registerNewDocFolders()`; `src/setup.js` `update()` step 1; `src/projects.js` `hasFiles()`.

### R20 Without projects.json, every folder with files is a doc set
- Where: `src/projects.js` `loadConfig()`.

### R21 Folder names are short and plain
A name uses lower-case letters, digits, `-` and `_`, up to 40 characters, and starts with a lower-case letter or digit.
- Where: `src/paths.js` `checkName()`, `NAME`.

### R22 add-docs refuses a used name or a huge folder
- A name already in `projects.json` is refused. `--copy` never overwrites a folder.
- A folder over 20000 files or 500 MB needs `--yes`.
- `--code <repo>` with no `graphify-out/graph.json` stops before any write ([R33](#r33-a-code-graph-must-exist-and-match-the-docs)).
- Where: `src/setup.js` `addDocs()`, `MAX_DOC_FILES`, `MAX_DOC_BYTES`.

## Learning from use

### R23 A learned link needs two confirmations and fades
- A link is used in search only after 2 confirmations (`LEARN_MIN_N`). Its weight halves every 45 days (`HALF_LIFE_DAYS`).
- A link under 0.02 is removed at the next map build (`LEARN_PRUNE`). A link adds at most 45% of a neuron's strongest unlearned score (`LEARN_CAP`).
- Where: `src/mk.js` `search()`, `effective()`, `integrate()`.

### R24 Learned links never start a search
Learned links only spread a search that words or meaning already started. They never pass the gate on their own.
- Where: `src/mk.js` `search()` (comments at the learned-links step).

### R25 A file counts once per map, within 45 minutes
A file opened or edited counts only if a map was shown in the same session no more than 45 minutes earlier and the file is in that map. Each file counts once per map.
- Where: `src/mk.js` `touched()` (`LEARN_WINDOW_MS`, `done` list).

## Eval and tuning

### R26 Retrain keeps new weights only when the strict score does not fall
With a doc set name, the new strict count must be at least the old count. With no name, the new weights always replace the old ones, and the old file is saved as `rank.prev.json`. If either strict count is missing, a named run keeps the current weights. With no eval case file, retrain only writes suggested cases.
- Where: `src/retrain.js` `keepNew()`, the `eval-cases.json` check.

### R27 Model tune keeps the tuned model only when it wins
The tuned model is kept only when the held-out total rises, no doc set's held-out count falls by more than 1, and the full strict and quiet counts do not fall.
- Where: `src/tune/tune.js` `decide()`, `rollBackModel()`.

## Tips and hints

### R28 One tip per session
A session gets at most one tip, in order, starting again at the end of the list. Tips are off when `projects.json` has `"tips": false`.
- Where: `src/tips.js` `tipFor()`.

### R29 Setup hint until setup is done
The setup hint shows once per session until the data folder has `mk.db`, `projects.json` or `docs/`.
- Where: `src/brain.js` `setupHint()`.

## Setup and hosts

### R30 Nothing leaves the machine after setup
- A prompt uses the meaning model only from local files (`local_files_only`). The model is downloaded only in setup step 5 (`src/setup.js` `fetchModel()`) and by `brain.js build`.
- Network calls in setup: `npm ci` (step 2), and pip for the optional tune run. Stack docs are fetched only when the user picks them, by the `setup` and `update` skills.
- The injected text goes to the model the host already uses.
- Where: `src/embed.js` `getEmbedder()`; `src/brain.js` `build` mode; `src/setup.js` `run()`.

### R31 Host hook files change only with --apply, after a backup
Without `--apply`, `setup.js --host` prints the config and changes nothing. With it, the file is backed up, checked as JSON, then written. Other hooks are kept. `--remove-host` removes only gabriel's entries.
- Where: `src/setup.js` `hostSetup()`, `addGabriel()`, `removeGabriel()`.

### R32 Old data is copied, never deleted
Setup step 6 copies data from `~/.claude/brain`, and only with `--yes`. A failed copy leaves the old data as it was.
- Where: `src/setup.js` `run()` step 6; `src/migrate-data.js` `migrate()`.

## Code graph

### R33 A code graph must exist and match the docs
- A doc set with a `graph` entry whose file is missing fails to build with `graph not found`. The old map stays.
- `add-docs --code <repo>` needs `<repo>/graphify-out/graph.json`. With no file, it stops. It never falls back to the docs folder.
- A build that finds almost no code (under 1% of doc sections link to it) prints a warning and still finishes. A section links by a cited file path or a backticked name (rule in [ARCHITECTURE](../../docs/ARCHITECTURE.md), Map build).
- `add-docs <name> --code <repo> --relink` sets only that set's `graph` and rebuilds its map. `mk-status all` shows each graph path, and `GRAPH MISSING` when the file is gone.
- Where: `src/mk.js` `build()`, `graphPathOf()`; `src/setup.js` `addDocs()`, `relinkDocs()`; `src/brain.js` `mk-status` mode.

## Chain and session pin

### R34 Two links away: code names
- After the one-hop `↔` lines, `src/mk.js` `search()` (block "Two hops out") adds code names reached by two strong links (each weight 0.6 or more) from the top code hits. The name must contain the hit's name stem: its first `stem` PascalCase parts, with a leading verb in `CHAIN_VERBS` dropped. `format()` marks such a line "2 links away".
- At most `max` such lines per search. A node with more than `SEED_HUB` links is never added.
- Each doc set can set `chain` in `projects.json`: `seeds` (top code hits it starts from, 0 to 10), `max` (extra lines, 0 to 10), `stem` (name parts that must match, 1 to 6; higher is stricter). Defaults: 4, 3, 3 (`src/projects.js` `DEFAULTS`). Each field can be set on its own. A value that is not a number falls back to the set's value, then the default. A number out of range is clamped to its limit.
- Test on 12 private questions (2026-11-14): no chain 9/12, 3,3,3 10/12, 4,3,3 11/12. Main gate 523/569 and quiet 30/31 unchanged. Other values: `node eval/eval-map.js --chain <seeds>,<max>,<stem>`.
- Where: `src/mk.js` `search()`, `CHAIN_VERBS`, `CHAIN_DEFAULT`, `chainNum()`; `src/projects.js` `loadConfig()`; `eval/eval-map.js`.

### R35 Session pin
- `gabriel use <set>` (a set name or an alias, any case) pins this session to that set. The pin is one line in `<data>/seen/<session>.pin`. The reply is a note only. The pin check runs before the [R02](#r02-short-and-slash-prompts-get-no-context) gate.
- `gabriel use auto` clears the pin. An unknown name, such as `gabriel use ?`, lists the set names.
- While pinned, `src/mk.js` `searchAll()` searches only that set. The fallback rule ([R10](#r10-general-docs-answer-only-when-no-doc-set-does)) is unchanged.
- Every user note starts with a blank line, then `📌 pinned: <set>  ("gabriel use auto" to undo)`. The model text never gets it.
- Not pinned, with 2 or more doc sets: each map note ends with a 💡 line that suggests `gabriel use <set>`. The model text never gets it.
- No session id: nothing is pinned, and the reply says so.
- Gaps: [findings](../technical/findings.md).
- Where: `src/pin.js` `parsePin()`, `getPin()`, `setPin()`; `src/brain.js` `pinNote()`, `hook()`, `mapFor()`; `src/mk.js` `searchAll()` (`opts.pin`). Tests: `test/test-pin.js`, `test/test-workflow.js`.
