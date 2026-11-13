// Tests for src/extract.js and the doc reading in mk.js. All fixtures are built at run time (no binary files in the repo).
// Runs in a temp folder. Prints one line per check and ALL PASSED, or the first failure.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-test-'));
const data = path.join(tmp, 'data'), home = path.join(tmp, 'home');
process.env.GABRIEL_DATA = data;
process.env.BRAIN_HOME = home;
fs.mkdirSync(data, { recursive: true });
fs.mkdirSync(home, { recursive: true });
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

const ex = require('../src/extract.js');
const mk = require('../src/mk.js');
const { extractText } = ex;

// ---- zip writer: entries are deflated, except the names in `stored` ----
function zip(files, stored = []) {
  const locals = [], centrals = [];
  let offset = 0;
  const entries = Object.entries(files);
  for (const [name, text] of entries) {
    const data = Buffer.from(text, 'utf8'), method = stored.includes(name) ? 0 : 8;
    const comp = method === 8 ? zlib.deflateRawSync(data) : data;
    const crc = zlib.crc32(data), nameB = Buffer.from(name, 'utf8');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameB.length, 26);
    locals.push(lh, nameB, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameB.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameB);
    offset += lh.length + nameB.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const DOCX = zip({ 'word/document.xml': `<?xml version="1.0"?><w:document ${W}><w:body>
  <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Fix a flat tire</w:t></w:r></w:p>
  <w:p><w:r><w:t>Remove the wheel, find the hole, patch the inner tube.</w:t></w:r></w:p>
  </w:body></w:document>` });
const PPTX = zip({
  'ppt/slides/slide2.xml': '<p:sld><a:p><a:r><a:t>Second slide</a:t></a:r></a:p><a:p><a:r><a:t>Second body</a:t></a:r></a:p></p:sld>',
  'ppt/slides/slide1.xml': '<p:sld><a:p><a:r><a:t>Tire repair</a:t></a:r></a:p><a:p><a:r><a:t>Check the tread &amp; pressure</a:t></a:r></a:p></p:sld>',
});
const ODT = zip({ mimetype: 'application/vnd.oasis.opendocument.text', 'content.xml': `<?xml version="1.0"?><office:document-content xmlns:office="o" xmlns:text="t"><office:body><office:text>
  <text:h text:outline-level="2">Patch the tube</text:h><text:p>Use a patch kit.</text:p></office:text></office:body></office:document-content>` }, ['mimetype']);
const ODP = zip({ 'content.xml': `<office:document-content xmlns:office="o" xmlns:draw="d" xmlns:text="t"><office:body><office:presentation>
  <draw:page draw:name="Pump"><draw:frame><draw:text-box><text:p>Pump to 4 bar.</text:p></draw:text-box></draw:frame></draw:page>
  </office:presentation></office:body></office:document-content>` });
const XLSX = zip({
  'xl/sharedStrings.xml': '<sst><si><t>Part</t></si><si><t>Qty</t></si><si><t>Inner tube</t></si></sst>',
  'xl/workbook.xml': '<workbook><sheets><sheet name="Parts" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>4</v></c></row><row r="3"/></sheetData></worksheet>',
});

// ---- a minimal PDF with one page and the text "Fix a flat tire" (uncompressed, correct xref offsets) ----
function makePdf() {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 18 Tf 20 100 Td (Fix a flat tire) Tj ET';
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); return file; };
const check = (name, fn) => { fn(); console.log(`ok - ${name}`); };

