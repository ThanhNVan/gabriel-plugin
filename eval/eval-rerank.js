// Offline A/B experiment. No hook settings or active model files are changed.
// node eval-rerank.js [--set dev] [--cases file.json] [--json result.json] [--download]
const fs = require('node:fs');
const path = require('node:path');
const mk = require('../src/mk');
const { homeDir } = require('../src/rules');
const paths = require('../src/paths');
const { getEmbedder } = require('../src/embed');
const { judge, judgeRendered } = require('../eval/eval-map.js');
const argv = process.argv.slice(2);
const opt = (name) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : null;

async function main() {
  const embed = await getEmbedder(false);
  if (!embed) throw new Error('local embedding model missing');
  const tf = await import('@huggingface/transformers');
  tf.env.allowRemoteModels = argv.includes('--download');
  const modelId = 'Xenova/ms-marco-MiniLM-L-6-v2';
  const settings = { cache_dir: path.join(paths.modelsDir(), 'rerank'), local_files_only: !argv.includes('--download') };
  tf.env.localModelPath = settings.cache_dir;
  console.log(`loading ${modelId} (${argv.includes('--download') ? 'download allowed in experiment cache' : 'local only'})`);
  const loadStart = Date.now();
  const tokenizer = await tf.AutoTokenizer.from_pretrained(modelId, settings);
  const model = await tf.AutoModelForSequenceClassification.from_pretrained(modelId, { ...settings, dtype: 'q8', session_options: { intraOpNumThreads: 2 } });
  const loadMs = Date.now() - loadStart;
  const score = async (q, passages) => {
    const out = [];
    for (let i = 0; i < passages.length; i += 8) {
      const part = passages.slice(i, i + 8);
      const features = tokenizer(part.map(() => q), { text_pair: part, padding: true, truncation: true });
      const result = await model(features);
      out.push(...result.logits.data);
    }
    return out;
  };
  const assert = require('node:assert/strict');
  const probe = await score('How many people live in Berlin?', ['Berlin has a population of 3,520,031 registered inhabitants.', 'New York City is famous for its museums.']);
  assert.ok(probe[0] > probe[1], 'the model must rank the relevant passage higher');
  console.log(`model ready in ${loadMs} ms; relevance self-check passed`);
  const weights = JSON.parse(fs.readFileSync(path.join(paths.privateDir(mk.defaultProject()), 'rank.json'), 'utf8')).w;
  const cases = JSON.parse(fs.readFileSync(opt('--cases') || path.join(paths.privateDir(mk.defaultProject()), 'eval-cases.json'), 'utf8')).filter((c) => !c.known && (!c.project || c.project === mk.defaultProject()) && (!opt('--set') || c.set === opt('--set')));
  const rows = [];
  for (const c of cases) {
    const start = Date.now(), pv = (await embed([c.q]))[0];
    const base = mk.search(homeDir(), c.q, { pv, feat: true, learn: false });
    let reranked = base, rerankMs = 0, candidates = [];
    if (base?.feat?.length) {
      const seen = new Set();
      candidates = base.feat.map((r) => ({ ...r, z: r.f.reduce((s, v, i) => s + v * (weights[i] || 0), 0) })).sort((a, b) => b.z - a.z).filter((r) => {
        const k = r.n.file + '::' + r.n.section;
        if (seen.has(k)) return false; seen.add(k); return true;
      }).slice(0, 40);
      const t = Date.now(), scores = await score(c.q, candidates.map((r) => r.n.section + ': ' + r.n.text));
      const docs = mk.rankDocs(candidates.map((r, i) => ({ n: r.n, f: [1 / (1 + Math.exp(-scores[i]))] })), [1]).map((r) => ({ n: r.n, a: r.z }));
      reranked = { ...base, docs };
      rerankMs = Date.now() - t;
    }
    rows.push({ c, base: judge(c, base), reranked: judge(c, reranked), baseRendered: judgeRendered(c, base), rerankedRendered: judgeRendered(c, reranked), poolHit: c.doc ? candidates.some((r) => new RegExp(c.doc, 'i').test(r.n.file) && (!c.sec || new RegExp(c.sec, 'i').test(r.n.section))) : null, totalMs: Date.now() - start, rerankMs, docs: reranked?.docs.map((d) => d.n.file + ' > ' + d.n.section) || [] });
    if (rows.length % 5 === 0) console.log(`progress ${rows.length}/${cases.length}`);
  }
  const positives = rows.filter((r) => !r.c.none), negatives = rows.filter((r) => r.c.none);
  console.log(JSON.stringify({ questions: rows.length, base: positives.filter((r) => r.base === 'OK').length, reranked: positives.filter((r) => r.reranked === 'OK').length, baseRendered: positives.filter((r) => r.baseRendered === 'OK').length, rerankedRendered: positives.filter((r) => r.rerankedRendered === 'OK').length, total: positives.length, quiet: negatives.filter((r) => r.reranked === 'OK').length, negatives: negatives.length, maxMs: Math.max(...rows.map((r) => r.totalMs)), averageMs: Math.round(rows.reduce((s, r) => s + r.totalMs, 0) / rows.length), loadMs }));
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(rows, null, 2) + '\n');
  await model.dispose();
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
