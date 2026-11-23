#!/usr/bin/env python3
"""Hard negative mining for the tune step. Picks texts that look like the positive but are wrong.

Run the self-test (no model needed):
  python hard_negs.py --self-test
"""
import random
import sys

import numpy as np

CHUNK = 256


def pick(sims, corpus, pos_ids, k, top, rng, keep=None, anchors=None, positives=None):
    """For each row: the top `top` corpus ids by sims, minus the row's positives, shuffled, then up to k unique texts."""
    out = []
    for r in range(len(sims)):
        s = np.asarray(sims[r])
        if top < len(s):
            part = np.argpartition(-s, top - 1)[:top]
        else:
            part = np.arange(len(s))
        order = part[np.argsort(-s[part], kind="stable")]
        banned = set(pos_ids[r])
        cands = [int(i) for i in order if int(i) not in banned]
        rng.shuffle(cands)
        # keep() costs one model call per candidate, so filter in small chunks and stop once k texts are kept
        size = max(k * 4, 8) if keep is not None else max(len(cands), 1)
        texts = []
        for start in range(0, len(cands), size):
            group = cands[start:start + size]
            if keep is not None:
                mask = keep(anchors[r], positives[r], [corpus[i] for i in group])
                group = [c for c, m in zip(group, mask) if m]
            for i in group:
                if corpus[i] not in texts:
                    texts.append(corpus[i])
                if len(texts) == k:
                    break
            if len(texts) == k:
                break
        out.append(texts)
    return out


def ce_keep(ce_model_id, margin=0.0, batch=64, total_rows=None):
    """Cross-encoder filter for pick(). Drops a candidate that scores above the positive minus margin.
    Loads the model on the first call. keep.dropped and keep.scored count the work done."""
    state = {"model": None, "rows": 0, "bucket": -1}

    def keep(anchor, pos, cands):
        if state["model"] is None:
            from sentence_transformers import CrossEncoder
            state["model"] = CrossEncoder(ce_model_id)
        pairs = [(anchor, pos)] + [(anchor, c) for c in cands]
        scores = [float(s) for s in state["model"].predict(pairs, batch_size=batch, convert_to_numpy=True)]
        mask = [s <= scores[0] - margin for s in scores[1:]]
        keep.scored += len(pairs)
        keep.dropped += mask.count(False)
        state["rows"] += 1
        if total_rows:
            pct = int(100 * state["rows"] / total_rows)
            if pct // 10 > state["bucket"] or state["rows"] == total_rows:
                state["bucket"] = pct // 10
                print(f"ce-filter {state['rows']}/{total_rows} ({pct}%)", flush=True)
        return mask

    keep.dropped = 0
    keep.scored = 0
    return keep


def ce_margins(ce_model_id, anchors, positives, negatives, batch=64):
    """Cross-encoder margin per row: score(anchor, positive) minus score(anchor, negative). Used as the label for margin-mse."""
    from sentence_transformers import CrossEncoder
    ce = CrossEncoder(ce_model_id)
    total = len(anchors)
    out = []
    bucket = -1
    for start in range(0, total, 512):
        end = min(start + 512, total)
        n = end - start
        pairs = list(zip(anchors[start:end], positives[start:end])) + list(zip(anchors[start:end], negatives[start:end]))
        s = ce.predict(pairs, batch_size=batch, convert_to_numpy=True)
        out += [float(x) for x in (s[:n] - s[n:])]
        pct = int(100 * end / total)
        if pct // 10 > bucket or end == total:
            bucket = pct // 10
            print(f"ce-margin {end}/{total} ({pct}%)", flush=True)
    return out


def _pos_ids(anchors, positives, corpus):
    """For each row: the corpus ids of ALL positives that share the row's anchor text."""
    index = {t: i for i, t in enumerate(corpus)}
    by_anchor = {}
    for a, p in zip(anchors, positives):
        by_anchor.setdefault(a, set()).add(index[p])
    return [sorted(by_anchor[a]) for a in anchors]


