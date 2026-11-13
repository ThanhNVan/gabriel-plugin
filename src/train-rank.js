// Train the doc ranking of one project's map from its written-down questions (eval-cases.json in the project's private folder). No download, no outside model.
//   node src/train-rank.js --project <name>                  leave-one-area-out check: train on all areas but one, test on that one; prints the honest score
//   node src/train-rank.js --project <name> --train dev,held train on these sets, test on the others (default test: fresh)
//   node src/train-rank.js --project <name> --write          train on all questions of the chosen sets and write the project's rank file
//   node src/train-rank.js --project <name> --out <file>     same as --write, but writes <file> (implies --write)
//   --exclude-sets a,b   sets that are never trained or scored (default: excludeSets in <private>/<name>/train.json, else none)
// Default project: mk.defaultProject(). Cases: only those with no project or this project.
// Each candidate section has a few signals (see mk.js, "doc ranking"). The weights are learned with a listwise loss: the right sections of a question must score above the others.
// No random numbers: the weights start at 0, the loop has a fixed number of steps and nothing is shuffled. The same questions and model give the same weights.
const fs = require('fs');
const path = require('path');
const mk = require('./mk.js');
const { homeDir } = require('./rules.js');
const paths = require('./paths.js');
const { getProject } = require('./projects.js');
const { getEmbedder } = require('./embed.js');

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const NAMES = ['activation', 'words', 'heading words', 'meaning', 'heading meaning', 'word coverage', 'heading coverage', 'file size', 'first chunk of file', 'depth', 'meaning vs best', 'heading meaning vs best', 'coverage vs best', 'findings or backlog doc', 'non-developer or README', 'best meaning in section', 'query share of chunk', 'file best meaning vs best', 'file word share', 'problem question and findings doc', 'core doc', 'question meaning', 'question meaning vs best'];
const LAMBDA = Number(opt('--l2', 0.01));
const rx = (s) => new RegExp(s, 'i');

const PROJECT = opt('--project', mk.defaultProject());
const P = getProject(PROJECT);
if (!P) throw new Error('unknown project: ' + PROJECT);
const casesFile = path.join(paths.privateDir(PROJECT), 'eval-cases.json');
const trainFile = path.join(paths.privateDir(PROJECT), 'train.json');
const fromFile = fs.existsSync(trainFile) ? (JSON.parse(fs.readFileSync(trainFile, 'utf8')).excludeSets || []) : [];
const EXCLUDE = new Set(argv.includes('--exclude-sets') ? String(opt('--exclude-sets')).split(',').filter(Boolean) : fromFile);

const pick = mk.rankDocs;
function train(qs, l2 = LAMBDA, iters = 1200) {   // Adam on the listwise loss: -log( sum of softmax over the right sections )
  const d = NAMES.length, w = new Array(d).fill(0), m = new Array(d).fill(0), v = new Array(d).fill(0);
  const use = qs.filter((q) => q.rows.some((r) => r.y));
  for (let t = 1; t <= iters; t++) {
    const g = new Array(d).fill(0);
    for (const q of use) {
      const z = q.rows.map((r) => r.f.reduce((s, x, i) => s + x * w[i], 0)), mxz = Math.max(...z);
      const e = z.map((x) => Math.exp(x - mxz)), Z = e.reduce((s, x) => s + x, 0);
      const ep = q.rows.map((r, i) => (r.y ? e[i] : 0)), Zp = ep.reduce((s, x) => s + x, 0);
      for (let i = 0; i < q.rows.length; i++) for (let k = 0; k < d; k++) g[k] += (e[i] / Z - ep[i] / Zp) * q.rows[i].f[k];
    }
    for (let k = 0; k < d; k++) {
      const gk = g[k] / use.length + l2 * w[k];
      m[k] = 0.9 * m[k] + 0.1 * gk; v[k] = 0.999 * v[k] + 0.001 * gk * gk;
      w[k] -= 0.05 * (m[k] / (1 - 0.9 ** t)) / (Math.sqrt(v[k] / (1 - 0.999 ** t)) + 1e-8);
    }
  }
  return w;
}
const hit = (q, w) => pick(q.rows, w).some((r) => r.y);

