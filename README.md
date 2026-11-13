# gabriel

gabriel is a plugin for Claude Code. It adds the rules and doc parts that fit each prompt you send.

- For each prompt, it adds the few rules and doc sections that match it.
- It builds a local map of your doc folders. A code graph adds code names to the map.
- Prompts that match nothing get no extra text.

## Install

In Claude Code, run:

```
/plugin marketplace add <git url or local folder>
/plugin install gabriel@gabriel
/gabriel:setup
/gabriel:add-docs notes ~/notes
```

`add-docs` points gabriel at a folder of doc files and builds its map, so the first question can show it. Gabriel reads Markdown, text, reStructuredText, AsciiDoc, Org, HTML, Word, PowerPoint, OpenDocument, Excel, CSV, TSV and PDF. PDFs need the optional `pdfjs-dist` package, which `npm ci --omit=dev` installs. JSON (`.json`), JSON Lines (`.jsonl`, `.ndjson`) and YAML (`.yaml`, `.yml`) are opt-in: list them in `"extensions"` in `projects.json` to read them. See [docs/ADDING-DOCS.md](docs/ADDING-DOCS.md). You can also copy folders into `~/.claude/gabriel-data/docs/<name>/` and run `/gabriel:setup` again, but only while there is no `projects.json`. Each folder there is one doc set.

After you add or change doc files later, run `/gabriel:update`. It adds new folders and rebuilds the changed sets. See [docs/ADDING-DOCS.md](docs/ADDING-DOCS.md).

To check how well it finds your docs, and to train it on your own questions, see [docs/EVAL.md](docs/EVAL.md) and `/gabriel:retrain`.

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

After setup, gabriel sends nothing. Setup downloads npm packages and one meaning model (22.6 MB) once.
Claude Code still sends your prompts, and the text gabriel adds, to Claude as usual.

## Requirements

- Node.js 22.5 or newer. gabriel uses the built-in `node:sqlite` module.
- npm.
- Claude Code with plugin support.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the parts fit together.
- [docs/PRIVACY.md](docs/PRIVACY.md): what is stored, where, and how to delete it.
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): common problems and fixes.
- [docs/ADDING-DOCS.md](docs/ADDING-DOCS.md): how to add doc sets.
- [docs/EVAL.md](docs/EVAL.md): how gabriel is measured and retrained.

## Best results: graph your code, then write its docs

> **Read this first if you use gabriel on a code base.** gabriel can only find what is written down. Good docs about your code help it more than anything else.

1. **Graph the code.** Install the graphify skill and run `/graphify <repo>` in the repo. It writes `graphify-out/graph.json`. gabriel reads it to link doc sections to class and file names.
2. **Write the docs from the graph.** Ask Claude to read `graphify-out/` and the code, then write docs for that code base. A doc skill such as `/engineering:documentation` helps. Write these four kinds:
   - **Technical:** modules and who owns what, main classes, how to add a feature, known bugs.
   - **Business:** what the system is for, its rules, its terms (a glossary), its states.
   - **Architecture:** the parts, how they talk, data flow, key decisions. Add a diagram.
   - **Workflows:** each main flow step by step, from the trigger to the result, with the files it touches.
3. **Add them:** `/gabriel:add-docs <name> <docs folder> --code <repo>`. Run `/gabriel:update` after you add or change docs.

Docs that name real files, classes and steps give gabriel the most to link. Check them against the code: a wrong doc misleads gabriel too.

## Credit

Made by ThanhNVan @ AIC Lab FPT University.

## License

MIT. See [LICENSE](LICENSE).