def mine(model, anchors, positives, k, top=100, seed=42, keep=None):
    """Hard negatives for each anchor row, from the other positives in the set. Returns one list of texts per row."""
    corpus = list(dict.fromkeys(positives))
    pos_ids = _pos_ids(anchors, positives, corpus)
    total = len(anchors)
    if total == 0:
        return []
    enc = dict(batch_size=64, normalize_embeddings=True, convert_to_numpy=True)
    a_emb = model.encode(anchors, **enc)
    c_emb = model.encode(corpus, **enc)
    rng = random.Random(seed)
    out = []
    last_bucket = -1
    for start in range(0, total, CHUNK):
        end = min(start + CHUNK, total)
        sims = a_emb[start:end] @ c_emb.T
        out += pick(sims, corpus, pos_ids[start:end], k, top, rng,
                    keep=keep, anchors=anchors[start:end], positives=positives[start:end])
        pct = int(100 * end / total)
        if pct // 10 > last_bucket or end == total:
            last_bucket = pct // 10
            print(f"mine {end}/{total} ({pct}%)", flush=True)
    return out


def self_test():
    corpus = ["p0", "p1", "p2", "p3"]

    def test_basic():
        sims = np.array([[0.9, 0.8, 0.1, 0.7], [0.2, 0.95, 0.6, 0.5], [0.3, 0.4, 0.85, 0.9]])
        pos_ids = [[0], [1], [2]]
        out = pick(sims, corpus, pos_ids, 1, 100, random.Random(42))
        assert len(out) == 3
        for r, row in enumerate(out):
            assert len(row) == 1
            assert row[0] in corpus
            assert row[0] != corpus[r]
        assert out == [["p3"], ["p0"], ["p1"]]

    def test_same_anchor_two_positives():
        assert _pos_ids(["a", "a"], ["p1", "p2"], corpus) == [[1, 2], [1, 2]]
        sims = np.array([[0.9, 0.95, 0.92, 0.1], [0.9, 0.95, 0.92, 0.1]])
        pos_ids = [[1, 2], [1, 2]]
        for seed in range(21):
            out = pick(sims, corpus, pos_ids, 1, 100, random.Random(seed))
            for row in out:
                assert "p1" not in row and "p2" not in row

    def test_tiny_corpus():
        sims = np.array([[0.1, 0.9]])
        out = pick(sims, ["p0", "p1"], [[0]], 5, 100, random.Random(42))
        assert out == [["p1"]]

    def test_keep_hook():
        sims = np.array([[0.9, 0.8, 0.7, 0.6]])

        def keep(anchor, pos, cands):
            return [c != "p3" for c in cands]

        out = pick(sims, corpus, [[0]], 3, 100, random.Random(42), keep=keep, anchors=["a"], positives=["p0"])
        assert "p3" not in out[0]

    def test_keep_chunks():
        big = [f"c{i}" for i in range(20)]
        sims = np.arange(20, dtype=float)[None, :]
        calls = []

        def keep(anchor, pos, cands):
            calls.append(len(cands))
            return [True] * len(cands)

        out = pick(sims, big, [[]], 1, 100, random.Random(42), keep=keep, anchors=["a"], positives=["p"])
        assert len(out[0]) == 1
        assert calls == [8], f"keep calls {calls}"

    tests = [test_basic, test_same_anchor_two_positives, test_tiny_corpus, test_keep_hook, test_keep_chunks]
    for t in tests:
        t()
    return len(tests)


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        try:
            n = self_test()
        except AssertionError as e:
            print(f"self-test FAIL: assertion {e!r}", flush=True)
            sys.exit(1)
        print(f"self-test: {n}/{n} ok", flush=True)
        sys.exit(0)
    print("usage: hard_negs.py --self-test", file=sys.stderr)
    sys.exit(2)
