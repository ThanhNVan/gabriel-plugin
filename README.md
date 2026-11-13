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

`add-docs` points gabriel at a folder of Markdown files and builds its map. You can also copy folders into `~/.claude/gabriel-data/docs/<name>/` and run `/gabriel:setup` again. Each folder there is one doc set.

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

## Best results: docs + graphify

For a code repo, install the graphify skill and run `/graphify <repo>`.
gabriel reads the `graphify-out/graph.json` file it makes. It then links doc sections to code names.

## Credit

Made by ThanhNVan @ AIC Lab FPT University.

## License

MIT. See [LICENSE](LICENSE).
