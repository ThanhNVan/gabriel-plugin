// Project map: a neuron-like network over one project's docs (technical-docs, or every .md; see projects.js) + its graphify code graph.
//   neurons   doc chunks (technical-docs), code nodes (graphify graph.json), communities (hidden layer)
//   synapses  graphify edges (calls/implements/... strong, imports weak), doc->code (cited paths and symbols),
//             doc->doc (links, same section, shared code names)
//   firing    a prompt lights seed neurons by words, synonyms and meaning; the light then spreads a few steps
//             along the synapses (hubs are damped, each step keeps only the strongest) and the strongest neurons are shown.
// Everything lives in one derived file, data/mk.db (not in git; rebuilt by `node brain.js build-mk`). Any trouble = no map, never a failed prompt.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { homeDir, dataDir, tokens, loadThesaurus } = require('./rules.js');
const paths = require('./paths.js');
const { debug } = require('./debuglog.js');
const { extSet, isDocName, extractText } = require('./extract.js');
const repo = require('./repo.js');

const DB_VERSION = 7;     // 2 = stable node keys + learning tables; 3 = plural stems (ies -> y) and heading words ('#word') in the word index; 6 = class-name text has folders; 7 = handler table
const DECAY = 0.55, ROUNDS = 3, FRONTIER = 300, HUB = 600;     // spreading: damping per step, steps, neurons kept per step, a neuron with more links only receives
const SEED_DOCS = 30, SEED_CODE = 30, SEED_HUB = 800;          // seeds kept per layer; code nodes with more links than SEED_HUB are never seeds
const MIN_SCORE = 2.5, WORD_SCALE = 12, THESAURUS_WEIGHT = 0.5; // same word scoring as rules.js
const SIM_FLOOR = 0.2, SIM_SPAN = 0.35, SIM_GATE = 0.3;         // meaning score of a doc chunk, same calibration as brain.js
const HEAD_GATE = 0.52;   // a question this close in meaning to a section title passes the gate on its own
const ROUTE_NAMED = 1.2;   // see searchAll
const ALSO_CLOSE = 0.4, FALLBACK_IF_WEAKER_THAN = 1.6, ALSO_CHARS = 1100;   // a second project block when its score is within 0.4 of the best; the fallback docs are only asked when the project's own best is under 1.6
const FALLBACK_FIRST = 0.8;
const FALLBACK_GATE = 1.7, FALLBACK_MARGIN = 0.3, FALLBACK_PROBE_ALONE = 0.5, FALLBACK_PROBE_WITH_PROJECT = 1.0;   // general docs: their own stricter gate (positives: median 2.35, 10th percentile 1.75; unrelated prompts: median 0.67, 90th percentile 1.10), the lead needed over a project, and the words-only look that decides whether the full tech search runs
const CODE_SIM = 0.55;  // a class name must be this close in meaning to the question to be added
const CODE_K = 2;       // at most this many class names (closest in meaning first) are added to the code list
const MAX_DOCS = 6, MAX_CODE = 6, MAX_CHARS = 2200, DOC_CHARS = 210, GATE = 0.65, CODE_KEEP = 2;
const POOL = 50;   // candidate pool size for the code reranker (search opts.pool)
const POOL_NEAR = 20;   // pool slots for the closest class names by meaning (no score cut)
// Learning from use: opening or editing a file soon after a map was shown strengthens the links from that prompt's strongest seeds to the file's main types.
// Bounded on purpose: a link saturates at LEARN_MAX (a full link counts like one full graph edge), fades with a half-life, needs several confirmations to show, and is never used to start a search or pass the gate.
const LEARN_RATE = 0.2, LEARN_MAX = 1, LEARN_GAIN = 1, LEARN_PRUNE = 0.02, LEARN_MIN_N = 2, LEARN_CAP = 0.45, HALF_LIFE_DAYS = 45, LEARN_WINDOW_MS = 45 * 60000, LEARN_SEEDS = 8, LEARN_TARGETS = 3;
const GENERIC = new Set('Empty Task CancellationToken IEnumerable DateTime Guid List Dictionary String Int32 Result IRequest IRequestHandler Unit Component Object Json Action Func Exception Boolean Nullable Type Tuple'.split(' '));
const CLASS_NAME = /^[A-Za-z][A-Za-z0-9]{4,}$/;   // a class name (the old vecc rows); function and method names are also embedded, but only classes are shown
const NB_CODE = 3, NB_PER = 4, NB_CHARS = 900;   // map output: neighbors shown for the top 3 code hits, 4 each
const CHAIN_VERBS = new Set(['Set', 'Get', 'Create', 'Update', 'Delete', 'Add', 'Remove', 'On']);
const CHAIN_ROLES = new Set(['Command', 'Query', 'Request', 'Handler', 'Dto', 'Event', 'Notification', 'Message', 'Service', 'Repository', 'Result']);   // trailing role words are not the stem (VesselPurgeCommandHandler -> Vessel%Purge, which also finds OnVesselPurged)
const CHAIN_DEFAULT = { seeds: 4, max: 3, stem: 3 };   // seeds 4: 11/12 on eval-cases-chain.json vs 10/12 with 3; main gate unchanged (523/569, quiet 30/31), 2026-11-14   // fallback for the "two links away" step (seeds, max, stem); the real values come from the project's chain setting in projects.js, or opts.chain. Clamped in search().
// a setting that is not a finite number falls back to its default; the rest is clamped into its range
const chainNum = (v, d, lo, hi) => Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
const HANDLER_REL = new Set(['handled_by', 'sends_to_handler', 'dapr_to_handler']);   // graph links from a sender or event to its handler
const REL = { calls: 1, implements: 1, inherits: 1, extends: 1, dispatches_to: 1, rationale_for: 0.8, conceptually_related_to: 0.6, semantically_similar_to: 0.6, method: 0.7, defines: 0.6, contains: 0.5, references: 0.3, imports: 0.2, imports_from: 0.2, re_exports: 0.2, handled_by: 1, publishes_event: 1, raises_event: 1, sends_to_handler: 1, publishes_to_handler: 1, implemented_by: 1, http_route: 1, template_calls: 1, template_uses: 1, uses_dbset: 1 };

// Projects come from projects.js (file order = routing order). A search looks at one project only, so a new project cannot disturb the answers of the others.
const { loadConfig, loadProjects, getProject, projectNames, embedModel, DEFAULT_EMBED_MODEL } = require('./projects');
// the default project: the one with a routing prior, else the first that is not a fallback
const defaultProject = () => { const ps = loadProjects(); return (ps.find((p) => p.prior > 0) || ps.find((p) => !p.fallback) || ps[0] || {}).name; };
const docsRoot = (project = defaultProject()) => { const p = getProject(project); if (!p) throw new Error('unknown project: ' + project); return p.root; };
const graphPathOf = (project) => { const P = getProject(project) || {}; return P.graph ? (path.isAbsolute(P.graph) ? P.graph : path.join(docsRoot(project), P.graph)) : null; };   // an absolute graph path stays as it is (a copied doc root, as in the tune run, keeps it)   // the project's code graph file (null when it sets none); build() and status use the same rule
const legacyProject = () => loadConfig().legacyProject;
const isFallback = (project) => !!(getProject(project) || {}).fallback;   // the general docs: answer only when no project does
const dbFile = (home) => path.join(dataDir(home), 'mk.db');   // one file for all projects; every row carries its project
const f32 = (b) => (b.byteOffset % 4 === 0 ? new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) : new Float32Array(new Uint8Array(b).buffer));   // meaning numbers read in place (a copy only when the bytes are not aligned): the scan covers every chunk of a project
const sqlite = () => require('node:sqlite').DatabaseSync;       // loaded here so a missing module never breaks the hook

// ---- words ----
const camel = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
const nameCore = (label) => String(label).replace(/^\./, '').replace(/\(\)$/, '');   // .collect_metrics() -> collect_metrics
// the text embedded for a class name: its words, then the last 4 folders of its file (the file name is left out)
const codeText = (label, file) => {
  const parts = String(file || '').replace(/\\/g, '/').split('/');
  parts.pop();
  return camel(nameCore(label)).replace(/[_.]+/g, ' ').trim().toLowerCase() + ' | ' + parts.slice(-4).join(' ');
};
const MAX_RICH_BYTES = 2 * 1024 * 1024, BODY_LINES = 12, BODY_CHARS = 600, COMMENT_LINES = 3;
const codeDesc = new Map();
function resetCodeDesc() { codeDesc.clear(); }
function descriptions(project) {
  if (!codeDesc.has(project)) {
    let data = {};
    try {
      const value = JSON.parse(fs.readFileSync(path.join(paths.privateDir(project), 'code-desc.json'), 'utf8'));
      if (value && typeof value === 'object' && !Array.isArray(value)) data = value;
    } catch { /* missing or invalid file */ }
    codeDesc.set(project, data);
  }
  return codeDesc.get(project);
}
function codeLabels(db, project) {
  const fileOf = new Map();
  const where = project === undefined ? '' : ' AND project = ?';
  const stmt = db.prepare("SELECT label, file, deg FROM nodes WHERE kind = 'code' AND file != ''" + where + ' ORDER BY deg ASC');
  for (const r of (project === undefined ? stmt.all() : stmt.all(project))) {
    if (fileOf.has(r.label) || GENERIC.has(r.label)) continue;
    if (CLASS_NAME.test(r.label) || (/^\.?[A-Za-z_][A-Za-z0-9_]*\(\)$/.test(r.label) && nameCore(r.label).length >= 5)) fileOf.set(r.label, r.file);
  }
  return fileOf;
}
// the doc comment right above the definition (def = 1-based line): up to 3 comment lines, nearest first; text only (no /// or /** marks, no XML tags)
function docComment(lines, def) {
  const out = [];
  let walked = 0;
  for (let i = def - 2; i >= 0 && walked < COMMENT_LINES; i--) {
    const t = lines[i].trim();
    if (!/^(\/\/|\/\*|\*)/.test(t)) break;
    walked++;
    const text = t.replace(/^\/\/\/?|^\/\*\*?|\*\/$|^\*/g, '').replace(/<[^>]+>/g, ' ').trim();
    if (text) out.unshift(text);
  }
  return out.join(' ');
}
// the lines of a code file in the project's repo folder (cached per call); null when there is no repo, no file or a file over 2 MB. Never throws.
function fileLines(project, file, cache) {
  try {
    const P = getProject(project) || {};
    if (!P.repo || !fs.existsSync(P.repo)) return null;
    const key = path.join(P.repo, P.repoBase || '', String(file).replace(/\\/g, '/'));
    if (!cache.has(key)) {
      let lines = false;
      const st = fs.statSync(key, { throwIfNoEntry: false });
      if (st && st.isFile() && st.size <= MAX_RICH_BYTES) lines = fs.readFileSync(key, 'utf8').split('\n');
      cache.set(key, lines);
    }
    return cache.get(key) || null;
  } catch {
    return null;
  }
}
// the doc comment text above a code definition in the repo ('' when none). Same file reader as richText. --sda uses it.
function commentOf(label, file, project, cache = new Map()) {
  try {
    const lines = fileLines(project, file, cache);
    if (!lines) return '';
    const def = repo.defLine(lines.join('\n'), String(label).replace(/^\./, '').replace(/\(\)$/, ''));
    return def ? docComment(lines, def) : '';
  } catch {
    return '';
  }
}
// codeText plus the doc comment above the definition and the code body from the project's repo folder: the 12 non-empty lines from the definition, cut to 600 chars.
// cache (a Map) holds each file's lines for one call: false when the file is missing or over 2 MB. Never throws.
function richText(label, file, project, cache = new Map()) {
  const desc = descriptions(project)[label];
  const base = codeText(label, file) + (typeof desc === 'string' && desc ? ' | ' + desc : '');
  try {
    const lines = fileLines(project, file, cache);
    if (!lines) return base;
    const name = String(label).replace(/^\./, '').replace(/\(\)$/, '');
    const def = repo.defLine(lines.join('\n'), name);   // 1-based, 0 = not found
    if (!def) return base;
    const body = [];
    for (let i = def - 1; i < lines.length && body.length < BODY_LINES; i++) {   // from the definition line itself (its signature carries the most)
      const t = lines[i].trim();
      if (t) body.push(t);
    }
    const text = body.join(' ').replace(/\s+/g, ' ').slice(0, BODY_CHARS);
    const parts = [docComment(lines, def), text].filter(Boolean);
    return parts.length ? base + ' | ' + parts.join(' ') : base;
  } catch {
    return base;
  }
}
// The root of a word, so that forms of one word meet: generated and generator -> generat, sends and sender -> send. Cut up to two endings, drop a doubled end letter and a final e.
function rootOf(w) {
  let r = w;
  for (let pass = 0; pass < 2; pass++) {
    const s = ['ing', 'ers', 'ors', 'ed', 'er', 'or'].find((x) => r.endsWith(x) && r.length - x.length >= 4);
    if (!s) break;
    r = r.slice(0, -s.length);
  }
  const s = ['ation', 'ion'].find((x) => r.endsWith(x) && r.length - x.length >= 4);
  if (s) r = r.slice(0, -s.length);
  if (/([b-df-hj-np-tv-z])\1$/.test(r) && r.length > 4) r = r.slice(0, -1);
  return r.length > 4 && r.endsWith('e') ? r.slice(0, -1) : r;
}
function words(text) { // normal words, plus the pieces of identifiers: IhmEventTask -> ihmeventtask, ihm, event, task
  const out = tokens(text);
  for (const w of tokens(camel(text))) out.add(w);
  for (const w of [...out]) if (w.length > 5 && w.endsWith('ie')) out.add(w.slice(0, -2) + 'y'); // repositories -> (stemmed) repositorie -> repository
  return out;
}
// word families, for the code-name pass: sends, sender and send are one family; generated and generator are one family
const CODE_SYN = [['update', 'change', 'edit', 'modify'], ['create', 'add', 'new', 'insert'], ['delete', 'remove', 'drop'], ['store', 'save', 'persist', 'keep'], ['get', 'fetch', 'load', 'read'], ['find', 'search', 'lookup'], ['hold', 'collect', 'gather', 'accumulate']];
const CODE_FILLER = new Set(['class', 'type', 'object', 'thing', 'item', 'one']);   // words of a question that never help to find a class name
let canonCache;
const canon = () => canonCache ||= new Map(CODE_SYN.flatMap((g) => g.map((w) => [rootOf(w), rootOf(g[0])])));
const familyOf = (w) => { const r = rootOf(w.length === 4 && w.endsWith('s') && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w); return canon().get(r) || r; };
const families = (text, skip) => { const out = new Set(); for (const w of words(text)) if (w.length >= 3 && /^[a-z]+$/.test(w) && !(skip && skip.has(w))) out.add(familyOf(w)); return out; };
// words that mean nearly the same in this codebase and its docs (only the map uses them; the rules brain keeps its own list)
const MK_SYNONYMS = [['manual', 'manually', 'hand', 'handmade'], ['store', 'storage', 'persist', 'saved', 'kept'], ['working', 'healthy', 'strong', 'shape'], ['base', 'root', 'parent', 'inherit', 'super'],
  ['style', 'convention', 'format', 'lint'], ['disagree', 'drift', 'mismatch', 'differ', 'contradict', 'inconsistent'], ['authorization', 'authorisation', 'permission', 'access', 'rights'],
  ['frontend', 'front', 'ui', 'angular', 'spa'], ['sidecar', 'dapr'], ['install', 'prerequisite', 'requirement', 'setup'], ['start', 'run', 'launch', 'boot'], ['event', 'message', 'notification'],
  ['log', 'trace', 'observability', 'telemetry'], ['fail', 'broken', 'error', 'crash', 'wrong'], ['cors', 'origin'], ['health', 'alive', 'liveness', 'heartbeat'], ['outbox', 'bus']];
