// Quality check for the default map (mk.js). The questions are in eval-cases.json in the private data folder (about 160).
//   node eval/eval-map.js                     run all questions with the meaning model (like the hook) and print a summary
//   node eval/eval-map.js --set dev|held|fresh   only one set. Tune on `dev` only. `held`: do not tune on it. `fresh`: questions written after the tuning; write a new batch (set `fresh`) for the next round, then call the old one `held`
//   node eval/eval-map.js --tier middle       only easy | middle | hard
//   node eval/eval-map.js --area events       only one area (prefix of the id; the areas are the id prefixes in your cases file)
//   node eval/eval-map.js --no-meaning        words and synonyms only
//   node eval/eval-map.js --fails             list every failing question (default: only the first 40)
//   node eval/eval-map.js --report            also write EVAL-MK.md (every question with its result)
//   node eval/eval-map.js --route             use the real router (every project in projects.json, and the general docs): an answer from the wrong project is a miss. Without it each question searches its own project (field `project`, default: the default project)
//   node eval/eval-map.js --min 0.7           exit 1 when the strict pass rate of the chosen questions is under 70% (or an unrelated question leaks)
//   node eval/eval-map.js --project <name>      one project (default: the default project). Cases: <private>/<name>/eval-cases.json
//   node eval/eval-map.js --all                 every project that has an eval-cases.json, one block each
//   node eval/eval-map.js --route --cwd <dir>   route as if the prompt came from that working folder (cwdHints); a case can set its own "cwd"
//   node eval/eval-map.js --rank <rank.json>    test these doc ranking weights (from train-rank.js) instead of the project's rank file
//   node eval/eval-map.js --why                 for each DOC or FAIL: its miss class (section-rank, not-in-pool, wrong-doc, code-only-miss), then the counts
//   --cases <file> overrides the cases file (one project only). No cases file: prints a note and exits 0. See docs/EVAL.md.
// A case: q (the question), doc / sec (regular expressions for a doc file and its section), code (regex for a code name),
// any (pass when the doc OR the code matches), none (nothing may be returned). Matching ignores case.
// Results: OK = right doc and section (or right code); DOC = right doc, wrong section; FAIL = nothing right; LEAK = an unrelated question got a map.
// Learned links are ignored here, so the numbers do not depend on how you worked.
const fs = require('fs');
const path = require('path');
const { homeDir } = require('../src/rules.js');
const paths = require('../src/paths.js');
const mk = require('../src/mk.js');
const { getEmbedder } = require('../src/embed.js');

const argv = process.argv.slice(2), flag = (n) => argv.includes(n), opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const rx = (s) => new RegExp(s, 'i');
const short = (f) => f.replace(/^technical-docs\/(for-dev\/)?/, '').replace(/\.md$/, '');

function judge(c, res) {
  if (c.none) return res ? 'LEAK' : 'OK';
  const docs = res ? res.docs : [], code = res ? res.code : [];
  const docFile = c.doc ? docs.some((d) => rx(c.doc).test(d.n.file)) : null;
  const docSec = c.doc ? docs.some((d) => rx(c.doc).test(d.n.file) && (!c.sec || rx(c.sec).test(d.n.section || ''))) : null;
  const codeOk = c.code ? code.some((x) => rx(c.code).test(x.n.label)) : null;
  const strict = c.any ? (docSec || codeOk) : [docSec, codeOk].filter((v) => v !== null).every(Boolean);
  if (strict) return 'OK';
  const lenient = c.any ? (docFile || codeOk) : [docFile, codeOk].filter((v) => v !== null).every(Boolean);
  return lenient ? 'DOC' : 'FAIL';
}

// --why: the miss class of a DOC or FAIL. In order: the section is shown but the code name is missing; the section is a candidate but not shown;
// a candidate or shown doc is the right file but no candidate has the section; anything else is the wrong doc.
function whyOf(c, res) {
  if (!c.doc) return 'wrong-doc';
  const isDoc = (x) => rx(c.doc).test(x.file), isSec = (x) => isDoc(x) && (!c.sec || rx(c.sec).test(x.sec));
  const shown = (res ? res.docs : []).map((d) => ({ file: d.n.file, sec: d.n.section || '' }));
  const cands = res && res.cands ? res.cands : [];
  const codeOk = c.code ? (res ? res.code : []).some((x) => rx(c.code).test(x.n.label)) : true;
  if (shown.some(isSec) && !codeOk) return 'code-only-miss';
  if (cands.some(isSec)) return 'section-rank';
  if (shown.concat(cands).some(isDoc)) return 'not-in-pool';
  return 'wrong-doc';
}

