# gabriel

gabriel is for AI coding agents: Claude Code, Codex CLI, Gemini CLI, GitHub Copilot (through its instructions file), and any tool via `gabriel context`. It adds the rules and doc parts that fit each prompt you send.

- For each prompt, it adds the few rules and doc sections that match it.
- It builds a local map of your doc folders. A code graph adds code names to the map.
- Prompts that match nothing get no extra text.

## Quick start (5 minutes)

1. `/plugin marketplace add <git url or local folder>` and `/plugin install gabriel@gabriel`.
2. `/gabriel:setup`. Say no to the optional steps for now.
3. `/gabriel:add-docs <name> <a folder of docs you already have>`.
4. Ask a question about those docs. No map? Run `/gabriel:why "<your question>"`.

> [!WARNING]
> **The full setup is big.** The quick start above takes minutes and works on docs you already have. The best results need more: a code graph and docs about your code. Plan an afternoon for that. See [Pros and cons](#pros-and-cons).

## Pros and cons

**Pros: it pays off once set up**

- **Knows which file.** Each prompt gets the doc sections and code names that fit it. Claude starts in the right place instead of searching.
- **Knows the flows.** Workflow and architecture docs, plus one-hop code graph links, show how the parts connect.
- **Quiet when it should be.** Prompts that match nothing get no extra text.
- **Local.** After setup, nothing leaves your machine. No API key, no cloud index.
- **Gets better with use.** It learns from the files you open after a map. You can retrain its ranking on your own questions, and keep the new weights only if they score at least as well.
- **One brain, many tools.** Claude Code, Codex CLI, Gemini CLI, GitHub Copilot and any other tool share the same data folder.
- **Your rules, when they fit.** It adds only the rules that match the prompt, not the whole rule file.

**Cons: the cost is up front**

- **Big setup.** The best results need a code graph (`/graphify`) and good docs: architecture, workflows, business rules. Writing them takes hours. `/gabriel:setup` helps, but you still review what is written.
- **Docs go stale.** The map is only as current as your docs and graph. After code changes, run `/gabriel:refresh-docs <name>`: it updates the graph, fixes the docs the change touches, rebuilds the map, then asks whether to retrain. After you edit docs by hand, `/gabriel:update` is enough.
- **A lead, not proof.** The map can point at the wrong doc. Claude must still confirm in the code.
- **More text per prompt.** A matched prompt costs extra tokens for the added block.
- **Disk space.** The meaning model is 22.6 MB. PDF support adds about 36 MB. The optional fine-tune adds about 1.3 GB of Python packages.
- **Not equal on every tool.** Copilot cannot get the map on each prompt. It has to call gabriel itself. See [docs/HOSTS.md](docs/HOSTS.md).

## Install

In Claude Code, run:

```plain
/plugin marketplace add <git url or local folder>
/plugin install gabriel@gabriel
/gabriel:setup
/gabriel:add-docs notes ~/notes
```

On a first install, `/gabriel:setup` warns that the full setup is big, then offers four optional steps, each asked first: install helper skills (graphify, superpowers, ponytail), graph a project, write its docs, and download docs for your stack. Run `/gabriel:setup --onboard` to offer them again later.

Installed from a local folder? Claude Code runs a copy in `~/.claude/plugins/cache/`. After you change the folder, run `claude plugin update gabriel@gabriel` and restart Claude Code.

`add-docs` points gabriel at a folder of doc files and builds its map. Gabriel reads Markdown, text, reStructuredText, AsciiDoc, Org, HTML, Word, PowerPoint, OpenDocument, Excel, CSV, TSV and PDF (PDFs need the optional `pdfjs-dist` package, which `npm ci --omit=dev` installs). JSON (`.json`), JSON Lines (`.jsonl`, `.ndjson`) and YAML (`.yaml`, `.yml`) are opt-in: list them in `"extensions"` in `projects.json`. See [docs/ADDING-DOCS.md](docs/ADDING-DOCS.md). You can also copy folders into `~/.gabriel/docs/<name>/` (older installs: `~/.claude/gabriel-data/docs/<name>/`) and run `/gabriel:setup` again, but only while there is no `projects.json`. Each folder is one doc set.

To check how well it finds your docs, and to train it on your own questions, see [docs/EVAL.md](docs/EVAL.md) and `/gabriel:retrain`.

## Skills: what each one is for

A skill is a command you type in Claude Code, starting with `/gabriel:`. You only need a few of them. Most days gabriel works on its own: you just ask Claude questions.

**Which one do I need?**

| I want to... | Type |
|---|---|
| Install gabriel, or fix it after an update | `/gabriel:setup` |
| Give gabriel a folder of docs to use | `/gabriel:add-docs <name> <folder>` |
| Tell gabriel that I added or changed doc files | `/gabriel:update` |
| Bring the docs up to date after the code changed | `/gabriel:refresh-docs <name>` |
| See if everything is up to date | `/gabriel:status` |
| I want to know why I got no map | `/gabriel:why "<prompt>"` |
| Make gabriel pick better results, using my test questions | `/gabriel:retrain <name>` |
| Work on chosen projects only in this chat | type `gabriel use <name>` (no slash) |

**`/gabriel:setup`.** Run it once after you install gabriel, and again after you update it. It installs what gabriel needs, creates its data folder (`~/.gabriel/`), and builds the maps. The first time, it also offers some optional steps, and asks before each one. To see those steps again later: `/gabriel:setup --onboard`.

**`/gabriel:add-docs <name> <folder>`.** Gives gabriel a new set of docs, called a doc set. Pick a short name, like `notes` or `shop`. gabriel reads the folder where it is, and builds a map of it. From then on, when you ask a question about these docs, gabriel adds the parts that fit.
- Your docs are about a code project? Add `--code <code folder>`. That folder needs a code graph (`graphify-out/graph.json`, made by `/graphify`). Then the map also names the code.
- Add `--repo <code folder>` too, and each code name shows the line where it is in your code today, marked ✓.
- Example: `/gabriel:add-docs shop ~/shop/docs --code ~/shop --repo ~/shop`

**`/gabriel:update`.** Run it after you add, change or delete doc files. It finds new doc folders, rebuilds only the maps that changed, and suggests test questions for new sections. Not sure what it will do? Add `--dry-run` to see first. You often don't need it: gabriel also does this in the background.

**`/gabriel:refresh-docs <name>`.** Run it after the code changed. It updates the code graph, finds the docs the change touched, and fixes them with you: it shows a list and asks which docs to change. It uses the set's code folder and docs folder, and asks for them if they are missing. Then it rebuilds the map and asks whether to retrain (skip, keep only if better, or replace anyway). You can also give the folders: `/gabriel:refresh-docs <code folder> [docs folder]`.

**`/gabriel:status`.** Shows each doc set and when its map was built. `ok` means it is up to date. `GRAPH MISSING` means the code graph file is gone. `REPO MISSING` means the code folder set with `--repo` is gone.

**`/gabriel:retrain <name>`.** gabriel ranks the parts it finds. Retrain teaches it, using test questions you write (see [docs/EVAL.md](docs/EVAL.md)). No name means the default doc set. The new ranking is kept only if it scores at least as well. `--force` keeps it anyway (`/gabriel:retrain <name> --force`). The old file is saved as `rank.prev.json`.

**`/gabriel:tune-embeddings`.** Optional, and slow. It trains gabriel's small meaning model on your questions, and keeps the new model only if it scores better. Most people never need it. See [docs/TUNING.md](docs/TUNING.md).

**The `map` skill** is not a command. It tells Claude how to read the map block, and that the map is a hint to check, not proof.

### Add your own skill or command

Claude Code puts the plugin name before every plugin skill (`/gabriel:<name>`). To add one:

1. Make the folder `skills/<name>/` and write a `SKILL.md` in it. Copy `skills/why/SKILL.md` as a start.
2. Call gabriel from the file as `node "${CLAUDE_PLUGIN_ROOT}/src/brain.js" <mode> "$ARGUMENTS"`.
3. Run `claude plugin update gabriel@gabriel`, then restart Claude Code.

A command with no prefix (for example `gabriel <question>`) lives outside the plugin, in your host's own folder. Start from `templates/user-command/gabriel.md`. In the copy, replace `<path-to>` with the folder that holds `gabriel-plugin`.

| Host | Put the copy here | Type |
|---|---|---|
| Claude Code | `~/.claude/commands/gabriel.md` | `/gabriel <question>` |
| Codex CLI | `~/.codex/skills/gabriel/SKILL.md` (or `$CODEX_HOME/skills/`). Add `name: gabriel` to the frontmatter. | Ask for the `gabriel` skill by name |

Then start a new session. The command runs `brain.js context`, which works in any host (see [docs/HOSTS.md](docs/HOSTS.md)).

### All commands and options

| Command | What it does |
|---|---|
| `/gabriel:setup` | Installs and checks gabriel. First run: the onboarding steps. |
| `/gabriel:add-docs <name> <folder> [--code <repo>] [--repo <folder>]` | Adds a doc set and builds its map. With `--code`, the repo needs `graphify-out/graph.json`. `--repo <folder>` sets the code folder, checked against the graph, so the map can show exact lines. `--relink` (`/gabriel:add-docs <name> --code <repo> --relink`, or with `--repo`) changes only the code repo of a set. |
| `/gabriel:update [--dry-run] [--stack]` | Adds new doc folders, rebuilds changed maps, suggests test questions. `--stack` fetches stack docs again. |
| `/gabriel:refresh-docs <name>` or `<code folder> [docs folder]` | After code changes: updates the graph, fixes and shrinks the docs it touches, rebuilds the map, then asks whether to retrain. Uses the set's code and docs folders. |
| `/gabriel:status` | Shows each doc set, its code graph, and when its map was built. `GRAPH MISSING` means the graph file is gone. |
| `/gabriel:why "<prompt>"` | Says why no map was shown for a prompt: one line per doc set, with the next step. Writes nothing. |
| `/gabriel:retrain [name]` | Retrains the ranking on your test questions. No name means the default doc set. Keeps the new weights only if they score no worse. `--force` keeps them anyway. The old file is saved as `rank.prev.json`. |
| `/gabriel:tune-embeddings` | Optional, slow fine-tune of the meaning model. See [docs/TUNING.md](docs/TUNING.md). |

### For AI agents that run these skills

Your AI agent runs the skills for you. Point it to **[docs/AGENT-GUIDE.md](docs/AGENT-GUIDE.md)**. The step skills already tell it to read the guide first. In short:

- Never commit or push. Never read `graph.json` whole. Leave nothing in the code repo.
- Ask before each choice. Update the graph (`graphify update`); do not rebuild it.
- Let the check scripts find problems (`check-docs`, `check-claims`, `key-ideas`, `graph-stats`), and read only the lines they flag. This saves tokens.
- Finish with the checklist: checks at 0 hits, the set `ok` in `mk-status all`, then a report of what was and was not checked.

The guide has a table per skill (when to run it, what to be careful about, when it is done) and the known errors with their fixes. It works for Codex CLI, Gemini CLI and Copilot agents too.
## What you see

This is a made-up example from a doc set named `notes`:

```plain
My notes map (spreading search over docs, built 2026-11-10; start here, then confirm in the code, the map can be old):
- doc bikes.md > Brakes: Check the brake pads every 500 km.
- doc cooking.md > Rice: Soak rice for 30 minutes before you boil it.
- doc cooking.md > Stock: Keep the stock in the fridge for up to 3 days.
```

The `map` skill tells Claude how to read this block. Claude treats it as a lead, not as proof.

### Pin doc sets per session

Working in one project or a few all session? Type a prompt that names the sets:

```plain
gabriel use makillez esg
```

From then on, this session's map searches only those doc sets. Naming another set in a prompt does not switch it. The fallback general docs can still show. Every gabriel note starts with `📌 pinned: makillez, esg  ("gabriel use auto" to undo)`. The full rules are in [R35](repo-docs/business/02-business-rules.md#r35-session-pin).

- `gabriel use auto`: search all doc sets again, on each prompt.
- `gabriel use manual`: no map until you type `/gabriel <question>`. To make manual the default, set `"mode": "manual"` in `projects.json` ([R40](repo-docs/business/02-business-rules.md#r40-manual-mode)).
- Not pinned and you have 2 or more doc sets? Each map note ends with a 💡 line that reminds you of `gabriel use <set>`.
- `gabriel use ?` (or any unknown name): list your doc sets.
- A name or an alias works. A new session starts unpinned. A pin is dropped about 7 days after its last use.

## What leaves your machine

After setup, gabriel sends nothing. Setup downloads npm packages and one meaning model (22.6 MB) once. If you say yes during the first setup, it also downloads public docs for your languages and frameworks. It asks first and shows the list.
Claude Code still sends your prompts, and the text gabriel adds, to Claude as usual.

## Requirements

- Windows, macOS or Linux. CI tests all three.
- Node.js 22.5 or newer. gabriel uses the built-in `node:sqlite` module.
- npm.
- One host: Claude Code with plugin support, Codex CLI, Gemini CLI or GitHub Copilot. Any other tool can call `gabriel context`. See [docs/HOSTS.md](docs/HOSTS.md).

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the parts fit together.
- [docs/WORKFLOWS.md](docs/WORKFLOWS.md): step-by-step flows, with diagrams: setup, each prompt, learning, building maps, retrain, tune, other hosts, data, migration.
- [docs/HOSTS.md](docs/HOSTS.md): Claude Code, Codex CLI, Gemini CLI, GitHub Copilot and other tools. Install, remove, limits.
- [docs/PRIVACY.md](docs/PRIVACY.md): what is stored, where, and how to delete it.
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): common problems and fixes.
- [docs/AGENT-GUIDE.md](docs/AGENT-GUIDE.md): for your AI agent. How to run each skill, the rules, the checks and the known errors.
- [docs/ADDING-DOCS.md](docs/ADDING-DOCS.md): how to add doc sets.
- [docs/EVAL.md](docs/EVAL.md): how gabriel is measured and retrained.
- [docs/TUNING.md](docs/TUNING.md): the optional fine-tune of the meaning model.
- [docs/DOC-LAYOUT.md](docs/DOC-LAYOUT.md): the folder layout and lean rules for the code docs that setup writes and refresh-docs keeps.
- [docs/GRAPH-ENHANCEMENT.md](docs/GRAPH-ENHANCEMENT.md): add the links that graphify misses (handlers, events, HTTP routes, page routes, dialogs, background services, tables and foreign keys) with your own passes, and measure the gain.

<!-- Maintainers: private tests on real local data live in the gitignored private/tests/ (not in npm test). Run: node private/tests/run.js. Baseline: node private/tests/baseline.js --compare (or --save). See private/tests/README.md. -->

## Best results: graph your code, then write its docs

> **Read this first if you use gabriel on a code base.** gabriel can only find what is written down. Good docs about your code help it more than anything else.

The docs and the graph live in their own folder, `<home>`: by default `~/.gabriel/this-machine-repo-docs/<name>`, safe on plugin updates ([where it goes](docs/DOC-LAYOUT.md)). The code repo stays clean. `/gabriel:setup` makes this folder for you.

1. **Graph the code.** Install the graphify skill and run `/graphify <repo>`. Setup moves the graph to `<home>/graphify-out/graph.json`. gabriel reads it to link doc sections to class and file names.
   - **Enhance the graph (optional, big gain on framework code).** The AST graph misses links that cross a framework: message to handler, event to subscriber, frontend client to API, URL to page, code to dialog, repository to table. Add them with your own passes, then tell gabriel their weights. Step by step: [docs/GRAPH-ENHANCEMENT.md](docs/GRAPH-ENHANCEMENT.md).
2. **Write the docs from the graph.** `/gabriel:setup` (first run or `--onboard`) offers to write them, with Mermaid diagrams. They go in `<home>/docs/`. You can also ask Claude, for example with `/engineering:documentation`. Use the layout in [docs/DOC-LAYOUT.md](docs/DOC-LAYOUT.md):
   - **Business** (`docs/business/`): what the system is for, its rules, its states, a glossary, and one page per main workflow, from trigger to result.
   - **Technical** (`docs/technical/`): architecture, modules, how to build, test and add a feature, known bugs.
3. **Add them:** `/gabriel:add-docs <name> <home>/docs --code <home> --repo <repo>`. `--code` is the folder that holds `graphify-out/graph.json`. `--repo` is the real code, checked against the graph. If the docs name almost no code, the command warns. Then use `--relink`. See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
4. **Keep them current:** after code changes, run `/gabriel:refresh-docs <name>`.

Docs that name real files, classes and steps give gabriel the most to link. Keep them lean: one fact in one place, no copied code. Check them against the code: a wrong doc misleads gabriel too.

## Credit

Made by ThanhNVan @ Metizoft.\
Made by ThanhNVan @ AIC Lab FPT University.\
Made by ThanhNVan @ FPT Education FSB.

## License

MIT. See [LICENSE](LICENSE).