const coreRe = new Map();   // per project: the broad docs that a general question usually wants (coreDocs in projects.json)
const coreDoc = (project) => { const s = (getProject(project) || {}).coreDocs; if (!coreRe.has(s)) coreRe.set(s, s ? new RegExp(s) : null); return coreRe.get(s); };
const META_Q = new Set(['disagree', 'drift', 'mismatch', 'differ', 'contradict', 'bug', 'finding', 'unfixed', 'broken', 'problem', 'improve', 'suggestion', 'gap', 'wrong', 'outdated', 'stale'].map(familyOf));
let mkSynCache;
const mkSynonyms = () => (mkSynCache ||= MK_SYNONYMS.map((g) => g.map((w) => [...tokens(w)][0]).filter(Boolean)));
const rankCache = new Map();   // file path -> weights for the doc ranking (the project's rank.json); null = none, the plain activation order is used
function loadRank(project) {
  const file = (getProject(project) || {}).rank;
  if (!file) return null;
  if (!rankCache.has(file)) { let w = null; try { w = JSON.parse(fs.readFileSync(file, 'utf8')).w ?? null; } catch { /* no file: plain order */ } rankCache.set(file, w); }
  return rankCache.get(file);
}

function rankDocs(rows, weights, max = MAX_DOCS) {
  const scored = rows.map((r) => ({ ...r, z: r.f.reduce((s, v, i) => s + v * (weights[i] || 0), 0) })).sort((a, b) => b.z - a.z);
  const picked = [], per = new Map(), sections = new Set();
  for (const r of scored) {
    const key = r.n.file + '::' + r.n.section;
    if (picked.length >= max || sections.has(key) || (per.get(r.n.file) || 0) >= 2 || r.z < scored[0].z - 3) continue;
    sections.add(key); per.set(r.n.file, (per.get(r.n.file) || 0) + 1); picked.push(r);
  }
  return picked;
}
// the role a folder gives to the classes inside it: a class under TicketAggr/ is an aggregate, under Queries/ a query
const ROLE_FOLDER = [[/Aggr$/, 'aggregate'], [/^Events$/, 'event'], [/^Queries$/, 'query'], [/^Commands$/, 'command'], [/^Controllers$/, 'controller'], [/^Policies$/, 'policy'], [/^Repositories$/, 'repository'], [/\.Domain$/, 'domain'], [/\.Application$/, 'application']];
const roleWords = (file) => {
  const segs = String(file || '').split('/').slice(0, -1), out = [];
  for (const seg of segs) for (const [re, w] of ROLE_FOLDER) if (re.test(seg)) out.push(w);
  const i = segs.indexOf('Services');
  if (i >= 0 && segs[i + 1]) out.push(segs[i + 1].replace(/([a-z])([A-Z])/g, '$1 $2'));   // the service a class lives in (Services/<Name>/…) is part of what it is
  return out.join(' ');
};

// ---- reading the docs ----
const AUTO_SKIP = new Set(['graphify-out', 'node_modules', '.git', 'atlas', '_tools']);
// layout: 'auto' = technical-docs/ when there is one, else every doc file; 'technical-docs' = only that folder; 'all-md' = every doc file, except skipDirs
// exts: a Set of lowercase extensions with the dot (extSet): the project's "extensions", default every default type
function listDocs(root, layout = 'auto', skipDirs = [...AUTO_SKIP], exts = extSet(null)) {
  const out = [], base = path.join(root, 'technical-docs');
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'atlas' && e.name !== '_tools') walk(p); } else if (isDocName(e.name, exts)) out.push(p); } };
  const walkAll = (d, skip) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!skip.has(e.name)) walkAll(p, skip); } else if (isDocName(e.name, exts)) out.push(p); } };
  if (layout === 'all-md') walkAll(root, new Set(skipDirs));
  else if (fs.existsSync(base)) walk(base);
  else if (layout === 'auto') walkAll(root, AUTO_SKIP);   // a project without technical-docs/: every .md under the root, except tool folders
  return out.sort();
}

const clean = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*{1,3}/g, '').replace(/(^|\s)_+|_+(?=\s|$)/g, '$1').replace(/\s+/g, ' ').trim(); // keeps underscores inside names like DEFINITION_OF_DONE
const slug = (h) => h.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-');

