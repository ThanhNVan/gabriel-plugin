// Reads the text of one doc file and returns Markdown-like text (headings as "#" lines), so mk.chunkDoc can split it unchanged.
// extractText never throws: a file it cannot read gives ''. Markdown files are returned byte for byte.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SUPPORTED = ['.md', '.markdown', '.mdx', '.txt', '.text', '.rst', '.adoc', '.asciidoc', '.org', '.html', '.htm',
  '.docx', '.pptx', '.odt', '.odp', '.xlsx', '.csv', '.tsv', '.pdf'];
const OPT_IN = ['.json', '.yaml', '.yml', '.jsonl', '.ndjson'];   // read only when a project lists them in "extensions"
const MAX_OPT_BYTES = 1024 * 1024, MAX_JSONL_BYTES = 20 * 1024 * 1024, MAX_ROWS = 5000, MAX_JSON_LINES = 5000;

// Lowercase extensions with the dot. A null list (the default) means every default type; opt-in types need a listed name.
const extSet = (list) => new Set(list == null ? SUPPORTED : list.map((e) => '.' + String(e).replace(/^\./, '').toLowerCase()));
// ".md" matches case-sensitively, as it always did; other types match in any case (Manual.PDF is read).
function isDocName(name, exts) {
  const lower = name.toLowerCase();
  for (const x of exts) if (name.endsWith(x) || (x !== '.md' && lower.endsWith(x))) return true;
  return false;
}
// Files that are never doc text, even when their type is opted in.
const skipName = (name) => { const n = name.toLowerCase(); return n === 'package.json' || n === 'package-lock.json' || /^tsconfig.*\.json$/.test(n) || /\.min\.json$/.test(n); };

// ---- zip (stdlib only): name -> Buffer for the entries `want` accepts ----
function readZip(buf, want = () => true) {
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const out = new Map();
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad zip directory');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    if (!want(name)) continue;
    if (buf.readUInt32LE(off) !== 0x04034b50) throw new Error('bad zip entry');
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const data = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, Buffer.from(data));
    else if (method === 8) out.set(name, zlib.inflateRawSync(data));
    else throw new Error('unsupported zip method ' + method);
  }
  return out;
}

// ---- XML helpers (regex, no parser: the files are simple and the output is text only) ----
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const unescapeXml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g) => {
  if (g[0] === '#') { const n = g[1] === 'x' || g[1] === 'X' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m; }
  return Object.hasOwn(ENT, g) ? ENT[g] : m;
});
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();
// the inner XML of every <tag> element (not self-closing)
const elems = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*?)?(?<!/)>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);
// the text of every <tag> run inside xml, joined
const textOf = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => unescapeXml(m[1])).join('');

// ---- formats ----
function docxText(buf) {
  const xml = (readZip(buf, (n) => n === 'word/document.xml').get('word/document.xml') || Buffer.alloc(0)).toString('utf8');
  const out = [];
  for (const inner of elems(xml, 'w:p')) {
    const text = oneLine(textOf(inner, 'w:t'));
    if (!text) continue;
    const style = (inner.match(/<w:pStyle\s+w:val="([^"]+)"/) || [])[1] || '';
    const m = /^Heading(\d)$/i.exec(style), h = m ? Math.min(+m[1], 4) : style === 'Title' ? 1 : 0;
    out.push(h ? '#'.repeat(h) + ' ' + text : text);
  }
  return out.join('\n\n');
}

