'use strict';
// Training pairs made from code names (the tuner, see docs/TUNING.md). A row is one class name and its file.
// Each row gives up to `per` template questions (anchor) built from the name's words; the positive is codeText(label, file),
// the same text the map embeds for the class name (src/mk.js). Only code names and folders are used, never eval text.
//   codePairs(rows: {label, file}[], opts?: {seed?, per?, skip?: Set<string>}) -> {anchor, positive}[]
// The templates are the spike's make-code-pairs.js, copied in as data. Same rows + same seed = same output.
const { codeText } = require('../mk.js');

// a small seeded random number generator (mulberry32). Local copy: export-pairs.js requires this file, so no require back.
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// split a name into lower-case words: DeleteProjectCommandHandler -> 'delete project command handler'
const words = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  .replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase();

const VERBS = new Set(['create', 'add', 'register', 'delete', 'remove', 'purge', 'update', 'change', 'set', 'get', 'send',
  'sync', 'import', 'export', 'upload', 'combine', 'reset', 'run', 'calculate', 'validate']);
const ROLES = new Set(['command', 'query', 'request', 'handler', 'controller', 'repository', 'service', 'dto', 'event',
  'requested', 'changed', 'created', 'deleted', 'updated', 'validator', 'model', 'read', 'adapter', 'client', 'policy']);
const PAST = new Set(['changed', 'created', 'deleted', 'updated', 'requested']);

// {subject} = the name's words left after the verb and role words; {pastword} = the role (created, deleted...); {area} = folder under Services/
const TEMPLATES = {
  create: ['how is a {subject} created', 'what happens when a new {subject} is added', 'where do we add a {subject} in {area}'],
  delete: ['what happens when a {subject} is deleted', 'how is a {subject} removed'],
  update: ['how is the {subject} updated', 'what happens when someone changes the {subject}'],
  get: ['how does the {subject} load', 'where is the {subject} list read from'],
  send: ['how is the {subject} sent', 'who sends the {subject}'],
  event: ['what happens after {subject} {pastword}', 'which handler runs when {subject} {pastword}', 'what goes out after {subject} {pastword}'],
  controller: ['which api endpoint handles {subject}', 'where is the {subject} api'],
  repository: ['where is the {subject} saved in the database', 'how is {subject} read from the database'],
  service: ['which service does {subject}', 'where is {subject} done'],
  other: ['where is {subject} in {area}', 'what is {subject}', 'how does {subject} work'],
};

// the folder right under Services/ (Services/Vessels/... -> vessels), else ''
function areaOf(file) {
  const parts = file.split('/');
  const i = parts.indexOf('Services');
  return i >= 0 && i + 2 < parts.length ? parts[i + 1].toLowerCase() : '';
}

// the questions for one row: verb and role pick the template group, the rest of the words is the subject
function anchorsOf(label, file, rnd, per) {
  let w = words(label).split(' ').filter(Boolean);
  const isEvent = /^On[A-Z]/.test(label);
  if (isEvent && w[0] === 'on') w = w.slice(1);
  const kept = [];
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 'command' && w[i + 1] === 'handler') { i++; continue; }
    kept.push(w[i]);
  }
  w = kept;
  let verb = '';
  if (w.length && VERBS.has(w[0])) { verb = w[0]; w = w.slice(1); }
  let role = '';
  if (w.length && ROLES.has(w[w.length - 1])) { role = w[w.length - 1]; w = w.slice(0, -1); }
  const subject = w.join(' ').trim();
  if (!subject) return [];

  let group;
  if (['create', 'add', 'register'].includes(verb)) group = 'create';
  else if (['delete', 'remove', 'purge'].includes(verb)) group = 'delete';
  else if (['update', 'change', 'set'].includes(verb)) group = 'update';
  else if (verb === 'get' || role === 'query') group = 'get';
  else if (verb === 'send') group = 'send';
  else if (isEvent || PAST.has(role)) group = 'event';
  else if (role === 'controller') group = 'controller';
  else if (role === 'repository') group = 'repository';
  else if (['service', 'adapter', 'client'].includes(role)) group = 'service';
  else group = 'other';

  const pastword = PAST.has(role) ? role : 'happens';
  const area = areaOf(file);
  const list = TEMPLATES[group];
  const start = Math.floor(rnd() * list.length);
  const picked = new Set();
  for (let k = 0; k < Math.min(per, list.length); k++) picked.add(list[(start + k) % list.length]);

  const out = new Set();
  for (const t of picked) {
    out.add(t.split('{subject}').join(subject)
      .split('{pastword}').join(pastword)
      .split(' in {area}').join(area ? ' in ' + area : '')
      .replace(/\s+/g, ' ').trim());
  }
  return [...out];
}

// a class name is one plain identifier (no dot, no namespace such as Metizoft.Vessels.Application); same test as build() in mk.js
const IDENT = /^[A-Za-z][A-Za-z0-9]{4,}$/;

function codePairs(rows, opts = {}) {
  const seed = opts.seed ?? 42, per = opts.per ?? 3, skip = opts.skip ?? new Set();
  const rnd = seeded(seed);
  const pairs = [];
  for (const r of rows) {
    const label = String(r.label || '');
    const file = String(r.file || '');
    if (!IDENT.test(label) || label.startsWith('Metizoft')) continue;
    const positive = codeText(label, file);
    for (const anchor of anchorsOf(label, file, rnd, per)) {
      if (skip.has(anchor.toLowerCase())) continue;
      pairs.push({ anchor, positive });
    }
  }
  return pairs;
}

module.exports = { codePairs };
