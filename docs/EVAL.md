# Eval and training for a project

Each project has its own test questions and its own doc ranking.
All files for one project sit in its private folder: `<data>/private/<name>/`.

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

Matching ignores case.

## Suggest, review, save

1. Run `node eval/suggest-cases.js --project <name>`. It writes `eval-cases.suggested.json`, with one case per `##` or `###` section.
2. Review the file. Rewrite each question in your own words.
3. Do not copy the heading. A heading as the question is too easy to match.
4. Save the file as `eval-cases.json`. The script never writes that file.

## Score the map

Run `node eval/eval-map.js --project <name>`. It runs every case and prints a summary.

- `--all` scores every project that has a cases file.
- `--rank <file>` scores other weights, like a candidate file.
- `--report` writes `notes/EVAL-MK.md` in the project's private folder.
- `--min 0.7` exits with 1 when the strict score is under 70%.

**Strict** means the right doc and the right section are in the map.
**Right doc or code** means the doc is right, but the section may not be.

## Train the doc ranking

Run `node src/train-rank.js --project <name>` for the honest check. It prints the leave-one-area-out score.

- `--write` writes the project's rank file.
- `--out <file>` writes another file instead.
- `--train dev,held` trains on these sets only.
- Excluded sets come from `excludeSets` in `<private>/<name>/train.json`. `--exclude-sets a,b` overrides it.

Training uses no random numbers. The same questions and model give the same weights.

Training needs the local meaning model. Without it, the script stops with a message.

## Retrain: keep the better weights

Run `node src/retrain.js <name>`. It does these steps:

1. Rebuilds the map.
2. Scores the current weights.
3. Trains new weights into a temp file.
4. Scores the new weights.
5. Keeps the new weights only when the strict count is not lower. With no name (the default project), it always keeps the new weights, and saves the old file as `rank.prev.json` next to it. To go back, copy `rank.prev.json` over `rank.json`.

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

The rescue step is off. It lets a strong match pass the gate alone, but its threshold is 9 (`Q_GATE` in `src/mk.js`), and a meaning score cannot reach 9. Nothing sets a lower value, so the rescue never fires.

Without these two files for a set, the map works without the index.
