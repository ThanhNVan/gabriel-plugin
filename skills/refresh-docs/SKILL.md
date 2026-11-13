---
name: refresh-docs
description: After code changes, refresh a project's code graph (graphify update), update the docs the change touches, then shrink those docs without losing a key idea, rebuild gabriel's map and retrain its ranking. Usage: /gabriel:refresh-docs <code folder> [docs folder]
disable-model-invocation: true
argument-hint: <code folder> [docs folder]
---

Arguments: `<code folder>` is the repo with `graphify-out/`. `[docs folder]` is the doc set to update; when it is left out, use the `root` of the gabriel doc set whose code graph is that folder (`projects.json`), else ask.

Work in four steps. Show % progress after each. Never commit or push: the user does that.

## 1. Refresh the graph

1. Check `graphify --help` works. If not, stop and suggest `/gabriel:setup --onboard` (it installs graphify).
2. Note the old commit and size of `graphify-out/graph.json` with a one-line script. Never read the file into the chat: it can be 90 MB. graphify writes `"built_at_commit": "<sha>"` as the last key, so the last 400 bytes hold the commit; the node count is `JSON.parse(...).nodes.length`.
3. Run `graphify update "<code folder>"`. It re-extracts code only and needs no model. It can take minutes: run it in the background and wait.
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

1. **Before**: write a key-idea list from the doc. One line per idea: each rule, step, decision, number, name, path, command, warning and diagram fact. Keep the list in your reply, not in the doc.
2. **Shrink**: shorter sentences, plain common words, one idea per sentence. Merge repeats, cut filler, turn long prose into short lists or a table when that is clearer. Keep code names, paths, commands, numbers and error text exactly. Keep every heading others link to (anchors).
3. **Cut over-detail** (the lean rules in `DOC-LAYOUT.md`): per-method or per-field text, copied code over 5 lines, line numbers, a fact repeated from the doc that owns it (replace it with a link), guesses, empty or "planned" sections. These are not key ideas: list each cut as `cut: <what>, <rule>` and show the list. Over the size limit (300 lines, a workflow page 120): split the doc.
4. **After**: check each key idea against the new text. Every line must still be there, said plainly, or moved to the doc that owns it and linked. Put back any that is missing.
5. Show per doc: lines before and after, the cut list, and "key ideas kept: N/N". Never report less than N/N: fix it first.

## Finish

1. Run `/gabriel:update` so gabriel rebuilds the maps for the changed docs (it would also happen on its own in the background). Wait for it to finish.
2. Retrain the doc set's ranking: `/gabriel:retrain <name>`. It scores the current weights, trains new ones, and keeps them only when the strict score does not fall.
   - If the update suggested new cases (`eval-cases.suggested.json`), say so first: retrain uses only the saved `eval-cases.json`, so new sections count once the user reviews and saves the cases.
   - If the doc set has no `eval-cases.json` yet, retrain writes suggested cases and stops. Tell the user to review them, then run `/gabriel:retrain <name>`.
   - Do not run the optional meaning-model fine-tune (`/gabriel:tune-embeddings`) here: it is slow and only on request.
3. Report: graph counts, docs changed, lines before and after, key ideas kept, retrain scores (current and new strict, kept or not), and what was not checked.
