'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const mk = require('../mk.js'), paths = require('../paths.js'), repo = require('../repo.js');
const { getProject } = require('../projects.js');

const INSTRUCTION = 'For each class or method below, write 1-2 plain sentences: what it does and when it runs, in business words (the user action or situation), plus key rules or failure cases. Start with the area (e.g. "Purchase orders:"). Do not repeat the name. Do not comment on bugs, code quality or wrong messages. Output only JSON: {"<Name>": "<description>", ...}';
const QUESTION_INSTRUCTION = 'For each class or method below, write 3 short questions a developer would ask that this code answers, in business words (the user action or situation). Do not use the class or method name. Output only JSON: {"<Name>": ["<question>", "<question>", "<question>"], ...}';

// Windows: Node cannot spawn codex.cmd without a shell (EINVAL), so run the npm package's codex.js with node directly
const CODEX_JS = process.platform === 'win32' && process.env.APPDATA ? path.join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js') : null;
// One codex exec call (read-only sandbox, about 3-4 minutes even for a small prompt). Returns the last message, else stdout.
function callLlm(prompt, opts) {
  const last = path.join(require('os').tmpdir(), `code-desc-${process.pid}.txt`);
  try { fs.unlinkSync(last); } catch { /* none yet */ }
  const args = ['exec', '-m', opts.model, '-c', 'model_reasoning_effort=' + opts.effort, '--skip-git-repo-check', '--sandbox', 'read-only', '-o', last, '-'];
  const [cmd, argv] = CODEX_JS && fs.existsSync(CODEX_JS) ? [process.execPath, [CODEX_JS, ...args]] : ['codex', args];
  const result = spawnSync(cmd, argv, { input: prompt, encoding: 'utf8', shell: false, timeout: 15 * 60 * 1000, maxBuffer: 1e8 });
  if (result.error || result.status !== 0) throw result.error || new Error('codex exit ' + result.status);
  try { return fs.readFileSync(last, 'utf8'); } catch { return result.stdout; } finally { try { fs.unlinkSync(last); } catch { /* gone */ } }
}

function firstObject(output) {
  const start = output.indexOf('{');
  if (start < 0) throw new Error('no JSON object');
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < output.length; i++) {
    const c = output[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(output.slice(start, i + 1));
  }
  throw new Error('incomplete JSON object');
}

function source(project, file, label) {
  try {
    const text = fs.readFileSync(path.join(project.repo, project.repoBase || '', file), 'utf8');
    const line = repo.defLine(text, label.replace(/^\./, '').replace(/\(\)$/, ''));
    if (!line) return '';
    return text.split('\n').slice(line - 1).filter((s) => s.trim() && !/^\s*(using\s|import\s)/.test(s)).join('\n').slice(0, 3500);
  } catch { return ''; }
}

function run(opts, deps = {}) {
  const project = getProject(opts.project);
  if (!project) throw new Error('unknown project: ' + opts.project);
  const batch = opts.batch === undefined ? 10 : Number(opts.batch);
  const limit = opts.limit === undefined ? Infinity : Number(opts.limit);
  if (!Number.isInteger(batch) || batch < 1 || !(limit === Infinity || Number.isInteger(limit) && limit >= 0)) throw new Error('batch and limit must be whole numbers');
  const db = new DatabaseSync(mk.dbFile(), { readOnly: true });
  let files;
  try { files = mk.codeLabels(db, opts.project); } finally { db.close(); }
  const requested = opts.labels ? JSON.parse(fs.readFileSync(opts.labels, 'utf8')) : [...files.keys()];
  if (!Array.isArray(requested)) throw new Error('labels must be an array');
  const instruction = opts.questions ? QUESTION_INSTRUCTION : INSTRUCTION;
  const target = path.join(paths.privateDir(opts.project), opts.questions ? 'code-questions.json' : 'code-desc.json');
  let saved = {};
  try { const data = JSON.parse(fs.readFileSync(target, 'utf8')); if (data && typeof data === 'object' && !Array.isArray(data)) saved = data; } catch { /* start empty */ }
  const pending = [...new Set(requested)].filter((label) => typeof label === 'string' && !saved[label]).slice(0, limit);
  let skipped = 0;
  const items = [];
  for (const label of pending) {
    const code = project.repo && files.has(label) ? source(project, files.get(label), label) : '';
    if (code) items.push({ label, code }); else skipped++;
  }
  const batches = Math.ceil(items.length / batch);
  const promptOf = (part) => instruction + '\n\n' + part.map((item) => '=== ' + item.label + '\n' + item.code + '\n\n').join('');
  console.log(`labels: ${pending.length}, with source: ${items.length}, skipped: ${skipped}, batches: ${batches}`);
  if (opts.dryRun) { if (items.length) console.log(promptOf(items.slice(0, batch))); return; }
  const invoke = deps.callLlm || callLlm;
  for (let i = 0; i < batches; i++) {
    const part = items.slice(i * batch, (i + 1) * batch);
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const output = invoke(promptOf(part), { model: opts.model || 'gpt-6.1-terra', effort: opts.effort || 'low' });
        result = firstObject(output);
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid JSON object');
        break;
      } catch { if (attempt === 1) console.log(`batch ${i + 1} failed after retry`); }
    }
    if (result) {
      for (const item of part) {
        const value = result[item.label];
        if (opts.questions) {
          // 1-5 questions: trimmed, non-empty, at most 200 characters; bad entries are dropped
          const qs = Array.isArray(value) ? value.filter((q) => typeof q === 'string').map((q) => q.trim()).filter((q) => q && q.length <= 200).slice(0, 5) : [];
          if (qs.length) saved[item.label] = qs;
        } else if (typeof value === 'string' && value.trim() && value.trim().length <= 400) saved[item.label] = value.trim();
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const tmp = target + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(saved, null, 2) + '\n');
      fs.renameSync(tmp, target);
      mk.resetCodeDesc();
    }
    const done = Math.min((i + 1) * batch, items.length);
    console.log(`progress: ${done}/${items.length} (${Math.round(done * 100 / items.length)}%) batch ${i + 1}/${batches}`);
  }
}

function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--dry-run') opts.dryRun = true;
    else if (key === '--questions') opts.questions = true;
    else if (['--project', '--labels', '--batch', '--model', '--effort', '--limit'].includes(key) && args[i + 1] && !args[i + 1].startsWith('--')) opts[key.slice(2)] = args[++i];
    else throw new Error('unknown or incomplete option: ' + key);
  }
  if (!opts.project) throw new Error('--project is required');
  return opts;
}

module.exports = { run, callLlm };
if (require.main === module) {
  try { run(parseArgs(process.argv.slice(2))); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
