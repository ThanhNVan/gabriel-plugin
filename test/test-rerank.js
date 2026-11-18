'use strict';
const assert = require('node:assert');
const { rerankCode, rerankMap } = require('../src/rerank.js');
(async () => {
  const n = (label) => ({ label, file: `src/${label}.cs` });
  const res = { code: [{ a: 1, n: n('Alpha') }, { a: 0.9, n: n('Beta') }], pool: ['Alpha', 'Beta', 'Gamma', 'Delta'].map((l) => ({ ...n(l), a: 0 })) };
  const score = async (q, texts) => texts.map((t) => (t.startsWith('gamma') ? 9 : t.startsWith('delta') ? 5 : 0));
  const out = await rerankCode(res, 'where is gamma', score, { max: 2 });
  assert.deepStrictEqual(out.code.map((c) => c.n.label), ['Gamma', 'Delta']);
  const same = await rerankCode({ code: res.code }, 'q', score, { max: 2 });
  assert.deepStrictEqual(same.code.map((c) => c.n.label), ['Alpha', 'Beta'], 'no pool: unchanged');
  const bad = await rerankCode(res, 'q', async () => { throw new Error('boom'); }, { max: 2 });
  assert.ok(bad.code.length >= 1, 'a scorer error never breaks the result');
  assert.deepStrictEqual(res.code.map((c) => c.n.label), ['Alpha', 'Beta'], 'input res.code not mutated');
  const withChain = { code: [{ a: 1, n: n('Alpha') }, { a: 0, n: n('Chain'), chain: true }], pool: res.pool };
  const chained = await rerankCode(withChain, 'where is gamma', score, { max: 2 });
  assert.strictEqual(chained.code[chained.code.length - 1].n.label, 'Chain', 'chain item stays last');
  const { getReranker, rerankModel } = require('../src/rerank.js');
  const tmp = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'rerank-'));
  assert.strictEqual(await getReranker('local/none-such', tmp), null, 'missing model folder gives null');
  process.env.GABRIEL_RERANK_MODEL = '';
  assert.strictEqual(rerankModel(), null, 'empty env disables the reranker');
  delete process.env.GABRIEL_RERANK_MODEL;

  // richText: the code body from the repo folder (temp data folder + temp repo, same stub as the other tests)
  const fs = require('node:fs'), pth = require('node:path'), os = require('node:os');
  const dataDir = fs.mkdtempSync(pth.join(os.tmpdir(), 'rt-data-')), repo = fs.mkdtempSync(pth.join(os.tmpdir(), 'rt-repo-'));
  process.env.GABRIEL_DATA = dataDir;
  fs.writeFileSync(pth.join(dataDir, 'projects.json'), JSON.stringify({ version: 1, projects: [{ name: 'demo', root: 'docs', repo }] }));
  fs.mkdirSync(pth.join(repo, 'src'));
  fs.writeFileSync(pth.join(repo, 'src', 'foo.ts'), ['import x from "y";', '', 'export class FooService {', '  constructor() {}', '  bar(a: number) {', '    const total = a * 2;', '    return total;', '  }', '}', ''].join('\n'));
  fs.writeFileSync(pth.join(repo, 'src', 'short.ts'), ['export class Short {', 'h1', '', 'h2', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 't13', '}', ''].join('\n'));
  fs.writeFileSync(pth.join(repo, 'src', 'long.ts'), ['export class LongOne {', ...Array.from({ length: 12 }, () => 'w'.repeat(100)), '}', ''].join('\n'));
  const { richText } = require('../src/rerank.js');
  const { codeText, resetCodeDesc } = require('../src/mk.js');
  const base = codeText('FooService', 'src/foo.ts');
  const rich = richText('FooService', 'src/foo.ts', 'demo');
  const descDir = pth.join(dataDir, 'private', 'demo');
  fs.mkdirSync(descDir, { recursive: true });
  fs.writeFileSync(pth.join(descDir, 'code-desc.json'), JSON.stringify({ FooService: 'Orders: Checks the order.' }));
  resetCodeDesc();
  assert.strictEqual(richText('FooService', 'src/foo.ts', 'demo'), base + ' | Orders: Checks the order.' + rich.slice(base.length));
  assert.strictEqual(richText('FooService', 'src/none.ts', 'demo'), codeText('FooService', 'src/none.ts') + ' | Orders: Checks the order.');
  fs.writeFileSync(pth.join(descDir, 'code-desc.json'), '{');
  resetCodeDesc();
  assert.strictEqual(richText('FooService', 'src/foo.ts', 'demo'), rich, 'bad JSON preserves original text');
  assert.ok(rich.startsWith(base), 'rich text starts with the codeText base');
  assert.ok(rich.includes(' | '), 'rich text has a body after the base');
  assert.ok(rich.includes('constructor'), 'rich text has a body word');
  const meth = richText('.bar()', 'src/foo.ts', 'demo');
  assert.ok(meth.includes('total'), 'method label .bar() finds the bar( line and its body');
  assert.strictEqual(richText('FooService', 'src/none.ts', 'demo'), codeText('FooService', 'src/none.ts'), 'missing file: codeText');
  assert.strictEqual(richText('FooService', 'src/foo.ts', 'no-such-project'), base, 'unknown project: codeText');
  const shortRich = richText('Short', 'src/short.ts', 'demo');
  assert.ok(shortRich.includes('export class Short') && shortRich.includes('t9') && !shortRich.includes('t10'), 'body is 12 non-empty lines from the definition line (class line, h1, h2, t1..t9)');
  const longRich = richText('LongOne', 'src/long.ts', 'demo');
  const longBase = codeText('LongOne', 'src/long.ts');
  assert.strictEqual(longRich.slice(longBase.length + 3).length, 600, 'body capped at 600 chars');

  // doc comments right above the definition: XML /// (tags dropped), /** */ and // lines, at most 3 comment lines
  fs.writeFileSync(pth.join(repo, 'src', 'invoice.cs'), ['using System;', '/// <summary>', '/// Sends the invoice to the buyer.', '/// </summary>', 'public class InvoiceSender', '{', '    public void Send() { }', '}', ''].join('\n'));
  fs.writeFileSync(pth.join(repo, 'src', 'line.ts'), ['/**', ' * Adds a line item to the order.', ' */', 'export class LineAdder {', '  run() { return 1; }', '}', ''].join('\n'));
  fs.writeFileSync(pth.join(repo, 'src', 'plain.ts'), ['// Keeps the total in cents.', 'export class CentsTotal {', '  run() { return 1; }', '}', ''].join('\n'));
  fs.writeFileSync(pth.join(repo, 'src', 'many.cs'), ['/// Line one here.', '/// Line two here.', '/// Line three here.', '/// Line four here.', '/// Line five here.', 'public class ManyNotes {', '}', ''].join('\n'));
  const invRich = richText('InvoiceSender', 'src/invoice.cs', 'demo');
  const invBase = codeText('InvoiceSender', 'src/invoice.cs');
  const at = invRich.indexOf('Sends the invoice to the buyer.');
  assert.ok(at > invBase.length, 'doc comment text comes after the codeText base');
  assert.ok(at < invRich.indexOf('class InvoiceSender'), 'doc comment text comes before the body lines');
  assert.ok(!invRich.includes('///') && !invRich.includes('<summary>'), 'no comment marks or XML tags');
  assert.ok(richText('LineAdder', 'src/line.ts', 'demo').includes('Adds a line item to the order.'), '/** */ comment text is used');
  assert.ok(richText('CentsTotal', 'src/plain.ts', 'demo').includes('Keeps the total in cents.'), '// comment text is used');
  const many = richText('ManyNotes', 'src/many.cs', 'demo');
  assert.ok(!many.includes('Line two here.') && many.includes('Line three here.') && many.includes('Line five here.'), 'only the 3 comment lines nearest the definition');

  const capture = [];
  const capScore = async (q, texts) => { capture.push(...texts); return texts.map(() => 0); };
  const resR = { project: 'demo', code: [], pool: [{ label: 'FooService', file: 'src/foo.ts' }, { label: '.bar()', file: 'src/foo.ts' }] };
  await rerankCode(resR, 'q', capScore, { max: 2, rich: true });
  assert.deepStrictEqual(capture, [richText('FooService', 'src/foo.ts', 'demo'), richText('.bar()', 'src/foo.ts', 'demo')], 'rich:true sends rich texts');
  capture.length = 0;
  await rerankCode(resR, 'q', capScore, { max: 2 });
  assert.deepStrictEqual(capture, [codeText('FooService', 'src/foo.ts'), codeText('.bar()', 'src/foo.ts')], 'default sends codeText');

  // rerankMap: the main set and every also set, inside one time limit
  assert.strictEqual(await rerankMap(null, 'q', score, 5000), null, 'null res gives null');
  const item = (label, a = 0) => ({ label, file: `src/${label}.cs`, a });
  const set = (label) => ({ a: 1, n: { label, file: `src/${label}.cs`, kind: 'code' } });
  const mapRes = () => ({
    project: 'p', code: [set('Alpha'), set('Beta')], pool: [item('Alpha', 1), item('Beta', 0.9), item('Gamma')],
    also: [{ project: 'p2', code: [set('Delta')], pool: [item('Delta'), item('Echo')] }],
  });
  const pick = async (q, texts) => texts.map((t) => (t.startsWith('gamma') ? 9 : t.startsWith('echo') ? 8 : 0));
  const mapIn = mapRes(), before = JSON.stringify(mapIn);
  const mapOut = await rerankMap(mapIn, 'where is gamma', pick, 5000);
  assert.strictEqual(mapOut.code[0].n.label, 'Gamma', 'main set: best pool item first');
  assert.strictEqual(mapOut.also[0].code[0].n.label, 'Echo', 'also set: best pool item first');
  assert.strictEqual(JSON.stringify(mapIn), before, 'input res not mutated');
  const chainIn = { ...mapRes(), code: [set('Alpha'), { a: 0, n: { label: 'Chain', file: 'c.cs', kind: 'code' }, chain: true }] };
  const chainOut = await rerankMap(chainIn, 'where is gamma', pick, 5000);
  assert.ok(chainOut.code.some((c) => c.chain && c.n.label === 'Chain'), 'chain item stays in code');
  const slow = async (q, texts) => { await new Promise((r) => setTimeout(r, 200)); return texts.map(() => 0); };
  const slowIn = mapRes();
  assert.strictEqual(await rerankMap(slowIn, 'q', slow, 50), slowIn, 'timeout gives the same object');
  const badIn = mapRes();
  assert.strictEqual(await rerankMap(badIn, 'q', async () => { throw new Error('boom'); }, 5000), badIn, 'scorer throws gives the same object');

  console.log('ALL PASSED');
})().catch((e) => { console.error(e); process.exitCode = 1; });
