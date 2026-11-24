// Retrain one project's doc ranking. The new weights are kept only when they do not lower the strict score.
//   node src/retrain.js [name] [--force]     (default: the default project; --force keeps the new weights even if strict falls)
// 1. No eval-cases.json yet: write suggested cases (eval/suggest-cases.js) and stop. You review and save them, then run again.
// 2. Rebuild the project's map (brain.js build-mk), score the current weights (eval-map), train new weights into a temp file (train-rank --out),
//    score those (eval-map --rank). Copy them to the project's rank file only when the new strict count is not lower (--force: always).
//    Before a kept file replaces an existing rank file, the old one is saved as rank.prev.json next to it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const mk = require('./mk.js');
const paths = require('./paths.js');
const { getProject } = require('./projects.js');

// Keep the new weights? force (--force): keep them even when strict falls. No new score: keep the current weights.
// No old score: keep the new weights. Otherwise keep them only when the new strict count is not lower.
function keepNew(oldS, newS, force = false) {
  if (force) return true;
  if (!newS) return false;
  if (!oldS) return true;
  return newS.n >= oldS.n;
}
// Why the current weights were kept: a missing count is named, otherwise the lower count is shown
function reason(oldS, newS) { return !oldS || !newS ? `no strict count for the ${!oldS ? 'current' : 'new'} weights` : `the new strict count is lower (${newS.n} < ${oldS.n})`; }
if (require.main !== module) { module.exports = { keepNew, reason }; return; }

const named = !!(process.argv[2] && !process.argv[2].startsWith('--'));
const force = process.argv.includes('--force');   // keep the new weights even when strict falls
const name = named ? process.argv[2] : mk.defaultProject();
const P = getProject(name);
if (!P) throw new Error('unknown project: ' + name);
const ROOT = path.resolve(__dirname, '..');
const casesFile = path.join(paths.privateDir(name), 'eval-cases.json');
const suggestFile = path.join(paths.privateDir(name), 'eval-cases.suggested.json');

// Run one step as a child. Resolves { ok, out } (stdout and stderr together).
// Every 30 s it prints a status line to stderr (phase, n/total, %), so a watcher sees the run is alive.
function runNode(script, args, phase, n, total) {
  const pct = () => Math.round(((n - 1) / total) * 100);
  console.error(`${phase} (${n}/${total}) ${pct()}%`);
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = setInterval(() => console.error(`${phase} (${n}/${total}) ${pct()}%, running ${Math.round((Date.now() - t0) / 1000)} s`), 30000);
    const child = spawn(process.execPath, [path.join(ROOT, script), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (e) => { clearInterval(tick); resolve({ ok: false, out: out + String(e) }); });
    child.on('close', (code) => { clearInterval(tick); resolve({ ok: code === 0, out }); });
  });
}
const strictOf = (text) => { const m = String(text).match(/^ {2}.+? questions\s+strict (\d+)\/(\d+)/m); return m ? { n: Number(m[1]), t: Number(m[2]) } : null; };
const show = (label, s) => (s ? `${label}: strict ${s.n}/${s.t}` : `${label}: no strict line`);

(async function main() {
  if (!fs.existsSync(casesFile)) {
    const r = await runNode('eval/suggest-cases.js', ['--project', name], 'suggesting cases', 1, 1);
    process.stdout.write(r.out);
    if (!r.ok) { console.error('suggest-cases failed'); process.exitCode = 1; return; }
    console.log(`no eval cases for ${name} yet. Review ${suggestFile}, rewrite the questions in your own words, save it as ${casesFile}, then run retrain again. See docs/EVAL.md.`);
    return;
  }
  const build = await runNode('src/brain.js', ['build-mk', name], 'building map', 1, 4);
  if (!build.ok) { console.error(build.out.trim()); console.error(`map not built for ${name}: no retrain`); process.exitCode = 1; return; }
  const before = await runNode('eval/eval-map.js', ['--project', name], 'scoring current weights', 2, 4);
  if (!before.ok) { console.error(before.out.trim()); process.exitCode = 1; return; }
  const oldS = strictOf(before.out);
  console.log(show(`current weights (${fs.existsSync(P.rank) ? P.rank : 'no rank file: plain order'})`, oldS));
  const tmp = path.join(os.tmpdir(), `retrain-${name}-${process.pid}.json`);
  try {
    const trained = await runNode('src/train-rank.js', ['--project', name, '--out', tmp], 'training new weights', 3, 4);
    if (!trained.ok && /needs the local meaning model/.test(trained.out)) {   // not a failure: no model installed, so nothing to train
      console.log(`meaning model is missing (train-rank needs it): no training; kept the current weights`); return;
    }
    if (!trained.ok) {
      console.error(`training failed; kept the current weights\n${trained.out.trim().split('\n').slice(-3).join('\n')}`);
      process.exitCode = 1; return;
    }
    const after = await runNode('eval/eval-map.js', ['--project', name, '--rank', tmp], 'scoring new weights', 4, 4);
    if (!after.ok) { console.error(after.out.trim()); process.exitCode = 1; return; }
    const newS = strictOf(after.out);
    console.log(show('new weights', newS));
    if (keepNew(oldS, newS, force)) {
      fs.mkdirSync(path.dirname(P.rank), { recursive: true });
      const prev = path.join(path.dirname(P.rank), 'rank.prev.json');
      if (fs.existsSync(P.rank)) { fs.copyFileSync(P.rank, prev); console.log(`old weights saved: ${prev}`); }
      fs.copyFileSync(tmp, P.rank);
      const fell = oldS && newS && newS.n < oldS.n;
      if (force && fell) console.log(`--force: kept the new weights although strict fell ${oldS.n} -> ${newS.n}`);
      console.log(`kept the new weights: ${P.rank}`);
    } else {
      console.log(`kept the current weights: ${reason(oldS, newS)}`);
    }
  } finally { try { fs.rmSync(tmp, { force: true }); } catch { /* none */ } }
})();
