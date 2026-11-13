# Tuning the meaning model (optional)

This step teaches the small meaning model your own words.
It learns from your eval questions and your doc sections.
It is optional. gabriel works well without it.

Everything runs on your PC. Nothing you write leaves the machine.
The only downloads are the Python packages and the base model, which the training step fetches once.

## What it does

1. Makes training pairs. Each eval question is paired with the doc section that answers it.
2. Trains the model on those pairs, on the CPU.
3. Exports the trained model to ONNX with torch.onnx, then makes it smaller (8-bit) with onnxruntime quantization.
4. Scores the old model and the new one on a copy of your data.
5. Keeps the new model only if the scores pass the keep rule. Otherwise it rolls back.

## What you need

- Python 3.10 or newer.
- A CPU build of torch. Install it from the CPU index, not the default build. The default build is much bigger.
- The packages in `src/tune/requirements.txt`.
- Disk space for the packages and a copy of your maps. The download size is measured in your setup run.
- At least 50 reviewed eval questions in one or more projects. See `docs/EVAL.md`.

Set up the packages once:

```
node src/setup.js --tune
```

This is the only setup step that installs the Python packages. A normal setup does not.
It finds Python, makes a venv in your data folder (`<data>/tune-venv`), and installs the packages.
Add `--dry-run` to see the steps first. The last line says the packages are ready and how big they are.

Manual steps, if you want them:

```
python -m venv <venv>
<venv>\Scripts\python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
<venv>\Scripts\python -m pip install -r src\tune\requirements.txt
```

## Run it

```
node src/tune/tune.js --yes
```

The venv defaults to `<data>/tune-venv`. If it is missing, the run stops and tells you to run `node src/setup.js --tune`.
Use `--venv <dir>` to pick another venv.

Or run `/gabriel:tune-embeddings` in Claude Code.

The run prints one progress line per step, like `[###---] 40% step 3/5`. It stops at the first failure.

## Why 50 or more reviewed cases

Fewer cases give a noisy score. A few lucky answers can flip the result.
The export refuses to train with fewer than 50 pairs.
The message says how many cases you have. Add or review more questions in `eval-cases.json`.

## Why split by file

The held-out questions must be about doc files the model never saw in training.
Otherwise the score is too kind. The split is random but fixed by a seed (default 42).
It puts about 20% of the doc files in the held-out set.
Each file is on one side only, so no section from a held-out file reaches training.

## The keep rule

The tuned model is kept only when all four hold:

- The held-out total goes up. It must be strictly higher.
- No project's held-out score falls by more than 1.
- The full strict score is not lower.
- The quiet score (unrelated questions) is not lower.

A run prints a before and after table, and the reason when it rolls back.

## Scores run on a copy

A model change re-embeds every map. That takes time and changes the numbers.
So the run copies the maps, the vectors and the private files into a work folder.
It builds the maps and scores there. Your real maps stay as they are until the decision.
Maps and models are linked, not copied, where the volume allows it. Files that get written are copied.

## Keep and rollback

- Keep: the model is copied to `<data>/models/local/gabriel-tuned`. `projects.json` gets `"embedModel": "local/gabriel-tuned"`. The other keys do not change.
  The next prompt rebuilds each map once, in the background. The question index is rebuilt now.
- Roll back after a bad score: the real model folder is removed (it is normally not there). `projects.json` is not changed.
- `--rollback`: removes `embedModel` from `projects.json`. Use it to go back to the default model.
  The next prompt rebuilds each map once with the default model.

A run refuses to start while `projects.json` still sets `embedModel`. Run `--rollback` first.

## Privacy

- The pairs, the scores and the model stay in your data folder.
- Nothing is sent to a server. There is no telemetry.
- The network is used only by pip (the packages) and by the base model download in the training step.

## Limits

- The training step only learns from your eval questions. Write them in your own words.
- The doc vectors in the map use the full chunk text. The training pairs use the first 300 characters, like the hook does for its vectors. A small mismatch.
- Training on a CPU can take a long time. The time depends on the number of pairs and your CPU.