function pptxText(buf) {
  const files = readZip(buf, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const slides = [...files].map(([n, b]) => ({ n: +n.match(/slide(\d+)\.xml$/)[1], xml: b.toString('utf8') })).sort((a, b) => a.n - b.n);
  return slides.map(({ n, xml }) => {
    const [title = '', ...body] = elems(xml, 'a:p').map((p) => oneLine(textOf(p, 'a:t'))).filter(Boolean);
    return [`## Slide ${n}${title ? ': ' + title : ''}`, ...body].join('\n');
  }).join('\n\n');
}

// ODF body: text:h (outline level) and text:p paragraphs, in document order
function odfBlocks(xml) {
  const out = [];
  for (const m of xml.matchAll(/<text:(h|p)\b([^>]*?)(?<!\/)>([\s\S]*?)<\/text:\1>/g)) {
    const text = oneLine(unescapeXml(m[3].replace(/<text:(s|tab|line-break)\b[^>]*\/>/g, ' ').replace(/<[^>]+>/g, '')));
    if (!text) continue;
    const lvl = m[1] === 'h' ? Math.min(+((m[2].match(/outline-level="(\d+)"/) || [])[1] || 1), 4) : 0;
    out.push(lvl ? '#'.repeat(lvl) + ' ' + text : text);
  }
  return out.join('\n\n');
}
const odfContent = (buf) => (readZip(buf, (n) => n === 'content.xml').get('content.xml') || Buffer.alloc(0)).toString('utf8');

function odpText(buf) {
  const xml = odfContent(buf);
  return [...xml.matchAll(/<draw:page\b([^>]*?)(?<!\/)>([\s\S]*?)<\/draw:page>/g)].map((m, i) => {
    const name = unescapeXml((m[1].match(/draw:name="([^"]*)"/) || [])[1] || '');
    const body = odfBlocks(m[2]);
    return [`## ${name || 'Slide ' + (i + 1)}`, body].filter(Boolean).join('\n');
  }).join('\n\n');
}

function xlsxText(buf) {
  const z = readZip(buf, (n) => n === 'xl/sharedStrings.xml' || n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n.startsWith('xl/worksheets/'));
  const get = (n) => (z.get(n) || Buffer.alloc(0)).toString('utf8');
  const sst = elems(get('xl/sharedStrings.xml'), 'si').map((si) => textOf(si, 't'));
  const rels = new Map();
  for (const [, attrs] of get('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)>/g)) {
    const id = (attrs.match(/\bId="([^"]*)"/) || [])[1], target = (attrs.match(/\bTarget="([^"]*)"/) || [])[1];
    if (id && target) rels.set(id, target.replace(/^\//, '').replace(/^(?!xl\/)/, 'xl/'));
  }
  const sheets = [...get('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/?>/g)].map((m, i) => ({
    name: unescapeXml((m[1].match(/\bname="([^"]*)"/) || [])[1] || `Sheet ${i + 1}`),
    file: rels.get((m[1].match(/\br:id="([^"]*)"/) || [])[1]) || `xl/worksheets/sheet${i + 1}.xml`,
  }));
  return sheets.map((sh) => {
    const rows = [];
    for (const row of elems(get(sh.file), 'row')) {
      const vals = [];
      for (const [, attrs, inner] of row.matchAll(/<c\b([^>]*?)(?<!\/)>([\s\S]*?)<\/c>/g)) {
        const t = (attrs.match(/\bt="([^"]*)"/) || [])[1];
        const v = t === 's' ? (sst[Number((inner.match(/<v>([^<]*)<\/v>/) || [])[1])] ?? '')
          : t === 'inlineStr' ? textOf(inner, 't')
            : unescapeXml((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '');
        const cell = oneLine(v);
        if (cell) vals.push(cell);
      }
      if (vals.length) rows.push(vals.join(' · '));
      if (rows.length >= MAX_ROWS) break;
    }
    return ['## ' + sh.name, ...rows].join('\n');
  }).join('\n\n');
}

// simple CSV/TSV reader: quotes, doubled quotes and line breaks inside quotes
function delimited(text, delim, name) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length && rows.length < MAX_ROWS; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const lines = rows.map((r) => r.map(oneLine).filter(Boolean).join(' · ')).filter(Boolean);
  return lines.length ? [`# ${name}`, ...lines].join('\n') : '';
}

function rstText(text) {
  const L = text.split(/\r?\n/), UL = { '=': '#', '-': '##', '~': '###', '^': '####' }, out = [];
  for (let i = 0; i < L.length; i++) {
    const title = L[i].trim(), under = (L[i + 1] || '').trim();
    if (title && i + 1 < L.length && /^([=\-~^])\1+$/.test(under) && under.length >= title.length) { out.push(UL[under[0]] + ' ' + title); i++; continue; }
    out.push(L[i]);
  }
  return out.join('\n');
}

const adocText = (text) => text.split(/\r?\n/).map((l) => { const m = /^(=+)\s+(.*)$/.exec(l); return m ? '#'.repeat(Math.min(m[1].length, 4)) + ' ' + m[2] : l; }).join('\n');
const orgText = (text) => text.split(/\r?\n/).map((l) => { const m = /^(\*+)\s+(.*)$/.exec(l); return m ? '#'.repeat(Math.min(m[1].length, 4)) + ' ' + m[2] : l; }).join('\n');

function htmlText(text) {
  let s = text.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (m, n, inner) => {
    const t = oneLine(inner.replace(/<[^>]+>/g, ' '));   // tags out here; entities are decoded once, below
    return t ? `\n\n${'#'.repeat(Math.min(+n, 4))} ${t}\n\n` : '\n\n';
  });
  s = s.replace(/<br\b[^>]*>|<\/?li\b[^>]*>|<\/?tr\b[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>|<t[dh]\b[^>]*>/gi, ' · ')
    .replace(/<\/?(p|div|section|article|header|footer|table|ul|ol|blockquote|pre)\b[^>]*>/gi, '\n\n');
  s = unescapeXml(s.replace(/<[^>]+>/g, ''));
  return s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n');
}

function jsonText(text, name) {
  const data = JSON.parse(text);
  const out = [];
  const put = (s) => { if (out.length < MAX_JSON_LINES) out.push(s); };
  const walk = (v, p) => {
    if (v !== null && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
    else put(`${p}: ${oneLine(String(v))}`);
  };
  if (data !== null && typeof data === 'object') for (const k of Object.keys(data)) { put('## ' + k); walk(data[k], k); }
  else put(`value: ${oneLine(String(data))}`);
  return out.length ? [`# ${name}`, ...out].join('\n') : '';
}

// JSON Lines: one record per line -> "## Record N" + flattened "a.b: value" lines; bad lines are skipped
function jsonlText(text, name) {
  const out = [];
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    if (n >= MAX_ROWS || out.length >= MAX_JSON_LINES) break;
    if (!line.trim()) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    n++; out.push(`## Record ${n}`);
    const walk = (v, p) => {
      if (out.length >= MAX_JSON_LINES) return;
      if (v !== null && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
      else out.push(`${p || 'value'}: ${oneLine(String(v))}`);
    };
    walk(rec, '');
  }
  return n ? [`# ${name}`, ...out].join('\n') : '';
}

// no YAML library: top-level "key:" lines become headings, everything else stays as text
function yamlText(text, name) {
  if (!text.trim()) return '';
  const lines = text.split(/\r?\n/).map((l) => {
    const m = /^([A-Za-z_][\w.-]*)\s*:(.*)$/.exec(l);
    return m ? `## ${m[1]}${m[2].trim() ? '\n' + m[2].trim() : ''}` : l;
  });
  return [`# ${name}`, ...lines].join('\n');
}

// ---- PDF: optional package pdfjs-dist (npm install puts it in the optionalDependencies) ----
let pdfLib;   // undefined = not tried yet; false = missing
async function loadPdf() {
  if (pdfLib === undefined) { try { pdfLib = await import('pdfjs-dist/legacy/build/pdf.mjs'); } catch { pdfLib = false; } }
  return pdfLib || null;
}
async function pdfHasSupport() { return !!(await loadPdf()); }

async function pdfText(file) {
  const lib = await loadPdf();
  if (!lib) return '';
  const doc = await lib.getDocument({ data: new Uint8Array(fs.readFileSync(file)), isEvalSupported: false, verbosity: 0 }).promise;
  const pages = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      let s = '', y = null;
      for (const it of tc.items) {
        if (typeof it.str !== 'string') continue;
        const iy = it.transform[5];
        if (y !== null && !s.endsWith('\n')) s += Math.abs(iy - y) > 1 ? '\n' : (/\s$/.test(s) || /^\s/.test(it.str) ? '' : ' ');
        s += it.str;
        if (it.hasEOL) s += '\n';
        y = iy;
      }
      const body = s.split('\n').map(oneLine).filter(Boolean).join('\n');
      if (body) pages.push(`## Page ${p}\n${body}`);
    }
  } finally { try { await doc.destroy(); } catch { /* closed */ } }
  return pages.join('\n\n');
}

// ---- entry point ----
async function extractText(file) {
  try {
    const ext = path.extname(file).toLowerCase(), name = path.basename(file);
    if (ext === '.md' || ext === '.markdown' || ext === '.mdx') return fs.readFileSync(file, 'utf8');   // unchanged
    if (ext === '.pdf') return await pdfText(file);
    if (OPT_IN.includes(ext)) {
      const cap = ext === '.jsonl' || ext === '.ndjson' ? MAX_JSONL_BYTES : MAX_OPT_BYTES;
      if (skipName(name) || fs.statSync(file).size > cap) return '';
    }
    const buf = fs.readFileSync(file), text = buf.toString('utf8');
    switch (ext) {
      case '.txt': case '.text': return text.trim() ? `# ${name}\n${text}` : '';
      case '.rst': return rstText(text);
      case '.adoc': case '.asciidoc': return adocText(text);
      case '.org': return orgText(text);
      case '.html': case '.htm': return htmlText(text);
      case '.docx': return docxText(buf);
      case '.pptx': return pptxText(buf);
      case '.odt': return odfBlocks(odfContent(buf));
      case '.odp': return odpText(buf);
      case '.xlsx': return xlsxText(buf);
      case '.csv': return delimited(text, ',', name);
      case '.tsv': return delimited(text, '\t', name);
      case '.json': return jsonText(text, name);
      case '.jsonl': case '.ndjson': return jsonlText(text, name);
      case '.yaml': case '.yml': return yamlText(text, name);
      default: return '';
    }
  } catch { return ''; }
}

module.exports = { SUPPORTED, OPT_IN, extSet, isDocName, skipName, extractText, pdfHasSupport };
