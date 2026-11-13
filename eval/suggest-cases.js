// Suggest eval cases for one project: one case per section (## or ###) of its docs. Written to <private>/<name>/eval-cases.suggested.json.
// The suggested question is the heading plus the first sentence of the section. That is a starting point only:
// review the file, rewrite each question in your own words (not the heading), then save it as eval-cases.json. This script never writes eval-cases.json.
//   node eval/suggest-cases.js --project <name>     (default: the default project)
// sectionCases() is shared with `node src/setup.js --update` (new sections only).
const fs = require('fs');
const path = require('path');
const mk = require('../src/mk.js');
const paths = require('../src/paths.js');
const { getProject } = require('../src/projects.js');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// normalized text of the ## and ### headings in a file (code fences skipped)
function headingKeys(raw) {
  const keys = new Set();
  let fence = false;
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { fence = !fence; continue; }
    const m = !fence && line.match(/^#{2,3}\s+(.*)$/);
    if (m) keys.add(norm(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')));
  }
  return keys;
}

// The section cases of one project, in file order: { q, doc, sec } plus file and section (the raw names, for `covered`). No id, no set. Throws for an unknown project.
function sectionCases(project) {
  const P = getProject(project);
  if (!P) throw new Error('unknown project: ' + project);
  const root = mk.docsRoot(project);
  const cases = [];
  for (const f of mk.listDocs(root, P.layout, P.skipDirs)) {
    const rel = path.relative(root, f).replace(/\\/g, '/'), raw = fs.readFileSync(f, 'utf8');
    const keys = headingKeys(raw), first = new Map();   // section path -> text of its first chunk (chunks come from the same code the map build uses)
    for (const c of mk.chunkDoc(rel, raw).chunks) if (!first.has(c.section)) first.set(c.section, c.text);
    for (const [section, text] of first) {
      const heading = section.split(' > ').pop();
      if (!section || !keys.has(norm(heading))) continue;
      const sentence = (text.match(/^(.+?[.!?])(\s|$)/) || [null, text])[1];
      cases.push({ q: `${heading}: ${sentence}`.slice(0, 160).trimEnd(), doc: esc(rel) + '$', sec: esc(heading), file: rel, section });
    }
  }
  return cases;
}

// True when one existing case already covers the section. Same rule as the eval (eval/eval-map.js judge): the doc regex must match the
// file, and the sec regex (when there is one) must match the section path. A case with no doc covers nothing; a bad regex covers nothing.
function covered(existing, cand) {
  return existing.some((c) => {
    if (typeof c.doc !== 'string') return false;
    try {
      return new RegExp(c.doc, 'i').test(cand.file) && (!c.sec || new RegExp(c.sec, 'i').test(cand.section || ''));
    } catch { return false; }
  });
}

// New suggested cases for a project: the sections no reviewed or suggested case covers. Ids continue after the old suggested list.
// Returns { fresh (the new ones), cases (old + new, what to write) }. Never writes anything.
function newSuggestions(project, reviewed, old) {
  const known = [...reviewed, ...old];
  let next = old.reduce((m, c) => Math.max(m, Number(String(c.id || '').replace(/^S/, '')) || 0), 0) + 1;
  const fresh = [];
  for (const c of sectionCases(project)) {
    if (covered(known, c)) continue;
    known.push({ doc: c.doc, sec: c.sec });   // a section added twice in one run is suggested once
    fresh.push({ id: `S${next++}`, q: c.q, doc: c.doc, sec: c.sec, set: 'suggested' });
  }
  return { fresh, cases: [...old, ...fresh] };
}

module.exports = { sectionCases, covered, newSuggestions, esc };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const PROJECT = opt('--project', mk.defaultProject());
  const dir = paths.privateDir(PROJECT), file = path.join(dir, 'eval-cases.suggested.json');
  const list = (f) => { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; } };
  const { cases } = newSuggestions(PROJECT, list(path.join(dir, 'eval-cases.json')), list(file));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cases, null, 1) + '\n');
  console.log(`wrote ${cases.length} suggested cases to ${file}; review them, then save as eval-cases.json`);
}
