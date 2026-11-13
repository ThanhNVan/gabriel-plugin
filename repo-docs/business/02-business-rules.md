# 02 Business rules

Each rule says what must hold, then where it is enforced. Workflows and states link here. They do not repeat these rules.

## The hook

### R01 Hook never blocks a prompt
Any error in the prompt hook prints nothing. The prompt goes on as if gabriel were not there.
- Where: `src/brain.js` `hook()` (catch-all) and `touchedHook()`.
- Time limits: the hook timeout is 60 s (`hooks/hooks.json`). The map search is skipped after 11 s (`mapFor`, `MK_BUDGET_MS`). The meaning step gives up after 9 s (`EMBED_TIMEOUT`).

### R02 Short and slash prompts get no context
A prompt that starts with `/`, has fewer than 4 words, or is a harness message gets no rules, map or history. It may still get the setup hint or a tip.
- Where: `src/brain.js` `hook()` and `contextText()`; `src/history.js` `isAutomated()` (harness messages such as task notices).

### R03 Rules block: at most 6 rules and 2400 characters
- At most 6 rules per prompt. Rules under 35% of the best score are dropped (`MAX_NODES`, `MIN_RATIO`, `rank()`).
- Each rule is cut at 320 characters (`NODE_CHARS`).
- The whole rules block stops at 2400 characters (`MAX_CHARS`, `format()`).
- Codex caps hook output, so the full block is cut at 9000 characters (`src/hosts/codex.js` `maxChars`, `capText()`).
- Where: `src/rules.js` `rank()`; `src/brain.js` `format()`, `capText()`.

### R04 Rules already in context are not repeated
Notes in the host's always-loaded file (for example `CLAUDE.md`) and files it imports with `@file` are already in context. They are marked and never returned.
- Where: `src/rules.js` `importedByContext()`, `build()` (`inContext`), `rank()` (filter).

### R05 Rule lines with a secret are never stored
A rule block that has the word key, token, secret or password followed by a 24-plus character string is skipped.
- Where: `src/rules.js` `SECRET`, `build()`.

### R06 Prompt history hides secrets and has a size cap
- Before saving, `redact()` hides bearer tokens, `sk-` keys, values after names like key, token, secret, password or license, and long mixed strings that look like keys.
- A prompt over 8000 characters is cut.
- A prompt equal to the last saved one is not saved again.
- Where: `src/history.js` `redact()`, `append()`.

### R07 An item is not sent twice in one session
Each rule, map block or earlier prompt is sent once per session. A second copy is dropped and the user sees a count.
- The seen list resets when the transcript shows a compaction, and every 30 prompts.
- Items are marked as sent only after the output is written. A crash or timeout does not mark unsent items.
- Seen files older than 7 days are removed.
- Where: `src/brain.js` `dedupe()` (its `save()` runs after the write).

## The map

### R08 Map block: at most 6 doc hits and 6 code hits, 2200 characters
- Doc hits: `MAX_DOCS`, at most 2 per file, and none under 30% of the best hit. Code hits: `MAX_CODE`, same 30% rule. Block size: `MAX_CHARS`. Each doc snippet: `DOC_CHARS` (210).
- Where: `src/mk.js` `format()`.

### R09 One doc set leads; a close second gets a short block
- The doc set with the best score leads. A second doc set within 0.4 points gets a short block (1100 characters, 2 docs, 2 code lines).
- Where: `src/mk.js` `searchAll()` (`ALSO_CLOSE`), `format()` (`ALSO_CHARS`).

### R10 General docs answer only when no doc set does
The fallback doc set (public background docs) answers when no doc set matches. It leads only when it is far stronger than a weak doc-set match. Otherwise it adds a short block. Its block says it is background reading, not a rule of this repo.
- Where: `src/mk.js` `searchAll()` (`FALLBACK_IF_WEAKER_THAN`, `FALLBACK_FIRST`, `FALLBACK_MARGIN`), `format()`.

### R11 Session gate (opt-in)
When a doc set sets `sessionGate: true`, a weak match is dropped if the prompt does not name the set and the working folder path does not contain the set's name. It shows only when this session already had a map for that set. Default: off.
- Where: `src/mk.js` `searchAll()`, `hadMap()`, `SESSION_STRONG`; `src/projects.js` `DEFAULTS`.

### R12 A named doc set gets the prompt first
A prompt that names a doc set by one of its aliases adds 1.2 points to that set.
- Where: `src/mk.js` `searchAll()` (`named`, `ROUTE_NAMED`). The `cwdHints` in `projects.json` add 0.3 when the folder matches.

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
A map is stale when any of these changed: the graph file, a doc file (its time and size), the map format version, or the meaning model.
- Where: `src/mk.js` `stale()`, `sources()`, `DB_VERSION`.

