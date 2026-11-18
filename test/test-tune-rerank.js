'use strict';
// Smoke test for the reranker fine-tune (src/tune/train_rerank.py) and its ONNX export (export_onnx.py --kind rerank).
// Runs only when env GABRIEL_RERANK_SMOKE=1 and a tune venv exists. Venv: env GABRIEL_TUNE_VENV, else
// private/tune-venv-xpu-old, else private/tune-venv. Otherwise it prints a skip line and exits 0.
// Synthetic rows in a temp folder only. The base model comes from Hugging Face on the first run.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TUNE_DIR = path.join(ROOT, 'src', 'tune');

function venvPython() {
  const candidates = [];
  if (process.env.GABRIEL_TUNE_VENV) candidates.push(path.resolve(process.env.GABRIEL_TUNE_VENV));
  candidates.push(path.join(ROOT, 'private', 'tune-venv-xpu-old'));
  candidates.push(path.join(ROOT, 'private', 'tune-venv'));
  for (const venv of candidates) {
    const py = process.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');
    if (fs.existsSync(py)) return py;
  }
  return null;
}

if (process.env.GABRIEL_RERANK_SMOKE !== '1') {
  console.log('rerank smoke test skipped (set GABRIEL_RERANK_SMOKE=1)');
  process.exit(0);
}
const py = venvPython();
if (!py) {
  console.log('rerank smoke test skipped (no tune venv; run node src/setup.js --tune)');
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gabriel-rerank-smoke-'));
const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };

function run(label, args) {
  const started = Date.now();
  const r = spawnSync(py, args, { env, encoding: 'utf8', timeout: 60 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const out = (r.stdout || '') + (r.stderr || '');
  console.log(`--- ${label}: exit ${r.status}, ${seconds} s`);
  if (r.error) console.log(String(r.error));
  return { status: r.status, out };
}

try {
  // 200 synthetic (query, code text) rows: 1 positive and 2 negatives each
  const pairs = path.join(tmp, 'pairs.jsonl');
  const rows = [];
  for (let i = 0; i < 200; i++) {
    rows.push(JSON.stringify({
      q: `what does widget ${i} do`,
      pos: `widget ${i} handler | services widget`,
      negs: [`gadget ${i + 1000} loader | models gadget`, `sprocket ${i + 2000} reader | utils sprocket`],
      project: 'smoke',
    }));
  }
  fs.writeFileSync(pairs, rows.join('\n') + '\n', 'utf8');

  const modelDir = path.join(tmp, 'model-torch');
  const train = run('train_rerank.py', [
    path.join(TUNE_DIR, 'train_rerank.py'), '--pairs', pairs, '--out', modelDir,
    '--epochs', '1', '--device', 'cpu', '--batch', '16',
  ]);
  assert.strictEqual(train.status, 0, 'train_rerank.py must exit 0:\n' + train.out.slice(-3000));

  const exportDir = path.join(tmp, 'model');
  const exp = run('export_onnx.py --kind rerank', [
    path.join(TUNE_DIR, 'export_onnx.py'), '--kind', 'rerank', '--model', modelDir, '--out', exportDir,
  ]);
  assert.strictEqual(exp.status, 0, 'export_onnx.py --kind rerank must exit 0:\n' + exp.out.slice(-3000));

  const q8 = path.join(exportDir, 'onnx', 'model_quantized.onnx');
  assert.ok(fs.existsSync(q8), 'missing ' + q8);

  console.log('ALL PASSED');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
