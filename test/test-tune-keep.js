'use strict';
// The "kept" branch of the tune run (src/tune/tune.js keepModel), without training: a real tune run keeps a model only when it wins,
// which a test cannot force. A copy of the base ONNX model stands in for the tuned one. Temp data folder only.
// Needs the base model in private/models/Xenova (installed by setup); without it this test prints a skip line and exits 0.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const outer = process.env.GABRIEL_DATA || process.env.BRAIN_DATA || path.join(ROOT, 'private');
const BASE = path.join(outer, 'models', 'Xenova', 'all-MiniLM-L6-v2');
if (!fs.existsSync(path.join(BASE, 'onnx', 'model_quantized.onnx'))) { console.log('tune keep test skipped (no base model installed)'); process.exit(0); }

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tune-keep-'));
const DATA = path.join(base, 'data'), T = path.join(base, 'copy');
process.env.GABRIEL_DATA = DATA;
delete process.env.BRAIN_DATA; delete process.env.GABRIEL_EMBED_MODEL;

(async () => {
  try {
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(path.join(DATA, 'projects.json'), JSON.stringify({ version: 1, projects: [{ name: 'fx', root: 'docs/fx' }] }));
    fs.cpSync(BASE, path.join(T, 'models', 'local', 'gabriel-tuned'), { recursive: true });
    const { keepModel } = require('../src/tune/tune.js');

    keepModel(T, ['fx']);   // fx has no doc-questions.json: no question index to rebuild
    const cfg = JSON.parse(fs.readFileSync(path.join(DATA, 'projects.json'), 'utf8'));
    assert.strictEqual(cfg.embedModel, 'local/gabriel-tuned');
    assert.deepStrictEqual(cfg.projects, [{ name: 'fx', root: 'docs/fx' }], 'only embedModel changes');
    assert.ok(fs.existsSync(path.join(DATA, 'models', 'local', 'gabriel-tuned', 'onnx', 'model_quantized.onnx')));
    console.log('  ok: kept: embedModel set, model copied into the data folder, projects unchanged');

    const { getEmbedder } = require('../src/embed.js');
    const emb = await getEmbedder(false, 'local/gabriel-tuned');
    assert.ok(emb, 'the kept model loads from disk');
    const [vec] = await emb(['hello']);
    assert.strictEqual(vec.length, 384, `vector length ${vec.length}`);
    const norm = Math.hypot(...vec);
    assert.ok(Math.abs(norm - 1) < 1e-3, `norm ${norm}`);
    console.log(`  ok: kept model embeds "hello" to ${vec.length} numbers, norm ${norm.toFixed(4)}`);
    console.log('ALL PASSED');
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { fs.rmSync(base, { recursive: true, force: true }); }
})();
