// Test for mk.js (the Alpha map) on a tiny fake docs folder and graph, in a temp folder. Prints ALL PASSED or the first failure.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-test-'));
const home = path.join(tmp, 'home'), root = path.join(tmp, 'docs'), root2 = path.join(tmp, 'docs2');
process.env.MK_DOCS = root;
process.env.BRAIN_HOME = home;   // the same rules folder as the mk-status child process, so both read one mk.db
// the projects come from projects.json in the data folder: write this test's own (the owner's config is never read here)
process.env.GABRIEL_DATA = path.join(tmp, 'data');
fs.mkdirSync(process.env.GABRIEL_DATA, { recursive: true });
fs.writeFileSync(path.join(process.env.GABRIEL_DATA, 'projects.json'), JSON.stringify({ version: 1, legacyProject: 'alpha', projects: [
  { name: 'alpha', label: 'Alpha', root, graph: 'graphify-out/graph.json', prior: 0.5, learn: true, aliases: ['alpha'], cwdHints: ['alpha'], sessionGate: true },
  { name: 'beta', label: 'Beta', root: root2, graph: 'graphify-out/graph.json', prior: 0, learn: false, aliases: ['beta'] },
  { name: 'ref', label: 'Ref docs', root: path.join(tmp, 'ref'), fallback: true },
] }));
const mk = require('../src/mk.js');

// Naming: the longer alias wins when a shorter one sits inside it ("gabriel" in "gabriel-dev").
{
  const ps = [{ name: 'g', aliases: ['gabriel'] }, { name: 'gd', aliases: ['gabriel-dev'] }];
  assert.deepStrictEqual(mk.namedProjects(ps, 'in gabriel-dev, how does x work'), ['gd']);
  assert.deepStrictEqual(mk.namedProjects(ps, 'in gabriel, how does x work'), ['g']);
  assert.deepStrictEqual(mk.namedProjects(ps, 'gabriel and gabriel-dev'), ['gd'], 'the short name inside the long one is not counted separately');
}

const write = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
write(path.join(root, 'technical-docs', 'for-dev', '01-intro.md'), [
  '# 01 — Intro', '', '## Orders', '',
  'The `OrderHandler` in `Services/Shop/OrderHandler.cs` saves a new order and raises `OrderCreated` for the billing service.', '',
  'See [billing](02-billing.md) for the invoice rules.', '',
].join('\n'));
write(path.join(root, 'technical-docs', 'for-dev', '02-billing.md'), [
  '# 02 — Billing', '', '## Invoices', '',
  'An invoice is created when `OrderCreated` arrives. The `InvoiceWriter` stores it and retries on failure.', '',
].join('\n'));
// filler docs: word rarity (idf) only means something when there are many chunks, like the real ~1,600
write(path.join(root, 'technical-docs', 'for-dev', '03-filler.md'), ['# 03 — Filler', '', ...Array.from({ length: 120 }, (_, i) => `Filler note ${i} about subject${i} and gadget${i}.\n`)].join('\n'));
// a graph with a normal chain (handler -> repository) and one huge hub that everything points at
const nodes = [
  { id: 'h', label: 'OrderHandler', source_file: 'Services/Shop/OrderHandler.cs', source_location: 'L7', community: 1, community_name: 'Shop' },
  { id: 'r', label: 'OrderRepository', source_file: 'Services/Shop/OrderRepository.cs', source_location: 'L5', community: 1, community_name: 'Shop' },
  { id: 'w', label: 'InvoiceWriter', source_file: 'Services/Billing/InvoiceWriter.cs', source_location: 'L9', community: 2, community_name: 'Billing' },
  { id: 'hub', label: 'ResultBase', source_file: 'Services/Shared/ResultBase.cs', source_location: 'L1', community: 3, community_name: 'Shared' },
];
const links = [{ source: 'h', target: 'r', relation: 'calls', confidence_score: 1 }, { source: 'h', target: 'hub', relation: 'references', confidence_score: 1 }];
for (let i = 0; i < 700; i++) { nodes.push({ id: 'x' + i, label: 'Thing' + i, source_file: 'Services/Shared/Thing' + i + '.cs', source_location: 'L1', community: 3, community_name: 'Shared' }); links.push({ source: 'x' + i, target: 'hub', relation: 'references', confidence_score: 1 }); }
write(path.join(root, 'graphify-out', 'graph.json'), JSON.stringify({ nodes, links, built_at_commit: 'abc12345def' }));

