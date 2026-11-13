// Copies old brain data into the new data folder. Copies and checks, never deletes or changes the source.
// Usage: node src/migrate-data.js --from <old brain folder> [--to <dir>] [--dry-run] [--project <name>] [--projects <file>] [--thesaurus <file>]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dataDir, checkName } = require('./paths');

// [source under the old brain folder, target under the new data folder]; <p> = the project the old data belongs to (--project)
const MOVES = [
  ['data/mk.db', 'mk.db'], ['data/vectors.json', 'vectors.json'], ['graph.json', 'graph.json'],
  ['data/dq.bin', 'dq.<p>.bin'], ['data/dq.idx.json', 'dq.<p>.idx.json'],
  ['data/seen', 'seen'], ['data/models', 'models'], ['data/corpus/tech', 'corpus/tech'], ['history', 'history'],
  ['eval-mk-cases.json', 'private/<p>/eval-cases.json'], ['doc-questions.json', 'private/<p>/doc-questions.json'],
  ['rank.json', 'private/<p>/rank.json'], ['rank.pre-refresh-20261112.json', 'private/<p>/notes/rank.pre-refresh-20261112.json'],
  ['EVAL-MK.md', 'private/<p>/notes/EVAL-MK.md'], ['EVAL-HISTORY.md', 'private/<p>/notes/EVAL-HISTORY.md'],
  ['REFRESH-2026-11-12.md', 'private/<p>/notes/REFRESH-2026-11-12.md'],
  ['RETRIEVAL-IMPROVEMENTS-2026-11-12.md', 'private/<p>/notes/RETRIEVAL-IMPROVEMENTS-2026-11-12.md'],
  ['retrieval-results-20261112', 'private/<p>/results/retrieval-results-20261112'],
  ['live-tests', 'private/<p>/live-tests'], ['eval-expectation-changes.json', 'private/<p>/eval-expectation-changes.json'],
  ['eval-retrieval-heldout.json', 'private/<p>/eval-retrieval-heldout.json'], ['graphify-out', 'private/brain-graphify-out'],
];
// not moved: data/history-check, data/mk-check, data/mk.lock, data/refresh.lock (rebuilt or temporary)

const CHUNK = 1024 * 1024;

function hashFile(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const h = crypto.createHash('sha256');
    const buf = Buffer.alloc(CHUNK);
    let n;
    while ((n = fs.readSync(fd, buf, 0, CHUNK, null)) > 0) h.update(buf.subarray(0, n));
    return h.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

// All files under dir, recursive, sorted by name.
function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

// Step 1: one pair per file. Missing sources are skipped.
function expand(from, to, project) {
  const pairs = [];
  const add = (src, rel) => pairs.push({ src, dst: path.join(to, ...rel.split('/')), rel, size: fs.statSync(src).size });
  for (const [srcRel, dstTpl] of MOVES) {
    const dstRel = dstTpl.replace('<p>', project);
    const src = path.join(from, srcRel);
    if (!fs.existsSync(src)) continue;
    if (fs.statSync(src).isDirectory()) {
      for (const f of walk(src)) add(f, path.posix.join(dstRel, path.relative(src, f).split(path.sep).join('/')));
    } else {
      add(src, dstRel);
    }
  }
  return pairs;
}

// Writes a JSON file once. Never overwrites. Validates JSON before writing.
function writeJsonOnce(file, rel, to, dryRun, log) {
  const dst = path.join(to, ...rel.split('/'));
  if (fs.existsSync(dst)) {
    log(`kept existing ${rel}`);
    return;
  }
  const text = fs.readFileSync(file, 'utf8');
  JSON.parse(text);
  if (dryRun) {
    log(`would write ${rel}`);
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, text, { flag: 'wx' });
  log(`wrote ${rel}`);
}

function migrate({ from, to = dataDir(), project = 'default', dryRun = false, projects = null, thesaurus = null, log = console.log } = {}) {
  checkName(project);
  const pairs = expand(from, to, project);

  // Source hashes are cached: each source file is hashed at most once per run.
  const srcHashes = new Map();
  const srcHash = (p) => {
    if (!srcHashes.has(p.src)) srcHashes.set(p.src, hashFile(p.src));
    return srcHashes.get(p.src);
  };

  // Step 2: pre-scan everything before copying anything.
  const todo = [];
  const conflicts = [];
  let done = 0;
  for (const p of pairs) {
    if (!fs.existsSync(p.dst)) todo.push(p);
    else if (hashFile(p.dst) === srcHash(p)) done++;
    else conflicts.push(p.rel);
  }
  if (conflicts.length) {
    const err = new Error('conflict: ' + conflicts.join(', '));
    err.code = 'CONFLICT';
    throw err;
  }
  const bytes = todo.reduce((sum, p) => sum + p.size, 0);

  // Step 3: dry run changes nothing.
  if (dryRun) {
    for (const p of todo) log(`would copy ${p.rel} (${p.size} bytes)`);
    if (projects) writeJsonOnce(projects, 'projects.json', to, true, log);
    if (thesaurus) writeJsonOnce(thesaurus, 'private/thesaurus.local.json', to, true, log);
    return { planned: todo.length, copied: 0, done, conflicts: [], bytes };
  }

  // Step 4: copy each todo file, then check its hash.
  fs.mkdirSync(to, { recursive: true });
  let copied = 0;
  todo.forEach((p, i) => {
    fs.mkdirSync(path.dirname(p.dst), { recursive: true });
    fs.copyFileSync(p.src, p.dst, fs.constants.COPYFILE_EXCL);
    const h = hashFile(p.dst);
    if (h !== srcHash(p)) {
      fs.unlinkSync(p.dst);
      const err = new Error('hash mismatch: ' + p.rel);
      err.code = 'HASH';
      throw err;
    }
    fs.appendFileSync(path.join(to, 'migration.log'), `${p.src}\t${p.dst}\t${h}\t${p.size}\n`);
    copied++;
    log(`${i + 1}/${todo.length} copied ${p.rel} (${p.size})`);
  });

  // Step 5: optional JSON files, written once.
  if (projects) writeJsonOnce(projects, 'projects.json', to, false, log);
  if (thesaurus) writeJsonOnce(thesaurus, 'private/thesaurus.local.json', to, false, log);

  return { planned: todo.length, copied, done, conflicts: [], bytes };
}

module.exports = { MOVES, migrate };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
  const from = opt('--from');
  const to = opt('--to') || dataDir();
  const projects = opt('--projects');
  const thesaurus = opt('--thesaurus');
  const project = opt('--project') || 'default';
  const dryRun = args.includes('--dry-run');
  const usage = 'usage: node src/migrate-data.js --from <old brain folder> [--to <dir>] [--dry-run] [--project <name>] [--projects <file>] [--thesaurus <file>]';

  if (!from || !fs.existsSync(from) || (projects && !fs.existsSync(projects)) || (thesaurus && !fs.existsSync(thesaurus))) {
    console.error(usage);
    process.exitCode = 3;
  } else {
    try {
      const r = migrate({ from, to, project, dryRun, projects, thesaurus });
      console.log(`planned ${r.planned}, copied ${r.copied}, already done ${r.done}, bytes ${r.bytes}`);
    } catch (e) {
      console.error(e.message);
      process.exitCode = e.code === 'CONFLICT' ? 1 : e.code === 'HASH' ? 2 : 1;
    }
  }
}
