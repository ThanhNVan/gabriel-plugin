// Tests for the suggested cases: a section is new only when no reviewed or suggested case covers it (same rule as the eval).
// Temp GABRIEL_DATA with one doc set. The real data folder is never read.
const assert = require('node:assert'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'suggest-test-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const data = path.join(tmp, 'data');
process.env.GABRIEL_DATA = data;
delete process.env.BRAIN_DATA;

const docs = path.join(data, 'docs', 'notes');
fs.mkdirSync(docs, { recursive: true });
fs.writeFileSync(path.join(docs, 'bikes.md'), '# Bikes\n\n## Fix a flat tire\n\nRemove the wheel and patch the tube.\n\n## Brakes\n\nCheck the brake pads every 500 km.\n');
fs.writeFileSync(path.join(docs, 'cooking.md'), '# Cooking\n\n## Boil pasta\n\nBring a big pot of salted water to a boil.\n');
fs.writeFileSync(path.join(data, 'projects.json'), JSON.stringify({ version: 1, projects: [{ name: 'notes', root: 'docs/notes' }] }));

const { covered, newSuggestions, sectionCases } = require('../eval/suggest-cases.js');

// 1: covered() follows the eval rule
const cand = { file: 'bikes.md', section: 'Fix a flat tire' };
assert.strictEqual(covered([{ doc: 'bikes\\.md$', sec: 'Fix a flat tire' }], cand), true, 'same doc and section');
assert.strictEqual(covered([{ doc: 'bikes\\.md$' }], cand), true, 'no sec: any section of the doc');
assert.strictEqual(covered([{ doc: 'BIKES\\.md$' }], cand), true, 'case-insensitive, like the eval');
assert.strictEqual(covered([{ doc: 'bikes\\.md$', sec: 'Fix' }], cand), true, 'sec is a regex, not an exact name');
assert.strictEqual(covered([{ doc: 'bikes\\.md$', sec: 'Brakes' }], cand), false, 'other section');
assert.strictEqual(covered([{ doc: 'cooking\\.md$' }], cand), false, 'other doc');
assert.strictEqual(covered([{ doc: '(', sec: 'x' }], cand), false, 'bad regex covers nothing and does not throw');
assert.strictEqual(covered([{ sec: 'Fix a flat tire' }], cand), false, 'no doc covers nothing');
assert.strictEqual(covered([{ doc: '', sec: 'Fix' }], cand), true, 'an empty doc regex matches any file, like the eval');
console.log('covered(): eval rule, bad regex skipped, no-doc case covers nothing');

// 2: newSuggestions skips covered sections and keeps old suggested cases
{
  const all = sectionCases('notes');
  assert.strictEqual(all.length, 3, 'three sections in the set');
  const reviewed = [
    { id: 'R1', q: 'fix a tire', doc: 'bikes\\.md$', sec: 'Fix a flat tire' },
    { id: 'R2', q: 'anything about cooking', doc: 'cooking' },           // broad: covers every cooking section
    { id: 'R3', q: 'brakes without a doc', sec: 'Brakes' },             // no doc: covers nothing
    { id: 'R4', q: 'broken regex', doc: '(', sec: 'Brakes' },           // bad regex: covers nothing
  ];
  const old = [{ id: 'S1', q: 'old question', doc: 'garden\\.md$', sec: 'Water', set: 'suggested' }];
  const r = newSuggestions('notes', reviewed, old);
  assert.deepStrictEqual(r.fresh.map((c) => c.sec), ['Brakes'], 'only Brakes is new');
  assert.strictEqual(r.fresh[0].id, 'S2', 'ids continue after the old suggested list');
  assert.deepStrictEqual(r.cases[0], old[0], 'old suggested case kept as it was');
  assert.strictEqual(r.cases.length, 2);
  console.log('newSuggestions: Brakes only, old case kept, id S2');

  // 3: running again with the new list adds nothing
  const again = newSuggestions('notes', reviewed, r.cases);
  assert.strictEqual(again.fresh.length, 0, 'second run: nothing new');
  assert.deepStrictEqual(again.cases, r.cases);
  console.log('newSuggestions: second run adds nothing');
}

console.log('ALL PASSED');
