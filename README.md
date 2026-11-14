# gabriel

gabriel is for AI coding agents: Claude Code, Codex CLI, Gemini CLI, GitHub Copilot (through its instructions file), and any tool via `gabriel context`. It adds the rules and doc parts that fit each prompt you send.

- For each prompt, it adds the few rules and doc sections that match it.
- It builds a local map of your doc folders. A code graph adds code names to the map.
- Prompts that match nothing get no extra text.

> [!WARNING]
> **The setup is big.** Plan an afternoon, not five minutes. The plugin installs fast, but gabriel is only as good as the docs you give it. The full setup is: graph your code, write or collect docs, add them, then write a few test questions. It pays off later. See [Pros and cons](#pros-and-cons).

## Pros and cons

**Pros: it pays off once set up**

- **Knows which file.** Each prompt gets the doc sections and code names that fit it. Claude starts in the right place instead of searching.
- **Knows the flows.** Workflow and architecture docs, plus one-hop code graph links, show how the parts connect.
- **Quiet when it should be.** Prompts that match nothing get no extra text.
- **Local.** After setup, nothing leaves your machine. No API key, no cloud index.
- **Gets better with use.** It learns from the files you open after a map. You can retrain its ranking on your own questions, and keep the new weights only if they score better.
- **One brain, many tools.** Claude Code, Codex CLI, Gemini CLI, GitHub Copilot and any other tool share the same data folder.
- **Your rules, when they fit.** It adds only the rules that match the prompt, not the whole rule file.

**Cons: the cost is up front**

- **Big setup.** The best results need a code graph (`/graphify`) and good docs: architecture, workflows, business rules. Writing them takes hours. `/gabriel:setup` helps, but you still review what is written.
- **Docs go stale.** The map is only as current as your docs and graph. After code changes, run `/gabriel:refresh-docs <code folder>`: it updates the graph, fixes the docs the change touches, then rebuilds the map and retrains. After you edit docs by hand, `/gabriel:update` is enough.
- **A lead, not proof.** The map can point at the wrong doc. Claude must still confirm in the code.
- **More text per prompt.** A matched prompt costs extra tokens for the added block.
- **Disk space.** The meaning model is 22.6 MB. PDF support adds about 36 MB. The optional fine-tune adds about 1.3 GB of Python packages.
- **Not equal on every tool.** Copilot cannot get the map on each prompt. It has to call gabriel itself. See [docs/HOSTS.md](docs/HOSTS.md).

## Install

In Claude Code, run:

```
/plugin marketplace add <git url or local folder>
/plugin install gabriel@gabriel
/gabriel:setup
/gabriel:add-docs notes ~/notes
```

On a first install, `/gabriel:setup` warns that the full setup is big, then offers four optional steps, each asked first: install helper skills (graphify, superpowers, ponytail), graph a project, write its docs, and download docs for your stack. Run `/gabriel:setup --onboard` to offer them again later.

Installed from a local folder? Claude Code runs a copy in `~/.claude/plugins/cache/`. After you change the folder, run `claude plugin update gabriel@gabriel` and restart Claude Code.

`add-docs` points gabriel at a folder of doc files and builds its map, so the first question can show it. Gabriel reads Markdown, text, reStructuredText, AsciiDoc, Org, HTML, Word, PowerPoint, OpenDocument, Excel, CSV, TSV and PDF. PDFs need the optional `pdfjs-dist` package, which `npm ci --omit=dev` installs. JSON (`.json`), JSON Lines (`.jsonl`, `.ndjson`) and YAML (`.yaml`, `.yml`) are opt-in: list them in `"extensions"` in `projects.json` to read them. See [docs/ADDING-DOCS.md](docs/ADDING-DOCS.md). You can also copy folders into `~/.gabriel/docs/<name>/` (older installs: `~/.claude/gabriel-data/docs/<name>/`) and run `/gabriel:setup` again, but only while there is no `projects.json`. Each folder there is one doc set.

After you add or change doc files later, gabriel picks them up in the background on a later prompt: new folders under `~/.gabriel/docs/` (including `docs/stack/`, made by setup for your stack docs) and changed files. Run `/gabriel:update` to do it now. See [docs/ADDING-DOCS.md](docs/ADDING-DOCS.md).

To check how well it finds your docs, and to train it on your own questions, see [docs/EVAL.md](docs/EVAL.md) and `/gabriel:retrain`.

## Commands

| Command | What it does |
|---|---|
| `/gabriel:setup` | Installs and checks gabriel. First run: the onboarding steps. |
| `/gabriel:add-docs <name> <folder> [--code <repo>]` | Adds a doc set and builds its map. With `--code`, the repo needs `graphify-out/graph.json`. `--relink` (`/gabriel:add-docs <name> --code <repo> --relink`) changes only the code repo of a set. |
| `/gabriel:update [--dry-run] [--stack]` | Adds new doc folders, rebuilds changed maps, suggests test questions. `--stack` fetches stack docs again. |
| `/gabriel:refresh-docs <code folder> [docs folder]` | After code changes: updates the graph, fixes and shrinks the docs it touches, rebuilds the map, retrains. |
| `/gabriel:status` | Shows each doc set, its code graph, and when its map was built. `GRAPH MISSING` means the graph file is gone. |
| `/gabriel:retrain [name]` | Retrains the ranking on your test questions. With a name, keeps the new weights only if they score no worse. With no name, retrains the default doc set and always keeps the new weights (old ones saved as `rank.prev.json`). |
| `/gabriel:tune-embeddings` | Optional, slow fine-tune of the meaning model. See [docs/TUNING.md](docs/TUNING.md). |

The `map` skill is not a command. It tells Claude how to read the map block.

## What you see

This is a made-up example from a doc set named `notes`:

```
My notes map (spreading search over docs, built 2026-11-10; start here, then confirm in the code, the map can be old):
- doc bikes.md > Brakes: Check the brake pads every 500 km.
- doc cooking.md > Rice: Soak rice for 30 minutes before you boil it.
- doc cooking.md > Stock: Keep the stock in the fridge for up to 3 days.
```

The `map` skill tells Claude how to read this block. Claude treats it as a lead, not as proof.

## What leaves your machine

After setup, gabriel sends nothing. Setup downloads npm packages and one meaning model (22.6 MB) once. If you say yes during the first setup, it also downloads public docs for your languages and frameworks. It asks first and shows the list.
Claude Code still sends your prompts, and the text gabriel adds, to Claude as usual.

## Requirements

- Node.js 22.5 or newer. gabriel uses the built-in `node:sqlite` module.
- npm.
- One host: Claude Code with plugin support, Codex CLI, Gemini CLI or GitHub Copilot. Any other tool can call `gabriel context`. See [docs/HOSTS.md](docs/HOSTS.md).

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the parts fit together.
- [docs/WORKFLOWS.md](docs/WORKFLOWS.md): step-by-step flows, with diagrams: setup, each prompt, learning, building maps, retrain, tune, other hosts, data, migration.
- [docs/HOSTS.md](docs/HOSTS.md): Claude Code, Codex CLI, Gemini CLI, GitHub Copilot and other tools. Install, remove, limits.
- [docs/PRIVACY.md](docs/PRIVACY.md): what is stored, where, and how to delete it.
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): common problems and fixes.
- [docs/ADDING-DOCS.md](docs/ADDING-DOCS.md): how to add doc sets.
- [docs/EVAL.md](docs/EVAL.md): how gabriel is measured and retrained.
- [docs/TUNING.md](docs/TUNING.md): the optional fine-tune of the meaning model.
- [docs/DOC-LAYOUT.md](docs/DOC-LAYOUT.md): the folder layout and lean rules for the code docs that setup writes and refresh-docs keeps.

