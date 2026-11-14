# Troubleshooting

Start with `/gabriel:status`. It shows each doc set as built, stale or missing. A set with a problem gets a `fix:` line with the one command that fixes it. Run that command yourself.

**The plugin folder** is where gabriel's code lives. From a marketplace install, it is `~/.claude/plugins/cache/<marketplace>/gabriel/<version>/`. From a local folder, it is that folder: local-path marketplaces load in place.

For a direct check, run:

```
node "<plugin folder>/src/brain.js" mk-status all
```

## No map is shown for a prompt

A map appears only when a prompt matches your docs well enough. Check these in order.

1. **The prompt is short.** Prompts with fewer than 4 words, and prompts that start with `/`, skip the search. Ask a longer question.
2. **The map is not built.** Run `/gabriel:status`. If it says "no map", run `/gabriel:setup`. Or run `node "<plugin folder>/src/brain.js" build-mk <name>`.
3. **The doc set is small.** A few short files may show no map at all. The quiet gate is tuned for bigger doc sets. Add more docs, or check the match yourself:

   ```
   node "<plugin folder>/src/brain.js" mk "your question"
   ```

   This prints the map for the text, or "(no map for this text)". Add `--project <name>` to pick a doc set.
4. **The words do not match.** Use the same words as your docs, or name the doc set in the prompt (its `aliases` in `projects.json` count). A pinned session ignores other set names: see the next section.
5. **The map is stale.** A changed doc or graph makes the map stale. The hook rebuilds it in the background, at most once a minute. Wait a minute, then ask again. `mk-status all` prints `fix: /gabriel:update` under a stale set.

## The map shows only one project

Cause: the session is pinned with `gabriel use <set>`. Every gabriel note then starts with `📌 pinned: <set>`, and the map searches only that set. Naming another set in a prompt does not help.

Fix: type `gabriel use auto`. The 📌 line goes away. See the README section "Pin one doc set per session".

## A PDF shows no text

Setup prints `found N docs` with the count per type. Check these in order.

1. **The PDF is a scan.** A scanned PDF holds pictures, not text, so the map has nothing to read. Run OCR on the PDF first, then add the new file. Setup counts the file, but the map skips it.
2. **`pdfjs-dist` is missing.** Add-docs prints `PDF files found but pdfjs-dist is not installed: run npm ci --omit=dev in the plugin folder`. Run `npm ci --omit=dev` in the plugin folder, then add the set again. Setup alone does not install it: it skips npm when the main package is already there.
3. **The set does not list PDFs.** A set with `"extensions": ["md"]` in `projects.json` skips PDFs. Add `"pdf"` to the list, then run setup again.

## The hook seems slow or times out

- The hook timeout is 60 seconds. Inside the hook, the map search is skipped after 11 seconds. The meaning step gives up after 9 seconds. A slow step then drops out, and the prompt still goes through.
- Each prompt starts a new hook process. Loading the meaning model takes time on every prompt.
- If it is always slow, run setup with `--skip-model`. That gives words-only mode, which is faster.

## The model download fails

Setup retries the download 3 times, with waits of 5, 15 and 45 seconds. If all retries fail, setup continues in words-only mode and prints:

```
node "<plugin folder>/src/setup.js" --only model
```

Run that line later, when the network works. gabriel works without the model. It loses meaning matches only.

## Node is too old

gabriel needs Node.js 22.5 or newer. Setup step 1 stops with `node ... is too old`.

1. Install Node.js 22.5 or newer.
2. Open a new terminal. Check with `node --version`.
3. Run `/gabriel:setup` again.

## npm install is blocked by scripts

Some packages need an install script. npm can block it. Setup then fails at step 2 with `npm install failed`.

1. Allow the script for the runtime package:

   ```
   npm install-scripts approve onnxruntime-node
   ```

2. Run `/gabriel:setup` again.

## Windows paths with spaces

Put quotes around every path that has a space, including the `--data` folder. The `setup.ps1` file in the plugin folder passes its arguments to `src/setup.js`. From PowerShell:

```
pwsh -File "D:\My Tools\gabriel\setup.ps1" --dry-run
```

## The hook runs twice

Symptom: each prompt shows the same block twice. Find your host below.

**Claude Code.** Cause: an old manual hook is still in your Claude Code settings. The plugin adds its own hook too.

Fix: open your Claude Code settings file and remove the old hook entry that runs `brain.js hook`. Keep the plugin's hook. The plugin's hook is in `hooks/hooks.json`.

**Codex CLI.** Cause: the `UserPromptSubmit` entry for gabriel is in `hooks.json` twice. Setup never adds a second entry, so this comes from a manual edit or a second copy of the file.

