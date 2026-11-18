'use strict';
// Meaning: an optional local reranker. It scores (question, code text) pairs and keeps the best pool items. Off unless a model is set. Never throws.
const fs = require('fs');
const path = require('path');
const paths = require('./paths.js');
const { rerankModel, getProject } = require('./projects.js');
const { codeText, richText } = require('./mk.js');
const { withTimeout } = require('./embed.js');
const { exactLines } = require('./repo.js');

const LOCAL_ID = /^local\/[a-z0-9][a-z0-9_-]{0,63}$/i;   // a tuned model: <modelsDir>/local/<name>/, read from disk only (same rule as embed.js)
const rerankers = new Map();                             // dir|model -> scorer promise (one load per model per process)

function getReranker(model = rerankModel(), dir = paths.modelsDir()) { // scorer = async (q, texts) => number[]; null when not usable
  if (!model) return Promise.resolve(null);
  const key = dir + '|' + model;
  if (!rerankers.has(key)) rerankers.set(key, (async () => {
    if (!LOCAL_ID.test(model)) return null;
    if (!fs.existsSync(path.join(dir, ...model.split('/')))) return null;   // tuned model not exported yet
    const tf = await import('@huggingface/transformers');
    tf.env.cacheDir = dir; tf.env.localModelPath = dir; tf.env.allowLocalModels = true; tf.env.allowRemoteModels = false;
    const tokenizer = await tf.AutoTokenizer.from_pretrained(model);
    const net = await tf.AutoModelForSequenceClassification.from_pretrained(model, { dtype: 'q8', local_files_only: true });
    return async (q, texts) => {
      const inputs = tokenizer(new Array(texts.length).fill(q), { text_pair: texts, padding: true, truncation: true, max_length: 256 });
      const { logits } = await net(inputs);
      return Array.from(logits.data);   // one logit per text
    };
  })().catch(() => null));
  return rerankers.get(key);
}

// richText lives in mk.js (re-exported below for the callers that import it from here)
async function rerankCode(res, q, score, { max = 6, rich = false, project: optProject } = {}) {   // returns a new object; the input is never changed
  if (!res || !Array.isArray(res.pool) || !res.pool.length || typeof score !== 'function') return res;
  try {
    const cache = new Map(), project = res.project || optProject;   // the search result carries project (mk.js search)
    const texts = res.pool.map((p) => (rich ? richText(p.label, p.file, project, cache) : codeText(p.label, p.file)));
    const s = await score(q, texts);
    if (!Array.isArray(s) || s.length !== texts.length || !s.every(Number.isFinite)) return res;   // a bad scorer output keeps today's list
    const order = res.pool.map((_, i) => i).sort((a, b) => (s[b] - s[a]) || (a - b)).slice(0, max);   // ties keep pool order
    const old = new Map((res.code || []).filter((c) => !c.chain).map((c) => [c.n.label, c]));
    const picked = order.map((i) => {
      const p = res.pool[i], prev = old.get(p.label);
      return prev ? { ...prev, a: s[i] } : { a: s[i], n: { label: p.label, file: p.file, kind: 'code' } };
    });
    // a chain item follows the hit it came after (its source) when that hit is picked; the rest go last. A picked label never shows twice.
    const pickedLabels = new Set(picked.map((c) => c.n.label)), after = new Map(), rest = [];
    let src = null;
    for (const c of res.code || []) {
      if (!c.chain) { src = c.n.label; continue; }
      if (pickedLabels.has(c.n.label)) continue;
      if (src && pickedLabels.has(src)) (after.get(src) || after.set(src, []).get(src)).push(c); else rest.push(c);
    }
    return { ...res, code: [...picked.flatMap((c) => [c, ...(after.get(c.n.label) || [])]), ...rest] };
  } catch {
    return res;
  }
}

// The main set and each also set, reranked. Same object when nothing changed.
const LIVE_POOL = 20;   // live map: score the first 20 pool items. 50 q check half 2026-11-18: 20 = 22/50 at 0.8 s median, 30 = 23/50 at 2.1 s, 50 = 25/50 at about 3 s (map only 17/50)
async function rerankSets(res, q, score) {
  const one = async (r) => { const c = Array.isArray(r.pool) && r.pool.length > LIVE_POOL ? { ...r, pool: r.pool.slice(0, LIVE_POOL) } : r, o = await rerankCode(c, q, score, { rich: true }); return o === c ? r : o; };   // unchanged = the same object
  const top = await one(res);
  const also = await Promise.all((res.also || []).map(one));
  const pairs = [[res, top], ...(res.also || []).map((r, i) => [r, also[i]])];
  if (pairs.every(([old, neu]) => old === neu)) return res;
  for (const [old, neu] of pairs) {   // exact line numbers for the new items only
    const P = getProject(neu.project) || {};
    if (old === neu || !P.repo || !fs.existsSync(P.repo)) continue;
    const had = new Set((old.code || []).map((c) => c.n.label));
    try { exactLines(P.repo, (neu.code || []).filter((c) => !had.has(c.n.label)), P.repoBase || ''); } catch { /* keep the line-less items */ }
  }
  return { ...top, also };
}

// Rerank the whole result inside msLeft ms. Returns res itself on any problem.
async function rerankMap(res, q, score, msLeft) {
  if (!res || typeof score !== 'function' || !(msLeft > 0)) return res;
  try {
    return await withTimeout(rerankSets(res, q, score), msLeft);
  } catch {
    return res;
  }
}

module.exports = { rerankModel, getReranker, rerankCode, rerankMap, richText };