// Split one markdown file into chunks of about 450 characters. A chunk keeps its heading path.
function chunkDoc(rel, raw) {
  const out = [], stack = [];
  // line: the 1-based line of the section's heading in the file. Only formats whose text keeps the file's own lines get one (extract.js rewrites the rest, so 0 there).
  const numbered = /\.(md|markdown|mdx|txt|text)$/i.test(rel), topLines = /\.(txt|text)$/i.test(rel) ? 1 : 0;   // extract.js puts a "# name" line on top of a .txt file
  let fence = false, buf = '', sec = '', secLine = 1, lineNo = 0;
  const lineOf = () => numbered ? Math.max(1, secLine - topLines) : 0;
  const flush = () => {
    let t = buf.trim(); buf = '';
    if (!t || /^[-=]+$/.test(t)) return;
    while (t.length > 450) {
      const space = t.lastIndexOf(' ', 450);
      let end = space > 0 ? space : 450;
      if (/[\uD800-\uDBFF]/.test(t[end - 1])) end--;
      out.push({ section: sec, text: t.slice(0, end), line: lineOf() }); t = t.slice(end).trimStart();
    }
    if (t) out.push({ section: sec, text: t, line: lineOf() });
  };
  for (const line of raw.split(/\r?\n/)) {
    lineNo++;
    if (/^\s*```/.test(line)) { flush(); fence = !fence; continue; }
    const h = !fence && line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(); stack.length = h[1].length - 1; stack[h[1].length - 1] = clean(h[2]); sec = stack.filter(Boolean).join(' > '); secLine = lineNo; continue; }
    if (!line.trim()) { flush(); continue; }
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) continue;             // table separator row
    const text = clean(line.replace(/^\s*[-*]\s+|^\s*\d+\.\s+|^\s*>\s?/, '').replace(/^\||\|$/g, '').replace(/\|/g, ' · '));
    if (!text) continue;
    if (buf && buf.length + text.length > 450) flush();
    buf += (buf ? ' ' : '') + text;
  }
  flush();
  const links = [...raw.matchAll(/\]\(([^)#\s]+\.md)(?:#([^)]*))?\)/g)].map((m) => ({ file: path.basename(m[1]), anchor: m[2] || '' }));
  return { rel, no: (path.basename(rel).match(/^(\d+)/) || [])[1] || path.parse(rel).name, chunks: out, links };
}

const PATH_RE = /[\w./-]+\.(?:cs|ts|html|scss|py|yml|json|ps1)\b/g;
const spansOf = (t) => [...t.matchAll(/`([^`]{2,80})`/g)].map((m) => m[1].trim());

// ---- build ----
async function build(home = homeDir(), opts = {}) {
  const project = opts.project || defaultProject(), P = getProject(project) || {}, root = opts.root || docsRoot(project), t0 = Date.now(), log = opts.log || (() => {});
  const gp = P.graph || null, graphPath = gp ? path.resolve(root, gp) : null;   // a project without a code graph (the general docs) has none
  if (graphPath && !fs.existsSync(graphPath)) throw new Error(`graph not found: ${graphPath}; run /graphify on the code repo, or fix "graph" for ${project} in projects.json`);   // before any write: the old map stays
  const g = graphPath && fs.existsSync(graphPath) ? JSON.parse(fs.readFileSync(graphPath, 'utf8')) : { nodes: [], links: [], built_at_commit: '' };
  const files = listDocs(root, P.layout, P.skipDirs, extSet(P.extensions));
  const tmp = dbFile(home) + '.' + process.pid + '.tmp';
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  for (const f of fs.readdirSync(path.dirname(tmp))) if (f.startsWith(path.basename(dbFile(home)) + '.') && f.endsWith('.tmp')) { try { fs.rmSync(path.join(path.dirname(tmp), f), { force: true }); } catch { /* still in use by a build that is running */ } }
  const db = new (sqlite())(tmp);
  db.exec(`CREATE TABLE nodes(id INTEGER PRIMARY KEY, kind TEXT, label TEXT, file TEXT, loc TEXT, section TEXT, text TEXT, comm INTEGER, deg INTEGER, nkw INTEGER, key TEXT);
    CREATE TABLE learn(ka TEXT, kb TEXT, w REAL, n INTEGER, t INTEGER, PRIMARY KEY(ka, kb));
    CREATE TABLE last(session TEXT PRIMARY KEY, t INTEGER, seeds TEXT, done TEXT);
    CREATE TABLE kw(word TEXT, node INTEGER);
    CREATE TABLE kw2(word TEXT, node INTEGER);
    CREATE TABLE df(word TEXT, kind TEXT, n INTEGER, PRIMARY KEY(word, kind));
    CREATE TABLE edges(a INTEGER, b INTEGER, w REAL);
    CREATE TABLE handler(a INTEGER, b INTEGER);
    CREATE TABLE comm(id INTEGER PRIMARY KEY, name TEXT, size INTEGER);
    CREATE TABLE vec(node INTEGER PRIMARY KEY, v BLOB);
    CREATE TABLE vech(node INTEGER PRIMARY KEY, v BLOB);
    CREATE TABLE vecc(label TEXT PRIMARY KEY, v BLOB);
    CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT);`);
  const addNode = db.prepare('INSERT INTO nodes VALUES(?,?,?,?,?,?,?,?,?,?,?)'), addKw = db.prepare('INSERT INTO kw VALUES(?,?)'), addKw2 = db.prepare('INSERT INTO kw2 VALUES(?,?)'), addEdge = db.prepare('INSERT INTO edges VALUES(?,?,?)');
  db.exec('BEGIN');
  let nid = 0;
  // 1. code neurons
  const codeId = new Map(), labelOf = new Map(), byFile = new Map(), byLabel = new Map(), comms = new Map(), migr = new Set();   // migr: ids of EF migration nodes (noise)
  for (const n of g.nodes) {
    const id = ++nid; codeId.set(n.id, id); labelOf.set(id, n.label || ''); if (n.migration) migr.add(id);
    const kws = words(n.label || '');
    addNode.run(id, 'code', n.label || '', n.source_file || '', n.source_location || '', '', '', n.community ?? -1, 0, kws.size, 'c|' + n.id);   // the graph's own id: stable across rebuilds
    if (!n.migration) for (const w of kws) addKw.run(w, id);   // no keyword rows for migration nodes
    for (const f of families((n.label || '') + ' ' + roleWords(n.source_file))) addKw2.run(f, id);   // the code-name pass: word families, never used to start a doc search or to spread
    if (n.source_file) (byFile.get(n.source_file) || byFile.set(n.source_file, []).get(n.source_file)).push(id);
    if (n.label) (byLabel.get(n.label) || byLabel.set(n.label, []).get(n.label)).push(id);
    if (n.community !== undefined) { const c = comms.get(n.community) || { name: n.community_name || '', size: 0 }; c.size++; comms.set(n.community, c); }
  }
  const addComm = db.prepare('INSERT INTO comm VALUES(?,?,?)');
  for (const [id, c] of comms) addComm.run(id, c.name, c.size);
  log(`code neurons ${g.nodes.length}, communities ${comms.size}`);
  // 2. code synapses (one row per direction; the strongest relation of a pair wins)
  const M = g.nodes.length + 1;   // code ids are 1..nodes, so M is above every id; the pair key is a * M + b (safe while M * M < 2^53)
  const pair = new Map();
  for (const e of g.links) {
    const a = codeId.get(e.source), b = codeId.get(e.target);
    if (!a || !b || a === b) continue;
    const w = (REL[e.relation] ?? 0.3) * (e.confidence_score ?? 1);
    const w2 = migr.has(a) || migr.has(b) ? w * 0.2 : w;   // migration end: weak synapse
    const k = a < b ? a * M + b : b * M + a;
    if ((pair.get(k) || 0) < w2) pair.set(k, w2);
  }
  const deg = new Map();
  for (const [k, w] of pair) {
    const a = Math.floor(k / M), b = k % M;
    addEdge.run(a, b, w); addEdge.run(b, a, w);
    deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1);
  }
  log(`code synapses ${pair.size}`);
  // 2b. handler links: the sender and the event (by name) each point to the handler. Skips duplicates.
  const addHandler = db.prepare('INSERT INTO handler VALUES(?,?)'), hseen = new Set();
  const putHandler = (a, b) => { if (hseen.has(a * M + b)) return; hseen.add(a * M + b); addHandler.run(a, b); };
  for (const e of g.links) {
    const b = codeId.get(e.target);
    if (!b || !HANDLER_REL.has(e.relation)) continue;
    const a = codeId.get(e.source);
    if (a) putHandler(a, b);
    for (const ev of byLabel.get(e.event) || []) putHandler(ev, b);
  }
  // 3. doc neurons and their synapses
  const docs = [];
  let skipped = 0;   // files with no readable text (unreadable, empty, scanned PDF, opt-in file too big or skipped)
  for (const f of files) {
    const text = await extractText(f);
    if (!text.trim()) { skipped++; continue; }
    docs.push(chunkDoc(path.relative(root, f).replace(/\\/g, '/'), text));
  }
  const docIds = [], byDocName = new Map(), spanChunks = new Map();
  let linkedChunks = 0;   // doc chunks with at least one link to a code neuron
  const link = (a, b, w) => { addEdge.run(a, b, w); addEdge.run(b, a, w); deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); };
  for (const d of docs) {
    d.ids = [];
    let prev = 0;
    for (const c of d.chunks) {
      const id = ++nid; c.id = id; d.ids.push(id);
      const sp = spansOf(c.text);
      const heading = (c.section.split(' > ').pop() || '');
      const kws = new Set([...[...words(c.section + ' ' + c.text)].filter((w) => w[0] !== '~'), ...sp.map((s) => s.toLowerCase()), ...[...c.text.matchAll(PATH_RE)].map((m) => m[0].toLowerCase()), ...[...words(heading)].map((w) => '#' + w)]); // '#word' = a word of the chunk's own heading: a question that names a heading should find its section
      addNode.run(id, 'doc', 'doc ' + d.no, d.rel, c.line ? 'L' + c.line : '', c.section, c.text, -1, 0, kws.size, 'd|' + d.rel + '|' + crypto.createHash('sha1').update(c.section + '\n' + c.text).digest('hex').slice(0, 12));   // changes only when the chunk's text changes
      for (const w of kws) addKw.run(w, id);
      docIds.push(id);
      if (prev) link(prev, id, 0.3);                      // next chunk in the same file
      prev = id;
      for (const s of new Set(sp)) (spanChunks.get(s) || spanChunks.set(s, []).get(s)).push(id);
      // doc -> code: a cited file path, a cited symbol (toCode counts the links to code neurons from this chunk)
      let toCode = 0;
      for (const p0 of new Set([...c.text.matchAll(PATH_RE)].map((m) => m[0]))) {
        const p = p0.replace(/^src\//, '').replace(/^\.\//, '');
        const hit = byFile.get(p) || [...byFile].find(([f]) => f.endsWith('/' + p))?.[1];
        if (!hit) continue;
        const base = path.basename(p).replace(/\.[^.]+$/, '');
        const top = hit.slice().sort((x, y) => (labelOf.get(x) === base ? 0 : 1) - (labelOf.get(y) === base ? 0 : 1)).slice(0, 6);
        for (const t of top) { link(id, t, 1); toCode++; }
      }
      for (const s of new Set(sp)) {
        const sym = s.replace(/\(\)$/, '').split('.').pop(), name = s.replace(/\(\)$/, '');
        // a lowercase name links only as an exact label (graphify writes functions as name()), at 4+ characters, camelCase or a call: `addDocs`, `addDocs()`
        const lower = /^[a-z]/.test(sym) && name.length >= 4 && (/[A-Z]/.test(name.slice(1)) || /\(\)$/.test(s));
        const hit = lower ? byLabel.get(name + '()') || byLabel.get(s) : byLabel.get(sym) || byLabel.get(s);
        if (hit && hit.length <= 3 && (lower || /^[A-Z]/.test(sym))) for (const t of hit) { link(id, t, 0.9); toCode++; }
      }
      if (toCode) linkedChunks++;
    }
    byDocName.set(path.basename(d.rel), d);
  }
  // doc -> doc: markdown links (to the chunk whose heading matches the anchor, else the first chunk), shared code names, same section
  for (const d of docs) for (const l of d.links) {
    const t = byDocName.get(l.file); if (!t || !t.chunks.length || !d.ids.length) continue;
    const hit = l.anchor ? t.chunks.find((c) => slug(c.section.split(' > ').pop() || '') === l.anchor) : null;
    link(d.ids[0], (hit || t.chunks[0]).id, 0.8);
  }
  for (const [, ids] of spanChunks) if (ids.length >= 2 && ids.length <= 6) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) link(ids[i], ids[j], 0.7);
  const bySec = new Map();
  for (const d of docs) for (const c of d.chunks) { const k = d.rel + '::' + c.section; (bySec.get(k) || bySec.set(k, []).get(k)).push(c.id); }
  for (const ids of bySec.values()) if (ids.length <= 8) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) link(ids[i], ids[j], 0.4);
  log(`doc neurons ${docIds.length} from ${docs.length} files`);
  if (g.nodes.length && docIds.length && linkedChunks * 100 < docIds.length) log(`warning: the docs name almost none of this graph's code (${linkedChunks} of ${docIds.length} sections link to it); is the code graph the right repo?`);
  // 4. degrees, word counts per layer, meta
  const setDeg = db.prepare('UPDATE nodes SET deg = ? WHERE id = ?');
  for (const [id, d] of deg) setDeg.run(d, id);
  db.exec('CREATE INDEX kw_w ON kw(word); CREATE INDEX kw2_w ON kw2(word); CREATE INDEX edges_a ON edges(a); CREATE INDEX nodes_kind ON nodes(kind);');
  db.exec('CREATE TABLE df2(word TEXT PRIMARY KEY, n INTEGER); INSERT INTO df2 SELECT word, COUNT(*) FROM kw2 GROUP BY word;');
  db.exec('INSERT INTO df SELECT k.word, n.kind, COUNT(*) FROM kw k JOIN nodes n ON n.id = k.node GROUP BY k.word, n.kind;');
  const setMeta = db.prepare('INSERT INTO meta VALUES(?,?)');
  for (const [k, v] of Object.entries({ version: DB_VERSION, built: Date.now(), commit: g.built_at_commit || '', root, stamp: JSON.stringify(sources(root, project)), nCode: g.nodes.length, nDoc: docIds.length, embed: embedModel() })) setMeta.run(k, String(v));   // embed: the meaning model these numbers come from
  db.exec('COMMIT');
  // 5. meaning numbers for the doc chunks (skipped when the local model is not installed)
  let vecs = 0;
  if (!opts.noEmbed) {
    const embed = opts.embed || (await require('./embed.js').getEmbedder(false));
    if (embed) {
      const rows = db.prepare("SELECT id, section, text FROM nodes WHERE kind = 'doc'").all();
      const put = db.prepare('INSERT INTO vec VALUES(?,?)');
      db.exec('BEGIN');
      for (let i = 0; i < rows.length; i += 32) {
        const part = rows.slice(i, i + 32), got = await embed(part.map((r) => (r.section ? r.section + ': ' : '') + r.text));
        part.forEach((r, j) => { const f = Float32Array.from(got[j]); put.run(r.id, Buffer.from(f.buffer, f.byteOffset, f.byteLength)); vecs++; });
        if (opts.progress) opts.progress(Math.min(i + 32, rows.length), rows.length, 'docs');
      }
      db.exec('COMMIT');
      // the heading alone (last two levels of the path), one number set per distinct heading: a question often matches the title of the section that answers it
      const headOf = (s) => (s || '').split(' > ').slice(-2).join(': ');
      const uniq = [...new Set(rows.map((r) => headOf(r.section)).filter(Boolean))], hv = new Map();
      for (let i = 0; i < uniq.length; i += 32) { const part = uniq.slice(i, i + 32), got = await embed(part); part.forEach((h, j) => hv.set(h, Float32Array.from(got[j]))); if (opts.progress) opts.progress(Math.min(i + 32, uniq.length), uniq.length, 'headings'); }
      const puth = db.prepare('INSERT INTO vech VALUES(?,?)');
      db.exec('BEGIN');
      for (const r of rows) { const f = hv.get(headOf(r.section)); if (f) puth.run(r.id, Buffer.from(f.buffer, f.byteOffset, f.byteLength)); }
      db.exec('COMMIT');
      // the meaning of class names: each distinct type name, read as words (DomainServiceDomainEventsHolder -> "domain service domain events holder")
      // one row per label: the file of its lowest-deg node (the folders of that file are part of the text)
      const fileOf = codeLabels(db);
      const names = [...fileOf.keys()], rcache = new Map();   // one file-lines cache for this build
      const putc = db.prepare('INSERT INTO vecc VALUES(?,?)');
      db.exec('BEGIN');
      for (let i = 0; i < names.length; i += 64) {
        const part = names.slice(i, i + 64), got = await embed(part.map((l) => richText(l, fileOf.get(l), project, rcache)));
        part.forEach((l, j) => { const f = Float32Array.from(got[j]); putc.run(l, Buffer.from(f.buffer, f.byteOffset, f.byteLength)); });
        if (opts.progress) opts.progress(Math.min(i + 64, names.length), names.length, 'code names');
      }
      db.exec('COMMIT');
    }
  }
  db.close();
  const merged = integrate(home, tmp, project);         // the project's fresh rows replace its old rows in mk.db; learned links stay where they are
  return { merged, code: g.nodes.length, docs: docIds.length, files: docs.length, skipped, synapses: pair.size, vectors: vecs, commit: g.built_at_commit || '', ms: Date.now() - t0, docLinked: linkedChunks };
}

// ---- learning: one store (this file), keyed by stable names, merged on every rebuild ----
const effective = (w, t, now) => w * Math.pow(0.5, Math.max(0, now - t) / (HALF_LIFE_DAYS * 86400000)); // a learned link fades by half every HALF_LIFE_DAYS

