"""Export a trained sentence-transformers model to ONNX and quantize it to 8 bit.

python export_onnx.py --model <trained dir> --out <dir>

--model: a sentence-transformers save. Its transformer files sit at the root (older saves)
         or in a *_Transformer folder such as 0_Transformer (newer saves).
--out:   gets onnx/model.onnx (float), onnx/model_quantized.onnx (8 bit), config.json and the
         tokenizer files. Same file names as the base model (Xenova/all-MiniLM-L6-v2).
"""
import argparse
import json
import sys
from pathlib import Path

INPUTS = ["input_ids", "attention_mask", "token_type_ids"]


def find_transformer_dir(model: Path) -> Path:
    if (model / "config.json").is_file():
        return model
    modules = model / "modules.json"
    if modules.is_file():
        for m in json.loads(modules.read_text(encoding="utf-8")):
            if m.get("type", "").endswith("Transformer"):
                d = model / m.get("path", "")
                if (d / "config.json").is_file():
                    return d
    for d in sorted(model.glob("*_Transformer")):
        if (d / "config.json").is_file():
            return d
    sys.exit(f"no transformer files in {model}: no config.json at the root or in a *_Transformer folder")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    import numpy as np
    import onnxruntime as ort
    import torch
    from onnxruntime.quantization import QuantType, quantize_dynamic
    from transformers import AutoModel, AutoTokenizer

    model_dir = find_transformer_dir(Path(args.model).resolve())
    out = Path(args.out).resolve()
    onnx_dir = out / "onnx"
    onnx_dir.mkdir(parents=True, exist_ok=True)
    fp32 = onnx_dir / "model.onnx"
    q8 = onnx_dir / "model_quantized.onnx"

    print(f"step 1/5 load the trained model from {model_dir}", flush=True)
    tok = AutoTokenizer.from_pretrained(model_dir)
    net = AutoModel.from_pretrained(model_dir, attn_implementation="eager").eval()

    class Encoder(torch.nn.Module):
        """Only the transformer: the model output is last_hidden_state (pooling is done in the JS side)."""
        def __init__(self, inner):
            super().__init__()
            self.inner = inner

        def forward(self, input_ids, attention_mask, token_type_ids):
            return self.inner(input_ids=input_ids, attention_mask=attention_mask,
                              token_type_ids=token_type_ids).last_hidden_state

    # reference output from torch, taken before the export runs (the export traces the model)
    sample = tok(["hello world", "a longer sentence to check padding"], return_tensors="pt", padding=True)
    feed = {k: sample[k].numpy() for k in INPUTS if k in sample}
    if "token_type_ids" not in feed:
        feed["token_type_ids"] = np.zeros_like(feed["input_ids"])
    with torch.no_grad():
        ref = Encoder(net)(*[torch.from_numpy(feed[k]) for k in INPUTS]).numpy()

    print("step 2/5 export to ONNX (torch.onnx, legacy exporter, opset 17)", flush=True)
    enc = tok("hello world", return_tensors="pt")
    dummy = tuple(enc[k] if k in enc else torch.zeros_like(enc["input_ids"]) for k in INPUTS)
    dyn = {k: {0: "batch", 1: "sequence"} for k in INPUTS + ["last_hidden_state"]}
    with torch.no_grad():
        torch.onnx.export(
            Encoder(net), dummy, str(fp32),
            input_names=INPUTS, output_names=["last_hidden_state"], dynamic_axes=dyn,
            opset_version=17, do_constant_folding=True, dynamo=False,
        )
    print(f"  wrote {fp32} ({fp32.stat().st_size / 1048576:.1f} MB)", flush=True)

    print("step 3/5 quantize to 8 bit (onnxruntime dynamic, QInt8)", flush=True)
    quantize_dynamic(str(fp32), str(q8), weight_type=QuantType.QInt8)
    print(f"  wrote {q8} ({q8.stat().st_size / 1048576:.1f} MB)", flush=True)

    print("step 4/5 save tokenizer and config", flush=True)
    tok.save_pretrained(out)
    net.config.save_pretrained(out)
    print(f"  saved to {out}", flush=True)

    print("step 5/5 check: onnxruntime output vs torch output", flush=True)
    sess = ort.InferenceSession(str(fp32), providers=["CPUExecutionProvider"])
    got = sess.run(None, feed)[0]
    diff = float(np.abs(ref - got).max())
    print(f"  float model max abs diff vs torch: {diff:.6f} (shape {tuple(got.shape)})", flush=True)
    if got.shape != ref.shape or not np.isfinite(got).all() or diff > 1e-2:
        sys.exit(f"check failed: shape {got.shape} vs {ref.shape}, max diff {diff}")

    print(f"ONNX_OK {q8} {q8.stat().st_size / 1048576:.1f}", flush=True)


if __name__ == "__main__":
    main()