### R17 The old map serves until the new one is ready
A build writes a temp file. The new rows replace the old ones in one transaction. A failed build leaves the old map in place.
- Where: `src/mk.js` `build()` (temp file), `integrate()` (`BEGIN IMMEDIATE`).

### R18 Background builds: one at a time, checked each minute
- The hook checks for stale maps at most once a minute.
- One background build runs at a time. Its lock counts as held for 10 minutes.
- Where: `src/brain.js` `refreshMapInBackground()` (`mk-check`, `MK_LOCK_MS`).

### R19 New doc folders join only when they hold files
A folder under `docs/` becomes a doc set only when it has at least one file (hidden files do not count). Under `projects.json`, this happens in `/gabriel:update` (or a background run of it, at most once per 10 minutes).
- Where: `src/brain.js` `registerNewDocFolders()`; `src/setup.js` `update()` step 1; `src/projects.js` `hasFiles()`.

### R20 Without projects.json, every folder with files is a doc set
- Where: `src/projects.js` `loadConfig()`.

### R21 Folder names are short and plain
A name uses lower-case letters, digits, `-` and `_`, up to 40 characters. It must start with a lower-case letter or digit.
- Where: `src/paths.js` `checkName()`, `NAME`.

### R22 add-docs refuses a used name or a huge folder
- A name already in `projects.json` is refused.
- A folder over 20000 files or 500 MB needs `--yes`.
- `--copy` refuses to overwrite an existing folder.
- Where: `src/setup.js` `addDocs()`, `MAX_DOC_FILES`, `MAX_DOC_BYTES`.

## Learning from use

### R23 A learned link needs two confirmations and fades
- A link is used in search only after it was confirmed at least 2 times (`LEARN_MIN_N`).
- Its weight halves every 45 days (`HALF_LIFE_DAYS`).
- A link under 0.02 is ignored and removed at the next map build (`LEARN_PRUNE`).
- A link adds at most 45% of a neuron's strongest unlearned score (`LEARN_CAP`).
- Where: `src/mk.js` `search()`, `effective()`, `integrate()`.

### R24 Learned links never start a search
Learned links only spread a search that words or meaning already started. They never pass the gate on their own.
- Where: `src/mk.js` `search()` (comments at the learned-links step).

### R25 A file counts once per map, within 45 minutes
A file opened or edited counts only if a map was shown in the same session no more than 45 minutes earlier, and the file is in that map. Each file counts once per map.
- Where: `src/mk.js` `touched()` (`LEARN_WINDOW_MS`, `done` list).

## Eval and tuning

### R26 Retrain keeps new weights only when the strict score does not fall
The strict count of the new weights must be at least the old count. Otherwise the current weights stay. If there is no eval case file, retrain only writes suggested cases.
- Where: `src/retrain.js` (`newS.n >= oldS.n`, the `eval-cases.json` check).

### R27 Model tune keeps the tuned model only when it wins
The tuned model is kept only when the held-out total rises, no doc set's held-out count falls by more than 1, and the full strict and quiet counts do not fall.
- Where: `src/tune/tune.js` `decide()`, `rollBackModel()`.

## Tips and hints

### R28 One tip per session
A session gets at most one tip. Tips go in order and start again at the end of the list. Tips are off when `projects.json` has `"tips": false`.
- Where: `src/tips.js` `tipFor()`.

### R29 Setup hint until setup is done
The setup hint shows once per session until the data folder has `mk.db`, `projects.json` or `docs/`.
- Where: `src/brain.js` `setupHint()`.

## Setup and hosts

### R30 Nothing leaves the machine after setup
- A prompt uses the meaning model only from local files. Downloads are off (`local_files_only`).
- The model is downloaded only in setup step 5 (`src/setup.js` `fetchModel()`) and by `brain.js build` (`getEmbedder(true)`).
- Network calls in setup: `npm ci` (step 2), and pip for the optional tune run.
- Stack docs are fetched only when the user picks them, through the `setup` and `update` skills (Claude fetches them, not gabriel's code).
- The injected text goes to the model the host already uses.
- Where: `src/embed.js` `getEmbedder()`; `src/brain.js` `build` mode; `src/setup.js` `run()`.

### R31 Host hook files change only with --apply, after a backup
Without `--apply`, `setup.js --host` prints the config and changes nothing. With `--apply` it makes a backup, checks the JSON, then writes. Other hooks are kept. `--remove-host` removes only gabriel's entries.
- Where: `src/setup.js` `hostSetup()`, `addGabriel()`, `removeGabriel()`.

### R32 Old data is copied, never deleted
Setup step 6 copies data from `~/.claude/brain`, and only with `--yes`. Without it, setup only shows the plan. A failed copy leaves the old data as it was.
- Where: `src/setup.js` `run()` step 6; `src/migrate-data.js` `migrate()`.