// ---- one file for all projects ----
// Every table carries a `project` tag (kw, kw2, vec, vech, df, df2, comm, meta, nodes). Edges and learned links need none: ids are unique, and keys of the other projects start with "<project>:".
// Open mk.db and make sure the tables exist. A file from before projects existed (no `project` column) is replaced; what it learned is carried over.
function openMain(home) {
  const file = dbFile(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let carry = null;
  if (fs.existsSync(file)) {
    let old;
    try {
      old = new (sqlite())(file, { readOnly: true });
      const cols = old.prepare('PRAGMA table_info(nodes)').all().map((c) => c.name);
      if (cols.length && !cols.includes('project')) carry = { learn: old.prepare('SELECT * FROM learn').all(), last: old.prepare('SELECT * FROM last').all() };
    } catch { /* not a map file: start again */ } finally { try { old.close(); } catch { /* closed */ } }
    if (carry) fs.rmSync(file, { force: true });
  }
  const db = new (sqlite())(file);
  db.exec('PRAGMA busy_timeout = 8000');
  db.exec(`CREATE TABLE IF NOT EXISTS nodes(id INTEGER PRIMARY KEY, kind TEXT, label TEXT, file TEXT, loc TEXT, section TEXT, text TEXT, comm INTEGER, deg INTEGER, nkw INTEGER, key TEXT, project TEXT);
    CREATE TABLE IF NOT EXISTS learn(ka TEXT, kb TEXT, w REAL, n INTEGER, t INTEGER, PRIMARY KEY(ka, kb));
    CREATE TABLE IF NOT EXISTS last(session TEXT PRIMARY KEY, t INTEGER, seeds TEXT, done TEXT);
    CREATE TABLE IF NOT EXISTS kw(word TEXT, node INTEGER, project TEXT);
    CREATE TABLE IF NOT EXISTS kw2(word TEXT, node INTEGER, project TEXT);
    CREATE TABLE IF NOT EXISTS df(word TEXT, kind TEXT, n INTEGER, project TEXT, PRIMARY KEY(word, kind, project));
    CREATE TABLE IF NOT EXISTS df2(word TEXT, n INTEGER, project TEXT, PRIMARY KEY(word, project));
    CREATE TABLE IF NOT EXISTS edges(a INTEGER, b INTEGER, w REAL);
    CREATE TABLE IF NOT EXISTS handler(a INTEGER, b INTEGER, project TEXT);
    CREATE INDEX IF NOT EXISTS handler_a ON handler(a, project);
    CREATE TABLE IF NOT EXISTS comm(id INTEGER, name TEXT, size INTEGER, project TEXT);
    CREATE TABLE IF NOT EXISTS vec(node INTEGER PRIMARY KEY, v BLOB, project TEXT);
    CREATE TABLE IF NOT EXISTS vech(node INTEGER PRIMARY KEY, v BLOB, project TEXT);
    CREATE TABLE IF NOT EXISTS vecc(label TEXT, v BLOB, project TEXT, PRIMARY KEY(label, project));
    CREATE TABLE IF NOT EXISTS meta(k TEXT, v TEXT, project TEXT, PRIMARY KEY(k, project));
    CREATE INDEX IF NOT EXISTS kw_w ON kw(word, project); CREATE INDEX IF NOT EXISTS kw2_w ON kw2(word, project);
    CREATE INDEX IF NOT EXISTS kw_node ON kw(node); CREATE INDEX IF NOT EXISTS kw2_node ON kw2(node);
    CREATE INDEX IF NOT EXISTS edges_a ON edges(a); CREATE INDEX IF NOT EXISTS nodes_p ON nodes(project, kind); CREATE INDEX IF NOT EXISTS nodes_file ON nodes(file, project); CREATE INDEX IF NOT EXISTS nodes_label ON nodes(label, project);
    CREATE INDEX IF NOT EXISTS vec_p ON vec(project); CREATE INDEX IF NOT EXISTS vech_p ON vech(project);`);
  if (carry) {
    const put = db.prepare('INSERT OR REPLACE INTO learn VALUES(?,?,?,?,?)'), putLast = db.prepare('INSERT OR REPLACE INTO last VALUES(?,?,?,?)');
    db.exec('BEGIN');
    for (const r of carry.learn) put.run(r.ka, r.kb, r.w, r.n, r.t);
    for (const r of carry.last) putLast.run(r.session, r.t, r.seeds, r.done);
    db.exec('COMMIT');
  }
  return db;
}

// Move a freshly built project (a temporary file with the old one-project layout) into mk.db, in one transaction: a reader sees the old rows or the new rows, never half.
// Ids move up by an offset, so the project keeps its order. A learned link is kept only when both its neurons still exist and it has not faded away.
function integrate(home, tmp, project) {
  const db = openMain(home), out = { kept: 0, dropped: 0, sessions: 0 };
  try {
    db.exec(`ATTACH DATABASE '${tmp.replace(/'/g, "''")}' AS t`);
    db.exec('BEGIN IMMEDIATE');
    try {
      const mine = '(SELECT id FROM nodes WHERE project = ?)';
      for (const tbl of ['kw', 'kw2']) db.prepare(`DELETE FROM ${tbl} WHERE node IN ${mine}`).run(project);
      db.prepare(`DELETE FROM edges WHERE a IN ${mine}`).run(project);
      for (const tbl of ['handler', 'vec', 'vech', 'vecc', 'df', 'df2', 'comm', 'meta', 'nodes']) db.prepare(`DELETE FROM ${tbl} WHERE project = ?`).run(project);
      const off = db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM nodes').get().m, plainKey = project === legacyProject(), learns = !!(getProject(project) || {}).learn;   // the legacy project keeps its old node keys (no prefix); only a project that learns gets its links pruned
      db.prepare(`INSERT INTO nodes SELECT id + ?, kind, label, file, loc, section, text, comm, deg, nkw, ${plainKey ? 'key' : "? || ':' || key"}, ? FROM t.nodes`).run(...(plainKey ? [off, project] : [off, project, project]));
      db.prepare('INSERT INTO kw SELECT word, node + ?, ? FROM t.kw').run(off, project);
      db.prepare('INSERT INTO kw2 SELECT word, node + ?, ? FROM t.kw2').run(off, project);
      db.prepare('INSERT INTO edges SELECT a + ?, b + ?, w FROM t.edges').run(off, off);
      db.prepare('INSERT INTO handler SELECT a + ?, b + ?, ? FROM t.handler').run(off, off, project);
      db.prepare('INSERT INTO vec SELECT node + ?, v, ? FROM t.vec').run(off, project);
      db.prepare('INSERT INTO vech SELECT node + ?, v, ? FROM t.vech').run(off, project);
      db.prepare('INSERT INTO vecc SELECT label, v, ? FROM t.vecc').run(project);
      db.prepare('INSERT INTO df SELECT word, kind, n, ? FROM t.df').run(project);
      db.prepare('INSERT INTO df2 SELECT word, n, ? FROM t.df2').run(project);
      db.prepare('INSERT INTO comm SELECT id, name, size, ? FROM t.comm').run(project);
      db.prepare('INSERT INTO meta SELECT k, v, ? FROM t.meta').run(project);
      if (learns) {   // learning: drop links whose neurons are gone or have faded
        const delLink = db.prepare('DELETE FROM learn WHERE ka = ? AND kb = ?');
        const before = db.prepare('SELECT COUNT(*) AS c FROM learn').get().c, now = Date.now();
        db.exec('DELETE FROM learn WHERE ka NOT IN (SELECT key FROM nodes) OR kb NOT IN (SELECT key FROM nodes)');
        for (const r of db.prepare('SELECT ka, kb, w, t FROM learn').all()) if (effective(r.w, r.t, now) < LEARN_PRUNE) delLink.run(r.ka, r.kb);
        out.kept = db.prepare('SELECT COUNT(*) AS c FROM learn').get().c; out.dropped = before - out.kept;
        out.sessions = db.prepare('SELECT COUNT(*) AS c FROM last').get().c;
      }
      db.exec('COMMIT');
    } catch (e) { try { db.exec('ROLLBACK'); } catch { /* nothing open */ } throw e; }
    db.exec('DETACH DATABASE t');
  } finally { try { db.close(); } catch { /* closed */ } }
  fs.rmSync(tmp, { force: true });
  return out;
}

const openRw = (home) => {
  const db = new (sqlite())(dbFile(home)); db.exec('PRAGMA busy_timeout = 2000');
  // learn and last got a project tag later; rows from before the tag belong to the legacy project (when the config names one)
  const legacy = legacyProject();
  for (const t of ['learn', 'last']) if (!db.prepare(`PRAGMA table_info(${t})`).all().some((c) => c.name === 'project')) db.exec(`ALTER TABLE ${t} ADD COLUMN project TEXT DEFAULT ${legacy ? `'${paths.checkName(legacy)}'` : 'NULL'}`);
  return db;
};

// Called by the hook after a map was shown: remember this prompt's strongest seeds for this session.
function remember(home, session, res, now = Date.now()) {
  const project = res && res.project || defaultProject();
  if (!session || !res || !res.seedKeys || !res.seedKeys.length || isFallback(project)) return false;   // the general docs have no code to learn from
  let db; try { db = openRw(home); } catch { return false; }
  try { db.prepare('INSERT OR REPLACE INTO last(session, t, seeds, done, project) VALUES(?,?,?,?,?)').run(session, now, JSON.stringify(res.seedKeys), '[]', project); return true; } catch { return false; } finally { try { db.close(); } catch { /* closed */ } }
}

// The map stores code files relative to a project folder (some projects: under src/, others: the repo root).
// Try the path's tails, longest first, and keep the first one the project's map knows.
function mapFile(db, project, file) {
  const parts = String(file || '').replace(/\\/g, '/').split('/').filter(Boolean), has = db.prepare('SELECT 1 FROM nodes WHERE project = ? AND file = ? LIMIT 1');
  for (let i = 0; i < parts.length - 1; i++) { const rel = parts.slice(i).join('/'); if (has.get(project, rel)) return rel; }
  return null;
}

// Called when a file was opened or edited (PostToolUse). If a map was shown for this session within LEARN_WINDOW_MS, the prompt's
// strongest seeds are linked to the file's main types. Each file counts once per map. Returns { learned } or { ignored: why }.
function touched(home, session, file, opts = {}) {
  const now = opts.now ?? Date.now();
  if (!session || !file) return { ignored: 'no session or file' };
  let db; try { db = openRw(home); } catch { return { ignored: 'no map' }; }
  try {
    const row = session === '*'   // '*' = the newest map of any session (used after a Codex step, run from a shell that has no session id)
      ? db.prepare('SELECT session, t, seeds, done, project FROM last ORDER BY t DESC LIMIT 1').get()
      : db.prepare('SELECT session, t, seeds, done, project FROM last WHERE session = ?').get(session);
    if (!row || now - row.t > LEARN_WINDOW_MS) return { ignored: 'no recent map' };
    const project = row.project || defaultProject(), rel = mapFile(db, project, file);
    if (!rel) return { ignored: 'file not in the map', project };
    const done = JSON.parse(row.done || '[]');
    if (done.includes(rel)) return { ignored: 'already counted' };
    const base = path.basename(rel).replace(/\.[^.]+$/, '');
    const targets = db.prepare("SELECT key, label FROM nodes WHERE project = ? AND kind = 'code' AND file = ? AND deg <= ? ORDER BY (label = ?) DESC, deg DESC LIMIT 12").all(project, rel, HUB, base)
      .filter((n) => !n.label.startsWith('.') && n.label.length >= 4 && !GENERIC.has(n.label)).slice(0, LEARN_TARGETS);
    if (!targets.length) return { ignored: 'no named code in the file' };
    const inFile = new Set(db.prepare('SELECT key FROM nodes WHERE project = ? AND file = ?').all(project, rel).map((r) => r.key));
    const seeds = JSON.parse(row.seeds).filter(([k]) => !inFile.has(k)).slice(0, LEARN_SEEDS);
    const get = db.prepare('SELECT w, n, t FROM learn WHERE ka = ? AND kb = ?'), put = db.prepare('INSERT OR REPLACE INTO learn(ka, kb, w, n, t, project) VALUES(?,?,?,?,?,?)');
    let learned = 0;
    db.exec('BEGIN');
    for (const [sk, act] of seeds) for (const t of targets) {
      const [ka, kb] = sk < t.key ? [sk, t.key] : [t.key, sk], cur = get.get(ka, kb);
      const w0 = cur ? effective(cur.w, cur.t, now) : 0;
      put.run(ka, kb, Math.min(LEARN_MAX, w0 + LEARN_RATE * act * (1 - w0 / LEARN_MAX)), (cur ? cur.n : 0) + 1, now, project);
      learned++;
    }
    done.push(rel);
    db.prepare('UPDATE last SET done = ? WHERE session = ?').run(JSON.stringify(done), row.session);
    db.exec('COMMIT');
    return { learned, file: rel, targets: targets.map((t) => t.label) };
  } catch (e) { debug('touched', e); try { db.exec('ROLLBACK'); } catch { /* none */ } return { ignored: 'error' }; } finally { try { db.close(); } catch { /* closed */ } }
}

function learnShow(home, limit = 15, now = Date.now()) {
  const db = new (sqlite())(dbFile(home), { readOnly: true });
  try {
    const rows = db.prepare('SELECT l.ka, l.kb, l.w, l.n, l.t, a.label AS la, a.section AS sa, a.file AS fa, b.label AS lb, b.file AS fb FROM learn l LEFT JOIN nodes a ON a.key = l.ka LEFT JOIN nodes b ON b.key = l.kb').all()
      .map((r) => ({ ...r, eff: effective(r.w, r.t, now) })).filter((r) => r.eff >= LEARN_PRUNE).sort((x, y) => y.eff - x.eff);
    const name = (l, s, f) => (l && l.startsWith('doc ') ? `${l} > ${s || f}` : `${l} (${f})`);
    return { total: rows.length, lines: rows.slice(0, limit).map((r) => `${r.eff.toFixed(2)} (x${r.n})  ${name(r.la, r.sa, r.fa)}  <->  ${name(r.lb, '', r.fb)}`) };
  } finally { db.close(); }
}

// Forget learned links. With no project: all of them. With a project: only the links whose from-neuron belongs to that doc set. Returns the number of learn rows deleted.
function learnReset(home, project) {
  const db = openRw(home);
  try {
    if (!project) { const n = db.prepare('SELECT COUNT(*) AS c FROM learn').get().c; db.exec('DELETE FROM learn; DELETE FROM last;'); return n; }
    const own = 'ka IN (SELECT key FROM nodes WHERE project = ?)';   // old learn rows have no project column: a link belongs to the set that owns its from-neuron
    const n = db.prepare('SELECT COUNT(*) AS c FROM learn WHERE ' + own).get(project).c;
    db.prepare('DELETE FROM learn WHERE ' + own).run(project); db.prepare('DELETE FROM last WHERE project = ?').run(project);
    return n;
  } finally { db.close(); }
}

// The distinct code files of one doc set, as the map stores them (graph paths). An empty Set when there is no map.
function codeFiles(home = homeDir(), project = defaultProject()) {
  try {
    const db = new (sqlite())(dbFile(home), { readOnly: true });
    try { return new Set(db.prepare("SELECT DISTINCT file FROM nodes WHERE project = ? AND kind = 'code' AND file != ''").all(project).map((r) => r.file)); }
    finally { db.close(); }
  } catch { return new Set(); }
}

// Is the map as new as the graph and the docs? Reads only the last bytes of graph.json (that is where built_at_commit is).
function status(home = homeDir(), project = defaultProject()) {
  const root = docsRoot(project), P = getProject(project) || {}, out = { stale: stale(home, project), root };
  try {
    const db = new (sqlite())(dbFile(home), { readOnly: true });
    try {
      const m = Object.fromEntries(db.prepare('SELECT k, v FROM meta WHERE project = ?').all(project).map((r) => [r.k, r.v]));
      Object.assign(out, { mapCommit: m.commit, built: Number(m.built), nCode: Number(m.nCode), nDoc: Number(m.nDoc), learned: db.prepare('SELECT COUNT(*) AS c FROM learn WHERE ka IN (SELECT key FROM nodes WHERE project = ?)').get(project).c });
    } finally { db.close(); }
  } catch { out.mapCommit = null; }
  out.graphCommit = null;
  if (P.graph) try { // graphify writes built_at_commit as the last key, so the last 400 bytes are enough (the file is ~90 MB)
    const f = path.resolve(root, P.graph), size = fs.statSync(f).size, n = Math.min(400, size), b = Buffer.alloc(n), fd = fs.openSync(f, 'r');
    try { fs.readSync(fd, b, 0, n, size - n); } finally { fs.closeSync(fd); }
    out.graphCommit = (b.toString('utf8').match(/"built_at_commit"\s*:\s*"([0-9a-f]{7,40})"/) || [])[1] || null;
  } catch { out.graphCommit = null; }
  try { out.lastUpdateCommit = fs.readFileSync(path.join(root, '.last_update_commit'), 'utf8').trim(); } catch { out.lastUpdateCommit = null; }
  return out;
}

// What the map was built from: the graph file and every technical doc. Cheap to compare (a few stat calls).
function sources(root, project) {
  const P = getProject(project) || {}, st = (f) => { try { const s = fs.statSync(f); return `${Math.round(s.mtimeMs)}:${s.size}`; } catch { return 'none'; } };
  return { graph: st(path.resolve(root, P.graph || 'graphify-out/graph.json')), docs: listDocs(root, P.layout, P.skipDirs, extSet(P.extensions)).map((f) => path.relative(root, f).replace(/\\/g, '/') + '@' + st(f)).join('|') };
}

// no rows yet: a map is due only for the default project, and only when its graph file exists (the other projects are built on request)
const graphOnDisk = (project) => { const P = getProject(project) || {}; return project === defaultProject() && !!P.graph && fs.existsSync(path.resolve(docsRoot(project), P.graph)); };
function stale(home = homeDir(), project = defaultProject()) { // true when there is no map, or a doc or the graph changed since it was built
  try {
    const db = new (sqlite())(dbFile(home), { readOnly: true });
    try {
      const m = Object.fromEntries(db.prepare('SELECT k, v FROM meta WHERE project = ?').all(project).map((r) => [r.k, r.v]));
      if (!m.root) return graphOnDisk(project);   // this project has no rows yet
      return Number(m.version) !== DB_VERSION || m.stamp !== JSON.stringify(sources(m.root, project)) || (m.embed || DEFAULT_EMBED_MODEL) !== embedModel();   // a new meaning model = rebuild once (old maps have no "embed" row: they used the default)
    } finally { db.close(); }
  } catch { return graphOnDisk(project); }   // the other projects are built on request, so no map is not "stale"
}

// True when the project has a map in mk.db. stale() is false for a new non-default project with no rows (built on request), so --update checks this too.
function hasMap(home = homeDir(), project = defaultProject()) {
  try {
    const db = new (sqlite())(dbFile(home), { readOnly: true });
    try { return !!db.prepare("SELECT 1 FROM meta WHERE project = ? AND k = 'root'").get(project); } finally { db.close(); }
  } catch { return false; }
}

// ---- firing ----
function expand(q, groups) {
  const m = new Map([...q].map((t) => [t, 1]));
  for (const g of groups) if (g.some((t) => q.has(t))) for (const t of g) if (!m.has(t)) m.set(t, THESAURUS_WEIGHT);
  return m;
}

// search() step 1: seeds by words (the moved code keeps its comments).
function seedByWords(S) {
  const { db, project, N, qw } = S;
  // 1. seeds by words: every query word fires the neurons that hold it
  const score = new Map(), hit = new Map(), strong = new Set(), kindOf = new Map(), hscore = new Map(), simOf = new Map(), hsimOf = new Map();
  const dfq = db.prepare('SELECT kind, n FROM df WHERE word = ? AND project = ?'), post = db.prepare('SELECT k.node AS node, n.kind AS kind, n.nkw AS nkw, n.deg AS deg, n.label AS label FROM kw k JOIN nodes n ON n.id = k.node WHERE k.word = ? AND k.project = ?');
  for (const [w, wt] of qw) {
    const dfs = Object.fromEntries(dfq.all(w, project).map((r) => [r.kind, r.n]));
    if (!Object.keys(dfs).length) continue;
    for (const r of post.all(w, project)) {
      const idf = Math.log(1 + N[r.kind] / (dfs[r.kind] || 1));
      kindOf.set(r.node, [r.kind, r.nkw, r.deg]);
      score.set(r.node, (score.get(r.node) || 0) + idf * wt);
      if (w[0] === '#') { hscore.set(r.node, (hscore.get(r.node) || 0) + idf * wt); continue; }   // a heading hit only adds score: it is the same word again, so it is not a second word and never "strong"
      hit.set(r.node, (hit.get(r.node) || 0) + 1);
      if (wt === 1 && w.length >= 8 && idf >= 3.5) strong.add(r.node);
      else if (wt === 1 && r.kind === 'code' && r.label.toLowerCase() === w && /^[A-Z]/.test(r.label) && w.length >= 5 && idf >= 3.2) strong.add(r.node); // the question names a class exactly (Ticket): one word is enough
    }
  }
  const seeds = new Map();
  for (const [id, s] of score) {
    const [kind, nkw, deg] = kindOf.get(id);
    if (kind === 'code' && deg > SEED_HUB) continue;
    if (!((hit.get(id) >= 2 && s >= MIN_SCORE) || strong.has(id))) continue;
    seeds.set(id, { kind, s: s / WORD_SCALE / Math.sqrt(Math.max(nkw, 8) / 8) });
  }
  Object.assign(S, { score, kindOf, hscore, simOf, hsimOf, dfq, seeds });
}

// search() step 2: seeds by meaning, heading meaning and the question index.
function seedByMeaning(S) {
  const { db, project, opts, home, seeds, simOf, hsimOf } = S;
  // 2. seeds by meaning: doc chunks that are close in meaning to the prompt
  if (opts.pv) {
    const floor = opts.simFloor ?? SIM_FLOOR, span = opts.simSpan ?? SIM_SPAN, simGate = opts.simGate ?? SIM_GATE;   // opts only for experiments with other models (see eval-model.js)
    for (const r of db.prepare('SELECT node, v FROM vec WHERE project = ?').all(project)) {
      const v = f32(r.v);
      if (v.length !== opts.pv.length) break;
      let sim = 0; for (let i = 0; i < v.length; i++) sim += v[i] * opts.pv[i];
      simOf.set(r.node, sim);
      if (sim < simGate && !seeds.has(r.node)) continue;
      const s = Math.min(Math.max((sim - floor) / span, 0), 1);
      if (s > 0) { const o = seeds.get(r.node) || { kind: 'doc', s: 0 }; o.s += s; seeds.set(r.node, o); }
    }
  }
  // 2b. a question that closely matches a section title is enough on its own (unrelated questions never come close: the highest measured was 0.47)
  if (opts.pv && !isFallback(project)) {   // not for the general docs: reading every heading number of 85,000 chunks costs a second; their candidates get their heading number further down
    try {
      const rescue = Math.max(0, ...[...seeds.values()].map((o) => o.s)) < (opts.gate ?? GATE);   // only when the gate would say no: otherwise these seeds would only disturb a good ranking
      for (const r of db.prepare('SELECT node, v FROM vech WHERE project = ?').all(project)) {
        const v = f32(r.v); if (v.length !== opts.pv.length) break;
        let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * opts.pv[i];
        hsimOf.set(r.node, s);
        if (rescue && s >= (opts.headGate ?? HEAD_GATE)) { const o = seeds.get(r.node) || { kind: 'doc', s: 0 }; o.s += Math.min(1, (s - SIM_FLOOR) / SIM_SPAN); seeds.set(r.node, o); }
      }
    } catch { /* a map without heading numbers */ }
  }
  // 2c. the question index (dq.js): the best-matching of the few questions written for each section (a map without the index works as before)
  const qsimOf = new Map();
  S.qsimOf = qsimOf;
  if (opts.pv && !opts.noDq) {   // only a project with a built index (dq.<project>.bin) gets it
    try {
      const Q = require('./dq.js').load(home, project);
      if (Q && Q.dim === opts.pv.length) {
        const idOfKey = new Map(db.prepare("SELECT id, key FROM nodes WHERE kind = 'doc' AND project = ?").all(project).map((r) => [r.key, r.id]));
        for (let i = 0; i < Q.keys.length; i++) {
          const id = idOfKey.get(Q.keys[i]); if (!id) continue;
          let s = 0; const o = i * Q.dim; for (let j = 0; j < Q.dim; j++) s += Q.vecs[o + j] * opts.pv[j];
          if (s > (qsimOf.get(id) ?? -1)) qsimOf.set(id, s);
        }
      }
    } catch { /* no question index */ }
  }
}

// search() step 3: the gate, act and seedKeys. Returns giveUp() (null) to stop the search.
function gateAndNormalize(S) {
  const { db, opts, trace, seeds, giveUp } = S;
  if (!seeds.size) return giveUp('no-seeds');
  // the best seed must be clearly matched, or the prompt is not about this system
  const best = Math.max(0, ...[...seeds.values()].map((o) => o.s));
  if (trace) { trace.best = best; trace.gate = opts.gate ?? GATE; }
  if (best < (opts.gate ?? GATE)) return giveUp('below-gate');     // the owner's eval (private, ~160 questions): project questions score 0.55 to over 2, unrelated ones 0 to 0.7; a missing map costs more than an extra one
  const act = new Map();
  for (const kind of ['doc', 'code']) {
    const t = [...seeds].filter(([, o]) => o.kind === kind).sort((a, b) => b[1].s - a[1].s).slice(0, kind === 'doc' ? SEED_DOCS : SEED_CODE);
    const max = t.length ? t[0][1].s : 1;
    for (const [id, o] of t) act.set(id, o.s / max);
  }
  const nSeeds = act.size;
  // what to remember for learning: this prompt's strongest seeds, by stable key
  const now = opts.now ?? Date.now(), keyOf = db.prepare('SELECT key FROM nodes WHERE id = ?');
  const seedKeys = [...act].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, a]) => [keyOf.get(id).key, Math.round(a * 100) / 100]);
  S.best = best; S.act = act; S.nSeeds = nSeeds; S.now = now; S.seedKeys = seedKeys;
}

