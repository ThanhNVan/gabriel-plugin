# Privacy

This page says what gabriel stores, where, and what it sends. It covers version 0.1.0.

## Short version

- Your docs, rules and prompt history stay on your machine.
- Setup downloads two things once: npm packages and one meaning model.
- After setup, gabriel makes no network calls.
- Claude Code still sends your prompts, and the text gabriel adds, to Claude as usual. That is how Claude Code works, not part of gabriel.

## What is downloaded, and when

| When | What | From |
|---|---|---|
| `/plugin install` | The plugin files | The marketplace you added (a git URL or a local folder). |
| `/gabriel:setup`, step 2 | npm packages: `@huggingface/transformers` and its dependencies, from the lock file | The npm registry. |
| `/gabriel:setup`, step 5 | One meaning model, `Xenova/all-MiniLM-L6-v2` (22.6 MB) | The model host (huggingface.co). |

- Setup can be run with `--skip-model`. Then no model is downloaded. gabriel runs in words-only mode.
- If the model download fails, setup retries 3 times. It then continues in words-only mode.
- The hook itself never downloads anything. It uses the model only if it is already on disk.

## What is stored, and where

Everything is in one data folder, `~/.claude/gabriel-data`. Set `GABRIEL_DATA` to use another folder.

| Path | What it holds | Can it contain private text? |
|---|---|---|
| `docs/<name>/` | Copies of your Markdown files, if you put them there. | Yes. These are your docs. |
| `projects.json` | Names and paths of your doc sets. | Paths only. |
| `mk.db` | Map: text chunks from your docs, code names, links, and the list of files you opened after a map. | Yes. It holds chunks of your docs. |
| `vectors.json`, `history/vectors.json` | Meaning numbers (lists of decimals) for rules and prompts. | Numbers only, but they come from your text. |
| `graph.json` | Rules graph: the text of your rules and memory notes. | Yes. |
| `history/*.jsonl` | Your prompts, one file per month and machine. | Yes. |
| `history/graph.db` | Word links built from your prompts. | Yes, in word form. |
| `seen/` | Which items were sent in each session. | Item text. Removed after 7 days. |
| `private/<name>/` | Files you add yourself: ranking weights, questions, eval cases. | Yes, if you add private text. |
| `models/` | The meaning model. | No. |

Plugin folder: code only. It holds no data. It is replaced when the plugin updates.

Your rules come from `~/.claude` (`CLAUDE.md` and memory notes). gabriel reads them. It does not write to that folder.

## What never leaves the machine

After setup, gabriel does not send:

- your prompts,
- your docs,
- your rules,
- your history,
- the map.

The hook reads the data folder and prints text to Claude Code. The meaning model runs locally.

## Prompt history: what is saved

- Each prompt that reaches the search is saved to `history/`. A prompt must have 4 or more words and must not start with `/`. Harness messages are not saved.
- Before saving, the text is cut by patterns. These are the patterns:
  - JWT-like tokens (`eyJ...`) and `Bearer` tokens are replaced with `[hidden]`.
  - Strings that start with `sk-` are replaced.
  - Text after a name that contains `key`, `token`, `secret`, `password`, `pwd`, `passwd`, `license` or `licence` and then `:` or `=` is replaced.
  - Long mixed letter-and-digit strings (24 or more characters) are replaced, unless they look like paths or URLs.
- Prompts longer than 8000 characters are cut.
- The working folder (`cwd`) and the time are saved with each prompt.

**Limit.** Redaction works by patterns only. An unusual secret can slip through. Check the files in `history/` if you paste secrets into prompts. Remove a prompt with:

```
node "<plugin folder>/src/brain.js" forget "<text of the prompt>"
```

## Deleting everything

1. Uninstall the plugin in Claude Code.
2. Delete the data folder: `~/.claude/gabriel-data` (or the folder set in `GABRIEL_DATA`).

That removes the map, the history, the model, the seen state and your private files. The plugin folder holds no data, so nothing else is left behind.

To forget only the learned links, run `node "<plugin folder>/src/brain.js" learn-reset`. To forget only prompt history, delete the `history/` folder.

## For contributors: the privacy scan

Before you publish a change, run:

```
npm run privacy
```

This runs `tools/check-public.js`. It checks every publishable file for:

- email addresses,
- IP addresses,
- secret-like lines (an API key or password assignment, or the header line of a private key file),
- user folder paths (for example a Windows `Users` path, or `/home/<name>`).

It also checks for owner words. The word list is read from `<data folder>/private/privacy-words.txt`. If that file is missing, the owner word check is skipped, and the scan says so.

The scan prints the file, the line and the kind of match. It never prints the matched value.

`npm run prepack` runs the scan with `--release`. A release fails if the word list is missing.

The scan skips the `private/` folder. The `.gitignore` file also lists it and the data files, so they stay out of git.