## Best results: graph your code, then write its docs

> **Read this first if you use gabriel on a code base.** gabriel can only find what is written down. Good docs about your code help it more than anything else.

1. **Graph the code.** Install the graphify skill and run `/graphify <repo>` in the repo. It writes `graphify-out/graph.json`. gabriel reads it to link doc sections to class and file names.
2. **Write the docs from the graph.** `/gabriel:setup` (first run or `--onboard`) offers to write them, with Mermaid diagrams. You can also ask Claude, for example with `/engineering:documentation`. Use the layout in [docs/DOC-LAYOUT.md](docs/DOC-LAYOUT.md):
   - **Business** (`docs/business/`): what the system is for, its rules, its states, a glossary, and one page per main workflow, from trigger to result.
   - **Technical** (`docs/technical/`): architecture, modules, how to build, test and add a feature, known bugs.
3. **Add them:** `/gabriel:add-docs <name> <docs folder> --code <repo>`. The repo must have `graphify-out/graph.json` (step 1). If the docs name almost no code, the command warns. Then use `--relink`. See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
4. **Keep them current:** after code changes, run `/gabriel:refresh-docs <repo>`.

Docs that name real files, classes and steps give gabriel the most to link. Keep them lean: one fact in one place, no copied code. Check them against the code: a wrong doc misleads gabriel too.

## Credit

Made by ThanhNVan @ AIC Lab FPT University.

## License

MIT. See [LICENSE](LICENSE).
