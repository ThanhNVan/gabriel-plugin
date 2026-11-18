// Which doc sets the map knows. From <dataDir>/projects.json (file order is the routing order);
// with no file, one project per folder under <dataDir>/docs/.
const fs = require('fs'), os = require('os'), path = require('path');
const { dataDir, projectsFile, privateDir, checkName, defaultRuleFiles } = require('./paths');
const DEFAULTS = { layout: 'auto', graph: null, skipDirs: ['graphify-out', 'node_modules', '.git', 'atlas', '_tools'],
  aliases: [], cwdHints: [], prior: 0, learn: true, fallback: false, sessionGate: false, coreDocs: null, extensions: null,
  chain: { seeds: 4, max: 3, stem: 3 }, repo: null, repoBase: '' };   // extensions: null = every default type; e.g. ["md","json"] (json/yaml are opt-in). chain = the "two links away" step: seeds = top code hits it starts from, max = extra lines, stem = name parts that must match (a higher stem is stricter). repo = the checked code folder (add-docs --repo); repoBase = '' or 'src' (graph paths relative to <repo>/src)
const resolveRoot = (r) => { const s = String(r || '');
  if (s.startsWith('~')) return path.join(os.homedir(), s.slice(1).replace(/^[\\/]/, ''));
  return path.isAbsolute(s) ? path.resolve(s) : path.join(dataDir(), s); };
// A folder with at least one file (any depth, hidden files not counted). An empty folder such as docs/stack is not a doc set yet.
const hasFiles = (dir) => { try { return fs.readdirSync(dir, { recursive: true, withFileTypes: true }).some((e) => e.isFile() && !e.name.startsWith('.')); } catch { return false; } };
let cache, cacheKey;
function loadConfig() {
  const file = projectsFile();
  const st = fs.statSync(file, { throwIfNoEntry: false }); const mtime = st ? st.mtimeMs : 0;   // no throw: a thrown ENOENT is slow on every call
  const key = file + '@' + mtime; if (cache && cacheKey === key) return cache;
  let j;
  if (mtime) {
    j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j.version !== 1) throw new Error(`projects.json version ${j.version} is not supported (expected 1)`);
  } else {
    const docs = path.join(dataDir(), 'docs');
    j = { projects: fs.existsSync(docs) ? fs.readdirSync(docs, { withFileTypes: true }).filter((e) => e.isDirectory() && hasFiles(path.join(docs, e.name)))
      .map((e) => ({ name: e.name, root: path.join('docs', e.name) })) : [] };
  }
  const seen = new Set();
  const projects = (j.projects || []).map((p) => {
    checkName(p.name); if (seen.has(p.name)) throw new Error('duplicate project: ' + p.name); seen.add(p.name);
    const root = (p.rootEnv && process.env[p.rootEnv]) || resolveRoot(p.root);   // rootEnv is used raw, like MK_DOCS today
    const rank = p.rank ? resolveRoot(p.rank) : path.join(privateDir(p.name), 'rank.json');
    return { ...DEFAULTS, label: p.name, ...p, root, rank, chain: { ...DEFAULTS.chain, ...(p.chain || {}) } };
  });
  const legacyProject = j.legacyProject || null;   // tag for map rows written before projects existed (owner only)
  if (legacyProject && !seen.has(legacyProject)) throw new Error(`legacyProject ${legacyProject} is not a project`);
  const embedModel = typeof j.embedModel === 'string' && j.embedModel ? j.embedModel : null;   // optional: a tuned meaning model, e.g. "local/gabriel-tuned"
  const rerankModel = typeof j.rerankModel === 'string' && j.rerankModel ? j.rerankModel : null;   // optional: a tuned reranker, e.g. "local/gabriel-rerank"
  cache = { projects, legacyProject, ruleFiles: j.ruleFiles || defaultRuleFiles(), embedModel, rerankModel }; cacheKey = key; return cache;
}
const loadProjects = () => loadConfig().projects;
const getProject = (name) => loadProjects().find((p) => p.name === name);
const projectNames = () => loadProjects().map((p) => p.name);
const DEFAULT_EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
// The meaning model id: env GABRIEL_EMBED_MODEL first, then projects.json "embedModel", then the default. Never throws.
function embedModel() {
  if (process.env.GABRIEL_EMBED_MODEL) return process.env.GABRIEL_EMBED_MODEL;
  try { return loadConfig().embedModel || DEFAULT_EMBED_MODEL; } catch { return DEFAULT_EMBED_MODEL; }
}
// The reranker id: env GABRIEL_RERANK_MODEL first (empty = off), then projects.json "rerankModel", else null. Never throws.
function rerankModel() {
  if (process.env.GABRIEL_RERANK_MODEL !== undefined) return process.env.GABRIEL_RERANK_MODEL || null;
  try { return loadConfig().rerankModel || null; } catch { return null; }
}
module.exports = { hasFiles, loadConfig, loadProjects, getProject, projectNames, DEFAULTS, resolveRoot, embedModel, DEFAULT_EMBED_MODEL, rerankModel };
