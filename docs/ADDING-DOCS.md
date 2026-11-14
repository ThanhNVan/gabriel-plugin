# Adding doc sets

A doc set is one folder of doc files. Gabriel builds a map from it. The map finds the parts of your docs that fit a question.

Gabriel reads Markdown, plain text, reStructuredText, AsciiDoc, Org, HTML, Word (.docx), PowerPoint (.pptx), OpenDocument (.odt, .odp), Excel (.xlsx), CSV, TSV and PDF. PDFs need the optional `pdfjs-dist` package, which `npm ci --omit=dev` installs. A scanned PDF has only pictures, so it has no text and is skipped. JSON (`.json`), JSON Lines (`.jsonl`, `.ndjson`) and YAML (`.yaml`, `.yml`) are opt-in: they are read only when the set lists them. Set `"extensions": ["md","pdf"]` in `projects.json` to limit a set to some types. For opt-in types, list the name without the dot, like `"json"`, `"jsonl"`, `"ndjson"`, `"yaml"` or `"yml"`.

Your data folder is `~/.gabriel/`. On Windows that is `C:\Users\<you>\.gabriel\`. Older installs use `~/.claude/gabriel-data/` instead, as long as that folder exists. The examples below use `~/.gabriel/`. Use your own folder's path.

**The plugin folder** is where gabriel's code lives. From a marketplace install, it is `~/.claude/plugins/cache/<marketplace>/gabriel/<version>/`. A local-folder marketplace is copied there too, so edits in your folder are not used until you run `claude plugin update gabriel@gabriel` and restart Claude Code.

## 1. Add the files

Option A: put the files in a folder under the data folder.

```
~/.gabriel/docs/<name>/
```

Use one folder per topic. Option A works only while there is no `projects.json` file in the data folder. After the first `add-docs`, that file exists, and a new folder under `docs/` is ignored. Then use `add-docs --copy`, or add an entry to `projects.json`.

Option B: point gabriel at a folder you already have.

```
/gabriel:add-docs <name> <folder>
```

Expected last line: `added <name>: <n> docs`

Add `--copy` to copy the files into the data folder. Without it, gabriel reads the folder where it is.

## 2. Build the map

`add-docs` builds the map for its set, so the first question can show it. You do not need setup after `add-docs`.

Setup builds the maps of all sets. Run it after you add a folder under `docs/`, or edit `projects.json` by hand:

```
/gabriel:setup
```

Setup prints one line for each set: `<name>: map built in <s> s: ...`

Changed docs rebuild in the background, at most once a minute.

## 3. Ask a question

Ask Claude a question that your docs answer. Gabriel adds a block to the prompt. The block starts with the set name and the word `map`.

## 4. Check a doc set

Run this in the plugin folder:

```
node src/brain.js mk "how do I fix a flat tire on my bike"
```

Expected last line: `[<ms> ms, <n> seeds, best <x>]`

The lines above it name the file and the section that fit. If no part fits, the line is `(no map for this text)`.

## 5. Code repos: add the code graph

For a code repo, first make a graph. Run this in Claude in the repo:

```
/graphify <repo>
```

This makes `graphify-out/graph.json` in the repo. Gabriel reads that file to link docs to code.

**No docs for the code yet? Write them first.** They help gabriel the most. Ask Claude to read `graphify-out/` and the code, and write (for example with `/engineering:documentation`):

- technical docs: modules, main classes, how to add a feature, known bugs;
- business docs: purpose, rules, a glossary, states;
- architecture: parts, data flow, key decisions, a diagram;
- workflows: each main flow from trigger to result, with the files it touches.

Check each doc against the code. A wrong doc misleads gabriel. See the README section "Best results".

Then add the set with the repo:

```
/gabriel:add-docs <name> <folder> --code <repo>
```

Expected line: `code graph found: linking docs to code`

With `--code`, the repo must hold `graphify-out/graph.json`. If it does not, add-docs stops before it writes anything. There is no fallback to a graph in the docs folder. Without `--code`, a graph in the docs folder is still used when present.

The build warns when almost no doc section links to the code. It prints `warning: the docs name almost none of this graph's code (<k> of <n> sections link to it); is the code graph the right repo?` The build summary ends with `, <k> doc sections linked to code`. If the repo is wrong, fix it with `--relink`. It changes only the code graph of an existing set, then rebuilds its map:

