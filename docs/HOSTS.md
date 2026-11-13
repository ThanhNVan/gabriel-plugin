# Hosts

gabriel works with several AI coding agents. The engine is the same for all of them. A small adapter for each host reads the host's input and writes the host's output.

| Host | How you connect it | Rules it reads | Setup writes |
|---|---|---|---|
| Claude Code | Plugin (`/plugin install gabriel@gabriel`) | `~/.claude`: `CLAUDE.md` and memory notes | Nothing. The plugin ships its own hooks. |
| Codex CLI | `setup.js --host codex --apply` | `$CODEX_HOME` or `~/.codex`: `AGENTS.md` | `hooks.json` in that folder |
| Gemini CLI | `setup.js --host gemini --apply` | `~/.gemini`: `GEMINI.md` | `settings.json` in that folder |
| GitHub Copilot (CLI, VS Code) | `setup.js --host copilot` prints lines for its instructions file | `$COPILOT_HOME` or `~/.copilot`: `copilot-instructions.md` | Nothing. Copilot has no prompt hook gabriel can use. |
| Any other tool | Call `brain.js context "<prompt>"` | `GABRIEL_RULES_HOME`, or `~/.claude` | Nothing |

The data folder is shared by all hosts. See [PRIVACY](PRIVACY.md).

Pick a host with `--host <name>`. Or set the environment variable `GABRIEL_HOST`. With neither, gabriel uses `claude`.

Run `node "<plugin folder>/src/setup.js" --host <name>` to see the config for a host. Nothing is written. Add `--apply` to write it.

## Claude Code

Install it as a plugin, as the [README](../README.md) shows. The plugin's hooks are in `hooks/hooks.json`. The `UserPromptSubmit` hook adds the rules and the map. The `PostToolUse` hook learns from the files you open.

To remove it, uninstall the plugin in Claude Code.

## Codex CLI

Codex keeps its hooks in `~/.codex/hooks.json`. If `CODEX_HOME` is set, the file is in that folder.

Install:

```
node "<plugin folder>/src/setup.js" --host codex
node "<plugin folder>/src/setup.js" --host codex --apply
```

What `--apply` writes. It adds two hook groups, and it keeps your other hooks and settings:

- `UserPromptSubmit`: runs `brain.js hook --host codex`. Timeout 60 seconds.
- `PostToolUse`: runs `brain.js touched --host codex`. Timeout 5 seconds. The matcher is `apply_patch|Read|Edit|Write`.

Before it writes, it saves a backup: `hooks.json.gabriel-backup-<time>`. A second `--apply` adds nothing. If the file is not valid JSON, gabriel changes nothing.

Remove:

```
node "<plugin folder>/src/setup.js" --remove-host codex --apply
```

This removes only gabriel's two groups. It makes a backup first.

Limits:

- Codex caps hook text at about 2,500 tokens. gabriel cuts its block at 9,000 characters.
- After a patch, the paths come from the patch text (`*** Update File:` and `*** Add File:`). Shell commands have no file path, so gabriel learns nothing from them.
- Rules in `AGENTS.md` are loaded every session. gabriel never repeats them.
- The matcher names are a best guess for Codex. If a tool name does not match, check the matcher in `hooks.json`.
- Codex hook formats come from the official Codex docs (checked 2026-11-13).

## Gemini CLI

Gemini keeps its settings in `~/.gemini/settings.json`. Other settings in that file are kept.

Install:

```
node "<plugin folder>/src/setup.js" --host gemini --apply
```

What `--apply` writes. It adds two hooks under `"hooks"`:

- `BeforeAgent`: runs `brain.js hook --host gemini`. Timeout 60000 ms.
- `AfterTool`: runs `brain.js touched --host gemini`. Timeout 5000 ms. The matcher is `write_file|replace|read_file`.

It makes a backup first, as for Codex. It never adds a second copy.

Remove:

```
node "<plugin folder>/src/setup.js" --remove-host gemini --apply
```

Limits:

- The hook sends the rules to Gemini. It has no line for you to read, so you do not see which rules were added.
- A file path is read from `file_path`, `absolute_path` or `path` in the tool input. A relative path is made absolute from the working folder.
- The tool names in the matcher (`write_file`, `replace`, `read_file`) are a best guess. Check them in your Gemini CLI version.
- Gemini's memory notes are read from `~/.gemini/projects/*/memory/`, not from `~/.claude`.

## GitHub Copilot

Copilot CLI and VS Code Copilot have hooks, in `~/.copilot/hooks/*.json`. But Copilot ignores what a `userPromptSubmitted` command hook prints. So gabriel cannot add the map to each prompt. (Sources: GitHub's "Copilot CLI hooks reference" and VS Code's "Agent hooks" page.)

Instead, Copilot runs gabriel itself. Its instructions file tells it to:

```
node "<plugin folder>/src/setup.js" --host copilot
```

This prints two lines. Add them to `~/.copilot/copilot-instructions.md` (or `.github/copilot-instructions.md` in a repo). Start a new Copilot session after the edit.

Limits:

- Copilot decides when to run gabriel. It may skip it.
- No `postToolUse` hook. `touched` learns only after a map was shown in the same session, and Copilot does not pass one in.
- To remove it, delete the lines from the instructions file.

## Any other tool

Call `context` and put the text in your prompt:

```
node "<plugin folder>/src/brain.js" context "<your prompt>" --host generic
node "<plugin folder>/src/brain.js" context "<your prompt>" --host generic --session <session id>
```

- It prints plain text: the same block the hooks send. It prints nothing for short prompts and for slash commands.
- The rules come from `GABRIEL_RULES_HOME`. If that is not set, it uses `BRAIN_HOME`. If neither is set, it uses `~/.claude`.
- No rule file is treated as loaded already, so all your rules can come back.
- With `--session`, the same item is not printed again in that session. Use the same session id for each prompt in one chat.

Limits:

- There is no hook and no line for the user. Your tool must add the text itself.
- Without `--session`, every prompt shows the rules again.

## Shared data

All hosts share one data folder. See [PRIVACY](PRIVACY.md) for the list.

- Each host has its own rules graph file: `graph.json` for Claude Code, `graph.codex.json` for Codex CLI, `graph.gemini.json` for Gemini CLI, and `graph.generic.json` for `context`.
- The doc maps are shared. So are the prompt history and the list of similar earlier prompts. A prompt sent in one host can show up in another host's "similar earlier prompts".

## Tests

`npm test` runs the host tests. They use temp folders only. They never read or write `~/.codex`, `~/.gemini` or your real `~/.claude`.
