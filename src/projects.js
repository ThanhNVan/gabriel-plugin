// Which doc sets the map knows. From <dataDir>/projects.json (file order is the routing order);
// with no file, one project per folder under <dataDir>/docs/.
const fs = require('fs'), os = require('os'), path = require('path');
const { dataDir, projectsFile, privateDir, checkName } = require('./paths');
const DEFAULTS = { layout: 'auto', graph: null, skipDirs: ['graphify-out', 'node_modules', '.git', 'atlas', '_tools'],
  aliases: [], cwdHints: [], prior: 0, learn: true, fallback: false, coreDocs: null };
const resolveRoot = (r) => { const s = String(r || '');
  if (s.startsWith('~')) return path.join(os.homedir(), s.slice(1).replace(/^[\\/]/, ''));
  return path.isAbsolute(s) ? path.resolve(s) : path.join(dataDir(), s); };
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
    j = { projects: fs.existsSync(docs) ? fs.readdirSync(docs, { withFileTypes: true }).filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, root: path.join('docs', e.name) })) : [] };
  }
  const seen = new Set();
  const projects = (j.projects || []).map((p) => {
    checkName(p.name); if (seen.has(p.name)) throw new Error('duplicate project: ' + p.name); seen.add(p.name);
    const root = (p.rootEnv && process.env[p.rootEnv]) || resolveRoot(p.root);   // rootEnv is used raw, like MK_DOCS today
    const rank = p.rank ? resolveRoot(p.rank) : path.join(privateDir(p.name), 'rank.json');
    return { ...DEFAULTS, label: p.name, ...p, root, rank };
  });
  const legacyProject = j.legacyProject || null;   // tag for map rows written before projects existed (owner only)
  if (legacyProject && !seen.has(legacyProject)) throw new Error(`legacyProject ${legacyProject} is not a project`);
  cache = { projects, legacyProject, ruleFiles: j.ruleFiles || ['CLAUDE.md'] }; cacheKey = key; return cache;
}
const loadProjects = () => loadConfig().projects;
const getProject = (name) => loadProjects().find((p) => p.name === name);
const projectNames = () => loadProjects().map((p) => p.name);
module.exports = { loadConfig, loadProjects, getProject, projectNames, DEFAULTS, resolveRoot };
