// Export a trained sentence model to ONNX and quantize it (8-bit, AVX2), so the local meaning model can load it.
//   node src/tune/export-onnx.js --model <trained dir> --out <modelsDir>/local/gabriel-tuned --venv <venv>
// Needs the venv from src/tune/requirements.txt (optimum with onnxruntime). Writes <out>/onnx/model_quantized.onnx
// and the config and tokenizer files next to it. Not run by the tests (it needs the venv and takes a while).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TOKEN_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json'];

function optimumCli(venv) {
  const exe = process.platform === 'win32'
    ? path.join(venv, 'Scripts', 'optimum-cli.exe')
    : path.join(venv, 'bin', 'optimum-cli');
  if (!fs.existsSync(exe)) throw new Error(`optimum-cli not found at ${exe}: install src/tune/requirements.txt into the venv`);
  return exe;
}

function run(exe, args, label) {
  console.log(`  ${label}: optimum-cli ${args.join(' ')}`);
  const r = spawnSync(exe, args, { stdio: 'inherit', windowsHide: true });
  if (r.error || r.status !== 0) throw new Error(`${label} failed${r.status != null ? ` (exit ${r.status})` : ''}`);
}

function exportOnnx({ model, out, venv }) {
  if (!fs.existsSync(path.join(model, 'config.json'))) throw new Error(`no trained model in ${model} (no config.json)`);
  const cli = optimumCli(venv);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gabriel-onnx-'));
  try {
    const onnxDir = path.join(tmp, 'onnx'), qDir = path.join(tmp, 'onnx-q8');
    console.log('step 1/3 export to ONNX');
    run(cli, ['export', 'onnx', '--model', model, '--task', 'feature-extraction', onnxDir], 'export');

    console.log('step 2/3 quantize to 8 bit (AVX2)');
    run(cli, ['onnxruntime', 'quantize', '--onnx_model', onnxDir, '--avx2', '-o', qDir], 'quantize');

    console.log('step 3/3 copy into place');
    const found = fs.readdirSync(qDir).filter((f) => f.endsWith('.onnx'));
    const q = found.find((f) => /quantized/i.test(f)) || found[0];
    if (!q) throw new Error(`no quantized .onnx file in ${qDir}`);
    fs.mkdirSync(path.join(out, 'onnx'), { recursive: true });
    fs.copyFileSync(path.join(qDir, q), path.join(out, 'onnx', 'model_quantized.onnx'));
    console.log(`  copied ${q} -> onnx/model_quantized.onnx`);
    for (const f of TOKEN_FILES) {
      const src = [path.join(onnxDir, f), path.join(model, f)].find((p) => fs.existsSync(p));
      if (!src) continue;
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
