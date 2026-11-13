// Meaning: the small local embedding model and the vectors file (data/vectors.json). Vectors are keyed by text hash.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dataDir, writeAtomic } = require('./rules.js');
const paths = require('./paths.js');
const { embedModel, DEFAULT_EMBED_MODEL } = require('./projects.js');

const BASE_MODEL = DEFAULT_EMBED_MODEL;                              // 23 MB, 384 numbers per text; the model setup downloads
const LOCAL_ID = /^local\/[a-z0-9][a-z0-9_-]{0,63}$/i;               // a tuned model: <modelsDir>/local/<name>/, read from disk only (src/tune)
const vecFile = (home) => path.join(dataDir(home), 'vectors.json');

const embedText = (n) => (n.section ? n.section + ': ' : '') + n.text.slice(0, 300);
const ehash = (n) => crypto.createHash('sha1').update(embedText(n)).digest('hex').slice(0, 16);
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]); // the CLI exits on its own, so a pending timer is fine

const embedders = new Map();   // model id -> embedder promise (one load per model per process)
function getEmbedder(allowDownload = false, model = embedModel()) { // null when the package or the model is not installed; never throws
  if (process.env.GABRIEL_NO_DOWNLOAD === '1') allowDownload = false;   // setup --skip-model: words-only, never fetch the model
  const local = model.startsWith('local/');
  if (local) allowDownload = false;                                     // a tuned model is never downloaded
  if (!embedders.has(model)) embedders.set(model, (async () => {
    if (local && !LOCAL_ID.test(model)) return null;
    const dir = paths.modelsDir();
    if (local && !fs.existsSync(path.join(dir, ...model.split('/')))) return null;   // tuned model not exported yet: words-only
    const tf = await import('@huggingface/transformers');
    tf.env.cacheDir = dir; tf.env.localModelPath = dir; tf.env.allowLocalModels = true; tf.env.allowRemoteModels = allowDownload;
    const ext = await tf.pipeline('feature-extraction', model, { dtype: 'q8', local_files_only: !allowDownload });
    return async (texts) => (await ext(texts, { pooling: 'mean', normalize: true })).tolist();
  })().catch(() => null));
  return embedders.get(model);
}

function readVectors(home, model) { // Map hash -> Float32Array, or null when absent or made by another model
  try {
    const v = JSON.parse(fs.readFileSync(vecFile(home), 'utf8'));
    if (v.model !== model) return null;
    const out = new Map();
    for (const [h, b64] of Object.entries(v.vec)) { const b = Buffer.from(b64, 'base64'); out.set(h, new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length))); }
    return out;
  } catch { return null; }
}

async function embedNodes(home, g, embedFn, model = embedModel()) { // vectors are keyed by text hash, so only new or changed text is embedded
  const old = readVectors(home, model) || new Map(), want = new Map(), vecs = new Map();
  for (const n of g.nodes) if (!n.inContext) want.set(ehash(n), embedText(n));
  const missing = [...want].filter(([h]) => !old.has(h));
  for (const h of want.keys()) if (old.has(h)) vecs.set(h, old.get(h));
  if (missing.length) { const got = await embedFn(missing.map(([, t]) => t)); missing.forEach(([h], i) => vecs.set(h, Float32Array.from(got[i]))); }
  const vec = {};
  for (const [h, v] of vecs) vec[h] = Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');
  writeAtomic(vecFile(home), JSON.stringify({ model, dim: [...vecs.values()][0]?.length || 0, vec }));
  return { total: vecs.size, added: missing.length };
}

// MODEL is the id in use now (a getter: env, then projects.json, then the default). BASE_MODEL is always the downloaded one.
module.exports = { get MODEL() { return embedModel(); }, BASE_MODEL, embedText, ehash, withTimeout, getEmbedder, readVectors, embedNodes };
