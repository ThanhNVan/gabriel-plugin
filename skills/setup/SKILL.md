---
name: setup
description: Install or repair gabriel: packages, model, data folder, maps. Run after install or update.
disable-model-invocation: true
---

Run this command and wait for it to finish:

```
node "${CLAUDE_PLUGIN_ROOT}/src/setup.js" $ARGUMENTS
```

Flags:

- `--dry-run`: show what would change, change nothing.
- `--skip-model`: do not download the meaning model.
- `--skip-test`: do not run the self-tests.
- `--yes`: setup copies old data from `~/.claude/brain` (step 6). Add-docs also accepts a very large folder (over 20000 files or 500 MB).
- `--tune`: install the optional Python packages for the tune run (see `docs/TUNING.md`). It only does this step: it finds Python 3.10 or newer, makes the venv in the data folder, installs torch (CPU) and the tune packages, and prints the install size. A normal setup never does this. Works with `--dry-run`.

Report the summary lines the command prints. Keep them as they are.

## First run: help a new user (skip with `--dry-run`, `--tune` or `--yes`)

Before you run the command above, check if this is a new user:

```
node -e "const fs=require('fs'),p=require(require('path').join(process.argv[1],'src','paths.js')).projectsFile();console.log(fs.existsSync(p)&&JSON.parse(fs.readFileSync(p,'utf8')).projects.length?'known':'new')" "${CLAUDE_PLUGIN_ROOT}"
```

If it prints `known`, stop after the setup report. If it prints `new`, run setup, then do these three steps in order. Ask each question with AskUserQuestion. Do nothing the user did not pick.

Work each step the same way, when superpowers is installed:

1. Plan: run `/superpowers:brainstorming` to settle what the user wants, then `/superpowers:writing-plans` to write the plan.
2. Do: run `/superpowers:executing-plans` on that plan.

Without superpowers (not installed, or installed in step 1 and Claude Code not restarted yet), plan in a short list, show it, then do it.

### 1. Helper tools

Ask (multi-select): "gabriel works best with these. Which should I install?"

- **graphify**: turns a code folder into a graph that gabriel reads. Commands: `uv tool install graphifyy` (or `pip install graphifyy` when uv is missing), then `graphify install`.
- **superpowers**: planning, debugging and review skills. Command: `claude plugin install superpowers@claude-plugins-official`.
- **ponytail**: keeps code small and simple. Commands: `claude plugin marketplace add DietrichGebert/ponytail`, then `claude plugin install ponytail@ponytail`.

Run only the picked commands. Skip a tool that is already there (`graphify --help` works, or `claude plugin list` shows it). Report each result. Plugins work after a Claude Code restart.

### 2. Graph a project

Skip this step if graphify is not installed. Ask: "Run graphify on a project now? Which folder?" Offer up to three code folders the user names or that you see in the working directory, plus "Not now".

On a pick, run `/graphify <folder>` and wait for it to finish. It writes `<folder>/graphify-out/`.

### 3. Write docs from the graph

Only after a graph was made in step 2. Ask (multi-select): "Write docs for <folder> from the graph?"

- Technical docs (modules, data, APIs, how to build and test)
- Business docs (what the product does, rules, terms)
- Architecture (parts, layers, how they connect)
- Workflows with Mermaid diagrams

For the picked ones, use the `engineering:documentation` skill when it is installed; otherwise write them yourself. Read `graphify-out/GRAPH_REPORT.md` and query the graph; never read `graph.json` whole. Confirm each claim in the code. Write to `<folder>/docs/`, one file per pick, in short plain words.

Then add the project so gabriel maps it: `/gabriel:add-docs <name> <folder>/docs --code <folder>`. If the user picked no docs, use `<folder>` as the docs folder.
