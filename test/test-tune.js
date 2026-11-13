'use strict';
// Fixture test for the optional embedding fine-tune (src/tune). Runs tune.js end to end on a small temp project:
// the 5 steps, the keep-or-roll-back result, the tuned model when kept, and --rollback.
// Needs the tune venv: env GABRIEL_TUNE_VENV, else <plugin>/private/tune-venv. Without a venv it prints a skip line and exits 0.
// Temp data folder and temp home only. The base model is copied (not linked) from private/models/Xenova.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const venv = process.env.GABRIEL_TUNE_VENV ? path.resolve(process.env.GABRIEL_TUNE_VENV) : path.join(ROOT, 'private', 'tune-venv');
const venvPy = process.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');
if (!fs.existsSync(venvPy)) {
  console.log('tune test skipped (no tune venv; run node src/setup.js --tune)');
  process.exit(0);
}

const TUNE = path.join(ROOT, 'src', 'tune', 'tune.js');
const BRAIN = path.join(ROOT, 'src', 'brain.js');
const BASE_SRC = path.join(ROOT, 'private', 'models', 'Xenova');
const TUNED = 'local/gabriel-tuned';
const TIMEOUT_MS = 10 * 60 * 1000;

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tune-test-'));
const GDATA = path.join(base, 'gdata'), HOME = path.join(base, 'home'), DOCS = path.join(GDATA, 'docs', 'fx');
const CFG = path.join(GDATA, 'projects.json'), MODEL_DIR = path.join(GDATA, 'models', 'local', 'gabriel-tuned');
process.env.GABRIEL_DATA = GDATA;
process.env.BRAIN_HOME = HOME;
delete process.env.BRAIN_DATA;
delete process.env.GABRIEL_EMBED_MODEL;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const readCfg = () => JSON.parse(fs.readFileSync(CFG, 'utf8'));

// Runs a node script; forwards its output live and keeps it for the checks.
function runStreamed(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { env: { ...process.env }, cwd: ROOT, windowsHide: true });
    let out = '', timedOut = false;
    const take = (d) => { const s = d.toString(); out += s; process.stdout.write(s); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, TIMEOUT_MS);
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, timedOut, out }); });
  });
}

(async () => {
  try {
    fs.mkdirSync(HOME, { recursive: true });
    fs.mkdirSync(DOCS, { recursive: true });

    // 1: the base model, copied into the temp data folder so the map build works offline
    if (!fs.existsSync(BASE_SRC)) throw new Error(`base model not found at ${BASE_SRC}: run node src/setup.js first`);
    fs.cpSync(BASE_SRC, path.join(GDATA, 'models', 'Xenova'), { recursive: true });
    console.log('  ok: base model copied into the temp data folder');

    // 2: fixture docs. 12 files x 5 "##" sections = 60 cases. Files 9-12 are the longer filler.
    // Keep rule: 20% of files are held out, so with 12 files at most 10 cases leave training. 60 - 10 = 50 = the minimum.
    const FILES = 12, SECS = 5, FILLER_FROM = 9;
    const cases = [];
    for (let i = 1; i <= FILES; i++) {
      const name = `doc-${String(i).padStart(2, '0')}.md`;
      let text = `# Doc ${i}\n\n`;
      for (let k = 1; k <= SECS; k++) {
        text += `## Part ${k}\n\nPart ${k} of doc ${i} covers topic${i}x${k} in plain words.\n\n`;
        if (i >= FILLER_FROM) text += `Filler for doc ${i}, part ${k}: nothing special here, just padding words.\n\n`;
        cases.push({
          id: `FX-${i}-${k}`, q: `What does doc ${i} say in part ${k} about topic${i}x${k}?`,
          doc: `^${esc(name)}$`, sec: `${esc(`Part ${k}`)}$`, set: 'dev', tier: 'easy',
        });
      }
      fs.writeFileSync(path.join(DOCS, name), text);
    }
    fs.writeFileSync(CFG, JSON.stringify({ version: 1, projects: [{ name: 'fx', label: 'fx', root: DOCS, layout: 'all-md', graph: null }] }, null, 2) + '\n');
    console.log(`  ok: fixture written: ${FILES} doc files, ${cases.length} sections`);

    // 3: the map, then the eval cases (one per section)
    const built = spawnSync(process.execPath, [BRAIN, 'build-mk', 'fx'], { cwd: ROOT, env: { ...process.env }, encoding: 'utf8', timeout: TIMEOUT_MS });
    const builtOut = (built.stdout || '') + (built.stderr || '');
    assert.strictEqual(built.status, 0, builtOut);
    assert.match(builtOut, /^map built/m);
    console.log('  ok: map built for the fixture project fx');

    const priv = path.join(GDATA, 'private', 'fx');
    fs.mkdirSync(priv, { recursive: true });
    fs.writeFileSync(path.join(priv, 'eval-cases.json'), JSON.stringify(cases, null, 2) + '\n');

    // 4: the tune run (default training: the script has no epochs option)
    const tune = await runStreamed([TUNE, '--venv', venv, '--yes']);
    assert.ok(!tune.timedOut, 'tune.js ran past 10 minutes');
    assert.strictEqual(tune.status, 0, `tune.js exit ${tune.status}`);
    assert.ok(tune.out.includes('step 5/5'), 'tune.js reached step 5/5');
    const kept = /^kept: /m.test(tune.out), rolled = /^rolled back: /m.test(tune.out);
    assert.ok(kept !== rolled, 'tune.js ends with exactly one of kept or rolled back');
    console.log(`  ok: tune.js exit 0, step 5/5 reached, branch: ${kept ? 'kept' : 'rolled back'}`);

    // 5: the branch result
    if (kept) {
      assert.strictEqual(readCfg().embedModel, TUNED, 'projects.json has the tuned embedModel');
      assert.ok(fs.existsSync(path.join(MODEL_DIR, 'onnx', 'model_quantized.onnx')), 'tuned model file exists');
      console.log(`  ok: projects.json embedModel is ${TUNED}, model file exists`);

      const { getEmbedder } = require(path.join(ROOT, 'src', 'embed.js'));
      const emb = await getEmbedder(false, TUNED);
      assert.ok(emb, 'the tuned model loads');
      const [vec] = await emb(['hello']);
      assert.strictEqual(vec.length, 384, `vector length ${vec.length}`);
      const norm = Math.hypot(...vec);
      assert.ok(Math.abs(norm - 1) < 1e-3, `norm ${norm}`);
      console.log(`  ok: tuned model embeds "hello" to ${vec.length} numbers, norm ${norm.toFixed(4)}`);
    } else {
      assert.strictEqual(readCfg().embedModel, undefined, 'projects.json has no embedModel');
      assert.ok(!fs.existsSync(MODEL_DIR), 'no tuned model folder');
      console.log('  ok: rolled back: no embedModel, no tuned model folder');
    }

    // 6: --rollback removes embedModel
    const rb = await runStreamed([TUNE, '--rollback', '--yes']);
    assert.ok(!rb.timedOut && rb.status === 0, `--rollback exit ${rb.status}`);
    assert.strictEqual(readCfg().embedModel, undefined, 'after --rollback: no embedModel');
    console.log('  ok: tune.js --rollback --yes leaves no embedModel');

    console.log('ALL PASSED');
    process.exitCode = 0;
  } catch (e) {
    console.error(e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { fs.rmSync(base, { recursive: true, force: true, maxRetries: 3 }); }
    catch (e) { console.error(`warning: temp folder not removed (${base}): ${e.message}`); }
  }
})();
