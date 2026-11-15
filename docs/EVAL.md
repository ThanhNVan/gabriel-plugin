# Eval and training for a project

Each project has its own test questions and doc ranking, in its private folder `<data>/private/<name>/`.

## Case format

Cases live in `eval-cases.json`. It holds a list of cases. Each case is one object.

- `id`: a short id, like `E-1`. The part before the last `-` is the area.
- `q`: the question. Write it in your own words.
- `doc`: a regular expression for the doc file, like `cooking\.md$`.
- `sec`: a regular expression for the section heading. Optional.
- `code`: a regular expression for a code name. Optional.
- `any`: pass when the doc OR the code matches.
- `none`: the question is unrelated. The map must return nothing.
- `set`: a group name, like `dev` or `held`. Training uses sets.
- `tier`: `easy`, `middle` or `hard`. Optional.
- `project`: the project the question is about. No value means the default project.
- `fn`: a function name, like `parsePin`. Optional. With `file`, it makes an exact case.
- `file`: a regular expression for the code file, with forward slashes, like `pin\.js$`. Optional. Used with `fn`.

Matching ignores case.

## Suggest, review, save

1. Run `node eval/suggest-cases.js --project <name>`. It writes `eval-cases.suggested.json`, with one case per `##` or `###` section.
2. Rewrite each question in your own words. Do not copy the heading: a heading is too easy to match.
3. Save the file as `eval-cases.json`. The script never writes that file.

## Score the map

Run `node eval/eval-map.js --project <name>`. It runs every case and prints a summary.

- `--all` scores every project that has a cases file.
- `--route` lets the real router pick the project. An answer from another project counts as a miss. Add `--cwd <dir>` to route as if the prompt came from that folder (it uses `cwdHints`). A case can also set its own `"cwd"`.
- `--rank <file>` scores other weights, like a candidate file.
- `--chain <seeds>,<max>,<stem>` (for example `--chain 4,3,3`) tries the "two links away" step with these values. Without it, the project's `chain` setting is used (see [ADDING-DOCS](ADDING-DOCS.md), section 10).
- `--report` writes `notes/EVAL-MK.md` in the project's private folder.
- `--why` says why each miss missed. For each DOC or FAIL it prints `why <id> <class>`, then the counts. The classes:
  - `section-rank`: the right doc and section are in the candidates, but the map did not show them.
  - `not-in-pool`: the right doc is a candidate, but no candidate has the right section.
  - `wrong-doc`: the right doc is not a candidate at all.
  - `code-only-miss`: the doc and section are shown, but the expected code name is missing.
- `--no-repo` skips the exact lines from the repo folder. The map then shows the graph's own lines. Use it for the "before" run.
- `--fails` also prints an `exact-miss <id>` line for each failed `fn` case, with the reason.
- `--min 0.7` exits with 1 when the strict pass rate is under 70%, or when an unrelated question shows a map.
- The `block chars` line shows the size of the map text the hook would show: the average and the largest, over the questions that got a map. `second-set block for <k>/<m> questions` counts the questions whose result has a second project block (with `--route`; without it the line says `n/a`).

**Strict** means the right doc and the right section are in the map.
**Right doc or code** means the doc is right, but the section may not be.

**Exact** is scored only for cases with `fn`. A case is exact when its code line for `fn` shows the line where `fn` is defined in the repo folder on disk now. With no repo folder, no case is exact. The summary prints it as `exact: <k>/<n>`.

## Train the doc ranking

Run `node src/train-rank.js --project <name>` for the honest check. It prints the leave-one-area-out score.

- `--write` writes the project's rank file.
- `--out <file>` writes another file instead.
- `--train dev,held` trains on these sets only (default: `dev,held,fresh`).
- Excluded sets come from `excludeSets` in `<private>/<name>/train.json`. `--exclude-sets a,b` overrides it.

Training uses no random numbers. The same questions and model give the same weights.

Training needs the local meaning model. Without it, the script stops with a message.

## Retrain: keep the better weights

Run `node src/retrain.js <name>`. It does these steps:

1. Rebuilds the map.
2. Scores the current weights.
3. Trains new weights into a temp file.
4. Scores the new weights.
5. Keeps the new weights only when the strict count is not lower. No name means the default doc set. The old file is saved as `rank.prev.json` next to it. To go back, copy `rank.prev.json` over `rank.json`. If the new strict count is missing, the current weights stay. If only the old count is missing, the new weights are kept.

With `--force` (`node src/retrain.js <name> --force`), the run keeps the new weights even when the strict count falls. It prints a line saying so, and saves the old file as `rank.prev.json`.

It prints both scores. If there are no cases yet, it writes suggestions and stops.

## Why leave-one-area-out is the honest score

Training and testing on the same questions gives a score that is too high.
Leave-one-area-out trains on all areas but one. Then it tests on the area left out.
Every question is tested once, and never trained on. That is the score to trust for new questions.

## How to write good questions

- Use your own words. Do not copy a heading.
- Ask the way a user would, with a problem or a goal.
- Write some hard ones that describe a symptom, not the name of the thing.
- Add some unrelated questions with `none`. They catch wrong matches.
- Keep a new batch for the final check. Do not tune on it.

## Question index (optional)

The question index adds plain questions for each doc section. It helps a question find a section that uses other words.

1. Write `<data>/private/<name>/doc-questions.json`. Keys are doc keys from the map (they start with `d|`). Each key maps to a list of questions.
2. Run `node src/brain.js build-dq --project <name>`. It writes `dq.<name>.bin` and `dq.<name>.idx.json`.

The index is used in two ways:

- When a project has the index, its 15 closest sections join the candidate pool.
- A trained ranking (`rank.json`) can use the match as one signal.

Without these two files for a set, the map works without the index.
