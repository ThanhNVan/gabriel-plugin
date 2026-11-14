# Dev workflow

How to install, test, and change gabriel. Commands run from the repo root in PowerShell.

## Install

Run `npm ci` once. Then run `node src/setup.js` to fetch the meaning model, build the maps and run the tests. `--skip-model` skips the model download. `--only build` or `--only test` runs one step. `setup.js` writes only inside the data folder and `node_modules`.

Optional tuning packages: `node src/setup.js --tune` (tune parts in [01-architecture.md](01-architecture.md)).

## Run the tests

- `npm test` runs `node test/run-all.js`: every `test/test-*.js` file in name order, then the privacy scan. One line per file. A failed file prints its last 20 output lines. Exit code 1 on any failure.
- One file: `node test/test-hosts.js`.
- One run at a time. `run-all.js` takes the lock `gabriel-test.lock` in the system temp folder. A second run stops with the first run's pid. A stuck lock is deleted by hand.
- Tests use temp folders, so the real `~/.claude` is not read.

## Lint, Mermaid and privacy checks

| Check | Command | What it does |
|-------|---------|--------------|
| Lint | `npm run lint` | ESLint on the whole repo (`eslint.config.js`). `test/test-lint.js` runs it too. |
| Mermaid | `node test/test-mermaid.js` | Parses every Mermaid block in the repo's `.md` files. Skips `node_modules`, `private`, `.git` and `graphify-out`. Includes `repo-docs/`. |
| Privacy | `npm run privacy` | `tools/check-public.js`: finds emails, IP addresses, secrets, user paths and owner words. Prints file, line and kind only. |

Lint and Mermaid need the dev packages (`npm ci` installs them). When a package is missing, the test prints a skip line and exits 0. See [findings.md](findings.md).

The owner word list is `private/privacy-words.txt` in the data folder or in the repo. The `private/` folder is not in git. Without the file, the scan reports 0 hits and still passes.

`npm run prepack` runs the privacy scan with `--release`. Run it before a release. With `--release`, a missing word list is an error, not a pass.

## Add a host adapter

A host is one file in `src/hosts/`. Copy `src/hosts/generic.js` (no hook file) or `src/hosts/codex.js` (hook file) as a start.

1. Create `src/hosts/<name>.js`. It exports `name`, `readInput`, `readTouched`, `writeOutput`, `rulesHome`, `defaultRuleFiles`, `contextFile`, `maxChars` and `setup`. Use `null` for `setup` when the host has no hook file.
2. If `setup` is set, give it `configFile()` and `entries(root)`. Each hook command must end with `--host <name>`. `setup.js` finds its own hooks by that text (`addGabriel`, `removeGabriel`).
3. Add the adapter to the `HOSTS` object in `src/hosts/index.js`. The name comes from the key.
4. Add cases to `test/test-hosts.js` and `test/test-setup-hosts.js`. Run `npm test`.
5. Update the host table in `docs/HOSTS.md`.

Keep the adapter fail open, as `brain.js` is: bad input gives no output, not an error.

## Add a doc format

Doc readers are in `src/extract.js`.

1. Add the extension to `SUPPORTED`. For a big or data-only type, add it to `OPT_IN` instead. Opt-in types are read only when a project lists them in `extensions`.
2. Add a `case` in the switch in `extractText`, or a reader function for a binary type. Return text with `#` heading lines, so `mk.js` `chunkDoc` can split it.
3. For a type that needs a package, use an optional dependency and a check like `pdfHasSupport`. `setup.js` already uses that check for PDF.
4. Add a case to `test/test-extract.js`. `setup.js` counts files with the same list, so no other change is needed there.

## Add a tip

Tips are the `TIPS` array in `src/tips.js`. Add one short plain string. `tipFor` gives one tip per session, in order, then starts again. The place is kept in `tip-index` in the data folder. Tips show in the user note only, never to the model. Check with `node test/test-tips.js`.

## Release

1. Set the same `version` in `package.json` and `.claude-plugin/plugin.json`. `marketplace.json` has no version field.
2. Add a heading `## <version> (<date>)` to `CHANGELOG.md`. Move the "Unreleased" items under it.
3. Run `npm test`. `test/test-version.js` checks steps 1 and 2 and the plugin name.
4. Run `npm run privacy`.
5. The owner commits and pushes. The agent does not.

## Plugin cache note

Claude Code runs a copy of the plugin from its plugin cache, even when the plugin was installed from a local folder. After a change, run `claude plugin update gabriel@gabriel` and restart Claude Code. Codex CLI and Gemini CLI run the folder directly, so they need no update.

This note comes from `docs/TROUBLESHOOTING.md`. The cache folder is outside this repo, so this page does not check it.

## Rebuild a map by hand

- One project: `node src/brain.js build-mk <name>`. All projects: `build-mk all`. Each run takes about a minute. A project whose graph file is missing fails with `graph not found` and keeps its old map. See [TROUBLESHOOTING](../../docs/TROUBLESHOOTING.md).
- Check the map is current: `node src/brain.js mk-status all`. Under each set with a problem, it prints a `fix:` line with the one command that fixes it.
- Learned links: `node src/brain.js learn-show`, and `learn-reset` to clear them.

The hook also rebuilds a project in the background when its docs or code graph change: one stale project per check, at most once a minute. A project whose graph file is missing is skipped. `node src/brain.js mk-status all` shows each graph path, and `GRAPH MISSING` when it is gone.