function judgeRendered(c, res, root = res) {
  if (!res) return judge(c, res);
  const project = res.project || mk.defaultProject(), P = require('../src/projects.js').getProject(project) || {};
  const heading = (P.label || project) + (P.fallback ? ' (' : ' map (');
  const lines = [];
  let own = false;
  for (const line of mk.format(root).split('\n')) {
    if (line && !line.startsWith('- ')) own = line.startsWith(heading);
    else if (own) lines.push(line);
  }
  const docs = res.docs.filter((d) => lines.some((s) => s.startsWith(`- doc ${d.n.file.replace(/^technical-docs\//, '')} > ${d.n.section || '(top)'}: `)));
  const code = res.code.filter((d) => lines.some((s) => s.startsWith(`- code ${d.n.label} (${d.n.file}`)));
  return judge(c, { ...res, docs, code });
}

// One project's eval: prints its summary block. DEFAULT = the project under test (the name is kept from the one-project version).
// Returns true only when --min is set and missed.
async function evalProject(DEFAULT, casesFile, embed, rankOpt) {
  const all = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
  const cases = all.filter((c) => (!opt('--set') || c.set === opt('--set')) && (!opt('--tier') || c.tier === opt('--tier')) && (!opt('--area') || c.id.toUpperCase().startsWith(opt('--area').toUpperCase())));
  const rows = [];
  for (const c of cases) {
    const start = Date.now();
    const pv = embed ? (await embed([c.q]))[0] : null;
    // --route: the real router picks the project; an answer from the wrong project counts as no answer (a miss), and any answer to an unrelated question is a leak
    const t0 = Date.now(), res0 = flag('--route') ? mk.searchAll(homeDir(), c.q, { pv, learn: false, strong: 0, cwd: opt('--cwd') || c.cwd || '', why: flag('--why'), ...rankOpt }) : mk.search(homeDir(), c.q, { pv, learn: false, project: c.project || DEFAULT, why: flag('--why'), ...rankOpt });
    const own = c.project || DEFAULT, res = flag('--route') && res0 && !c.none ? (res0.project === own ? res0 : (res0.also || []).find((a) => a.project === own) || null) : res0;   // the right project's block may be the main one or a second, shorter one
    rows.push({ c, status: judge(c, res), renderedStatus: judgeRendered(c, res, res0), why: flag('--why') ? whyOf(c, res) : null, alsoN: res0 && res0.also ? res0.also.length : 0, blockN: res0 ? mk.format(res0).length : 0, ms: Date.now() - t0, totalMs: Date.now() - start, best: res ? res.best : 0, docs: res ? res.docs.map((d) => short(d.n.file) + ' > ' + (d.n.section || '').split(' > ').slice(-1)[0]) : [], code: res ? res.code.map((x) => x.n.label) : [], commit: res ? res.commit : null });
    if (rows.length % 25 === 0) console.log(`progress ${rows.length}/${cases.length}`);
  }
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(rows, null, 2) + '\n');
  const rate = (rs, f) => (rs.length ? `${rs.filter(f).length}/${rs.length} (${Math.round((100 * rs.filter(f).length) / rs.length)}%)` : '-');
  const knownRows = rows.filter((r) => r.c.known);   // measured near misses that are listed but not counted
  rows.splice(0, rows.length, ...rows.filter((r) => !r.c.known));
  const isMk = (r) => !r.c.project || r.c.project === DEFAULT;   // the headline numbers are the default project only; the other projects get their own lines
  const pos = rows.filter((r) => !r.c.none && isMk(r)), neg = rows.filter((r) => r.c.none), others = rows.filter((r) => !r.c.none && !isMk(r));
  const strict = (r) => r.status === 'OK', lenient = (r) => r.status === 'OK' || r.status === 'DOC';
  const lines = [];
  const out = (s = '') => { lines.push(s); console.log(s); };
  const L = (require('../src/projects.js').getProject(DEFAULT) || {}).label || DEFAULT;   // the project's own label, e.g. "Notes"
  out(`${L} map eval: ${rows.length} questions (${pos.length} ${L}, ${neg.length} unrelated), ${embed ? 'with' : 'without'} meaning, learned links ignored`);
  out(`  ${(L + ' questions').padEnd(20)} strict ${rate(pos, strict)}   right doc or code ${rate(pos, lenient)}`);
  out(`  unrelated questions  quiet ${rate(neg, strict)}   (a LEAK is a map shown for an unrelated question)`);
  for (const s of ['dev', 'held', 'fresh', 'train2', 'blind', 'blind2', 'blind3', 'blind4', 'blind5', 'blind6']) { const p = pos.filter((r) => r.c.set === s); if (p.length) out(`  set ${s.padEnd(6)}           strict ${rate(p, strict)}   right doc or code ${rate(p, lenient)}`); }
  for (const pj of [...new Set(others.map((r) => r.c.project))]) { const p = others.filter((r) => r.c.project === pj); if (p.length) out(`  project ${pj.padEnd(5)}         strict ${rate(p, strict)}   right doc or code ${rate(p, lenient)}`); }
  for (const t of ['easy', 'middle', 'hard']) { const p = pos.filter((r) => r.c.tier === t); if (p.length) out(`  tier ${t.padEnd(6)}          strict ${rate(p, strict)}   right doc or code ${rate(p, lenient)}`); }
  const areas = [...new Set(rows.map((r) => r.c.id.replace(/-\d+$/, '')))];
  out('  by area (strict): ' + areas.filter((a) => a !== 'NEG' && pos.some((r) => r.c.id.startsWith(a + '-'))).map((a) => { const p = pos.filter((r) => r.c.id.startsWith(a + '-')); return `${a} ${p.filter(strict).length}/${p.length}`; }).join('   '));
  if (flag('--route')) { const shown = rows.filter((r) => !r.c.none); out(`  second project block shown for ${rate(shown, (r) => r.alsoN > 0)} of the questions (the cost of a close call: a few more lines)`); }
  const ms = rows.map((r) => r.ms); out(`  search time: average ${Math.round(ms.reduce((a, b) => a + b, 0) / Math.max(ms.length, 1))} ms, slowest ${Math.max(0, ...ms)} ms (the hook timeout is 60,000 ms; the map search stops after 11,000 ms)`);
  const blocks = rows.filter((r) => r.blockN > 0), bl = blocks.map((r) => r.blockN);   // the block the hook shows (mk.format of the result, second-project blocks included)
  out(`  block chars: average ${Math.round(bl.reduce((a, b) => a + b, 0) / Math.max(bl.length, 1))}, largest ${Math.max(0, ...bl)}; second-set block for ${flag('--route') ? `${blocks.filter((r) => r.alsoN > 0).length}/${blocks.length} questions` : 'n/a'}`);
  if (knownRows.length) out('  known, not counted: ' + knownRows.map((r) => `${r.c.id} (${r.status}): ${r.c.why || ''}`).join('; '));
  const bad = rows.filter((r) => !strict(r)), shown = flag('--fails') ? bad : bad.slice(0, 40);
  if (bad.length) out(`\nnot strict-OK (${bad.length})${shown.length < bad.length ? `, first ${shown.length} (use --fails for all)` : ''}:`);
  for (const r of shown) out(`  ${r.status.padEnd(4)} ${r.c.id.padEnd(8)} [${r.c.set},${r.c.tier}] "${r.c.q}"\n         want: ${[r.c.doc && 'doc~' + r.c.doc, r.c.sec && 'sec~' + r.c.sec, r.c.code && 'code~' + r.c.code, r.c.none && 'nothing'].filter(Boolean).join('  ')}${r.c.any ? '  (doc OR code)' : ''}\n         got:  ${r.docs.slice(0, 3).join(' | ') || '-'}  //  ${r.code.slice(0, 3).join(', ') || '-'}`);
  if (flag('--why')) {
    const misses = pos.filter((r) => r.status === 'DOC' || r.status === 'FAIL'), n = (k) => misses.filter((r) => r.why === k).length;
    for (const r of misses) out(`why ${r.c.id} ${r.why}`);
    out(`why classes: section-rank ${n('section-rank')}, not-in-pool ${n('not-in-pool')}, wrong-doc ${n('wrong-doc')}, code-only-miss ${n('code-only-miss')}`);
  }

  if (flag('--report')) {
    const md = [];
    const commit = (rows.find((r) => r.commit) || {}).commit;
    md.push('# Map — test questions and results', '',
      `> Generated by \`node eval/eval-map.js --report\` on ${new Date().toISOString().slice(0, 10)}. Map built from graph commit \`${commit ? commit.slice(0, 8) : '?'}\`. The questions are in the cases file (eval-cases.json, private data folder); this page is rebuilt from them.`, '',
      `${rows.length} questions: ${pos.length} about the default project and ${neg.length} unrelated. Learned links are ignored, so the numbers do not depend on how the map was used.`, '',
      '## Summary', '', '| What | Strict | Right doc or code |', '|---|---|---|',
      `| All default-project questions | ${rate(pos, strict)} | ${rate(pos, lenient)} |`,
      ...['dev', 'held', 'fresh', 'train2', 'blind', 'blind2', 'blind3', 'blind4', 'blind5', 'blind6'].filter((s) => pos.some((r) => r.c.set === s)).map((s) => `| Set \`${s}\`${{ dev: ' (used for tuning)', held: ' (failures were read, never tuned for)', fresh: ' (written after tuning, run once)', train2: ' (more data for the doc ranking weights)', blind: ' (run once, then used: its failures led to fixes and it joined the training)', blind2: ' (first run, before any fix: 48/59 strict = 81%, 54/59 right doc or code = 92%. The heading gate was added after that, so this row no longer counts as blind)', blind3: ' (written after round 3, first run: 53/61 strict = 87%, 55/61 right doc or code = 90%. The honest score for new questions. I read its failures, so it no longer counts as blind)', blind4: ' (written after round 4 from the doc headings, run once; the first-run score is in README.md. Once its failures are read it no longer counts as blind)', blind5: ' (written before the round-5 fixes from the doc headings, run once after them; the first-run score is in README.md)', blind6: ' (written before the question index was built, run once after it; the first-run score is in README.md)' }[s]} | ${rate(pos.filter((r) => r.c.set === s), strict)} | ${rate(pos.filter((r) => r.c.set === s), lenient)} |`),
      ...['easy', 'middle', 'hard'].map((t) => `| Tier \`${t}\` | ${rate(pos.filter((r) => r.c.tier === t), strict)} | ${rate(pos.filter((r) => r.c.tier === t), lenient)} |`),
      `| Unrelated questions kept quiet | ${rate(neg, strict)} | |`, '',
      '- **Strict:** the right doc and the right section (or the right code name) is in the map.',
      '- **Right doc or code:** the right doc is there, but maybe not the exact section.',
      '- **Tiers:** easy = the question uses the doc\'s own words; middle = a natural rephrasing; hard = a symptom or an indirect question.',
      '- **Sets:** only `dev` was used to tune the map. The failures of `held` were read but not tuned for. `fresh` was written after the tuning and run once, so it is the honest score for new questions.', '');
    const areaNamesFile = path.join(paths.privateDir(DEFAULT), 'eval-area-names.json');
    const names = fs.existsSync(areaNamesFile) ? JSON.parse(fs.readFileSync(areaNamesFile, 'utf8')) : {};   // area labels for the report, from the private data folder
    for (const a of areas) {
      md.push(`## ${names[a] || a}`, '', '| ID | Set | Tier | Question | Expected | Result | Top hit |', '|---|---|---|---|---|---|---|');
      for (const r of rows.filter((x) => x.c.id.startsWith(a + '-'))) {
        const want = [r.c.doc && `doc \`${r.c.doc}\``, r.c.sec && `section \`${r.c.sec}\``, r.c.code && `code \`${r.c.code}\``, r.c.none && 'no map'].filter(Boolean).join(', ') + (r.c.any ? ' (doc or code)' : '');
        const top = (r.docs[0] || r.code[0] || '-').replace(/\|/g, '\\|');
        md.push(`| ${r.c.id} | ${r.c.set} | ${r.c.tier} | ${r.c.q.replace(/\|/g, '\\|')} | ${want.replace(/\|/g, '\\|')} | ${r.status} | ${top} |`);
      }
      md.push('');
    }
    const reportFile = path.join(paths.privateDir(DEFAULT), 'notes', 'EVAL-MK.md');
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, md.join('\n') + '\n');
    out('\nwrote EVAL-MK.md');
  }
  const min = opt('--min');
  const failed = (min && pos.filter(strict).length / Math.max(pos.length, 1) < Number(min)) || neg.some((r) => r.status === 'LEAK');
  return !!(min && failed);
}

