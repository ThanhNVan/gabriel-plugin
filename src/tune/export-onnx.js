// Export a trained sentence model to ONNX and quantize it (8-bit), so the local meaning model can load it.
//   node src/tune/export-onnx.js --model <trained dir> --out <modelsDir>/local/gabriel-tuned --venv <venv>
// Runs src/tune/export_onnx.py with the venv Python (torch.onnx export, then onnxruntime quantization).
// Writes <out>/onnx/model_quantized.onnx and the config and tokenizer files next to it.
// Not run by the tests (it needs the venv and takes a while).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TOKEN_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json'];
const SCRIPT = path.join(__dirname, 'export_onnx.py');

function venvPython(venv) {
  const exe = process.platform === 'win32'
    ? path.join(venv, 'Scripts', 'python.exe')
    : path.join(venv, 'bin', 'python');
  if (!fs.existsSync(exe)) throw new Error(`python not found at ${exe}: run node src/setup.js --tune first`);
  return exe;
}

function exportOnnx({ model, out, venv }) {
  const py = venvPython(venv);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gabriel-onnx-'));
  try {
    console.log(`export: ${py} ${SCRIPT} --model ${model} --out <temp>`);
    const r = spawnSync(py, [SCRIPT, '--model', model, '--out', tmp], { stdio: 'inherit', windowsHide: true });
    if (r.error || r.status !== 0) throw new Error(`export failed${r.status != null ? ` (exit ${r.status})` : ''}${r.error ? ` (${r.error.message})` : ''}`);

    const q = path.join(tmp, 'onnx', 'model_quantized.onnx');
    if (!fs.existsSync(q)) throw new Error(`no quantized model written to ${q}`);
    fs.mkdirSync(path.join(out, 'onnx'), { recursive: true });
    fs.copyFileSync(q, path.join(out, 'onnx', 'model_quantized.onnx'));
    console.log('  copied onnx/model_quantized.onnx');
    for (const f of TOKEN_FILES) {
      const src = path.join(tmp, f);
      if (!fs.existsSync(src)) continue;
      fs.copyFileSync(src, path.join(out, f));
      console.log(`  copied ${f}`);
    }
    for (const f of ['config.json', 'tokenizer.json']) {
      if (!fs.existsSync(path.join(out, f))) throw new Error(`${f} missing: the model cannot load without it`);
    }
    return out;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!['--model', '--out', '--venv'].includes(a)) throw new Error('unknown argument: ' + a);
    if (argv[i + 1] === undefined) throw new Error(`${a} needs a value`);
    o[a.slice(2)] = path.resolve(argv[++i]);
  }
  for (const k of ['model', 'out', 'venv']) if (!o[k]) throw new Error(`--${k} is required`);
  return o;
}

module.exports = { exportOnnx };

if (require.main === module) {
  try {
    console.log(`done: ${exportOnnx(parseArgs(process.argv.slice(2)))}`);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
