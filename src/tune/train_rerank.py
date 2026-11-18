#!/usr/bin/env python3
"""Fine-tune a cross-encoder reranker on (question, code text) pairs. Optional. Runs on this PC only.

python train_rerank.py --pairs <jsonl> --out <dir> [--base cross-encoder/ms-marco-MiniLM-L6-v2]
                       [--epochs 1] [--batch 32] [--device auto] [--limit N]

Reads one JSON object per line: {"q": ..., "pos": ..., "negs": [...], "project": ...}.
Each row gives (q, pos, 1.0) and (q, neg, 0.0) for every neg. --limit N keeps the first N rows (smoke tests).
Writes the model to --out, and <out>/train-log.json (rows, pairs, epochs, batch, device, seconds, final_loss, base).
Needs sentence-transformers >= 4 (CrossEncoderTrainer API). Installed version: 6.3.0 in private/tune-venv-xpu-old.
"""
import argparse
import json
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train import pick_device, progress_line  # noqa: E402  (same folder)


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Fine-tune a cross-encoder reranker on question and code pairs.")
    p.add_argument("--pairs", required=True, help="jsonl file with q, pos, negs rows")
    p.add_argument("--out", required=True, help="folder for the trained model")
    p.add_argument("--base", default="cross-encoder/ms-marco-MiniLM-L6-v2", help="model to start from")
    p.add_argument("--epochs", type=int, default=1)
    p.add_argument("--batch", type=int, default=32)
    p.add_argument("--device", default="auto", help="auto (Intel xpu, then cuda, then cpu), xpu, cuda or cpu")
    p.add_argument("--limit", type=int, default=0, help="use only the first N input rows (0 = all)")
    return p.parse_args(argv)


def read_examples(path, limit):
    """Expand each row into (query, text, label) examples. Returns (rows_read, queries, texts, labels)."""
    queries, texts, labels = [], [], []
    rows = 0
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            if limit and rows >= limit:
                break
            row = json.loads(line)
            rows += 1
            queries.append(row["q"])
            texts.append(row["pos"])
            labels.append(1.0)
            for neg in row.get("negs", []):
                queries.append(row["q"])
                texts.append(neg)
                labels.append(0.0)
    return rows, queries, texts, labels


def main(argv=None):
    args = parse_args(argv)

    # heavy imports are here, so --help stays quick
    from datasets import Dataset
    from sentence_transformers.cross_encoder import CrossEncoder, CrossEncoderTrainer, CrossEncoderTrainingArguments
    from sentence_transformers.cross_encoder.losses import BinaryCrossEntropyLoss
    from transformers import TrainerCallback
    import torch

    rows, queries, texts, labels = read_examples(args.pairs, args.limit)
    if not labels:
        print("no training rows in " + args.pairs, file=sys.stderr)
        return 1
    print(f"rows: {rows}, pairs: {len(labels)}", flush=True)

    class Progress(TrainerCallback):
        def __init__(self):
            self.bucket = -1

        def on_step_end(self, targs, state, control, **kwargs):
            total = state.max_steps or 1
            pct = int(100 * state.global_step / total)
            if pct // 5 != self.bucket:   # a line about every 5 percent
                self.bucket = pct // 5
                print(progress_line(pct, state.global_step, total), flush=True)
            return control

    device = pick_device(args.device)
    print(f"device: {device}", flush=True)
    torch.manual_seed(42)
    started = time.time()
    os.makedirs(args.out, exist_ok=True)
    model = CrossEncoder(args.base, num_labels=1, device=device, max_length=256)   # same cut as src/rerank.js (max_length 256)
    train_ds = Dataset.from_dict({"query": queries, "response": texts, "label": labels})
    loss = BinaryCrossEntropyLoss(model)
    work = tempfile.mkdtemp(prefix="gabriel-rerank-", dir=args.out)
    try:
        targs = CrossEncoderTrainingArguments(
            output_dir=work,
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch,
            seed=42,
            use_cpu=(device == "cpu"),
            save_strategy="no",
            logging_steps=10,
            report_to="none",
            disable_tqdm=True,
        )
        trainer = CrossEncoderTrainer(model=model, args=targs, train_dataset=train_ds, loss=loss, callbacks=[Progress()])
        trainer.train()
    finally:
        shutil.rmtree(work, ignore_errors=True)

    model.save_pretrained(args.out)
    final_loss = None
    for row in trainer.state.log_history:
        if "loss" in row:
            final_loss = row["loss"]
    seconds = round(time.time() - started, 1)
    log = {
        "rows": rows, "pairs": len(labels), "epochs": args.epochs, "batch": args.batch, "device": device,
        "seconds": seconds, "final_loss": final_loss, "base": args.base,
    }
    with open(os.path.join(args.out, "train-log.json"), "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)
    print(f"saved model to {args.out} (final loss {final_loss}, {seconds} s)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
