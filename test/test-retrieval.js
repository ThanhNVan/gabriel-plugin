const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mk = require('../src/mk.js');

async function main() {
  const only = process.argv[2];
  if (!only || only === 'chunks') {
    for (const text of [Array.from({ length: 180 }, (_, i) => `word${i}`).join(' '), 'x'.repeat(1351), 'a '.repeat(450) + 'tail', 'a' + '\u{1F600}'.repeat(400)]) {
      const chunks = mk.chunkDoc('test.md', '# Parent\n\n## Child\n\n' + text).chunks;
      assert.equal(chunks.map((c) => c.text).join('').replace(/\s/g, ''), text.replace(/\s/g, ''), 'splitting must preserve the complete long line, including a short tail');
      assert.ok(chunks.every((c) => c.text.length <= 450 && c.section === 'Parent > Child'), 'chunks stay bounded and keep their heading');
      assert.ok(chunks.every((c) => !/[\uD800-\uDBFF]$|^[\uDC00-\uDFFF]/.test(c.text)), 'chunk boundaries must not split a Unicode character');
    }
    console.log('chunks PASSED');
    const fenced = mk.chunkDoc('test.md', '# Features\n\n## Supplier\n\n```text\ntickets documents messages and other supplier pages\n```').chunks;
    assert.ok(fenced.some((c) => c.section === 'Features > Supplier' && c.text.includes('tickets documents')), 'fenced reference text must be searchable');
  }
  if (!only || only === 'selection') {
    const { judge, judgeRendered } = require('../eval/eval-map.js');
    assert.equal(typeof judgeRendered, 'function', 'accuracy must also check what fits in the hook output');
    const hidden = { project: 'alpha', built: Date.now(), docs: [{ n: { file: 'answer.md', section: 'x'.repeat(2400), text: 'answer' } }], code: [] };
    assert.equal(judge({ doc: 'answer' }, hidden), 'OK');
    assert.equal(judgeRendered({ doc: 'answer' }, hidden), 'FAIL', 'a result omitted by the character cap is not delivered');
    const doc = (file) => ({ n: { file, section: 'Section', text: 'A short passage about the expected topic.' } });
    const secondary = { project: 'beta', built: Date.now(), docs: [doc('one.md'), doc('two.md'), doc('answer.md')], code: [] };
    const primary = { project: 'alpha', built: Date.now(), docs: [doc('answer.md')], code: [], also: [secondary] };
    assert.equal(judgeRendered({ doc: 'answer' }, secondary, primary), 'FAIL', 'the secondary third result is omitted, even if the primary has an identical path');
    assert.equal(judgeRendered({ doc: 'one' }, secondary, primary), 'OK', 'visible secondary results still count');
    assert.equal(typeof mk.rankDocs, 'function', 'training and runtime need one shared selector');
    const rows = Array.from({ length: 9 }, (_, i) => ({ n: { file: `${i}.md`, section: 'Section' }, f: [9 - i / 10], y: i === 5 }));
    const selected = mk.rankDocs(rows, [1]);
    assert.equal(selected.length, 6, 'default selection matches the six live slots');
    assert.ok(selected.some((r) => r.y), 'the sixth result counts during training too');
    const duplicate = { n: { file: '0.md', section: 'Section' }, f: [10] };
    const more = [{ n: { file: '0.md', section: 'Other' }, f: [9.9] }, { n: { file: '0.md', section: 'Third' }, f: [9.8] }];
    const got = mk.rankDocs([duplicate, ...more, ...rows, { n: { file: 'weak.md', section: '' }, f: [1] }], [1]);
    assert.equal(got.filter((r) => r.n.file === '0.md').length, 2, 'at most two sections per file');
    assert.equal(new Set(got.map((r) => r.n.file + '::' + r.n.section)).size, got.length, 'no duplicate sections');
    assert.ok(!got.some((r) => r.n.file === 'weak.md'), 'score-gap cutoff is shared');
    assert.equal(mk.rankDocs(rows, [1], 2).length, 2, 'explicit top-k diagnostics still work');
    assert.deepEqual(mk.rankDocs([], [1]), []);
    console.log('selection PASSED');
  }
  if (!only || only === 'embedding') {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retrieval-test-'));
    try {
      const root = path.join(tmp, 'docs');
      fs.mkdirSync(root, { recursive: true });
      const text = 'Context about query routing and retries. '.repeat(10) + 'LAST_SENTENCE_MUST_BE_EMBEDDED';
      fs.writeFileSync(path.join(root, 'one.md'), '# Complete passage\n\n' + text);
      const batches = [];
      await mk.build(tmp, { root, project: 'tech', embed: async (texts) => { batches.push(...texts); return texts.map(() => [1, 0]); } });
      assert.ok(batches.some((t) => t.startsWith('Complete passage: ') && t.includes('LAST_SENTENCE_MUST_BE_EMBEDDED')), 'embedding must receive the full chunk with its heading');
      console.log('embedding PASSED');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
