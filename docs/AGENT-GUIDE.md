# AGENT GUIDE: read this before you run a gabriel step

For the AI agent that runs a gabriel step: any `/gabriel:` skill in Claude Code, or the same scripts run by hand in another tool (Codex CLI, Gemini CLI, Copilot). Read this guide once per task, before step 1. It has the rules, how to run each skill, the checks, and the errors other agents hit, with their fixes.

## The 7 rules

1. **Never commit or push.** The user does that.
2. **Never read `graph.json` whole.** It can be 90 MB. Use `tools/graph-stats.js` (see "Save tokens" below).
3. **Leave nothing in the code repo.** The graph and the docs live in their own folder (`<home>/`, or the folder that holds `graphify-out/`). A temporary copy for `graphify update` is fine; delete it after.
4. **Ask before you act on a choice.** Folders, which docs to change, retrain. Do only what the user picked. Go on without asking only where the skill says so.
5. **Update the graph, do not rebuild it.** `graphify update "<code folder>"` re-reads only the changed code and needs no model. Run a full `/graphify <code folder> --no-viz` only for a set with no graph yet, or when the user asks.
6. **Run long commands in the background** (graphify, `npm test`, a map build of a big set), then wait for them to finish.
7. **The code is the proof.** The graph, the map and old docs are leads. Confirm each claim in the code before you write it.

## Before step 1

- Find `<plugin folder>`, the folder that holds `src/brain.js`. In Claude Code it is `${CLAUDE_PLUGIN_ROOT}` (filled in only inside skills). In Codex CLI or Gemini CLI, it is the folder in gabriel's hook command (`hooks.json` or `settings.json`). Elsewhere, it is the folder where `setup.js` was run.
- Run `node "<plugin folder>/src/brain.js" mk-status all`. Note each set's state, `@<commit>`, `graph` and `repo` lines.
- Read the whole skill once. Make a short to-do list from its steps. Show % progress after each step.

## Run each skill

In Claude Code, the user types the skill: every skill except `map` is set so the model cannot start it. In another tool, run the same command by hand. Each skill file is `<plugin folder>/skills/<name>/SKILL.md`: read it whole before you run it.

| Skill | Run when | Careful | Done when |
|---|---|---|---|
| `/gabriel:setup` | After install or a plugin update. `--onboard` repeats the first-run steps. | Ask before each optional step (tools, graph, docs, stack docs). Leave nothing in the code repo. When onboarding wrote docs: register the set without asking, then run `docs-checked <name>`. | Setup prints its summary. `mk-status all` shows each set `ok`. |
| `/gabriel:add-docs <name> <folder>` | A new folder of docs. | No `--code` given: ask once for the code repo. `--code` needs `<repo>/graphify-out/graph.json`; if it is missing, offer `/graphify <repo>` first and wait. `--relink` changes only the graph (or repo) of a set. | It prints `added <name>`, or the error to fix. |
| `/gabriel:update` | Doc files were added, changed or removed. | `--dry-run` first when unsure. It never writes `eval-cases.json` and never touches the code graph: for code changes, point to `refresh-docs`. | The summary line, with no `failed`. |
| `/gabriel:refresh-docs <name>` | The code changed. | Show both folders and get a yes before step 1. Change only the docs the user picks. Use the scripts, not whole-file reads. Ask the 3 retrain choices. Run `docs-checked <name>` last. | Its report table, with `key ideas kept: N/N`. |
| `/gabriel:status` | Before any other step, or to check one. | Read only. Show each `fix:` line, but do not run it without asking. | One block per set. |
| `/gabriel:why "<prompt>"` | No map was shown and the user asks why. | Read only. Show the lines as they are, then the next step each line gives. | One line per set. |
| `/gabriel:retrain [name]` | The user saved new `eval-cases.json`, or asks. | No name means the default set. With no `eval-cases.json` it only writes suggested cases: stop and tell the user. Use `--force` only when the user picks it. | Before and after strict scores, and kept or not. |
| `/gabriel:tune-embeddings` | Only when the user asks. It is slow. | Never run it as part of another skill. | The before and after table, kept or rolled back. |
| `map` (not a command) | A map block is in the prompt. | It is a lead: name the doc or file, then confirm it in the code. | n/a |

