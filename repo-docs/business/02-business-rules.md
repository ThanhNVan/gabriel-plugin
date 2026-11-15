# 02 Business rules

Each rule says what must hold, then where it is enforced. Workflows and states link here. They do not repeat these rules.

## The hook

### R01 Hook never blocks a prompt
Any error in the prompt hook prints nothing.
- Where: `src/brain.js` `hook()` (catch-all) and `touchedHook()`.
- Time limits: the hook timeout is 60 s (`hooks/hooks.json`). The map search is skipped after 11 s (`mapFor`, `MK_BUDGET_MS`). The meaning step gives up after 9 s (`EMBED_TIMEOUT`).

### R02 Short and slash prompts get no context
A harness or subagent message (`history.js` `isAutomated()`, for example `<agent-message`) gets nothing: no note, no hint, no history. A prompt that starts with `/` or has fewer than 4 words gets no rules, map or history. It may still get the setup hint or a tip. A pin command is checked before those two ([R35](#r35-session-pin)).
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
- Doc hits: `MAX_DOCS`, at most 2 per file, none under 30% of the best hit. Code hits: `MAX_CODE`, at most 2 types per file, same 30% rule. Each doc snippet: `DOC_CHARS` (210).
- Named pairs: a shown `XCommand`, `XQuery` or `XRequest` gives its slot to its handler (the same name plus `Handler`) from the same folder, when that handler is not shown yet. The block does not grow. Strict exact on 100 private Makillez cases (2026-11-16): tune 17/50 -> 28/50, check 15/50 -> 23/50. Where: `src/mk.js` `pairHandlers()`, run after `addNamedCode()` in `search()`.
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
- One background build runs at a time. Its lock file `mk.lock` names the set and counts as held for 10 minutes. A build removes it when it is empty (an old-style lock) or names the set just built. A lock that names another set stays.
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
- The new strict count must be at least the old one. No name means the default doc set. `--force` keeps the new weights anyway (the user chose it). A replaced file is saved as `rank.prev.json`.
- New count missing: the current weights stay. Only the old count missing: the new weights are kept.
- With no eval case file, retrain only writes suggested cases.
- Where: `src/retrain.js` `keepNew()` (the `force` flag), the `eval-cases.json` check.

### R27 Model tune keeps the tuned model only when it wins
The tuned model is kept only when the held-out total rises, no doc set's held-out count falls by more than 1, and the full strict and quiet counts do not fall.
- Where: `src/tune/tune.js` `decide()`, `rollBackModel()`.

## Tips and hints

### R28 One tip per session
A session gets at most one tip, in order, starting again at the first tip after the last. Tips are off when `projects.json` has `"tips": false` or does not exist.
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
- After the one-hop `↔` lines, `src/mk.js` `search()` (block "Two hops out") adds code names reached by two strong links (each weight 0.6 or more) from the top code hits. The name must contain the hit's name stem: its first `stem` PascalCase parts, with a leading verb in `CHAIN_VERBS` and trailing role words in `CHAIN_ROLES` dropped. The stem parts must appear in order, with any text between them. `format()` marks such a line "2 links away".
- An event handler named `On<stem>...` is also found by name, with no graph path. Its command reaches it by no two-link path.
- At most `max` such lines per search. A node with more than `SEED_HUB` links is never added.
- Each doc set can set `chain` in `projects.json`: `seeds` (top code hits it starts from, 0 to 10), `max` (extra lines, 0 to 10), `stem` (name parts that must match, 1 to 6; higher is stricter). Defaults: 4, 3, 3 (`src/projects.js` `DEFAULTS`). Each field can be set on its own. A value that is not a number falls back to the set's value, then the default. A number out of range is clamped to its limit.
- Test on 100 private chain cases (2026-11-16), halves of 50: tune 29/50 -> 31/50, check 21/50 -> 27/50 (after the stem and name change above). The defaults 4, 3, 3 were set on 18 cases and are not re-tested on the 100. Main gate 523/569 and quiet 30/31 were last run on 2026-11-14, before this change. Other values: `node eval/eval-map.js --chain <seeds>,<max>,<stem>`; one half: `--half tune|check`.
- Where: `src/mk.js` `search()`, `CHAIN_VERBS`, `CHAIN_ROLES`, `CHAIN_DEFAULT`, `chainNum()`; `src/projects.js` `loadConfig()`; `eval/eval-map.js`.

### R35 Session pin
- A pin is a list of doc sets for one session. The check runs before the [R02](#r02-short-and-slash-prompts-get-no-context) gate. The reply is a note only.
- Syntax:
  - `gabriel use a b` sets the list. It replaces the old list.
  - `gabriel use +c` adds to the list. It counts only when every word has a `+`.
  - Mixed words, such as `gabriel use a +b`, set the list. The `+` is dropped.
  - `gabriel use auto` clears the list.
- Which prompts are commands:
  - One word after `use` is always a command. An unknown name gets the near-miss note or the error note (below).
  - Two to 6 words are a command only when each word is a set, an alias, or a near-miss of one. Any other word makes the prompt an ordinary question, and it gets searched. For example, `gabriel use makillez docs for this` is searched.
- Names: the whole word is a set name or an alias (any case). `esg-tool` is not `esg`. Duplicates are dropped. The general docs (the fallback set) cannot be pinned.
- A near-miss is a typo of a set name or alias: at most 2 letters off (a swap of 2 letters counts as 1), and under half the word (`pin.js` `nearName()`). It pins nothing. The note asks the user to confirm by typing the fixed command, for example `Did you mean "makillez"? To pin, type: gabriel use esg makillez. Nothing changed.`
- One unknown word that is not a near-miss gets the error note with the set names. The pin stays as it was.
- At most 5 sets can be pinned (`MAX_PINS`). Over 5, the reply says nothing changed. A pin file edited by hand or corrupt reads as its first 5 unique names (`getPins()`).
- File: `<data>/seen/<session>.pin`, one name per line. Blank lines are ignored. An old file with one name still works.
- Each prompt in a pinned session refreshes the file's time (`pin.js` `touchPin()`). So a pin ends 7 days after its last use, by the `seen/` cleanup in [R07](#r07-an-item-is-not-sent-twice-in-one-session).
- An error or near-miss reply starts with the current 📌 line. A success reply names the new pins and has no 📌 line.
- A set that was removed from `projects.json` drops out of the search and the 📌 line (`brain.js` `livePins()`). If no pinned set is left, the search runs as if nothing were pinned.
- While pinned, `src/mk.js` `searchAll()` searches only the pinned sets:
  - The top set gets the full map block. Each other pinned set that matched gets a short block.
  - With 2 or more pins, the session gate hides each set it gates, from the top down. The other pinned sets still show.
  - The fallback general docs ([R10](#r10-general-docs-answer-only-when-no-doc-set-does)) run after the pinned blocks, as before.
  - Learning ([R23](#r23-a-learned-link-needs-two-confirmations-and-fades)) uses the top set only.
- While pinned, every user note starts with a blank line, then `📌 pinned: a, b  ("gabriel use auto" to undo)`. The model text never gets it.
- Not pinned, with 2 or more doc sets: each map note ends with a 💡 line that suggests `gabriel use <set>`. A due setup hint, drift or miss warning, or tip takes that line first (`brain.js` `noteHint()`). The model text never gets it.
- No session id: nothing is pinned or cleared, and the reply says so.
- If the pin check fails with an error, the prompt goes on as an ordinary question.
- Gaps: [findings](../technical/findings.md).
- Where: `src/pin.js` `parsePin()`, `getPins()`, `setPins()`, `touchPin()`, `nearName()`, `MAX_PINS`; `src/brain.js` `pinNote()`, `hook()`, `mapFor()`; `src/mk.js` `searchAll()` (`opts.pins`). Tests: `test/test-pin.js`, `test/test-map.js`, `test/test-workflow.js`, `test/test-brain.js`.

## Exact lines

### R36 Exact code lines
- Each code name in the map, and each `↔` neighbour, shows the line where the name is defined in the set's repo folder. The file is read on each prompt, so the line is the one on disk now. It prints `(<file>:<line> ✓)`.
- If the file is gone, or the name is not in it, it prints `(<file>, not found in repo)`.
- If the file is gone but the name is found in another file of the repo, it prints `(<file>:<line> ✓ moved)` with the new file.
- A neighbour with no file in the graph (an outside library name) prints `(external)`. It is not a repo file, so "not found in repo" would be wrong.
- `--repo` with `--code --relink` checks the folder against the new graph, before anything is written.
- A set with no repo folder keeps the graph's line, with no mark. `mk-status all` then shows `no repo (add-docs <name> --repo <folder> --relink)`. A label that is not a plain name (such as `R33 a code graph must exist`) also keeps the graph's line.
- Limits: at most 30 files, 2 MB each, 5 s per prompt (`BUDGET_MS`). A file past a limit keeps the graph's line. Any error keeps it too.
- The repo folder comes from `add-docs --repo`, which checks it first: a git repo, the graph's commit in its history, and at least 80% of 200 sampled graph files in it.
- Gaps: [findings](../technical/findings.md).
- Where: `src/repo.js` `checkRepo()`, `exactLines()`, `defLine()`; `src/setup.js` `checkRepoArg()`; `src/mk.js` `search()` and `format()` (`where()`). Tests: `test/test-repo.js`, `test/test-map.js`, `test/test-workflow.js`.

## Warnings

### R37 Drift warning
- A warning, not a tip. While a drift lasts, the hook note shows it on every 2nd prompt of a session (the 1st, 3rd, 5th; `DRIFT_EVERY`). It says what is behind, at most three sentences:
  - the code graph, when 10 or more changed code files are in it (`/gabriel:refresh-docs <name>`);
  - the docs, when they were last checked with `docs-checked <name>` more than 7 days before the latest code commit;
  - the docs, when a set with a repo was never checked, and its graph drift is 10 or more files. A new set with no check and little drift stays quiet.
- `"tips": false` does not turn it off.
- A background run writes the counts to `drift.json` at most once an hour (`brain.js drift`). It never blocks a prompt. `mk-status all` shows the counts on a `drift` line.
- `docs-checked <name>` records the repo HEAD and its commit time in `docs-checked.json`. The refresh-docs skill runs it last.
- Where: `src/brain.js` `driftNote()`, `readDocsChecked()`, `refreshMapInBackground()`, modes `drift` and `docs-checked`; `src/repo.js` `graphDrift()`, `lastCommitTime()`, `headCommit()`, `commitsSince()`; `src/mk.js` `codeFiles()`. Tests: `test/test-brain.js`, `test/test-repo.js`, `test/test-statusview.js`.

### R38 Miss warning
- A warning, not a tip. Only touched code files count: a file inside the set's repo folder whose extension is used by the graph's code files. Other files (docs, temp files, files in other folders) are not counted. Counted misses are kept per session (at most 20). When 3 or more are kept, the hook note says once per session that the code graph may be old.
- `docs-checked <name>` (run last by /gabriel:refresh-docs) clears the miss lists, so the count starts again.
- `"tips": false` does not turn it off.
- Where: `src/brain.js` `touchedHook()`, `isRepoCodeFile()`, `noteMiss()`, `missNote()`. Tests: `test/test-brain.js`.

### R39 No doc set inside the plugin cache
- A plugin update replaces the installed copy in `.claude/plugins/cache`, so a docs or graph folder there would be lost. `add-docs` and `--relink` refuse a docs or `--code` folder inside any `.claude/plugins/cache` folder (a git clone of the plugin is allowed), before any write. With `--copy`, a docs folder in the cache is allowed (the copy goes to `<data>/docs/<name>`), but a graph left there is not linked. The message names the safe folder: `<data>/this-machine-repo-docs/<name>`.
- Setup offers that folder as the default home ([DOC-LAYOUT](../../docs/DOC-LAYOUT.md)).
- Where: `src/paths.js` `insidePluginCache()`; `src/setup.js` `pluginPathRefusal()`, `addDocs()`, `relinkDocs()`. Tests: `test/test-add-docs.js`, `test/test-plugin-cache.js`.
