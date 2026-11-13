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

// The section cases of one project, in file order: { q, doc, sec } (no id, no set). Throws for an unknown project.
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
      cases.push({ q: `${heading}: ${sentence}`.slice(0, 160).trimEnd(), doc: esc(rel) + '$', sec: esc(heading) });
    }
  }
  return cases;
}

module.exports = { sectionCases, esc };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const PROJECT = opt('--project', mk.defaultProject());
  const cases = sectionCases(PROJECT).map((c, i) => ({ id: `S${i + 1}`, q: c.q, doc: c.doc, sec: c.sec, set: 'suggested' }));
  const file = path.join(paths.privateDir(PROJECT), 'eval-cases.suggested.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cases, null, 1) + '\n');
  console.log(`wrote ${cases.length} suggested cases to ${file}; review them, then save as eval-cases.json`);
}