// search() step 4: learned links, both directions.
function loadLearned(S) {
  const { db, project, opts, now } = S;
  // learned links, both directions, already faded by age; they only help to spread, never to start a search
  const learned = new Map();
  if (opts.learn !== false) {
    try {
      const add = (a, b, w) => (learned.get(a) || learned.set(a, []).get(a)).push([b, w]);
      const hasProject = db.prepare('PRAGMA table_info(learn)').all().some((c) => c.name === 'project');   // an old map file has no tag yet: all its rows belong to the legacy project
      const sql = 'SELECT a.id AS a, b.id AS b, l.w AS w, l.t AS t FROM learn l CROSS JOIN nodes a ON a.key = l.ka AND a.project = ? CROSS JOIN nodes b ON b.key = l.kb AND b.project = ? WHERE l.n >= ?' + (hasProject ? ' AND l.project = ?' : '');
      for (const r of db.prepare(sql).all(project, project, LEARN_MIN_N, ...(hasProject ? [project] : []))) { // one stray file open is a coincidence, not yet a habit
        const w = effective(r.w, r.t, now);
        if (w >= LEARN_PRUNE) { add(r.a, r.b, w); add(r.b, r.a, w); }
      }
    } catch { /* a map from before learning existed: no learned links */ }
  }
  S.learned = learned;
}

