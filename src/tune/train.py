#!/usr/bin/env python3
"""Fine-tune the sentence model on the training pairs. Optional. Runs on this PC only (CPU).

Setup: Python 3.10+, then the packages in src/tune/requirements.txt (torch first, from the CPU index).
tune.js runs this for you. To run it by hand:
  python train.py --base sentence-transformers/all-MiniLM-L6-v2 --pairs <dir> --out <dir>

Reads <pairs>/pairs.train.jsonl (one JSON object per line with "anchor" and "positive").
Writes the trained model to --out, and <out>/train-log.json (pairs, seconds, final loss).
"""
import argparse
import json
import os
import shutil
import sys
import tempfile
import time

BAR_WIDTH = 20


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Fine-tune a sentence model on question and section pairs (CPU).")
    p.add_argument("--base", default="sentence-transformers/all-MiniLM-L6-v2", help="model to start from")
    p.add_argument("--pairs", required=True, help="folder with pairs.train.jsonl")
    p.add_argument("--out", required=True, help="folder for the trained model")
    p.add_argument("--epochs", type=int, default=2)
    p.add_argument("--batch", type=int, default=32)
    p.add_argument("--lr", type=float, default=2e-5)
    p.add_argument("--warmup", type=float, default=0.1, help="share of steps used to warm up the learning rate")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--device", default="auto", help="auto (Intel xpu, then cuda, then cpu), xpu, cuda or cpu")
    return p.parse_args(argv)


def read_pairs(path):
    anchors, positives = [], []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                row = json.loads(line)
                anchors.append(row["anchor"])
                positives.append(row["positive"])
    return anchors, positives


def pick_device(want):
    """The torch device to train on: the one asked for, or with "auto" the first that works (Intel xpu, cuda, cpu)."""
    if want != "auto":
        return want
    try:
        import torch
        if hasattr(torch, "xpu") and torch.xpu.is_available():
            return "xpu"
        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    return "cpu"


def xpu_safe_loss(model):
    """MultipleNegativesRankingLoss with its default settings, without s[i, j] indexing.
    On Intel GPUs (torch 2.15 xpu) that indexing crashes the device (UR_RESULT_ERROR_DEVICE_LOST).
    Same math: cross entropy over scale * cos_sim(anchor, positive), right answer on the diagonal."""
    import torch
    import torch.nn.functional as F
    from sentence_transformers.losses import MultipleNegativesRankingLoss

    class XpuSafeMNRL(MultipleNegativesRankingLoss):
        def compute_loss_from_embeddings(self, embeddings, labels):
            scores = self.similarity_fct(embeddings[0], torch.cat(embeddings[1:], dim=0)) * self.scale
            return F.cross_entropy(scores, torch.arange(scores.size(0), device=scores.device))

    return XpuSafeMNRL(model)


def progress_line(pct, step, total):
    filled = int(BAR_WIDTH * pct / 100)
    return f"[{'#' * filled}{'-' * (BAR_WIDTH - filled)}] {pct}% step {step}/{total}"


def main(argv=None):
    args = parse_args(argv)

    # heavy imports are here, so --help stays quick
    from datasets import Dataset
    from sentence_transformers import SentenceTransformer, SentenceTransformerTrainer, SentenceTransformerTrainingArguments
    from sentence_transformers.losses import MultipleNegativesRankingLoss
    from transformers import TrainerCallback

    anchors, positives = read_pairs(os.path.join(args.pairs, "pairs.train.jsonl"))
    if not anchors:
        print("no training pairs in " + args.pairs, file=sys.stderr)
        return 1
    print(f"pairs: {len(anchors)}", flush=True)

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
    started = time.time()
    os.makedirs(args.out, exist_ok=True)
    model = SentenceTransformer(args.base, device=device)
    train_ds = Dataset.from_dict({"anchor": anchors, "positive": positives})
    loss = xpu_safe_loss(model) if device == "xpu" else MultipleNegativesRankingLoss(model)
    work = tempfile.mkdtemp(prefix="gabriel-train-", dir=args.out)
    try:
        targs = SentenceTransformerTrainingArguments(
            output_dir=work,
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch,
            learning_rate=args.lr,
            warmup_ratio=args.warmup,
            seed=args.seed,
            use_cpu=(device == "cpu"),
            save_strategy="no",
            logging_steps=10,
            report_to="none",
        )
        trainer = SentenceTransformerTrainer(model=model, args=targs, train_dataset=train_ds, loss=loss, callbacks=[Progress()])
        trainer.train()
    finally:
        shutil.rmtree(work, ignore_errors=True)

    model.save(args.out)
    final_loss = None
    for row in trainer.state.log_history:
        if "loss" in row:
            final_loss = row["loss"]
    seconds = round(time.time() - started, 1)
    log = {
        "pairs": len(anchors), "seconds": seconds, "final_loss": final_loss,
        "base": args.base, "epochs": args.epochs, "batch": args.batch, "lr": args.lr, "warmup": args.warmup, "seed": args.seed,
    }
    with open(os.path.join(args.out, "train-log.json"), "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)
    print(f"saved model to {args.out} (final loss {final_loss}, {seconds} s)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