```
/gabriel:add-docs <name> --code <repo> --relink
```

With `--code`, the set also gets `cwdHints`: the lower-case name of the code repo. If the repo sits inside a git repo, the git repo's name is used. A prompt run from that folder then leans toward this set. `--relink` does not change `cwdHints`.

Business docs with no code names can get the same warning. That is expected. See [TROUBLESHOOTING](TROUBLESHOOTING.md).

## 6. A very small set may show no map

The gate that decides when to show a map needs enough text. A set with only a few files may show no map. This is expected.

Add more docs and run setup again. Check again with step 4.

## 7. Make the map better

Suggest test questions from your docs:

```
node eval/suggest-cases.js --project <name>
```

Expected line: `wrote <n> suggested cases to <file>; review them, then save as eval-cases.json`

A section that a case already covers is not suggested again. A case covers a section when its `doc` pattern matches the file and its `sec` pattern matches the section. Cases with a bad pattern cover nothing. The file keeps the cases it already had.

Open the suggested file. Rewrite each question in your own words. Then save it as:

```
~/.gabriel/private/<name>/eval-cases.json
```

Then retrain the ranking:

```
/gabriel:retrain <name>
```

Claude reports the scores before and after. Read the comments at the top of `eval/suggest-cases.js` for more detail.

## 8. Remove a doc set

1. Open `~/.gabriel/projects.json`.
2. Delete the entry with that `name`. Save the file.
3. If you copied the set, delete its folder: `~/.gabriel/docs/<name>/`. A linked set uses your own folder. Keep that folder.
4. Run setup again:

```
/gabriel:setup
```

Expected line: `<n> projects`

Setup does not clear the old map rows of a removed set. To purge them, delete `mk.db` in the data folder, then run `/gabriel:setup`. This also clears the learned links.

## 9. Add more docs later

You can add doc sets and doc files at any time. Either:

- Add a new doc set with `/gabriel:add-docs <name> <folder>`, or copy a folder into `~/.gabriel/docs/<name>/`.
- Change or add files in a doc set you already have.

You often do not need a command:

- A new folder under `~/.gabriel/docs/` (any depth inside it) is added on its own. On a later prompt, gabriel sees it and runs the update in the background (at most once every 10 minutes). The folder must hold at least one file; an empty folder is ignored.
- `~/.gabriel/docs/stack/` is made by setup for docs about your languages and frameworks. Put files there (in subfolders if you like) and it becomes the `stack` doc set the same way.
- Changed files in a doc set you already have are rebuilt in the background too.

To do it now and see the result, run:

```
/gabriel:update
```

Expected lines: `added doc set <name>` for each new folder, `<name>: map built` for each changed set, and `summary: ...`. A second run right after prints `0 added, 0 rebuilt`. Add `--dry-run` to see what it would do first:

```
/gabriel:update --dry-run
```

`/gabriel:update` does not change `eval-cases.json`. It only adds new cases to `eval-cases.suggested.json`, for sections that are not in your cases yet. Then:

1. Open `~/.gabriel/private/<name>/eval-cases.suggested.json`. Keep the new cases you want. Rewrite each question in your own words, and save them in `eval-cases.json`.
2. Retrain the ranking: `/gabriel:retrain <name>`.

A folder dropped into `docs/` is a new doc set only when `projects.json` exists. With no `projects.json`, gabriel already reads every folder under `docs/`.

## 10. projects.json fields

- `"aliases": ["name"]`: a prompt that names the set routes to it. `add-docs` and `--update` set it. `--update` adds `[name]` to any older set that has none, and prints `set alias for <name>`.
- `"cwdHints": ["repo-name"]`: set by `add-docs --code`. A prompt run from a folder with this name adds a small score to the set.
- `"sessionGate": true`: on the first prompt of a session, a weak match that names no doc set and comes from outside its folder shows nothing. Default: `false`. Use it when several doc sets overlap.
