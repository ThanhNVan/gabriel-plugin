---
name: refresh-docs
description: After code changes, refresh a doc set: rebuild its code graph (graphify update), update the docs the change touches, shrink those docs without losing a key idea, rebuild gabriel's map, then ask whether to retrain its ranking. Usage: /gabriel:refresh-docs <doc set name>, or /gabriel:refresh-docs <code folder> [docs folder]
disable-model-invocation: true
argument-hint: "<doc set name> | <code folder> [docs folder]"
---

Before step 1, read `${CLAUDE_PLUGIN_ROOT}/docs/AGENT-GUIDE.md`: the rules, the finish checklist, and the known errors with their fixes.

Arguments, either:
- `<doc set name>` alone (for example `makillez`): run `node "${CLAUDE_PLUGIN_ROOT}/src/brain.js" mk-status all` and read that set's block. Its `graph <path>` is the path to `graph.json`, and its `@<commit>` gives the old commit. Read the set's entry in `projects.json` (find the file with `node -e "console.log(require('${CLAUDE_PLUGIN_ROOT}/src/paths.js').projectsFile())"`):
  - `repo` is the **code folder**. If `repoBase` is `src`, the graph paths are relative to `<repo>/src`, so graphify runs on `<repo>/src`.
  - The **graph folder** is the folder above `graphify-out` (the `graph` path without `graphify-out/graph.json`).
  - `root` is the **docs folder**.
  - If `repo` is missing or its folder is gone: use the code folder in `graphify-out/.graphify_root` when that file exists (graphify writes the folder it read). Else use the git root above the graph folder (the folder holding `.git`). If that also fails, ASK the user for the code folder, then offer to save it with `/gabriel:add-docs <set> --repo <folder> --relink`.
  - If `root` is gone, ask the user for the docs folder.
  - Show both folders and ask the user to confirm before step 1.
- `<code folder> [docs folder]`: the graph folder is the code folder. With no docs folder, use the `root` of the doc set whose graph is in that folder (`projects.json`), else ask.

Work in four steps. Show % progress after each. Never commit or push: the user does that.

## 1. Refresh the graph

1. Check `graphify --help` works. If not, stop and suggest `/gabriel:setup --onboard` (it installs graphify).
2. Note the old commit and counts: `node "${CLAUDE_PLUGIN_ROOT}/tools/graph-stats.js" "<graph folder>/graphify-out/graph.json"`. Never read the file into the chat: it can be 90 MB.
3. Run `graphify update "<code folder>"`. It re-extracts code only and needs no model. It can take minutes: run it in the background and wait. When the graph folder is not the code folder, keep the code repo clean:
   - If the `update <path>` lines of `graphify --help` list `--graph` (none up to 0.9.109 do; a `--graph` under `cluster-only` does not count), add `--graph "<graph folder>/graphify-out/graph.json"`.
   - If not (graphify 0.9.49 has no `--graph`), use the copy route: copy `<graph folder>/graphify-out` to `<code folder>/graphify-out`, run `graphify update "<code folder>"`, copy the folder back, then delete `<code folder>/graphify-out`.

   Then:
   - Check that no `graphify-out` folder is left in the code folder. If one is, move its files into the graph folder's `graphify-out` and remove it.
   - Delete `graph.html` and any dated backup folder (`graphify-out/<YYYY-MM-DD>/`) that graphify wrote. They are not used, and `graph.html` can trip the privacy scan.
   - Run `graph-stats.js` again with `--repo "<code folder>"`. It must print `graph-stats: 0 hits`: no commit mismatch (the code repo's `HEAD`, not the docs repo's), no dangling link, no node from `private/`, `node_modules/` or `graphify-out/`.
4. If it refuses because the new graph has fewer nodes, show the counts and ask the user before you add `--force`.
5. Report: old and new node counts, and the GRAPH_REPORT.md lines that changed.

## 2. Find the docs the change touches

1. List the changed code files: `git -C "<code folder>" diff --name-only <old commit>..HEAD` (no old commit: ask the user for a commit or a date).
2. For each changed file, find its graph neighbours (`graphify query "<file or class name>"`) and the docs that name the file, its classes or its routes (search the docs folder for those names).
3. Show a table: changed code file, docs that mention it, why (name match or graph link). Ask which docs to update. Change nothing the user did not pick.

## 3. Update the picked docs