(async () => {
  try {
    // no map yet: nothing found, nothing thrown, and "stale" says a build is due
    assert.strictEqual(mk.search(home, 'how does the order handler save an order'), null, 'no map must give null');
    assert.strictEqual(mk.stale(home), true, 'no map yet must be stale');
    const r = await mk.build(home, { root, noEmbed: true });
    assert.strictEqual(r.files, 3); assert.strictEqual(r.code, 704);
    assert.strictEqual(mk.stale(home), false, 'fresh map is not stale');

    // a prompt about the handler reaches the doc that cites it, the handler itself, and (by spreading) its repository
    const res = mk.search(home, 'how does the order handler save an order', {});
    assert.ok(res, 'a clear prompt must find something');
    assert.ok(res.docs.some((d) => d.n.file.includes('01-intro')), 'the doc that cites OrderHandler.cs must fire');
    assert.ok(res.code.some((c) => c.n.label === 'OrderHandler'), 'the handler must be found');
    assert.ok(res.code.some((c) => c.n.label === 'OrderRepository'), 'the repository must light up through the calls link');
    assert.ok(!res.code.some((c) => c.n.label === 'ResultBase'), 'a hub must not be shown');
    assert.ok(res.code.length <= 6 && res.docs.length <= 4, 'caps hold');

    // the doc link reaches the billing doc, which cites the invoice writer
    const res2 = mk.search(home, 'when does the invoice get created after an order', {});
    assert.ok(res2 && res2.docs.some((d) => d.n.file.includes('02-billing')), 'the billing doc must fire');

    // unrelated text stays quiet
    assert.strictEqual(mk.search(home, 'recommend a good pasta recipe for tonight'), null, 'unrelated text must give null');

    // doc line numbers: the line of the section's heading in the file; formats with no lines (here .rst) keep the text with no number
    {
      const root5 = path.join(tmp, 'docs5'), home5 = path.join(tmp, 'home5');
      write(path.join(root5, 'technical-docs', 'a.md'), 'intro\n\n# One\ntext one\n\n## Two\ntext two rivers\n');   // "two" is a stop word, so the chunk needs a second real word ("rivers")
      write(path.join(root5, 'technical-docs', 'b.txt'), 'plain lake note\n');
      write(path.join(root5, 'technical-docs', 'c.rst'), 'Canals\n======\n\nCanal water moves slowly.\n');
      write(path.join(root5, 'technical-docs', '04-filler.md'), ['# 04 — Filler', '', ...Array.from({ length: 120 }, (_, i) => `Spare note ${i} about item${i}.\n`)].join('\n'));
      write(path.join(root5, 'graphify-out', 'graph.json'), JSON.stringify({ nodes: [{ id: 'w', label: 'Widget', source_file: 'src/Widget.cs', source_location: 'L1', community: 1, community_name: 'W' }], links: [], built_at_commit: 'eee555' }));
      await mk.build(home5, { root: root5, project: 'beta', noEmbed: true });
      const r5 = mk.search(home5, 'what does the text about rivers say', { project: 'beta' });
      assert.ok(r5 && r5.docs.some((d) => d.n.file.endsWith('a.md')), 'the a.md doc must fire');
      assert.match(mk.format(r5), /- doc a\.md:6 > One > Two: text two rivers/, 'the "## Two" heading is on line 6');
      const r6 = mk.search(home5, 'canal water moves slowly', { project: 'beta' });
      assert.ok(r6 && r6.docs.some((d) => d.n.file.endsWith('c.rst')), 'the .rst doc must fire');
      assert.match(mk.format(r6), /- doc c\.rst > Canals: /, 'an .rst doc has no line number');
      assert.doesNotMatch(mk.format(r6), /c\.rst:\d/, 'an .rst doc has no line number');
    }

    // code links: a backticked name links to the code node with that exact label (graphify writes functions as name()); short or plain lowercase words do not
    {
      const root3 = path.join(tmp, 'docs3'), home3 = path.join(tmp, 'home3');
      write(path.join(root3, 'technical-docs', '01-repair.md'), '# 01 — Repair\n\n## Patch\n\nCall `tireRepair()` to patch the hole.\n');
      write(path.join(root3, 'technical-docs', '02-adds.md'), '# 02 — Adds\n\n## Add\n\nRun `addDocs` after each edit.\n');
      write(path.join(root3, 'technical-docs', '03-short.md'), '# 03 — Short\n\n## Short\n\nRun `run()` and `ab` and `add`.\n');
      const node3 = (id, label) => ({ id, label, source_file: 'src/' + id + '.ts', source_location: 'L1', community: 1, community_name: 'Tire' });
      write(path.join(root3, 'graphify-out', 'graph.json'), JSON.stringify({ nodes: [node3('a', 'tireRepair()'), node3('b', 'addDocs()'), node3('c', 'run()')], links: [], built_at_commit: 'ccc111' }));
      const r3 = await mk.build(home3, { root: root3, project: 'beta', noEmbed: true });
      assert.strictEqual(r3.docLinked, 2, 'the two sections that name a code label link to it; the short names do not');
    }

    // two links away: a code type that shares the top hit's name stem (a leading verb dropped) is added once, marked "2 links away"; other types are not
    {
      const root4 = path.join(tmp, 'docs4'), home4 = path.join(tmp, 'home4');
      write(path.join(root4, 'technical-docs', '01-status.md'), '# 01 — Status\n\n## Change status\n\nThe `SetOrderTaskStatusHandler` changes the status of an order task.\n');
      write(path.join(root4, 'technical-docs', '02-filler.md'), ['# 02 — Filler', '', ...Array.from({ length: 60 }, (_, i) => `Spare note ${i} about item${i}.\n`)].join('\n'));
      const n4 = (id, label) => ({ id, label, source_file: 'src/' + label + '.cs', source_location: 'L3', community: 1, community_name: 'Tasks' });
      // Mediator is a shared hub (over 600 links, like a base event class): the spreading search does not pass through it, the two-link step does
      const fill = Array.from({ length: 650 }, (_, i) => n4('f' + i, 'Filler' + i));
      write(path.join(root4, 'graphify-out', 'graph.json'), JSON.stringify({ nodes: [n4('s', 'SetOrderTaskStatusHandler'), n4('m', 'Mediator'), n4('q', 'OrderTaskStatusQuery'), n4('u', 'UnrelatedWidget'), ...fill],
        links: [{ source: 's', target: 'm', relation: 'calls', confidence_score: 1 }, { source: 'm', target: 'q', relation: 'calls', confidence_score: 1 }, { source: 'm', target: 'u', relation: 'calls', confidence_score: 1 },
          ...fill.map((f) => ({ source: f.id, target: 'm', relation: 'references', confidence_score: 1 }))], built_at_commit: 'ddd444' }));
      await mk.build(home4, { root: root4, project: 'beta', noEmbed: true });
      const r4 = mk.search(home4, 'how does the set order task status handler change the status', { project: 'beta' });
      assert.ok(r4 && r4.code.some((c) => c.n.label === 'SetOrderTaskStatusHandler'), 'the handler is a code hit');
      const chain = r4.code.filter((c) => c.chain).map((c) => c.n.label);
      assert.deepStrictEqual(chain, ['OrderTaskStatusQuery'], 'only the type with the same stem is added, two links away: ' + chain);
      assert.match(mk.format(r4), /- code OrderTaskStatusQuery \(src\/OrderTaskStatusQuery\.cs:3\) 2 links away/);
      // the chain step can be set per call: max 0 turns it off; a stem of 5 parts matches nothing here; a bad stem falls back to the default 3
      const chainOf = (opts) => mk.search(home4, 'how does the set order task status handler change the status', { project: 'beta', ...opts }).code.filter((c) => c.chain).map((c) => c.n.label);
      assert.deepStrictEqual(chainOf({ chain: { max: 0 } }), [], 'max 0: no two-link lines');
      assert.deepStrictEqual(chainOf({ chain: { stem: 5 } }), [], 'stem 5: OrderTaskStatusQuery does not share 5 name parts');
      assert.deepStrictEqual(chainOf({ chain: { stem: 'x' } }), ['OrderTaskStatusQuery'], 'bad stem: the default 3 is used');
    }

    // the printed block names the commit and stays short
    const text = mk.format(res);
    assert.ok(text.includes('abc12345') && text.length <= 2300, 'format shows the commit and respects the size cap');

    // ---- a second project in the same file: kept apart, routed by what it knows, and a rebuild of one leaves the other alone ----
    write(path.join(root2, 'technical-docs', '01-shipping.md'), ['# 01 — Shipping', '', '## Parcels', '', 'The `ParcelRouter` in `Services/Post/ParcelRouter.cs` sorts every parcel by zone and hands it to the courier.', ''].join('\n'));
    write(path.join(root2, 'technical-docs', '02-filler.md'), ['# 02 — Filler', '', ...Array.from({ length: 120 }, (_, i) => `Spare note ${i} about thing${i} and widget${i}.\n`)].join('\n'));
    // Id (under 4 characters) and List (in GENERIC) are the only code names in Services/Post/Short.cs: the file is mapped but has no named code
    write(path.join(root2, 'graphify-out', 'graph.json'), JSON.stringify({ nodes: [{ id: 'p', label: 'ParcelRouter', source_file: 'Services/Post/ParcelRouter.cs', source_location: 'L3', community: 1, community_name: 'Post' },
      { id: 'si', label: 'Id', source_file: 'Services/Post/Short.cs', source_location: 'L1', community: 1, community_name: 'Post' }, { id: 'sl', label: 'List', source_file: 'Services/Post/Short.cs', source_location: 'L2', community: 1, community_name: 'Post' }], links: [], built_at_commit: 'fed98765cba' }));
    await mk.build(home, { root: root2, project: 'beta', noEmbed: true });
    const parcel = 'how does the parcel router sort a parcel by zone', order = 'how does the order handler save an order';
    const p2 = mk.search(home, parcel, { project: 'beta' });
    assert.ok(p2 && p2.project === 'beta' && p2.docs.some((d) => d.n.file.includes('01-shipping')) && p2.code.some((c) => c.n.label === 'ParcelRouter'), 'the second project finds its own doc and class');
    assert.strictEqual(mk.search(home, parcel, {}), null, 'the Alpha map does not know parcels');
    assert.strictEqual(mk.search(home, order, { project: 'beta' }), null, 'the second project does not know orders');
    const again = mk.search(home, order, {});
    assert.ok(again && again.project === 'alpha' && again.docs.some((d) => d.n.file.includes('01-intro')) && again.code.some((c) => c.n.label === 'OrderRepository'), 'building another project leaves Alpha as it was');
    // a mapped file whose only code names are short or GENERIC gets its own reason, not 'file not in the map'
    const pShort = mk.search(home, parcel, { project: 'beta' });
    assert.strictEqual(mk.remember(home, 's5', pShort, Date.now()), true);
    assert.deepStrictEqual(mk.touched(home, 's5', 'C:\\w\\Services\\Post\\Short.cs', { now: Date.now() }), { ignored: 'no named code in the file' }, 'a mapped file with no named code gives its own reason');
    assert.strictEqual(mk.searchAll(home, parcel, { strong: 0 }).project, 'beta', 'the router picks the project that knows the prompt');
    assert.strictEqual(mk.searchAll(home, order, { strong: 0 }).project, 'alpha', 'and the Alpha prompt stays with Alpha');
    assert.strictEqual(mk.searchAll(home, 'beta ' + order, { strong: 0 }).project, 'alpha', 'naming a project that does not know the prompt does not block the others');
    assert.strictEqual(mk.searchAll(home, 'in beta ' + parcel, { strong: 0 }).project, 'beta', 'a named project that knows the prompt wins');
    // opts.trace: search() and searchAll() say why a map was or was not shown
    { const t = {}; assert.strictEqual(mk.search(home, 'zzzz qqqq xxxx wwww', { project: 'alpha', trace: t }), null); assert.strictEqual(t.reason, 'no-seeds'); }
    { const t = {}; assert.ok(mk.search(home, order, { project: 'alpha', trace: t })); assert.strictEqual(t.reason, 'shown'); assert.ok(t.best > 0); }
    { const t = {}; mk.searchAll(home, order, { trace: t }); assert.strictEqual(t.sets.alpha.reason, 'shown'); assert.ok('beta' in t.sets); }
    // a pinned session (opts.pins, from "gabriel use <name>") searches only those sets; an unknown pin is ignored
    const pa = mk.searchAll(home, parcel, { pins: ['alpha'] });
    assert.ok(!pa || pa.project !== 'beta', 'pinned to alpha: beta is never chosen');
    assert.ok(!pa || !(pa.also || []).some((a) => a.project === 'beta'), 'pinned: no beta block');
    const pn = mk.searchAll(home, 'in beta, ' + parcel, { pins: ['alpha'] });
    assert.ok(!pn || pn.project !== 'beta', 'naming beta does not beat the pin');
    const pg = mk.searchAll(home, parcel, { pins: ['gone'] }), p0 = mk.searchAll(home, parcel, {});
    assert.strictEqual(pg && pg.project, p0 && p0.project, 'unknown pin = no pin');
    const pb = mk.searchAll(home, parcel, { pins: ['beta'] });
    assert.ok(pb && pb.project === 'beta', 'pinned to beta finds beta');
    // two pins (Task 2): one block per pinned set that matches, the top one full, the others short
    // alpha does not match the parcel prompt (line 145 needs that), so this prompt names both sets' topics
    const both = order + ' and ' + parcel;
    const pab = mk.searchAll(home, both, { pins: ['alpha', 'beta'], strong: 0 });   // strong: 0 skips the session gate (alpha has sessionGate)
    assert.ok(pab, 'two pins: a map');
    const pinShown = [pab.project, ...(pab.also || []).map((a) => a.project)];
    assert.ok(pinShown.includes('beta'), 'both pinned sets that match are shown');
    assert.strictEqual(new Set(pinShown).size, pinShown.length, 'no set twice');
    // two pins, the session gate hides weak alpha: beta still shows (the gate drops only the gated set)
    const gated = mk.searchAll(home, both, { pins: ['alpha', 'beta'] });
    assert.ok(gated && [gated.project, ...(gated.also || []).map((a) => a.project)].includes('beta'), 'gate on alpha must not hide beta');
    // Review Focus 5: only one pinned set matches: one block, no empty one
    const only = mk.searchAll(home, 'ParcelRouter zone courier', { pins: ['alpha', 'beta'] });
    assert.ok(only && only.project === 'beta', 'beta answers');
    assert.ok(!(only.also || []).some((a) => a.project === 'alpha'), 'alpha did not match: no alpha block');
    assert.ok((only.also || []).every((a) => a.docs.length || a.code.length), 'no empty block');
    // Review Focus 2: a gone set in the list is dropped; the others still work; all gone = no pin
    const pgb = mk.searchAll(home, parcel, { pins: ['gone', 'beta'] });
    assert.ok(pgb && pgb.project === 'beta', 'a gone set is dropped, the others still work');
    const pg1 = mk.searchAll(home, parcel, { pins: ['gone'] });
    assert.strictEqual(pg1 && pg1.project, p0 && p0.project, 'all pins gone = no pin');
    // C4: the extra pinned set prints as a short block with its own header
    const pabText = mk.format(pab);
    assert.ok(pabText.includes('Alpha map (') && pabText.includes('Beta map ('), pabText);
    await mk.build(home, { root: root2, project: 'beta', noEmbed: true });   // a rebuild replaces the project rows and leaves the others
    assert.ok(mk.search(home, order, {}) && mk.search(home, parcel, { project: 'beta' }), 'both projects still answer after a rebuild');
    assert.strictEqual(mk.stale(home, 'beta'), false, 'the rebuilt project is not stale');
    assert.ok(mk.status(home, 'beta').nDoc > 0 && mk.status(home, 'alpha').nDoc > 0, 'status reads each project');

    // ---- learning from use ----
    const Q = 'how does the order handler save an order', T0 = Date.now(), actOf = (r, label) => (r.code.find((c) => c.n.label === label) || { a: 0 }).a;
    const file = 'C:\\work\\Alpha\\src\\Services\\Billing\\InvoiceWriter.cs';
    const before = mk.search(home, Q, { now: T0 });
    assert.strictEqual(actOf(before, 'InvoiceWriter'), 0, 'before learning the invoice writer is not part of an order-handler answer');
    assert.ok(before.seedKeys.length > 0 && before.seedKeys.every(([k]) => /^[cd]\|/.test(k)), 'seeds are remembered by stable key');
    // a touch without a recent map, a foreign file and an unknown file are all ignored
    assert.ok(mk.touched(home, 's1', file, { now: T0 }).ignored, 'no map was shown for this session yet');
    assert.strictEqual(mk.remember(home, 's1', before, T0), true);
    // session gate: a weak, unnamed match shows no map in a new session, but does in a session that already had an Alpha map, or inside the repo folder
    assert.strictEqual(mk.searchAll(home, Q, { session: 'fresh' }), null, 'a weak match in a new session shows no map (alpha has sessionGate: true)');
    // sessionGate is off by default: beta (no sessionGate) shows a weak, unnamed match from outside its folder in a new session; alpha (sessionGate: true) hid it
    const weakParcel = 'how do parcels get routed by zone', outside = 'C:\\elsewhere';
    assert.strictEqual(mk.searchAll(home, weakParcel, { session: 'fresh2', cwd: outside }).project, 'beta', 'default (no sessionGate): a weak match from outside shows');
    assert.strictEqual(mk.searchAll(home, Q, { session: 'fresh2', cwd: outside }), null, 'sessionGate: true: the weak alpha match from outside is hidden');
    assert.strictEqual(mk.searchAll(home, Q, { session: 's1' }).project, 'alpha', 'the same match shows in a session that already had a map');
    assert.strictEqual(mk.searchAll(home, Q, { cwd: 'C:\\repos\\Alpha' }).project, 'alpha', 'and inside the repo folder');
    assert.ok(mk.touched(home, 's1', 'C:\\other\\notes.txt', { now: T0 }).ignored, 'a file outside src is ignored');
    assert.ok(mk.touched(home, 's1', 'C:\\w\\src\\Services\\Nope\\Missing.cs', { now: T0 }).ignored, 'a file that is not in the map is ignored');
    assert.ok(mk.touched(home, 's1', file, { now: T0 + 3 * 3600000 }).ignored, 'a map older than 45 minutes teaches nothing');
    // one confirmation is a whisper, repeated confirmations make the link visible
    const t1 = mk.touched(home, 's1', file, { now: T0 });
    assert.ok(t1.learned > 0 && t1.targets.includes('InvoiceWriter'), 'opening the file soon after a map teaches the network');
    assert.ok(mk.touched(home, 's1', file, { now: T0 }).ignored, 'the same file counts once per map');
    // '*' (after a Codex step) uses the newest map; that map is Beta here, so an Alpha file is not in its map
    assert.strictEqual(mk.remember(home, 's3', { ...before, project: 'beta' }, T0 + 1), true);
    assert.strictEqual(mk.touched(home, '*', file, { now: T0 + 1 }).ignored, 'file not in the map', 'learning stays inside the map\'s own project');
    assert.strictEqual(mk.remember(home, 's3', { ...before, project: 'ref' }, T0 + 1), false, 'ref docs do not learn');
    const one = mk.search(home, Q, { now: T0 });
    assert.strictEqual(actOf(one, 'InvoiceWriter'), 0, 'a single confirmation must not change the answer');
    for (let i = 0; i < 8; i++) { mk.remember(home, 's1', mk.search(home, Q, { now: T0, learn: false }), T0); mk.touched(home, 's1', file, { now: T0 }); }
    const after = mk.search(home, Q, { now: T0 });
    assert.ok(actOf(after, 'InvoiceWriter') > 0, 'a link confirmed many times shows the file');
    assert.ok(actOf(after, 'InvoiceWriter') <= 0.5 * actOf(after, 'OrderHandler'), 'learned light is capped: a learned file never outshines a real match');
    assert.ok(actOf(after, 'OrderHandler') > 0 && actOf(after, 'OrderHandler') >= actOf(after, 'InvoiceWriter'), 'the real best match stays on top after learning');
    assert.strictEqual(actOf(mk.search(home, Q, { now: T0, learn: false }), 'InvoiceWriter'), 0, 'learning can be switched off');
    assert.strictEqual(mk.search(home, 'recommend a good pasta recipe for tonight', { now: T0 }), null, 'learning never lets an unrelated prompt through');
    assert.strictEqual(actOf(mk.search(home, Q, { now: T0 + 400 * 86400000 }), 'InvoiceWriter'), 0, 'a learned link fades away with age');
    const shown = mk.learnShow(home, 5, T0);
    assert.ok(shown.total > 0 && /InvoiceWriter/.test(shown.lines.join('\n')), 'learn-show lists the strongest links');
    // a rebuild merges the old map in: links to neurons that still exist stay, links to removed ones go
    const g1 = JSON.parse(fs.readFileSync(path.join(root, 'graphify-out', 'graph.json'), 'utf8'));
    g1.nodes.push({ id: 'extra', label: 'ExtraThing', source_file: 'Services/Shop/ExtraThing.cs', source_location: 'L1', community: 1, community_name: 'Shop' });
    fs.writeFileSync(path.join(root, 'graphify-out', 'graph.json'), JSON.stringify(g1));
    const r2 = await mk.build(home, { root, noEmbed: true });
    assert.ok(r2.merged.kept > 0 && r2.merged.dropped === 0, 'a rebuild keeps the learned links');
    assert.ok(actOf(mk.search(home, Q, { now: T0 }), 'InvoiceWriter') > 0, 'the learned link still works after the rebuild');
    const g2 = { ...g1, nodes: g1.nodes.filter((n) => n.id !== 'w') };
    fs.writeFileSync(path.join(root, 'graphify-out', 'graph.json'), JSON.stringify(g2));
    const r3 = await mk.build(home, { root, noEmbed: true });
    assert.ok(r3.merged.dropped > 0 && r3.merged.kept === 0, 'links to a removed node are dropped');
    assert.strictEqual(mk.learnShow(home, 5, T0).total, 0, 'nothing is left to show');
    mk.remember(home, 's2', mk.search(home, Q, { now: T0 }), T0); mk.touched(home, 's2', 'C:\\w\\src\\Services\\Shop\\OrderRepository.cs', { now: T0 });
    // the learned count and the reset work per doc set; a reset of one set leaves the others alone
    assert.ok(mk.status(home, 'alpha').learned > 0, 'alpha counts its own learned links');
    assert.strictEqual(mk.status(home, 'beta').learned, 0, 'beta has none: the count is per doc set');
    assert.strictEqual(mk.learnReset(home, 'beta'), 0, 'a reset of beta deletes nothing of alpha');
    assert.ok(mk.status(home, 'alpha').learned > 0);
    const badSet = require('child_process').spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'brain.js'), 'learn-reset', 'nope'], { env: { ...process.env, BRAIN_HOME: home }, encoding: 'utf8' });
    assert.strictEqual(badSet.status, 1, 'an unknown doc set exits with 1');
    assert.ok(/unknown doc set: nope/.test(badSet.stdout + badSet.stderr), 'an unknown doc set is named');
    assert.ok(mk.status(home, 'alpha').learned > 0, 'an unknown doc set deletes nothing');
    assert.ok(mk.learnReset(home, 'alpha') > 0, 'a reset of alpha deletes its links');
    assert.strictEqual(mk.status(home, 'alpha').learned, 0);
    assert.ok(mk.learnReset(home) >= 0 && mk.learnShow(home, 5, T0).total === 0, 'learn-reset forgets everything');
    assert.ok(mk.status(home).graphCommit === 'abc12345def', 'status reads the graph commit from the first bytes of graph.json');

    // a project whose graph file is missing: the build throws before any write, and the old map rows stay
    const gfile = path.join(root, 'graphify-out', 'graph.json'), before2 = mk.status(home);
    fs.renameSync(gfile, gfile + '.away');
    try {
      await assert.rejects(mk.build(home, { root, noEmbed: true }), /graph not found/, 'a missing graph must stop the build');
    } finally { fs.renameSync(gfile + '.away', gfile); }
    assert.deepStrictEqual(mk.status(home), before2, 'the old map is unchanged after a failed build');
    assert.ok(mk.search(home, 'how does the order handler save an order', {}).code.some((c) => c.n.label === 'OrderHandler'), 'the old map still answers');

    // mk-status all: the Alpha line shows its graph path, and GRAPH MISSING when the file is gone
    const statusRun = () => require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'src', 'brain.js'), 'mk-status', 'all'], { env: { ...process.env, BRAIN_HOME: home }, encoding: 'utf8' }).split('\n');
    // the whole Alpha block: its header line and the lines below it, up to the empty line
    const blockOf = (label) => { const ls = statusRun(), i = ls.findIndex((l) => l.startsWith(label)); if (i < 0) return ''; const out = []; for (let j = i; j < ls.length && ls[j] !== ''; j++) out.push(ls[j]); return out.join('\n'); };
    const statusAlpha = () => blockOf('Alpha');
    // the fix line printed right after a set's status line (null when there is none)
    const fixOf = (label) => blockOf(label).split('\n').find((l) => l.startsWith('  fix: ')) || null;
    assert.ok(statusAlpha().includes(path.join(root, 'graphify-out', 'graph.json')) && !/GRAPH MISSING/.test(statusAlpha()), 'mk-status shows the graph path');
    fs.renameSync(gfile, gfile + '.away');
    try {
      assert.ok(/GRAPH MISSING/.test(statusAlpha()), 'mk-status flags a missing graph');
      assert.match(fixOf('Alpha') || '', /^ {2}fix: \/gabriel:add-docs alpha --code .* --relink$/, 'a missing graph gets the add-docs fix');
    } finally { fs.renameSync(gfile + '.away', gfile); }
    // Ref docs has no map and no graph: its first problem is the missing map
    assert.strictEqual(fixOf('Ref docs'), '  fix: node src/brain.js build-mk ref', 'a set with no map gets the build-mk fix');
    // a healthy set (fresh map, graph, eval cases) prints no fix line; without its eval cases it gets the suggest fix
    const evalFile = path.join(process.env.GABRIEL_DATA, 'private', 'alpha', 'eval-cases.json');
    write(evalFile, '[]');
    assert.strictEqual(fixOf('Alpha'), null, 'a healthy set prints no fix line');
    fs.rmSync(evalFile);
    assert.strictEqual(fixOf('Alpha'), '  fix: node eval/suggest-cases.js --project alpha', 'a set with no eval cases gets the suggest-cases fix');
    write(evalFile, '[]');

    // build-mk: an unknown set name stops with an error (it does not build the default set); a build never clears a lock that names another set
    const buildCli = (args) => require('child_process').spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'brain.js'), 'build-mk', ...args], { env: { ...process.env, BRAIN_HOME: home, GABRIEL_NO_DOWNLOAD: '1' }, encoding: 'utf8', timeout: 600000 });
    const unknown = buildCli(['nosuchset']);
    assert.strictEqual(unknown.status, 1, 'an unknown set name must exit 1');
    assert.ok((unknown.stdout + unknown.stderr).includes('unknown doc set: nosuchset'), 'the message names the unknown set');
    const lockFile = path.join(process.env.GABRIEL_DATA, 'mk.lock');
    fs.writeFileSync(lockFile, 'other');
    buildCli([]);
    assert.strictEqual(fs.existsSync(lockFile) && fs.readFileSync(lockFile, 'utf8'), 'other', 'a default-set build must not remove a lock that names another set');
    fs.rmSync(lockFile, { force: true });

    // a changed doc makes the map stale
    await new Promise((ok) => setTimeout(ok, 30));
    fs.appendFileSync(path.join(root, 'technical-docs', 'for-dev', '02-billing.md'), '\nMore text about refunds.\n');
    assert.strictEqual(mk.stale(home), true, 'a changed doc must make the map stale');
    assert.strictEqual(fixOf('Alpha'), '  fix: /gabriel:update', 'a stale set gets the update fix');

    // exact lines (src/repo.js wired into search and format): a set with a repo folder shows the line on disk; no repo, or a folder that is gone, shows the old text
    {
      const projFile = path.join(process.env.GABRIEL_DATA, 'projects.json'), projJson = fs.readFileSync(projFile, 'utf8');
      const repo = path.join(tmp, 'alpha-repo');
      const setRepo = (dir) => { const j = JSON.parse(projJson); j.projects.find((p) => p.name === 'alpha').repo = dir; fs.writeFileSync(projFile, JSON.stringify(j)); };
      const showQ = () => mk.format(mk.search(home, 'how does the order handler save an order', { project: 'alpha' }));
      try {
        // no repo: the old text, exactly (the graph line, the neighbour with its file only)
        setRepo(null);
        const plain = showQ();
        assert.ok(plain.includes('- code OrderHandler (Services/Shop/OrderHandler.cs:7)\n'), 'no repo: the old code line ' + plain);
        assert.ok(plain.includes('    ↔ OrderRepository (Services/Shop/OrderRepository.cs) calls/implements\n'), 'no repo: the old neighbour line ' + plain);
        assert.ok(!/✓|not found in repo/.test(plain), 'no repo: no exact marks');

        // a repo folder with the real definitions on other lines than the graph says (graph L7, real line 3)
        write(path.join(repo, 'Services', 'Shop', 'OrderHandler.cs'), ['using System;', '', 'public class OrderHandler', '{', '    public void Save() { }', '}', ''].join('\n'));
        write(path.join(repo, 'Services', 'Shop', 'OrderRepository.cs'), ['// repo', 'public class OrderRepository', '{', '}', ''].join('\n'));
        setRepo(repo);
        const ok = showQ();
        assert.ok(ok.includes('- code OrderHandler (Services/Shop/OrderHandler.cs:3 ✓)\n'), 'repo: the code line shows the real line ' + ok);
        assert.ok(ok.includes('    ↔ OrderRepository (Services/Shop/OrderRepository.cs:2 ✓) calls/implements\n'), 'repo: the neighbour line shows its real line ' + ok);
        // eval-map: a case with fn is exact when the printed line is the definition on disk; --no-repo keeps the stale graph line (L7, real line 3)
        {
          const casesFile = path.join(tmp, 'eval-exact.json');
          fs.writeFileSync(casesFile, JSON.stringify([{ id: 'T-1', q: 'how does the order handler save an order', set: 'dev', tier: 'easy', project: 'alpha', code: 'OrderHandler', fn: 'OrderHandler', file: 'Services/Shop/OrderHandler\\.cs$' }]));
          const runEval = (...extra) => require('child_process').spawnSync(process.execPath, [path.join(__dirname, '..', 'eval', 'eval-map.js'), '--project', 'alpha', '--cases', casesFile, '--no-meaning', ...extra], { encoding: 'utf8' }).stdout;
          const withRepo = runEval();
          assert.ok(withRepo.includes('exact: 1/1 (100%)'), 'eval: the fn case is exact with the repo ' + withRepo);
          const noRepo = runEval('--no-repo');
          assert.ok(noRepo.includes('exact: 0/1 (0%)'), 'eval --no-repo: the stale graph line is not exact ' + noRepo);
        }
        // the neighbour's file is gone from the repo: marked as not found, the code line stays exact
        fs.rmSync(path.join(repo, 'Services', 'Shop', 'OrderRepository.cs'));
        const nbGone = showQ();
        assert.ok(nbGone.includes('    ↔ OrderRepository (Services/Shop/OrderRepository.cs, not found in repo) calls/implements\n'), 'repo: a neighbour with a missing file is marked, not dropped ' + nbGone);
        assert.ok(nbGone.includes('- code OrderHandler (Services/Shop/OrderHandler.cs:3 ✓)\n'), 'repo: the other code line stays exact ' + nbGone);

        // the code line's file is gone from the repo: marked as not found
        fs.rmSync(path.join(repo, 'Services', 'Shop', 'OrderHandler.cs'));
        const gone = showQ();
        assert.ok(gone.includes('- code OrderHandler (Services/Shop/OrderHandler.cs, not found in repo)\n'), 'repo: a missing file is marked ' + gone);

        // a moved file: the class now lives in Moved/OrderHandler.cs (git repo, committed): the line shows the new path, the real line and "moved"
        const moved = path.join(tmp, 'moved-repo');
        write(path.join(moved, 'Moved', 'OrderHandler.cs'), ['using System;', '', 'public class OrderHandler', '{', '}', ''].join('\n'));
        const gitM = (args) => require('child_process').execFileSync('git', ['-C', moved, '-c', 'user.name=t', '-c', 'user.email=t', '-c', 'commit.gpgsign=false', ...args], { stdio: 'pipe' });
        gitM(['init', '-q']);
        gitM(['add', '.']);
        gitM(['commit', '-q', '-m', 'init']);
        setRepo(moved);
        const mvd = showQ();
        assert.ok(mvd.includes('- code OrderHandler (Moved/OrderHandler.cs:3 ✓ moved)\n'), 'moved: the code line shows the new file, line and moved ' + mvd);

        // the repo folder itself is gone: the old text, no marks
        setRepo(path.join(tmp, 'no-such-folder'));
        const nofolder = showQ();
        assert.ok(nofolder.includes('- code OrderHandler (Services/Shop/OrderHandler.cs:7)\n') && !/✓|not found in repo/.test(nofolder), 'a missing repo folder: the old text ' + nofolder);
      } finally { fs.writeFileSync(projFile, projJson); }
    }

    // a broken map file never throws
    fs.writeFileSync(mk.dbFile(home), 'not a database');
    assert.strictEqual(mk.search(home, 'how does the order handler save an order'), null, 'a broken file must give null');
    console.log('ALL PASSED');
  } catch (e) { console.log('FAILED: ' + e.message); process.exitCode = 1; }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* the temp folder is cleaned by the OS later */ }
})();