async function main() {
  const rankFile = opt('--rank'), rankOpt = rankFile ? { rankW: JSON.parse(fs.readFileSync(rankFile, 'utf8')).w } : {};   // no --rank: each project uses its own rank file
  if (rankFile && !Array.isArray(rankOpt.rankW)) throw new Error(`no weights (w) in ${rankFile}`);
  const casesOf = (name) => (!flag('--all') && opt('--cases')) || path.join(paths.privateDir(name), 'eval-cases.json');
  const names = flag('--all') ? mk.projectNames().filter((n) => fs.existsSync(casesOf(n))) : [opt('--project') || mk.defaultProject()];
  if (flag('--all') && !names.length) console.log('no eval cases in any project: see docs/EVAL.md');
  const embed = flag('--no-meaning') ? null : await getEmbedder(false);
  let failed = false;
  for (const name of names) {
    if (!fs.existsSync(casesOf(name))) { console.log(`no eval cases for ${name}: see docs/EVAL.md`); continue; }
    if (flag('--all')) console.log(`== project ${name}`);
    failed = (await evalProject(name, casesOf(name), embed, rankOpt)) || failed;
  }
  process.exit(failed ? 1 : 0);
}

module.exports = { judge, judgeRendered };
if (require.main === module) main().catch((e) => { console.error(e); process.exitCode = 1; });