(async () => {
  const embed = await getEmbedder(false), home = homeDir();
  if (!embed) { console.error(`train-rank needs the local meaning model (not installed): no weights learned for ${PROJECT}`); process.exit(1); }
  const cases = JSON.parse(fs.readFileSync(casesFile, 'utf8')).filter((c) => (!c.project || c.project === PROJECT) && !c.known && !c.none && c.doc && !EXCLUDE.has(c.set));   // a project's ranker never trains or scores another project's questions
  const qs = [];
  for (const c of cases) {
    if ((qs.length + 1) % 25 === 0) console.log(`collecting candidates ${qs.length + 1}/${cases.length}`);
    const pv = (await embed([c.q]))[0];
    const res = mk.search(home, c.q, { pv, learn: false, feat: true, rankW: null, project: PROJECT });
    if (!res || !res.feat) continue;
    const rows = res.feat.map((x) => ({ n: x.n, f: x.f, y: rx(c.doc).test(x.n.file) && (!c.sec || rx(c.sec).test(x.n.section || '')) }));
    qs.push({ c, rows, area: c.id.replace(/-\d+$/, ''), base: res.docs.some((d) => rx(c.doc).test(d.n.file) && (!c.sec || rx(c.sec).test(d.n.section || ''))) });
  }
  const withPos = qs.filter((q) => q.rows.some((r) => r.y));
  console.log(`${qs.length} doc questions; the right section is in the candidate pool for ${withPos.length} (${Math.round((100 * withPos.length) / qs.length)}%)`);
  const pct = (n, t) => `${n}/${t} ${Math.round((100 * n) / Math.max(t, 1))}%`;
  if (!qs.length) { console.error(`no doc questions in ${casesFile} (after the excluded sets): nothing to train`); process.exit(1); }

  if (argv.includes('--write') || argv.includes('--out') || argv.includes('--train')) {
    const sets = opt('--train', 'dev,held,fresh').split(',');
    const tr = qs.filter((q) => sets.includes(q.c.set)), te = qs.filter((q) => !sets.includes(q.c.set));
    if (!tr.length) { console.error(`no questions in the training sets ${sets.join(',')}: pass --train <sets> (the set names in your eval-cases.json)`); process.exit(1); }
    const w = train(tr);
    console.log('weights: ' + NAMES.map((n, i) => `${n} ${w[i].toFixed(2)}`).join(', '));
    console.log(`train sets ${sets.join('+')}: plain ranking ${pct(tr.filter((q) => q.base).length, tr.length)} -> learned ${pct(tr.filter((q) => hit(q, w)).length, tr.length)}`);
    if (te.length) console.log(`test (not trained on): plain ranking ${pct(te.filter((q) => q.base).length, te.length)} -> learned ${pct(te.filter((q) => hit(q, w)).length, te.length)}`);
    if (argv.includes('--write') || argv.includes('--out')) {
      const rankFile = argv.includes('--out') ? path.resolve(opt('--out')) : P.rank;
      fs.mkdirSync(path.dirname(rankFile), { recursive: true });
      fs.writeFileSync(rankFile, JSON.stringify({ names: NAMES, w, trained: sets, questions: tr.length, made: new Date().toISOString().slice(0, 10) }, null, 1));
      console.log(`wrote ${rankFile}`);
    }
    process.exit(0);
  }

  // leave-one-area-out: the honest estimate
  const areas = [...new Set(qs.map((q) => q.area))];
  let base = 0, got = 0;
  const per = [], misses = [], atK = {};
  for (const a of areas) {
    const tr = qs.filter((q) => q.area !== a), te = qs.filter((q) => q.area === a);
    const w = train(tr), b = te.filter((q) => q.base).length, l = te.filter((q) => hit(q, w)).length;
    base += b; got += l; per.push(`${a} ${b}->${l}/${te.length}`);
    for (const k of [1, 2, 3, 4, 5, 6, 8]) atK[k] = (atK[k] || 0) + te.filter((q) => pick(q.rows, w, k).some((r) => r.y)).length;
    for (const q of te) if (!hit(q, w)) misses.push(`${q.c.id} "${q.c.q}"\n      want ${q.c.doc} ${q.c.sec || ''}\n      got  ${pick(q.rows, w).map((r) => r.n.file.replace(/^technical-docs\/(for-dev\/)?/, '') + ' > ' + (r.n.section || '').split(' > ').slice(-1)[0]).join(' | ')}`);
  }
  console.log('leave-one-area-out (train on the other areas, test on this one), plain -> learned:\n  ' + per.join('  '));
  console.log(`TOTAL doc questions: plain ${pct(base, qs.length)} -> learned ${pct(got, qs.length)}`);
  console.log('right section among the first k doc lines (learned, leave-one-area-out): ' + Object.entries(atK).map(([k, n]) => `k=${k} ${pct(n, qs.length)}`).join('  '));
  if (argv.includes('--show')) console.log('\nstill missed:\n  ' + misses.join('\n  '));
  const w = train(qs);
  console.log('weights on all: ' + NAMES.map((n, i) => `${n} ${w[i].toFixed(2)}`).join(', '));
  process.exit(0);
})();