// search() step 5: spreading in a few rounds (act is changed in place).
function spread(S) {
  const { db, act, learned } = S;
  // 3. spreading: a few steps; hubs receive little and do not pass it on; each step keeps only the strongest neurons
  const degOf = db.prepare('SELECT deg FROM nodes WHERE id = ?'), out = db.prepare('SELECT b, w FROM edges WHERE a = ?');
  const degCache = new Map();
  const dg = (id) => { if (!degCache.has(id)) degCache.set(id, degOf.get(id)?.deg ?? 0); return degCache.get(id); };
  const learnedIn = new Map();
  for (let r = 0; r < ROUNDS; r++) {
    const front = [...act].filter(([id]) => dg(id) <= HUB).sort((a, b) => b[1] - a[1]).slice(0, FRONTIER);
    const inflow = new Map(), viaLearned = new Map();
    for (const [u, au] of front) {
      for (const e of out.all(u)) inflow.set(e.b, (inflow.get(e.b) || 0) + au * e.w * DECAY / Math.sqrt(1 + dg(e.b)));
      for (const [b, w] of learned.get(u) || []) viaLearned.set(b, (viaLearned.get(b) || 0) + au * w * LEARN_GAIN / Math.sqrt(1 + dg(b)));
    }
    // learned light is capped per neuron (45% of the strongest unlearned activation): many seeds pointing at one learned file must never outshine what words and meaning found
    let topFree = 0;                                   // the strongest activation that did not come from learning
    for (const [id, a] of act) topFree = Math.max(topFree, a - (learnedIn.get(id) || 0));
    for (const [b, f] of viaLearned) {
      const room = LEARN_CAP * topFree - (learnedIn.get(b) || 0), add = Math.min(f, room);
      if (add > 0) { learnedIn.set(b, (learnedIn.get(b) || 0) + add); inflow.set(b, (inflow.get(b) || 0) + add); }
    }
    for (const [id, f] of inflow) act.set(id, (act.get(id) || 0) + f);
    if (act.size > FRONTIER * 4) { const keep = [...act].sort((a, b) => b[1] - a[1]).slice(0, FRONTIER * 4); act.clear(); for (const [id, a] of keep) act.set(id, a); }
  }
}

// search() step 6: first lists of docs and code.
function pickResults(S) {
  const { db, act, opts } = S;
  // 4. read the strongest neurons of each layer
  const info = db.prepare('SELECT * FROM nodes WHERE id = ?');
  const ranked = [...act].sort((a, b) => b[1] - a[1]);
  // code: up to two types per file first (a class, interface or record), methods and file nodes only when too few types fire
  let docs = [], seen = new Map(), types = [], extra = [], files = new Map();
  const shown = new Set();
  for (const [id, a] of ranked) {
    const n = info.get(id); if (!n) continue;
    if (n.kind === 'doc') {
      if (docs.length >= MAX_DOCS || (seen.get(n.file) || 0) >= 2 || (docs.length && a < docs[0].a * 0.3)) continue;
      seen.set(n.file, (seen.get(n.file) || 0) + 1); docs.push({ a, n });
    } else {
      if (n.deg > HUB || !n.file || n.label.length < 4 || GENERIC.has(n.label) || shown.has(n.label)) continue; // framework names say nothing; one result per name (the graph keeps a stub node per referencing file)
      shown.add(n.label);
      const isFile = n.label.toLowerCase() === path.basename(n.file).toLowerCase(), isMethod = n.label.startsWith('.');
      if (isFile || isMethod) { if (extra.length < MAX_CODE) extra.push({ a, n }); continue; }
      if ((files.get(n.file) || 0) >= 2 || types.length >= MAX_CODE || (types.length && a < types[0].a * 0.3)) continue; // up to 2 types per file (a Map counts them)
      files.set(n.file, (files.get(n.file) || 0) + 1); types.push({ a, n });
    }
  }
  // padding with file and method nodes keeps the same 0.3 cut as the types (a weak padding line is noise)
  const padCut = opts.padCut === false || !types.length ? 0 : types[0].a * 0.3;
  let code = types.length >= 3 ? types : types.concat(extra.filter((e) => !files.has(e.n.file) && e.a >= padCut).slice(0, 3 - types.length));
  S.info = info; S.ranked = ranked; S.docs = docs; S.code = code;
}

// Meaning of every class-name row vs the question, computed once per search (addNamedCode and codePool both read it). Row order kept; a vector of another size stops the scan, as before.
function vecSims(S) {
  if (S.vecSims) return S.vecSims;
  const out = [];
  for (const r of S.db.prepare('SELECT label, v FROM vecc WHERE project = ?').all(S.project)) {
    const v = f32(r.v); if (v.length !== S.opts.pv.length) break;
    let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * S.opts.pv[i];
    out.push([r.label, s]);
  }
  return (S.vecSims = out);
}

// search() step 7: code-name pass and class-name meaning.
function addNamedCode(S) {
  const { db, project, text, opts, N, info } = S;
  let code = S.code;
  // code-name pass: a type whose name families cover (nearly) every known word of the question. It only adds to the code list; it never starts or feeds the spreading above.
  {
    const fam = [...families(text, CODE_FILLER)], idf2 = new Map(), nCode = N.code;
    const d2 = db.prepare('SELECT n FROM df2 WHERE word = ? AND project = ?');
    for (const f of fam) { const r = d2.get(f, project); if (r) idf2.set(f, Math.log(1 + nCode / r.n)); }
    const total = [...idf2.values()].reduce((s, v) => s + v, 0);
    if (idf2.size >= 2 && total > 0) {
      const per = new Map(), post2 = db.prepare('SELECT k.node AS node, n.label AS label, n.file AS file, n.deg AS deg, n.nkw AS nkw FROM kw2 k JOIN nodes n ON n.id = k.node WHERE k.word = ? AND k.project = ?');
      for (const [f, idf] of idf2) for (const r of post2.all(f, project)) { const o = per.get(r.node) || per.set(r.node, { r, n: 0, s: 0 }).get(r.node); o.n++; o.s += idf; }
      const pickF = new Set(), extraCode = [];
      const named = [...per.values()].filter((o) => o.n >= 2 && o.s / total >= 0.6 && o.r.file && o.r.deg <= SEED_HUB && o.r.label.length >= 4 && !GENERIC.has(o.r.label) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(o.r.label) && o.r.label.toLowerCase() !== path.basename(o.r.file).toLowerCase())
        .sort((a, b) => (b.s / total) - (a.s / total) || b.s / Math.sqrt(b.r.nkw) - a.s / Math.sqrt(a.r.nkw));
      for (const o of named) {
        if (pickF.has(o.r.file) || extraCode.some((e) => e.n.label === o.r.label)) continue;
        if (extraCode.length >= 3) break;
        pickF.add(o.r.file);
        const old = code.find((c) => c.n.id === o.r.node || (c.n.label === o.r.label && c.n.file === o.r.file));
        const n = old ? old.n : info.get(Number(o.r.node));
        if (n) extraCode.push({ a: old ? old.a : 0, n });   // a result the search already had keeps its place at the front; it is moved up, not dropped
      }
      const front = new Set(extraCode.map((e) => e.n.id));
      code = [...extraCode, ...code.filter((c) => !front.has(c.n.id))].slice(0, MAX_CODE);
    }
    // meaning of class names: names read as words that are close to the question (only the one or two clearly closest)
    if (opts.pv) {
      const T = opts.codeSim ?? CODE_SIM, near = [];
      try {
        for (const [label, s] of vecSims(S)) if (CLASS_NAME.test(label) && s >= T) near.push([label, s]);
      } catch { /* a map without class-name numbers */ }
      near.sort((a, b) => b[1] - a[1]);
      const byLabel = db.prepare("SELECT id FROM nodes WHERE kind = 'code' AND label = ? AND file != '' AND project = ? ORDER BY deg ASC LIMIT 1");
      const add = [], K = opts.codeK ?? CODE_K, gap = opts.codeGap ?? 0.05;
      for (const [label, s] of near) {
        if (add.length >= K) break;
        if (s < near[0][1] - gap) continue;
        if (code.some((c) => c.n.label === label) || add.some((e) => e.n.label === label)) continue;
        const row = byLabel.get(label, project), n = row && info.get(row.id);
        if (n && n.deg <= SEED_HUB) add.push({ a: s, n });
      }
      if (add.length) { const front2 = new Set(add.map((e) => e.n.id)); const keep = code.filter((c) => !front2.has(c.n.id)); code = [...keep.slice(0, 1), ...add, ...keep.slice(1)].slice(0, MAX_CODE); }
    }
  }
  S.code = code;
}