Fix: search the hooks file for `brain.js`. The file is `~/.codex/hooks.json`, or `hooks.json` in `CODEX_HOME`. Keep one `hook --host codex` entry and one `touched --host codex` entry. Or remove gabriel's entries with `node "<plugin folder>/src/setup.js" --remove-host codex --apply`, then add them again with `--host codex --apply`. See [HOSTS](HOSTS.md).

**Gemini CLI.** Same cause and fix as Codex, in `~/.gemini/settings.json`, with `--host gemini`.

## Plugin update removed packages

A plugin update replaces the plugin folder. The npm packages inside it can go missing.

Fix: run `/gabriel:setup` again. It installs the packages again. Your data folder is not changed by an update.

## `/gabriel:add-docs` stops with an error

Each error leaves `projects.json` unchanged:

- `0 docs found in <folder>`: the folder has no files of a type gabriel reads. See the type list in [ADDING-DOCS](ADDING-DOCS.md).
- `folder not found: <folder>`: check the path.
- `code folder not found: <folder>`: check the `--code` path.
- `no graphify-out/graph.json in <repo>: run /graphify <repo> first, or leave out --code`: see [No code graph in the repo](#no-code-graph-in-the-repo).
- `project <name> already exists`: pick another name, or remove the old entry from `projects.json`.
- `bad project name: <name>`: use lowercase letters, digits, `-` and `_`, up to 40 characters, starting with a letter or digit.

To use other settings (aliases, layout, a code graph), edit `projects.json`. See `projects.example.json` in the plugin folder.

`--relink` stops with these errors, and changes nothing:

- `unknown doc set: <name>`: the name is not in `projects.json`.
- `--relink needs --code <repo>`: add `--code`.

## No code graph in the repo

Message: `no graphify-out/graph.json in <repo>: run /graphify <repo> first, or leave out --code`.

Cause: `--code` names a repo with no graph file. With `--code`, gabriel does not look in the docs folder.

Fix: run `/graphify <repo>` in Claude, then run the command again. Or leave out `--code`.

## `graph not found` when a map is built

Message: `graph not found: <path>; run /graphify on the code repo, or fix "graph" for <name> in projects.json`.

Cause: the set's `graph` entry points to a file that is gone. The build stops before it writes, so the old map keeps working. The hook then skips that set in the background check.

Fix, one of:

- Run `/graphify <repo>` to make the graph again, then run `/gabriel:add-docs <name> --code <repo> --relink`.
- Fix the `graph` entry for the set in `projects.json`.
- Delete the `graph` entry if the set should have no code links. The set then builds without them.

Check with `node "<plugin folder>/src/brain.js" mk-status all`.

## The docs name almost no code (wrong repo)

Message: `warning: the docs name almost none of this graph's code (<k> of <n> sections link to it); is the code graph the right repo?`

Cause: the code graph is from another repo, or the docs do not name the code. The build still runs, but the links are weak.

Fix: check the repo. If it is wrong, run `/gabriel:add-docs <name> --code <right repo> --relink`. The new build summary should end with a `<k> doc sections linked to code` count above zero. Business docs with no class or file names can show this warning and still be right.

## `GRAPH MISSING` in status

`/gabriel:status` (or `node "<plugin folder>/src/brain.js" mk-status all`) shows `graph <path>   GRAPH MISSING` for a set. The graph file is gone. The background check does not rebuild that set, so its map stops following the docs.

Fix: the same as `graph not found` above. `mk-status all` prints the fix line `fix: /gabriel:add-docs <name> --code <repo> --relink` under the set.

## `/gabriel:retrain` asks you to review cases

With no `eval-cases.json`, retrain writes suggested cases and stops. Review them, rewrite the questions in your own words, and save the file as `eval-cases.json`. Then run retrain again. See [EVAL](EVAL.md).

## Changes in the plugin folder are not used

Claude Code runs a copy of the plugin from `~/.claude/plugins/cache/`, even when you installed it from a local folder. Run `claude plugin update gabriel@gabriel`, then restart Claude Code. Codex CLI and Gemini CLI hooks run the folder you set up, so they need no update.

## Step 9 says "tests failed"

Setup step 9 runs `npm test` in the plugin folder. A failure there does not stop setup. Run `npm test` there to see which test failed, or skip the step with `--skip-test`.

## Some items are missing from the block

Items already sent in this session are not sent again. A note shows how many were skipped. The state resets after a compaction, or after 30 prompts. Start a new session to see them again.

## Still stuck

- Run `node "<plugin folder>/src/brain.js" check` to see problems in note headers.
- Run `node "<plugin folder>/src/brain.js" learn-show` to see learned links.
- Open an issue in the project repository with the output of `/gabriel:status` and the Node version. Remove any private text first.
