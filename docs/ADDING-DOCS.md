# Adding doc sets

A doc set is one folder of doc files. Gabriel builds a map from it. The map finds the parts of your docs that fit a question.

Gabriel reads Markdown, plain text, reStructuredText, AsciiDoc, Org, HTML, Word (.docx), PowerPoint (.pptx), OpenDocument (.odt, .odp), Excel (.xlsx), CSV, TSV and PDF. PDFs need the optional `pdfjs-dist` package, which `npm ci --omit=dev` installs. A scanned PDF has only pictures, so it has no text and is skipped. JSON (`.json`), JSON Lines (`.jsonl`, `.ndjson`) and YAML (`.yaml`, `.yml`) are opt-in: they are read only when the set lists them. Set `"extensions": ["md","pdf"]` in `projects.json` to limit a set to some types. For opt-in types, list the name without the dot, like `"json"`, `"jsonl"`, `"ndjson"`, `"yaml"` or `"yml"`.

Your data folder is `~/.claude/gabriel-data/`. On Windows that is `C:\Users\<you>\.claude\gabriel-data\`.

**The plugin folder** is where gabriel's code lives. From a marketplace install, it is `~/.claude/plugins/cache/<marketplace>/gabriel/<version>/`. From a local folder, it is that folder: local-path marketplaces load in place.

## 1. Add the files

Option A: put the files in a folder under the data folder.

```
~/.claude/gabriel-data/docs/<name>/
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

Then remove the set (step 8) and add it again with the repo:

```
/gabriel:add-docs <name> <folder> --code <repo>
```

Expected line: `code graph found: linking docs to code`

## 6. A very small set may show no map

The gate that decides when to show a map needs enough text. A set with only a few files may show no map. This is expected.

Add more docs and run setup again. Check again with step 4.

## 7. Make the map better

Suggest test questions from your docs:

```
node eval/suggest-cases.js --project <name>
```

Expected line: `wrote <n> suggested cases to <file>; review them, then save as eval-cases.json`

Open the suggested file. Rewrite each question in your own words. Then save it as:

```
~/.claude/gabriel-data/private/<name>/eval-cases.json
```

Then retrain the ranking:

```
/gabriel:retrain <name>
```

Claude reports the scores before and after. Read the comments at the top of `eval/suggest-cases.js` for more detail.

## 8. Remove a doc set

1. Open `~/.claude/gabriel-data/projects.json`.
2. Delete the entry with that `name`. Save the file.
3. If you copied the set, delete its folder: `~/.claude/gabriel-data/docs/<name>/`. A linked set uses your own folder. Keep that folder.
4. Run setup again:

```
/gabriel:setup
```

Expected line: `<n> projects`

Setup does not clear the old map rows of a removed set. To purge them, delete `mk.db` in the data folder, then run `/gabriel:setup`. This also clears the learned links.