// search() step 8: trained doc ranking; stops when nothing was found.
function rankDocRows(S) {
  const { db, project, opts, text, N, qw, info, ranked, act, score, kindOf, hscore, simOf, hsimOf, qsimOf, dfq, giveUp } = S;
  // doc ranking: a few signals per candidate section, combined with weights learned from written-down questions (rank.json, made by train-rank.js)
  S.why = null;   // why: the candidates in rank order (only for opts.why, see eval-map.js --why)
  const W = opts.rankW === undefined ? loadRank(project) : opts.rankW;
  if (opts.pv && (W || opts.feat)) {
    try {
      const isDoc = (id) => (info.get(id) || {}).kind === 'doc';
      const topIds = (m, k, f = (x) => x) => [...m].sort((a, b) => f(b[1]) - f(a[1])).slice(0, k).map(([id]) => id);
      const wOnly = new Map(); for (const [id, s] of score) if ((kindOf.get(id) || [])[0] === 'doc') wOnly.set(id, s - (hscore.get(id) || 0));
      const pool = new Set([...ranked.filter(([id]) => isDoc(id)).slice(0, 40).map(([id]) => id), ...topIds(wOnly, 15), ...topIds(simOf, 15), ...topIds(hsimOf, 10), ...topIds(qsimOf, 15)]);
      if (isFallback(project)) {   // heading meaning for the candidates only
        const one = db.prepare('SELECT v FROM vech WHERE node = ?');
        for (const id of pool) { const r = one.get(id); if (r) { const v = f32(r.v); let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * opts.pv[i]; hsimOf.set(id, s); } }
      }
      const plain = [...qw].filter(([w, wt]) => w[0] !== '#' && wt === 1).map(([w]) => w), idfD = new Map();
      for (const w of plain) { const r = dfq.all(w, project).find((x) => x.kind === 'doc'); if (r) idfD.set(w, Math.log(1 + N.doc / r.n)); }
      const total = [...idfD.values()].reduce((s, v) => s + v, 0) || 1;
      const kwOf = db.prepare('SELECT word FROM kw WHERE node = ?'), fileOf = db.prepare("SELECT MIN(id) AS m, COUNT(*) AS c FROM nodes WHERE file = ? AND kind = 'doc' AND project = ?"), fcache = new Map();
      const metaQ = [...families(text)].some((f) => META_Q.has(f));   // the question is about problems, drift or gaps: the findings and backlog docs are the place
      const rows = [...pool].map((id) => {
        const n = info.get(id), ws = new Set(kwOf.all(id).map((r) => r.word));
        let cov = 0, hcov = 0, mc = 0; for (const [w, idf] of idfD) { if (ws.has(w)) { cov += idf; mc++; } if (ws.has('#' + w)) hcov += idf; }
        const fi = fcache.get(n.file) || fcache.set(n.file, fileOf.get(n.file, project)).get(n.file);
        const meta = /\/(10-findings|19-known-unfixed-bugs|20-improvement-suggestions|09-repo-metrics)\.md$/.test(n.file) ? 1 : 0, nonDev = /for-non-dev\//.test(n.file) || /\/README\.md$/.test(n.file) ? 1 : 0;
        return { id, n, f: [act.get(id) || 0, wOnly.get(id) || 0, hscore.get(id) || 0, (simOf.get(id) ?? 0.3) - 0.3, (hsimOf.get(id) ?? 0.3) - 0.3, cov / total, hcov / total, Math.log(1 + fi.c) / 5, id === fi.m ? 1 : 0, (n.section || '').split(' > ').length / 4, 0, 0, 0, meta, nonDev, 0, mc / Math.sqrt(Math.max(ws.size, 4)) * 3, 0, 0, metaQ && meta ? 1 : 0, (coreDoc(project)?.test(n.file) ? 1 : 0), (qsimOf.get(id) ?? 0.3) - 0.3, 0] };
      });
      const mx = [0, 1, 2].map((k) => Math.max(1e-9, ...rows.map((r) => r.f[k])));
      for (const r of rows) for (const k of [0, 1, 2]) r.f[k] /= mx[k];
      const top = (k) => Math.max(...rows.map((r) => r.f[k])), tS = top(3), tH = top(4), tC = top(5), secMax = new Map();
      for (const r of rows) { const key = r.n.file + '::' + r.n.section; secMax.set(key, Math.max(secMax.get(key) ?? -1, r.f[3])); }
      const fileSim = new Map(), fileWord = new Map();   // file-level evidence: the best meaning and the total word score of the file's candidate chunks
      for (const r of rows) { fileSim.set(r.n.file, Math.max(fileSim.get(r.n.file) ?? -1, r.f[3])); fileWord.set(r.n.file, (fileWord.get(r.n.file) || 0) + r.f[1]); }
      const fwMax = Math.max(1e-9, ...fileWord.values()), fsMax = Math.max(...fileSim.values());
      for (const r of rows) { r.f[17] = fileSim.get(r.n.file) - fsMax; r.f[18] = fileWord.get(r.n.file) / fwMax; }
      const tQ = Math.max(...rows.map((r) => r.f[21])); for (const r of rows) r.f[22] = r.f[21] - tQ;   // question meaning vs the best
      for (const r of rows) { r.f[10] = r.f[3] - tS; r.f[11] = r.f[4] - tH; r.f[12] = r.f[5] - tC; r.f[15] = secMax.get(r.n.file + '::' + r.n.section); }
      if (opts.feat) S.feat = rows.map((r) => ({ n: r.n, f: r.f }));
      if (W) {
        const picked = rankDocs(rows, W).map((r) => ({ a: r.z, n: r.n }));
        if (picked.length) S.docs = picked;
        if (opts.why) S.why = rows.map((r) => ({ r, z: r.f.reduce((s, v, i) => s + v * (W[i] || 0), 0) })).sort((a, b) => b.z - a.z).slice(0, 40).map(({ r }) => ({ file: r.n.file, sec: r.n.section || '' }));
      }
    } catch { /* keep the plain ranking */ }
  }
  if (!S.docs.length && !S.code.length) return giveUp('nothing-to-show');
}

// search() step: a shown XCommand/XQuery/XRequest is swapped for its XCommandHandler... from the same folder (the class that does the work)
function pairHandlers(S) {
  const { db, project, code } = S;
  try {
    const dirOf = (f) => String(f || '').replace(/\\/g, '/').split('/').slice(0, -1).join('/');
    const byHandler = db.prepare("SELECT * FROM nodes WHERE kind = 'code' AND label = ? AND file != '' AND project = ? ORDER BY deg DESC");
    const have = new Set(code.map((c) => c.n.label));
    for (let i = 0; i < code.length; i++) {
      const c = code[i];
      if (!/(Command|Query|Request)$/.test(c.n.label)) continue;
      const label = c.n.label + 'Handler';
      if (have.has(label)) continue;
      const row = byHandler.all(label, project).find((r) => dirOf(r.file) === dirOf(c.n.file));
      if (!row) continue;   // no pairing across folders
      code[i] = { a: c.a, n: row }; have.add(label);
    }
  } catch { /* fails open: the list stays */ }
}

// search() step 9: one-hop and two-hop code neighbours.
function addNeighbours(S) {
  const { db, info, code, project, opts } = S;
  // One hop out from the top code hits: strong graph links only (calls/implements/inherits = 1, method = 0.7, defines = 0.6; see REL).
  try {
    const nb = db.prepare("SELECT n.label, n.file, n.loc, e.w FROM edges e JOIN nodes n ON n.id = e.b WHERE e.a = ? AND e.w >= 0.6 AND n.kind = 'code' ORDER BY e.w DESC, n.deg DESC LIMIT ?");
    for (const c of code.slice(0, NB_CODE)) c.nb = nb.all(c.n.id, NB_PER);
  } catch { /* neighbors are optional */ }
  // Two hops out: code types that share the name stem of the top code hits, reached by two strong links (seeds, max and stem: see CHAIN_DEFAULT).
  try {
    const pc = (getProject(project) || {}).chain || {}, oc = opts.chain || {};   // a bad value falls back one level: opts -> the project's setting -> CHAIN_DEFAULT
    const pick = (k, lo, hi) => chainNum(oc[k], chainNum(pc[k], CHAIN_DEFAULT[k], lo, hi), lo, hi);
    const seeds = pick('seeds', 0, 10), max = pick('max', 0, 10), stemN = pick('stem', 1, 6);
    const stemOf = (label) => { let p = label.match(/[A-Z][a-z0-9]*/g) || []; if (CHAIN_VERBS.has(p[0])) p = p.slice(1); const full = p.length; while (p.length && CHAIN_ROLES.has(p[p.length - 1])) p.pop(); if (full >= stemN && p.length >= 2) return p.slice(0, stemN).join('%'); return null; };   // a leading verb is not the stem (SetIhmEventTask... -> IhmEventTask); fewer name parts = too generic, no chain
    const twoHop = db.prepare("SELECT n.id AS id FROM edges e1 JOIN edges e2 ON e2.a = e1.b JOIN nodes n ON n.id = e2.b WHERE e1.a = ? AND e1.w >= 0.6 AND e2.w >= 0.6 AND n.kind = 'code' AND n.file != '' AND n.deg <= ? AND n.id != ? AND n.label LIKE ? GROUP BY n.id ORDER BY MAX(e1.w + e2.w) DESC, n.deg DESC LIMIT 10");
    // an event handler (On<stem>...) is found by name: it hangs off a different framework hub than the command, so no two-link path joins them
    const onByName = db.prepare("SELECT id FROM nodes WHERE project = ? AND kind = 'code' AND file != '' AND deg <= ? AND label LIKE ? ORDER BY deg DESC LIMIT 3");
    const have = new Set(code.map((c) => c.n.id)), labels = new Set(code.map((c) => c.n.label)), listed = new Set(code.flatMap((c) => (c.nb || []).map((x) => x.label + '|' + x.file)));
    let added = 0;
    const add = (id) => {
      const n = info.get(id);
      if (added >= max || !n || have.has(n.id) || labels.has(n.label) || listed.has(n.label + '|' + n.file) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.label)) return;
      have.add(n.id); labels.add(n.label); code.push({ a: 0, n, chain: true }); added++;
    };
    for (const c of code.slice(0, seeds)) {
      const stem = stemOf(c.n.label);
      if (!stem) continue;
      for (const r of onByName.all(project, SEED_HUB, 'On' + stem + '%')) add(r.id);
      for (const r of twoHop.all(c.n.id, SEED_HUB, c.n.id, '%' + stem + '%')) add(r.id);
    }
  } catch { /* chain is optional */ }
  // Handler table: the handlers that a top hit links to by a handler relation (table 'handler'), placed right after it. At most 2 per hit, 3 per search.
  const top = code.slice(0, 6), topIds = new Set(top.map((c) => c.n.id)), gotTable = new Set();   // snapshot: the list grows below
  try {
    const hq = db.prepare('SELECT b FROM handler WHERE a = ? AND project = ?');
    const placed = new Set();   // handlers this step placed: a handler linked from two hits is placed once
    let tabled = 0;
    for (const c of top) {
      if (tabled >= 3) break;
      if (!code.includes(c)) continue;   // this hit was moved as a handler of an earlier hit
      let per = 0;
      for (const r of hq.all(c.n.id, project)) {
        if (per >= 2 || tabled >= 3) break;
        const n = info.get(r.b);
        if (!n || !n.file || n.deg > SEED_HUB || n.id === c.n.id || placed.has(n.id)) continue;
        const at = code.findIndex((x) => x.n.id === n.id);
        if (at >= 0) code.splice(at, 1);   // it is somewhere else in the list (even the top 6): move it right after its hit
        code.splice(code.indexOf(c) + 1, 0, { a: c.a, n, chain: true });
        placed.add(n.id); topIds.add(n.id); gotTable.add(c.n.id); per++; tabled++;
      }
    }
  } catch { /* an old map has no handler table: skip */ }
  // Handler step: the On<Event> handler of a top hit, placed right after it. Its link is weak (0.3), so the one-hop query above skips it.
  try {
    const exactOn = db.prepare("SELECT id FROM nodes WHERE project = ? AND kind = 'code' AND file != '' AND deg <= ? AND label = ? LIMIT 1");
    const linkedOn = db.prepare("SELECT n.id AS id FROM edges e JOIN nodes n ON n.id = e.b WHERE e.a = ? AND n.project = ? AND n.kind = 'code' AND n.file != '' AND n.deg <= ? AND n.label LIKE 'On%' ORDER BY e.w DESC LIMIT 20");
    const twoOn = db.prepare("SELECT n.id AS id FROM edges e1 JOIN edges e2 ON e2.a = e1.b JOIN nodes n ON n.id = e2.b WHERE e1.a = ? AND n.project = ? AND n.kind = 'code' AND n.file != '' AND n.deg <= ? AND n.label LIKE 'On%' ORDER BY e1.w + e2.w DESC LIMIT 20");
    let placed = 0;
    for (const c of top) {
      if (placed >= 2) break;   // at most 2 handlers per search
      if (gotTable.has(c.n.id)) continue;   // the handler table already placed one for this hit
      // a handler is an On<Name> code node with a file, and not a hub
      const words = (s) => new Set((s.match(/[A-Z][a-z0-9]*/g) || []).filter((w) => !CHAIN_ROLES.has(w) && w !== 'On'));
      const hitWords = words(c.n.label.split('.')[0]);
      // linked handlers must share 2+ name words with the hit (a hub link alone brings unrelated handlers)
      const ok = (id, linked) => { const n = info.get(id); if (!n || topIds.has(id) || !/^On[A-Z][A-Za-z0-9_]*$/.test(n.label) || !n.file || n.deg > SEED_HUB) return null; if (linked && [...words(n.label)].filter((w) => hitWords.has(w)).length < 2) return null; return n; };
      const base = c.n.label, names = [];
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(base)) names.push('On' + base, 'On' + base.replace(/(DomainEvent|Event|Command)$/, ''));   // OrderPlacedEvent -> OnOrderPlaced
      let h = null;
      for (const name of names) { const r = exactOn.get(project, SEED_HUB, name); h = r && ok(r.id); if (h) break; }   // (c) exact name first
      if (!h) for (const r of linkedOn.all(c.n.id, project, SEED_HUB)) { if ((h = ok(r.id, true))) break; }   // (a) one link away
      if (!h) for (const r of twoOn.all(c.n.id, project, SEED_HUB)) { if ((h = ok(r.id, true))) break; }   // (b) two links away
      if (!h) continue;
      const at = code.findIndex((x) => x.n.id === h.id);
      if (at >= 0) code.splice(at, 1);   // it is further down: move it up
      code.splice(code.indexOf(c) + 1, 0, { a: c.a, n: h, chain: true });
      topIds.add(h.id); placed++;
    }
  } catch { /* handler step is optional */ }
}

// search() step 10: exact lines from the repo folder.
function addExactLines(S) {
  const { project, opts, code } = S;
  // Exact lines: with the set's repo folder, each code name and its neighbours get the line on disk now (src/repo.js). Fails open: the graph's lines stay.
  try {
    const P = getProject(project) || {};
    if (P.repo && fs.existsSync(P.repo) && !opts.noRepo) require('./repo.js').exactLines(P.repo, [...code, ...code.flatMap((c) => c.nb || [])], P.repoBase || '');
  } catch { /* the graph's lines stay */ }
}