## `/gabriel:setup`, step by step

The skill (`skills/setup/SKILL.md`) has the full text. Follow this list in order. After each step, tell the user the step and its check result (`step 3/9 done: ...`). Stop at a failed check: show the line, and ask.

| # | Do | Check | If it fails |
|---|---|---|---|
| 1 | New or known user? Run the one-line `projects.json` check from the skill. | It prints `new` or `known`. | `known` with no `--onboard`, or any of `--dry-run`, `--tune`, `--yes`: run step 2 only, then report. `--onboard`: skip step 2 and the warning, go to step 3. |
| 2 | Run `node "<plugin folder>/src/setup.js"` with the user's flags (never `--onboard`). Wait. A new user first gets the "Heads up" warning, in the skill's words. | Its summary lines. `mk-status all` shows each set `ok`. | Node too old, npm blocked, model download: see [TROUBLESHOOTING](TROUBLESHOOTING.md). |
| 3 | Read `<data>/onboarding.json`. | You know which of the 4 steps are `done`. | No file: all 4 are open. |
| 4 | Ask once (multi-select) which open steps to run: helper tools, graph a project, docs from the graph, stack docs. | The user's picks. | None picked: report and stop. |
| 5 | **Helper tools.** Install only the picked tools that are missing. | `graphify --help` works; `claude plugin list` shows the plugins. | A plugin needs a Claude Code restart before use. Save `tools` in `onboarding.json`. |
| 6 | **Graph a project.** Skip it when graphify is missing. Ask the code folder and `<name>` (default: the folder name in lower case; letters, digits, `-`, `_`, up to 40 characters). Ask `<home>`: `<data>/this-machine-repo-docs/<name>` (recommended), `<parent>/<name>-code-docs`, or a typed path; refuse one inside the code folder, under `<data>/docs/`, or in the plugin cache ([DOC-LAYOUT](DOC-LAYOUT.md)). Ask before you make it and before `git init`. Run `/graphify <code folder>`. Move `graphify-out/` into `<home>/`. Delete `graph.html` and dated backups. | `graph-stats.js <home>/graphify-out/graph.json --repo <code folder>`: `graph-stats: 0 hits`. No `graphify-out/` left in the code folder. | `commit mismatch`: show it and ask. Save `graph`. |
| 7 | **Docs from the graph.** Ask which kinds. Read `DOC-LAYOUT.md`, then `GRAPH_REPORT.md`. Write to `<home>/docs/`, with a Mermaid diagram in each doc. Confirm each claim in the code. | `check-docs` and `check-claims` on `<home>/docs`: 0 hits each. | Fix each flagged line, run again. |
| 8 | **Register.** `/gabriel:add-docs <name> <docs> --code <home> --repo <code folder>` (full paths, no question). Then `docs-checked <name>`. No docs picked in step 7: register `<home>` itself as `<docs>`, and skip `docs-checked`. | `mk-status all`: `<name>` is `ok` with a `repo` line. `docs checked for <name> at <sha>`. | `repo refused: ...`: show it and stop. Save `docs`. |
| 9 | **Stack docs.** Ask languages, frameworks, process. Search for trusted sources, show the list with sizes, and wait for a yes. Downloads go to Haiku subagents. Then `/gabriel:add-docs stack <data>/docs/stack` (or `/gabriel:update` when it exists). | Files are in `<data>/docs/stack/`; `stack` is `ok`. | A page that fails is listed, not retried in a loop. Save `stack`. |

Save each step's key in `onboarding.json` (`done`, the folder, or `skipped`) right after it, so a stopped run can resume. End with the finish checklist below and tell the user: after code changes, run `/gabriel:refresh-docs <name>`.

**Save tokens in setup:** run graphify once (later runs use `graphify update`); let the scripts check the graph and the docs; write only the doc kinds the user picked; send downloads to Haiku.

## Known errors and fixes