Read `${CLAUDE_PLUGIN_ROOT}/docs/DOC-LAYOUT.md` first: the layout and the lean rules apply to every edit. A new workflow gets a new `business/workflows/W<nn>-<name>.md` page; a new fact goes in the one doc that owns it, and other docs link to it.

For each picked doc:

1. Read the changed code and confirm every claim in it. The graph and old docs are leads, not proof.
2. Fix what the code change made wrong: names, paths, steps, rules, diagrams. Add what is new. Remove what is gone.
3. Keep the doc's own structure, headings and style. Keep Mermaid diagrams valid (double-quoted labels).
4. Note the commit it was checked against in `docs/README.md` (`Checked against commit: <sha>`), if the docs keep one.

## 4. Shrink the updated docs, keeping every key idea

For each updated doc:

1. **Before**: copy the docs folder to a scratch folder outside the docs (for `key-ideas.js` in step 4). Then write a key-idea list from the doc. One line per idea: each rule, step, decision, number, name, path, command, warning and diagram fact. Keep the list in your reply, not in the doc.
2. **Shrink**: shorter sentences, plain common words, one idea per sentence. Merge repeats, cut filler, turn long prose into short lists or a table when that is clearer. Keep code names, paths, commands, numbers and error text exactly. Keep every heading others link to (anchors).
3. **Cut over-detail** (the lean rules in `DOC-LAYOUT.md`): per-method or per-field text, copied code over 5 lines, line numbers, a fact repeated from the doc that owns it (replace it with a link), guesses, empty or "planned" sections. These are not key ideas: list each cut as `cut: <what>, <rule>` and show the list. Over the size limit (300 lines, a workflow page 120): split the doc.
4. **After**: run `node "${CLAUDE_PLUGIN_ROOT}/tools/key-ideas.js" "<scratch copy>" "<docs folder>"`. It checks every code name, link and number of the old text, across all docs, and prints `key ideas kept: N/N` per doc. Put back each `lost:` item, then run it again until `key-ideas: 0 lost`. Then check your own list for the ideas a script cannot see (rules, steps, decisions). Delete the scratch copy at the end.
5. Show per doc: lines before and after, the cut list, and "key ideas kept: N/N". Never report less than N/N: fix it first.
6. Check the docs: `node "${CLAUDE_PLUGIN_ROOT}/tools/check-docs.js" "<docs folder>" --code "<code folder>"`. Fix every hit and run it again until it prints `check-docs: 0 hits`. Then check every claim: `node "${CLAUDE_PLUGIN_ROOT}/tools/check-claims.js" "<docs folder>" --code "<code folder>"` (each backticked path, `name()`, constant and `--flag` must exist in the code). Fix each hit, or add a path that lives in another repo on purpose to `--ignore <path>,<path>`. Run it again until `check-claims: 0 hits`. Read only the lines these scripts flag, not whole docs.

## Finish

1. Rebuild only this doc set's map: `node "${CLAUDE_PLUGIN_ROOT}/src/brain.js" build-mk <name>`. Then `mk-status all`: the set must say `ok`, with the new `@<commit>`.
2. Run `/gabriel:update` (new doc folders, suggested eval cases).
3. Ask the user one question with three choices:
   - a. Skip retrain.
   - b. Retrain and keep the new weights only if the strict score does not fall: `/gabriel:retrain <name>`.
   - c. Retrain and replace the weights anyway, even if the strict score falls: `node "${CLAUDE_PLUGIN_ROOT}/src/retrain.js" <name> --force`.

   Do what they pick. Before you ask, say:
   - If the update suggested new cases (`eval-cases.suggested.json`), say so first: retrain uses only the saved `eval-cases.json`, so new sections count once the user reviews and saves the cases.
   - If the doc set has no `eval-cases.json` yet, retrain writes suggested cases and stops. Tell the user to review them, then retrain again.
   - Do not run the optional meaning-model fine-tune (`/gabriel:tune-embeddings`) here: it is slow and only on request.
4. Report as one table, one row per item: graph nodes (before, after, commit), each doc changed (lines before and after, key ideas kept N/N), doc checker result, retrain (skipped by choice, or current and new strict, kept or not, and which option ran). Then what was not checked.
5. **Record the check.** Last, after the docs are updated, run `node "${CLAUDE_PLUGIN_ROOT}/src/brain.js" docs-checked <name>`. It prints `docs checked for <name> at <sha>`. The drift warning uses this record.