async function main() {
  const fx = path.join(tmp, 'fx');
  const f = (name, content) => write(path.join(fx, name), content);

  // 1. the default and opt-in lists
  check('SUPPORTED has the default types and no opt-in type', () => {
    for (const x of ['.md', '.docx', '.pdf', '.html', '.xlsx']) assert.ok(ex.SUPPORTED.includes(x), x);
    for (const x of ex.OPT_IN) assert.ok(!ex.SUPPORTED.includes(x), x);
    assert.deepStrictEqual(ex.OPT_IN, ['.json', '.yaml', '.yml', '.jsonl', '.ndjson']);
  });

  // 2. markdown is byte-identical
  const md = path.join(fx, 'same.md');
  f('same.md', '# Title\r\n\r\nCafé bike: fix the tire.\r\n');
  assert.strictEqual(await extractText(md), fs.readFileSync(md, 'utf8'));
  console.log('ok - .md text equals the file bytes');

  // 3. text formats
  const txt = await extractText(f('cooking.txt', 'Pump the tire to 4 bar.\n'));
  assert.ok(txt.startsWith('# cooking.txt\n') && txt.includes('Pump the tire to 4 bar.'), txt);
  console.log('ok - .txt has a name heading and its text');

  const rst = await extractText(f('tire.rst', 'Tire repair\n===========\n\nRemove the wheel.\n\nSubhead\n--------\n\nUse a patch kit.\n'));
  assert.ok(rst.includes('# Tire repair') && rst.includes('## Subhead') && rst.includes('Use a patch kit.'), rst);
  assert.ok(!rst.includes('==='), 'underline dropped');
  console.log('ok - .rst headings and text');

  const adoc = await extractText(f('bike.adoc', '= Bike guide\n\n== Flat tire\n\nFind the hole.\n'));
  assert.ok(adoc.includes('# Bike guide') && adoc.includes('## Flat tire') && adoc.includes('Find the hole.'), adoc);
  console.log('ok - .adoc headings and text');

  const org = await extractText(f('bike.org', '* Bike guide\n** Flat tire\nFind the hole.\n'));
  assert.ok(org.includes('# Bike guide') && org.includes('## Flat tire'), org);
  console.log('ok - .org headings');

  const html = await extractText(f('garden.html', '<html><head><style>p{color:red}</style><script>var x=1;</script></head>' +
    '<body><h1>Garden &amp; Yard</h1><p>Water the tomatoes &lt;daily&gt;.</p><ul><li>Pick weeds</li></ul></body></html>'));
  assert.ok(html.includes('# Garden & Yard'), html);
  assert.ok(html.includes('Water the tomatoes <daily>.'), html);
  assert.ok(html.includes('Pick weeds'));
  assert.ok(!html.includes('var x') && !html.includes('color:red'), 'script and style dropped');
  console.log('ok - .html headings, entities, script and style dropped');

  const csv = await extractText(f('parts.csv', 'part,qty\n"Inner tube",2\n"Patch, small",\n'));
  assert.ok(csv.startsWith('# parts.csv\n') && csv.includes('part · qty') && csv.includes('Inner tube · 2') && csv.includes('Patch, small'), csv);
  console.log('ok - .csv rows with quotes');

  // 4. office formats
  const docx = await extractText(f('bikes.docx', DOCX));
  assert.ok(docx.includes('# Fix a flat tire') && docx.includes('Remove the wheel, find the hole, patch the inner tube.'), docx);
  console.log('ok - .docx Heading1 and body');

  const pptx = await extractText(f('talk.pptx', PPTX));
  assert.ok(pptx.includes('## Slide 1: Tire repair') && pptx.includes('Check the tread & pressure'), pptx);
  assert.ok(pptx.indexOf('## Slide 1') < pptx.indexOf('## Slide 2'), 'slides in order');
  console.log('ok - .pptx slides in order');

  const odt = await extractText(f('guide.odt', ODT));
  assert.ok(odt.includes('## Patch the tube') && odt.includes('Use a patch kit.'), odt);
  console.log('ok - .odt heading level 2 and text');

  const odp = await extractText(f('talk.odp', ODP));
  assert.ok(odp.includes('## Pump') && odp.includes('Pump to 4 bar.'), odp);
  console.log('ok - .odp page name and text');

  const xlsx = await extractText(f('parts.xlsx', XLSX));
  assert.ok(xlsx.includes('## Parts') && xlsx.includes('Part · Qty') && xlsx.includes('Inner tube · 4'), xlsx);
  console.log('ok - .xlsx sheet heading and rows');

  // 5. pdf (needs the optional pdfjs-dist)
  const pdfFile = f('flat.pdf', makePdf());
  if (await ex.pdfHasSupport()) {
    const pdf = await extractText(pdfFile);
    assert.ok(pdf.includes('Fix a flat tire') && pdf.includes('## Page 1'), pdf);
    console.log('ok - .pdf text and "## Page 1"');
  } else console.log('pdf skipped (pdfjs-dist missing)');

  // 6. opt-in json and yaml
  const json = await extractText(f('bikes.json', JSON.stringify({ bike: { wheel: { size: 26 }, tires: ['slick', 'knobby'] }, owner: 'Ann' })));
  for (const line of ['# bikes.json', '## bike', 'bike.wheel.size: 26', 'bike.tires.0: slick', 'bike.tires.1: knobby', '## owner', 'owner: Ann']) {
    assert.ok(json.split('\n').includes(line), `missing line ${line} in\n${json}`);
  }
  console.log('ok - .json flattened to a.b.c: value lines');

  const jl = await extractText(f('faq.jsonl', '{"q":"fix a flat tire","a":{"steps":["remove wheel"]}}\nnot json\n\n{"q":"boil pasta"}\n'));
  assert.match(jl, /## Record 1\nq: fix a flat tire\na\.steps\.0: remove wheel/);
  assert.match(jl, /## Record 2\nq: boil pasta/);
  assert.ok(!/not json/.test(jl), 'a bad line is skipped');
  console.log('ok - .jsonl one record per line, bad lines skipped');

  const big = await extractText(f('many.json', JSON.stringify(Array.from({ length: 6000 }, (_, i) => i))));
  assert.ok(big.split('\n').length <= 5001, 'json cap: 5,000 lines plus the title');
  console.log('ok - .json capped at 5,000 lines');

  const yaml = await extractText(f('site.yaml', 'name: gabriel\nlist:\n  - tire\n  - tube\n'));
  assert.ok(yaml.includes('## name') && yaml.includes('gabriel') && yaml.includes('## list') && yaml.includes('  - tire'), yaml);
  console.log('ok - .yaml top-level keys become headings');

  // 7. skip list and size limit for opt-in files
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.base.json', 'app.min.json']) {
    assert.strictEqual(await extractText(f(name, '{"a":1}')), '', name);
  }
  assert.strictEqual(await extractText(f('huge.json', '{"a":"' + 'x'.repeat(1024 * 1024 + 10) + '"}')), '', 'over 1 MB');
  console.log('ok - skipped: package.json, package-lock.json, tsconfig*.json, *.min.json, and over 1 MB');

  // 8. broken and missing files give '' and never throw
  assert.strictEqual(await extractText(f('broken.docx', Buffer.from('not a zip at all, just bytes'))), '');
  assert.strictEqual(await extractText(path.join(fx, 'missing.docx')), '');
  assert.strictEqual(await extractText(f('bad.json', '{ not json')), '');
  console.log('ok - broken and missing files give empty text');

  // 9. mk.listDocs: the owner rule (".md" only, case-sensitive) and the default types
  const lf = path.join(fx, 'listing');
  f('listing/a.md', 'a'); f('listing/B.MD', 'b'); f('listing/c.txt', 'c'); f('listing/d.json', '{}');
  const names = (exts) => mk.listDocs(lf, 'all-md', [], exts).map((p) => path.basename(p));
  assert.deepStrictEqual(names(ex.extSet(['md'])), ['a.md'], 'md-only list');
  assert.deepStrictEqual(names(ex.extSet(null)), ['a.md', 'c.txt'], 'default list');
  assert.deepStrictEqual(names(ex.extSet(['md', 'json'])), ['a.md', 'd.json'], 'opted-in json');
  console.log('ok - listDocs: md-only list keeps ".MD" out; default ignores json');

  // 10. end to end: a default project ignores .json; one that lists it reads it
  const docs = path.join(data, 'docs');
  write(path.join(docs, 'jplain', 'a.md'), '# Plain\n\n## Bike\n\nFix a flat tire.\n');
  write(path.join(docs, 'jplain', 'data.json'), '{"bike":{"tire":"flat"}}');
  write(path.join(docs, 'jopt', 'a.md'), '# Plain\n\n## Bike\n\nFix a flat tire.\n');
  write(path.join(docs, 'jopt', 'data.json'), '{"bike":{"tire":"flat"}}');
  fs.writeFileSync(path.join(data, 'projects.json'), JSON.stringify({ version: 1, projects: [
    { name: 'jplain', label: 'Plain', root: 'docs/jplain', graph: null, layout: 'all-md' },
    { name: 'jopt', label: 'Opt', root: 'docs/jopt', graph: null, layout: 'all-md', extensions: ['md', 'json'] },
  ] }));
  const plain = await mk.build(home, { project: 'jplain', noEmbed: true });
  const opt = await mk.build(home, { project: 'jopt', noEmbed: true });
  assert.strictEqual(plain.files, 1, 'default project: md only');
  assert.strictEqual(opt.files, 2, 'json listed: md and json read');
  console.log('ok - default project ignores .json; extensions ["md","json"] reads it');

  // 11. end to end: mixed folder, bikes.docx must be the first doc for a bike question
  const mixed = path.join(docs, 'mixed');
  write(path.join(mixed, 'bikes.docx'), DOCX);
  write(path.join(mixed, 'cooking.txt'), 'Boil pasta in salted water for ten minutes.\n');
  write(path.join(mixed, 'garden.html'), '<h2>Watering</h2><p>Water the tomatoes at the base in the morning.</p>');
  write(path.join(mixed, 'empty.txt'), '');
  write(path.join(mixed, 'filler.md'), ['# Filler', '', ...Array.from({ length: 120 }, (_, i) => `Filler note ${i} about subject${i} and gadget${i}.\n`)].join('\n'));
  fs.writeFileSync(path.join(data, 'projects.json'), JSON.stringify({ version: 1, projects: [
    { name: 'mixed', label: 'Mixed', root: 'docs/mixed', graph: null, layout: 'all-md' },
    { name: 'jplain', label: 'Plain', root: 'docs/jplain', graph: null, layout: 'all-md' },
    { name: 'jopt', label: 'Opt', root: 'docs/jopt', graph: null, layout: 'all-md', extensions: ['md', 'json'] },
  ] }));
  const built = await mk.build(home, { project: 'mixed', noEmbed: true });
  assert.strictEqual(built.files, 4, '4 files with text');
  assert.strictEqual(built.skipped, 1, 'the empty .txt is skipped and counted');
  const r = mk.search(home, 'how do I fix a flat tire on my bike', { project: 'mixed', pv: null });
  assert.ok(r && r.docs.length, 'a result');
  assert.strictEqual(r.docs[0].n.file, 'bikes.docx', 'first doc is bikes.docx');
  console.log('ok - mixed folder: bikes.docx is the first doc (built.skipped = 1)');

  console.log('ALL PASSED');
}

main().catch((e) => { console.error(e); process.exit(1); });
