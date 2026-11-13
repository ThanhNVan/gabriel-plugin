// "Question index": for each doc section, a few plain-language questions a developer might ask (doc-questions.json in the project's private folder, written once by a small model).
// Their meaning numbers let a question like "why is the browser blocking my request" find the CORS section even when the section never says that.
// One index per project: dq.<project>.bin and dq.<project>.idx.json in the data folder.
//   embedAll(home, project)  reads doc-questions.json, writes the index files   (run: node brain.js build-dq --project <name>)
//   load(home, project)      { keys, vecs, dim } or null when the index is not built (the map then works without it)
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./rules.js');
const paths = require('./paths.js');
const { embedModel, DEFAULT_EMBED_MODEL } = require('./projects.js');

const files = (home, project) => {
  const dir = dataDir(home);
  return { q: path.join(paths.privateDir(project), 'doc-questions.json'), bin: path.join(dir, `dq.${project}.bin`), idx: path.join(dir, `dq.${project}.idx.json`) };
};
const cache = new Map();   // key: project + data folder; null = no index (checked once per process)

async function embedAll(home, project) {
  const f = files(home, project), qs = JSON.parse(fs.readFileSync(f.q, 'utf8')), keys = [], texts = [];
  for (const [k, list] of Object.entries(qs)) for (const t of list) { keys.push(k); texts.push(t); }
  const embed = await require('./embed.js').getEmbedder(false);
  if (!embed) throw new Error('the local meaning model is not installed');
  const out = [];
  for (let i = 0; i < texts.length; i += 64) out.push(...(await embed(texts.slice(i, i + 64))));
  const dim = out[0].length, all = new Float32Array(out.length * dim);
  out.forEach((v, i) => all.set(v, i * dim));
  fs.mkdirSync(dataDir(home), { recursive: true });
  fs.writeFileSync(f.bin, Buffer.from(all.buffer, all.byteOffset, all.byteLength));
  fs.writeFileSync(f.idx, JSON.stringify({ keys, dim, model: embedModel() }));
  cache.delete(project + '|' + dataDir(home));
  return { questions: texts.length, sections: Object.keys(qs).length, dim };
}

function load(home, project) {
  const key = project + '|' + dataDir(home);
  if (cache.has(key)) return cache.get(key);
  let loaded = null;
  try {
    const f = files(home, project), idx = JSON.parse(fs.readFileSync(f.idx, 'utf8')), b = fs.readFileSync(f.bin);
    const vecs = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    // an index made by another meaning model is ignored (no index, like a missing one) until build-dq runs again
    const sameModel = (idx.model || DEFAULT_EMBED_MODEL) === embedModel();   // an index without a "model" field was made by the default model
    loaded = sameModel && vecs.length === idx.keys.length * idx.dim ? { keys: idx.keys, vecs, dim: idx.dim } : null;
  } catch { loaded = null; }
  cache.set(key, loaded);
  return loaded;
}

module.exports = { embedAll, load };