// Candidate pool for the reranker: shown code first, then close class names by meaning (opts.pv, no score cut, up to POOL_NEAR), then ranked code names fill the rest. Unique labels, max POOL.
function codePool(S) {
  const { db, project, opts, info } = S;
  const pool = [], seen = new Set();
  const push = (label, file, a) => { if (pool.length < POOL && !seen.has(label)) { seen.add(label); pool.push({ label, file, a }); } };
  for (const c of S.code) push(c.n.label, c.n.file, c.a);
  if (opts.pv) {
    try {
      const near = vecSims(S).slice();   // a copy: the sort below must not reorder the shared list
      near.sort((a, b) => b[1] - a[1]);
      const byLabel = db.prepare("SELECT id FROM nodes WHERE kind = 'code' AND label = ? AND file != '' AND project = ? ORDER BY deg ASC LIMIT 1");
      let added = 0;
      for (const [label, s] of near) {
        if (added >= POOL_NEAR || pool.length >= POOL) break;
        if (seen.has(label)) continue;
        const row = byLabel.get(label, project), n = row && info.get(row.id);
        if (n && n.deg <= SEED_HUB) { push(label, n.file, s); added++; }
      }
    } catch { /* a map without class-name numbers */ }
  }
  for (const [id, a] of S.ranked) {
    if (pool.length >= POOL) break;
    const n = info.get(id);
    if (!n || n.kind === 'doc' || n.deg > HUB || !n.file || n.label.length < 4 || GENERIC.has(n.label) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.label)) continue;
    push(n.label, n.file, a);
  }
  S.pool = pool;
}

// Returns { docs, code, comms, commit, built } or null. `pv` is the prompt's meaning vector (optional).
function search(home, text, opts = {}) {
  let db;
  const project = opts.project || defaultProject();
  const trace = opts.trace && typeof opts.trace === 'object' ? opts.trace : null, giveUp = (reason) => { if (trace) trace.reason = reason; return null; };   // opts.trace (a caller's object) gets why the search gave no map
  if (trace) trace.best = 0;
  try { db = new (sqlite())(dbFile(home), { readOnly: true }); } catch (e) { debug('search open', e); return giveUp('no-map-file'); }
  try {
    const meta = Object.fromEntries(db.prepare('SELECT k, v FROM meta WHERE project = ?').all(project).map((r) => [r.k, r.v]));
    if (Number(meta.version) !== DB_VERSION) return giveUp('old-version');
    const q = words(text);
    if (!q.size) return giveUp('no-words');
    const qw = expand(q, opts.thesaurus || loadThesaurus().concat(mkSynonyms()));
    for (const [w, wt] of [...qw]) qw.set('#' + w, wt);            // every question word also looks at section headings
    const N = { doc: Number(meta.nDoc), code: Number(meta.nCode) };
    const S = { db, project, opts, trace, giveUp, home, text, qw, N, why: null };
    seedByWords(S);
    seedByMeaning(S);
    if (gateAndNormalize(S) !== undefined) return null;   // giveUp() returns null: the search stops here
    loadLearned(S);
    spread(S);
    pickResults(S);
    addNamedCode(S);
    pairHandlers(S);
    if (rankDocRows(S) !== undefined) return null;   // the nothing-to-show stop
    addNeighbours(S);
    addExactLines(S);
    if (opts.pool) codePool(S);
    const { docs, code, feat, why, ranked, info, best, nSeeds, seedKeys, learned, pool } = S;
    // --why only: the candidate sections in rank order (the ranked list when no rank file is used)
    const cands = opts.why ? (why || ranked.filter(([id]) => info.get(id)?.kind === 'doc').slice(0, 40).map(([id]) => ({ file: info.get(id).file, sec: info.get(id).section || '' }))) : undefined;
    if (trace) trace.reason = 'shown';
    return { project, docs, code, commit: meta.commit, built: Number(meta.built), seeds: nSeeds, best, seedKeys, learned: learned.size, feat, cands, pool: opts.pool ? pool : undefined };
  } catch (e) { debug('search', e); return giveUp('error'); } finally { try { db.close(); } catch { /* already closed */ } }
}

// Which project does a prompt belong to? Every main project is asked; score = best match + the project's routing prior (projects.json "prior"; the default project has one, because the other projects copy its layout and generic prompts match both)
// + a bonus for a project named in the prompt (its aliases; a bonus, not a rule: one project's docs may name another) + a small bonus for the working folder (cwdHints). The highest score wins.
// The owner's eval (private, 487 written questions): 98.6% routed to the right project (the default project 99.1%, the second 88.5%, the third 100%; no priors at all: 88%, the third 13%). The fallback (general docs) is only a fallback: the slowest to search and the least specific.
const SESSION_STRONG = 1.4;
function hadMap(home, session, project) {   // did this session already get a map of this project? (remember() writes one `last` row per session)
  if (!session) return false;
  let db; try { db = new (sqlite())(dbFile(home), { readOnly: true }); } catch { return false; }
  try { const r = db.prepare('SELECT project FROM last WHERE session = ?').get(session); return !!r && (r.project || legacyProject() || defaultProject()) === project; } catch { return false; } finally { try { db.close(); } catch { /* closed */ } }
}
// Projects named in the (lower-case) prompt by an alias. When one matched alias sits inside a longer matched one
// ("gabriel" in "gabriel-dev": the dash is a word boundary), only the longer one counts.
function namedProjects(projects, lc) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = projects.map((p) => ({ p, a: (p.aliases || []).map((a) => a.toLowerCase()).filter((a) => new RegExp('\\b' + esc(a) + '\\b').test(lc)) })).filter((x) => x.a.length);
  return hits.filter((x) => !x.a.every((a) => hits.some((y) => y !== x && y.a.some((b) => b.length > a.length && b.includes(a))))).map((x) => x.p.name);
}
function searchAll(home, text, opts = {}) {
  const lc = String(text || '').toLowerCase(), cwd = String(opts.cwd || '').toLowerCase();
  const outTrace = opts.trace && typeof opts.trace === 'object' ? opts.trace : null, record = (name, t) => { if (outTrace) (outTrace.sets ||= {})[name] = { reason: t.reason, best: t.best || 0, gate: t.gate ?? GATE }; };   // opts.trace: per doc set, why it gave no map (search() fills a fresh object for each set)
  const ps = loadProjects(), fb = ps.find((p) => p.fallback);
  let main = ps.filter((p) => !p.fallback);
  const pinList = Array.isArray(opts.pins) ? opts.pins : [];
  const pins = pinList.filter((n) => main.some((p) => p.name === n));
  if (pins.length) main = main.filter((p) => pins.includes(p.name));   // a session pinned with "gabriel use a b" (src/pin.js): only those sets, one block each
  const named = namedProjects(main, lc);
  const hits = [];
  for (const p of main) {   // file order; a tie keeps the earlier project
    const tr = outTrace ? {} : undefined, r = search(home, text, { ...opts, project: p.name, learn: p.learn ? opts.learn : false, trace: tr });
    if (tr) record(p.name, tr);
    if (r) hits.push({ r, score: r.best + p.prior + (named.includes(p.name) ? ROUTE_NAMED : 0) + ([p.name, ...(p.cwdHints || [])].some((h) => cwd.includes(h.toLowerCase())) ? 0.3 : 0) });
  }
  hits.sort((a, b) => b.score - a.score);
  // Session gate: off-topic prompts (job tips, questions about this brain) scored 0.68-1.40 here while real unnamed questions have a median of 1.68
  // (2026-11-09 measurement). So a weak, unnamed match outside the repo folder shows a map only when this session already had one for that project.
  // Opt-in per project (projects.json "sessionGate": true). Off by default.
  const gated = (h) => (getProject(h.r.project) || {}).sessionGate && !named.includes(h.r.project) && !cwd.includes(h.r.project) && h.r.best < (opts.strong ?? SESSION_STRONG) && !hadMap(home, opts.session, h.r.project);   // is this set cut by the session gate?
  if (pins.length >= 2) { while (hits[0] && gated(hits[0])) { if (outTrace) { outTrace.sessionGate = true; outTrace.gated ??= hits[0].r.project; } hits.shift(); } }   // 2+ pins: drop each gated set from the top, the other pinned sets still show
  else if (pins.length !== 1 && hits[0] && gated(hits[0])) { if (outTrace) { outTrace.sessionGate = true; outTrace.gated ??= hits[0].r.project; } hits.length = 0; }   // one pin: the user chose this set, so the gate does not hide it
  const top = hits[0], also = [];
  if (pins.length >= 2) also.push(...hits.slice(1).map((h) => h.r));   // two or more pinned sets: every other pinned set that matched gets a short block
  else if (top && hits[1] && hits[1].score >= top.score - ALSO_CLOSE) also.push(hits[1].r);   // a close call: the second project gets a short block too
  // The fallback project (general docs): the answer when no project answers, and a short extra block when the project's own answer is weak and the general docs are clearly stronger.
  // A words-only look costs 0.3 s; the meaning scan of the fallback chunks about 1 s, so it only runs when the project is weak and the words already match something.
  if (fb && (!top || top.r.best < FALLBACK_IF_WEAKER_THAN)) {
    const ptr = outTrace ? {} : undefined, probe = search(home, text, { ...opts, pv: null, gate: 0, project: fb.name, learn: false, trace: ptr });
    if (ptr) record(fb.name, ptr);
    if (probe && probe.best >= (top ? FALLBACK_PROBE_WITH_PROJECT : FALLBACK_PROBE_ALONE)) {
      const ttr = outTrace ? {} : undefined, t = search(home, text, { ...opts, gate: FALLBACK_GATE, project: fb.name, learn: false, trace: ttr });
      if (ttr) record(fb.name, ttr);
      if (t && !top) { t.also = []; return t; }
      if (t && t.best >= top.r.best + FALLBACK_FIRST) { t.also = [top.r, ...also]; return t; }   // the general docs are far stronger than a weak project match: they lead
      if (t && t.best >= top.r.best + FALLBACK_MARGIN) also.push(t);
    }
  }
  if (!top) return null;
  top.r.also = also;
  return top.r;
}

// The "(...)" part of a code line or a neighbour line. exact true: the line on disk, with a check mark (" moved" when the name was found in another file); exact false: the file or name is not in the repo; no exact mark: today's text.
const where = (n, file, withLine) => n.exact === true ? `${file}:${n.loc.replace(/^L/, '')} ✓${n.moved ? ' moved' : ''}`
  : n.exact === false && n.file ? `${file}, not found in repo`
    : `${file}${withLine && n.loc ? ':' + n.loc.replace(/^L/, '') : ''}`;
function format(res, lim = {}) {   // lim: a shorter block (max characters, number of docs and code lines) for a second project
  if (!res) return '';
  const pj = res.project || defaultProject(), P = getProject(pj) || {}, pn = P.label || pj;
  let out = P.fallback
    ? `${pn} (general programming and architecture, from public docs; built ${new Date(res.built).toISOString().slice(0, 10)}; background reading, not a rule of this repo):\n`
    : `${pn} map (spreading search over ${P.graph ? 'docs + code graph' : 'docs'}${res.commit ? ' @' + res.commit.slice(0, 8) : ''}, built ${new Date(res.built).toISOString().slice(0, 10)}; start here, then confirm in the code, the map can be old):\n`;
  const codeLine = (c) => `- code ${c.n.label} (${where(c.n, c.n.file, true)})${c.chain ? ' 2 links away' : ''}`;
  const codes = res.code.slice(0, lim.code ?? 99);
  let keep = lim.max ? 0 : codes.slice(0, CODE_KEEP).reduce((s, c) => s + codeLine(c).length + 1, 0);   // room kept for the first code lines: long docs must not push out an exact code hit
  const add = (s) => { if (out.length - nbUsed + s.length + 1 <= (lim.max ?? MAX_CHARS) - keep) out += s + '\n'; };
  let nbUsed = 0;   // neighbor lines have their own budget, so they never push a code hit out
  const addNb = (s) => { if (nbUsed + s.length + 1 <= NB_CHARS) { out += s + '\n'; nbUsed += s.length + 1; } };
  for (const d of res.docs.slice(0, lim.docs ?? 99)) add(`- doc ${d.n.file.replace(/^technical-docs\//, '')}${d.n.loc ? ':' + d.n.loc.replace(/^L/, '') : ''} > ${d.n.section || '(top)'}: ${d.n.text.length > DOC_CHARS ? d.n.text.slice(0, DOC_CHARS) + '...' : d.n.text}`);
  keep = 0;
  for (const c of codes) {
    const before = out.length;
    add(codeLine(c));
    if (out.length === before) continue;   // the code line did not fit: show no orphan neighbor lines
    if (!lim.max) for (const x of c.nb || []) addNb(`    ↔ ${x.label} (${where(x, x.file || 'external', false)}) ${x.w >= 1 ? 'calls/implements' : x.w >= 0.7 ? 'method' : 'defines/related'}`);
  }
  if (!lim.max) for (const a of res.also || []) out += format(a, { max: ALSO_CHARS, docs: 2, code: 2 });   // a second project: short
  return out;
}

module.exports = { defaultProject, projectNames, dbFile, docsRoot, graphPathOf, build, stale, hasMap, search, searchAll, namedProjects,format, chunkDoc, listDocs, rankDocs, remember, touched, learnShow, learnReset, status, codeFiles, pairHandlers, codeText, richText, commentOf, codeLabels, resetCodeDesc };
