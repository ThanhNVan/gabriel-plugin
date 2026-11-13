# Troubleshooting

Start with `/gabriel:status`. It shows one line for each doc set: the map is built, stale, or missing.

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
4. **The words do not match.** Use the same words as your docs, or name the doc set in the prompt. Its `aliases` in `projects.json` count as a match.
5. **The map is stale.** A changed doc or graph makes the map stale. The hook rebuilds it in the background, at most once a minute. Wait a minute, then ask again.

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

Put quotes around every path that has a space. This applies to the plugin folder and to the `--data` folder.

```
node "D:\My Tools\gabriel\src\setup.js" --data "D:\My Notes\gabriel-data"
```

The `setup.ps1` file in the plugin folder passes its arguments to `src/setup.js`. Use it from PowerShell:

```
pwsh -File "D:\My Tools\gabriel\setup.ps1" --dry-run
```

## The hook runs twice

Symptom: each prompt shows the same block twice.

Cause: an old manual hook is still in your Claude Code settings. The plugin adds its own hook too.

Fix: open your Claude Code settings file and remove the old hook entry that runs `brain.js hook`. Keep the plugin's hook. The plugin's hook is in `hooks/hooks.json`.

## Plugin update removed packages

A plugin update replaces the plugin folder. The npm packages inside it can go missing.

Fix: run `/gabriel:setup` again. It installs the packages again. Your data folder is not changed by an update.

## `/gabriel:add-docs` stops with an error

Each error leaves `projects.json` unchanged:

- `0 docs found in <folder>`: the folder has no `.md` files. Only Markdown is read.
- `folder not found: <folder>`: check the path.
- `project <name> already exists`: pick another name, or remove the old entry from `projects.json`.
- `bad project name: <name>`: use lowercase letters, digits, `-` and `_`.

To use other settings (aliases, layout, a code graph), edit `projects.json`. See `projects.example.json` in the plugin folder.

## `/gabriel:retrain` asks you to review cases

With no `eval-cases.json`, retrain writes suggested cases and stops. Review them, rewrite the questions in your own words, and save the file as `eval-cases.json`. Then run retrain again. See [EVAL](EVAL.md).

## Step 9 says "tests failed"

Setup step 9 runs `npm test` in the plugin folder. A failure there does not stop setup. Run `npm test` in the plugin folder to see which test failed.

To skip the step, run setup with `--skip-test`.

## Some items are missing from the block

Items already sent in this session are not sent again. A note shows how many were skipped. The state resets after a compaction, or after 30 prompts. Start a new session to see them again.

## Still stuck

- Run `node "<plugin folder>/src/brain.js" check` to see problems in note headers.
- Run `node "<plugin folder>/src/brain.js" learn-show` to see learned links.
- Open an issue in the project repository with the output of `/gabriel:status` and the Node version. Remove any private text first.