| You see | Cause | Fix |
|---|---|---|
| `error: unknown update option: --graph` | This graphify version has no `--graph`. | Copy route: copy `<graph folder>/graphify-out` into the code folder, run `graphify update "<code folder>"`, copy it back, delete the copy in the code folder. |
| A privacy hit in `graph.html`, or a dated folder in `graphify-out/` | graphify writes them. | Delete `graph.html` and `graphify-out/<YYYY-MM-DD>/`. They are not used. |
| `built_at_commit` is not the code repo's `HEAD` | The graph is from an older commit. | Run `graphify update` again on the code folder, then `graph-stats.js --repo <code folder>` (it compares with the code repo's `HEAD`, not the docs repo's). |
| `graph not found: <path>` | The set's `graph` entry points to a missing file. | If the graph file is gone, run `/graphify <code folder>` first. Then `/gabriel:add-docs <name> --code <folder with graphify-out> --relink`. |
| `refused: <path> is inside the plugin cache, which a plugin update replaces` | The docs or graph folder is in the plugin cache (`.claude/plugins/cache`). | Move it to the folder the line names (`<data>/this-machine-repo-docs/<name>`), then add it again. |
| `repo refused: <reason>` | The `--repo` folder does not fit the graph. | Read the reason in [TROUBLESHOOTING](TROUBLESHOOTING.md#repo-refused-when-adding-a-repo-folder). Use the repo the graph came from. |
| `warning: the docs name almost none of this graph's code` | Wrong repo, or the docs name no code. | Check the repo. Docs should name real files and classes in backticks. |
| `check-docs: <n> hits` with n > 0 | A doc breaks a [DOC-LAYOUT](DOC-LAYOUT.md) rule. | Fix each hit, run it again, until `check-docs: 0 hits`. |
| A Mermaid block does not render | Unquoted labels or special characters. | Put every node label in double quotes: `A["src/mk.js build"]`. |
| Retrain stops and writes suggested cases | No `eval-cases.json` yet. | Tell the user to review `eval-cases.suggested.json` and save it as `eval-cases.json`. Do not write that file yourself. |

More messages and fixes: [TROUBLESHOOTING](TROUBLESHOOTING.md).

## Save tokens: let scripts check

Run these instead of reading whole files. Read only the lines they flag. Each prints one line per hit and exits 1 when there is one.

| Check | Command | Clean result |
|---|---|---|
| Graph counts, commit, dangling links, excluded folders | `node "<plugin folder>/tools/graph-stats.js" <graph.json> --repo <code folder>` | `graph-stats: 0 hits` |
| Doc layout (size, code blocks, line numbers, links) | `node "<plugin folder>/tools/check-docs.js" <docs folder> --code <code folder>` | `check-docs: 0 hits` |
| Every backticked path, `name()`, constant and `--flag` exists | `node "<plugin folder>/tools/check-claims.js" <docs folder> --code <code folder>` | `check-claims: 0 hits` |
| No key idea lost in a rewrite | `node "<plugin folder>/tools/key-ideas.js" <copy before> <docs folder>` | `key-ideas: 0 lost` |

## When you edit docs

- Follow [DOC-LAYOUT](DOC-LAYOUT.md). One fact, one place: replace a repeat with a link to the rule or section that owns it.
- Name the code, do not copy it. No line numbers. Short, plain sentences.
- Shrinking: write the key-idea list first, check each idea after. Report `key ideas kept: N/N`. Never less.

## Finish checklist

Do the steps that apply, in order. Do not say "done" before they pass. Read-only skills (`status`, `why`, `map`) need only step 5.

1. If you edited docs: `check-docs` and `check-claims` print 0 hits, and `key-ideas` prints `0 lost` for a rewrite.
2. `mk-status all`: the set says `ok` (at the new `@<commit>` when the graph changed).
3. Only when the skill has this step (`setup`, `refresh-docs`), after the docs match the code: `node "<plugin folder>/src/brain.js" docs-checked <name>`. It prints `docs checked for <name> at <sha>`. Never run it when the docs were not reviewed: it silences the drift warning.
4. If graphify ran: no `graphify-out/` left in the code folder, unless the set's graph lives there.
5. Report: what changed, every check run and its result, and what was not checked.
