// Retrain one project's doc ranking. The new weights are kept only when they do not lower the strict score.
//   node src/retrain.js [name] [--force]     (default: the default project; --force keeps the new weights even if strict falls)
// 1. No eval-cases.json yet: write suggested cases (eval/suggest-cases.js) and stop. You review and save them, then run again.
// 2. Rebuild the project's map (brain.js build-mk), score the current weights (eval-map), train new weights into a temp file (train-rank --out),
//    score those (eval-map --rank). With a name: copy them to the project's rank file only when the new strict count is not lower.
//    With no name: always copy them (the owner's choice), after a backup of the old file as rank.prev.json next to it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const mk = require('./mk.js');
const paths = require('./paths.js');
const { getProject } = require('./projects.js');

// Keep the new weights? A named run keeps them only when the strict count does not fall. A run with no name always keeps them.
// force (--force): a named run keeps them even when the strict count falls.
function keepNew(named, oldS, newS, force = false) { return !named || force || !!(oldS && newS && newS.n >= oldS.n); }
// Why the current weights were kept: a missing count is named, otherwise the lower count is shown
function reason(oldS, newS) { return !oldS || !newS ? `no strict count for the ${!oldS ? 'current' : 'new'} weights` : `the new strict count is lower (${newS.n} < ${oldS.n})`; }
if (require.main !== module) { module.exports = { keepNew, reason }; return; }

const named = !!(process.argv[2] && !process.argv[2].startsWith('--'));
const force = process.argv.includes('--force');   // named run: replace the weights even when strict falls
const name = named ? process.argv[2] : mk.defaultProject();
const P = getProject(name);
if (!P) throw new Error('unknown project: ' + name);
const ROOT = path.resolve(__dirname, '..');
const casesFile = path.join(paths.privateDir(name), 'eval-cases.json');
const suggestFile = path.join(paths.privateDir(name), 'eval-cases.suggested.json');

function runNode(script, args) {   // { ok, out }: stdout and stderr together
  try { return { ok: true, out: execFileSync(process.execPath, [path.join(ROOT, script), ...args], { encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; }
}
const strictOf = (text) => { const m = String(text).match(/^ {2}.+? questions\s+strict (\d+)\/(\d+)/m); return m ? { n: Number(m[1]), t: Number(m[2]) } : null; };
const show = (label, s) => (s ? `${label}: strict ${s.n}/${s.t}` : `${label}: no strict line`);

(function main() {
  if (!fs.existsSync(casesFile)) {
    const r = runNode('eval/suggest-cases.js', ['--project', name]);
    process.stdout.write(r.out);
    if (!r.ok) { console.error('suggest-cases failed'); process.exitCode = 1; return; }
    console.log(`no eval cases for ${name} yet. Review ${suggestFile}, rewrite the questions in your own words, save it as ${casesFile}, then run retrain again. See docs/EVAL.md.`);
    return;
  }
  const build = runNode('src/brain.js', ['build-mk', name]);
  if (!build.ok) { console.error(build.out.trim()); console.error(`map not built for ${name}: no retrain`); process.exitCode = 1; return; }
  const before = runNode('eval/eval-map.js', ['--project', name]);
  if (!before.ok) { console.error(before.out.trim()); process.exitCode = 1; return; }
  const oldS = strictOf(before.out);
  console.log(show(`current weights (${fs.existsSync(P.rank) ? P.rank : 'no rank file: plain order'})`, oldS));
  const tmp = path.join(os.tmpdir(), `retrain-${name}-${process.pid}.json`);
  try {
    const trained = runNode('src/train-rank.js', ['--project', name, '--out', tmp]);
    if (!trained.ok && /needs the local meaning model/.test(trained.out)) {   // not a failure: no model installed, so nothing to train
      console.log(`meaning model is missing (train-rank needs it): no training; kept the current weights`); return;
    }
    if (!trained.ok) {
      console.error(`training failed; kept the current weights\n${trained.out.trim().split('\n').slice(-3).join('\n')}`);
      process.exitCode = 1; return;
    }
    const after = runNode('eval/eval-map.js', ['--project', name, '--rank', tmp]);
    if (!after.ok) { console.error(after.out.trim()); process.exitCode = 1; return; }
    const newS = strictOf(after.out);
    console.log(show('new weights', newS));
    if (keepNew(named, oldS, newS, force)) {
      fs.mkdirSync(path.dirname(P.rank), { recursive: true });
      const prev = path.join(path.dirname(P.rank), 'rank.prev.json');
      if ((!named || force) && fs.existsSync(P.rank)) { fs.copyFileSync(P.rank, prev); console.log(`old weights saved: ${prev}`); }
      fs.copyFileSync(tmp, P.rank);
      const fell = oldS && newS && newS.n < oldS.n;
      if (named && force && fell) console.log(`--force: kept the new weights although strict fell ${oldS.n} -> ${newS.n}`);
      console.log(`kept the new weights: ${P.rank}${named ? '' : ` (no name given: always replaced${fell ? `, although strict fell ${oldS.n} -> ${newS.n}` : ''})`}`);
    } else {
      console.log(`kept the current weights: ${reason(oldS, newS)}`);
    }
  } finally { try { fs.rmSync(tmp, { force: true }); } catch { /* none */ } }
})();
