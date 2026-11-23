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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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
    p.add_argument("--hard-negs", type=int, default=0, help="hard negatives per pair, mined from the other positives (0 = none)")
    p.add_argument("--mine-top", type=int, default=100, help="top-N candidates to draw hard negatives from")
    p.add_argument("--limit", type=int, default=0, help="keep only the first N pairs (0 = all)")
    p.add_argument("--stages", type=int, choices=[1, 2], default=1,
                   help="1 = train on the pairs; 2 = train, mine hard negatives with that model, train again (needs --hard-negs >= 1)")
    p.add_argument("--ce-filter", default=None, metavar="MODEL",
                   help="drop hard negatives a cross-encoder scores above the positive (needs --hard-negs >= 1)")
    p.add_argument("--ce-margin", type=float, default=0.0, help="a candidate must score at most positive minus this margin to be kept")
    p.add_argument("--loss", choices=["mnrl", "cached", "margin-mse"], default="mnrl",
                   help="mnrl = MultipleNegativesRankingLoss; cached = CachedMultipleNegativesRankingLoss (less memory); margin-mse = distill from a cross-encoder")
    p.add_argument("--mini-batch", type=int, default=32, help="mini-batch size for --loss cached")
    p.add_argument("--ce-model", default="cross-encoder/ms-marco-MiniLM-L6-v2", help="cross-encoder that scores the margins for --loss margin-mse")
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


def build_data(anchors, positives, negs, k):
    """Keep the rows that got k hard negatives. Returns the dataset dict, or None if no row did."""
    keep_rows = [r for r in range(len(anchors)) if len(negs[r]) == k]
    if not keep_rows:
        return None
    data = {"anchor": [anchors[r] for r in keep_rows], "positive": [positives[r] for r in keep_rows]}
    for i in range(k):
        data[f"negative_{i + 1}"] = [negs[r][i] for r in keep_rows]
    return data


def final_loss_of(trainer):
    final_loss = None
    for row in trainer.state.log_history:
        if "loss" in row:
            final_loss = row["loss"]
    return final_loss


def main(argv=None):
    args = parse_args(argv)
    if args.stages == 2 and args.hard_negs < 1:
        print("--stages 2 needs --hard-negs", file=sys.stderr)
        return 2
    if args.ce_filter and args.hard_negs < 1:
        print("--ce-filter needs --hard-negs", file=sys.stderr)
        return 2
    if args.loss == "margin-mse" and args.hard_negs != 1:
        print("--loss margin-mse needs --hard-negs 1", file=sys.stderr)
        return 2

    # heavy imports are here, so --help stays quick
    from datasets import Dataset
    from sentence_transformers import SentenceTransformer, SentenceTransformerTrainer, SentenceTransformerTrainingArguments
    from sentence_transformers.losses import CachedMultipleNegativesRankingLoss, MarginMSELoss, MultipleNegativesRankingLoss
    from transformers import TrainerCallback
    from hard_negs import ce_keep, ce_margins

    anchors, positives = read_pairs(os.path.join(args.pairs, "pairs.train.jsonl"))
    if args.limit > 0:
        anchors, positives = anchors[:args.limit], positives[:args.limit]
    if not anchors:
        print("no training pairs in " + args.pairs, file=sys.stderr)
        return 1
    print(f"pairs: {len(anchors)}", flush=True)
    keep = ce_keep(args.ce_filter, args.ce_margin, total_rows=len(anchors)) if args.ce_filter else None

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

    def train_once(data):
        if "label" in data:
            loss = MarginMSELoss(model)
        elif args.loss == "cached":
            loss = CachedMultipleNegativesRankingLoss(model, mini_batch_size=args.mini_batch)
        else:
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
            trainer = SentenceTransformerTrainer(model=model, args=targs, train_dataset=Dataset.from_dict(data), loss=loss, callbacks=[Progress()])
            trainer.train()
        finally:
            shutil.rmtree(work, ignore_errors=True)
        return trainer

    def mined_data():
        from hard_negs import mine
        negs = mine(model, anchors, positives, args.hard_negs, args.mine_top, args.seed, keep=keep)
        data = build_data(anchors, positives, negs, args.hard_negs)
        if data is None:
            print("no row got enough hard negatives", file=sys.stderr)
            return None
        print(f"hard negatives: kept {len(data['anchor'])}/{len(anchors)} rows", flush=True)
        if args.loss == "margin-mse":
            data["label"] = ce_margins(args.ce_model, data["anchor"], data["positive"], data["negative_1"])
        return data

    plain = {"anchor": anchors, "positive": positives}
    stage_losses = []
    if args.stages == 1:
        data = plain
        if args.hard_negs > 0:
            data = mined_data()
            if data is None:
                return 1
        trainer = train_once(data)
        stage_losses.append(final_loss_of(trainer))
    else:
        print("stage 1/2", flush=True)
        trainer = train_once(plain)
        stage_losses.append(final_loss_of(trainer))
        print("stage 2/2", flush=True)
        data = mined_data()
        if data is None:
            return 1
        trainer = train_once(data)
        stage_losses.append(final_loss_of(trainer))

    model.save(args.out)
    final_loss = stage_losses[-1]
    seconds = round(time.time() - started, 1)
    log = {
        "pairs": len(data["anchor"]), "seconds": seconds, "final_loss": final_loss,
        "stages": args.stages, "stage_losses": stage_losses,
        "base": args.base, "epochs": args.epochs, "batch": args.batch, "lr": args.lr, "warmup": args.warmup, "seed": args.seed,
        "hard_negs": args.hard_negs, "mine_top": args.mine_top, "limit": args.limit,
        "ce_filter": args.ce_filter, "ce_margin": args.ce_margin if keep else None,
        "ce_dropped": keep.dropped if keep else 0, "ce_scored": keep.scored if keep else 0,
        "loss": args.loss, "mini_batch": args.mini_batch,
        "ce_model": args.ce_model if args.loss == "margin-mse" else None,
    }
    with open(os.path.join(args.out, "train-log.json"), "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)
    print(f"saved model to {args.out} (final loss {final_loss}, {seconds} s)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
