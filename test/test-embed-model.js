'use strict';
// Tests for the meaning model choice (src/embed.js, src/projects.js embedModel): default, projects.json value,
// env override, a broken config (fails open), and a tuned model that is not on disk (words-only: getEmbedder gives null).
// Temp data folder. Never downloads: the local/ ids are read from disk only.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-model-test-'));
const DEFAULT = 'Xenova/all-MiniLM-L6-v2';
delete process.env.GABRIEL_EMBED_MODEL;
delete process.env.BRAIN_DATA;
const ROOT = path.resolve(__dirname, '..');
const { embedModel, DEFAULT_EMBED_MODEL } = require(path.join(ROOT, 'src', 'projects.js'));
const embed = require(path.join(ROOT, 'src', 'embed.js'));

// a new temp data folder for each case, so the config cache never mixes two cases
let n = 0;
function dataDir(projectsJson) {
  const d = path.join(base, 'data' + ++n);
  fs.mkdirSync(d, { recursive: true });
  if (projectsJson !== undefined) fs.writeFileSync(path.join(d, 'projects.json'), JSON.stringify(projectsJson));
  process.env.GABRIEL_DATA = d;
  return d;
}

(async () => {
  try {
    // 1: no config file -> the default model
    dataDir();
    assert.strictEqual(DEFAULT_EMBED_MODEL, DEFAULT);
    assert.strictEqual(embedModel(), DEFAULT);
    console.log('  ok: default id with no config');

    // 2: projects.json "embedModel" is read (also through the MODEL getter)
    dataDir({ version: 1, embedModel: 'local/from-config', projects: [] });
    assert.strictEqual(embedModel(), 'local/from-config');
    assert.strictEqual(embed.MODEL, 'local/from-config');
    console.log('  ok: config value read');

    // 3: env GABRIEL_EMBED_MODEL wins over the config
    dataDir({ version: 1, embedModel: 'local/from-config', projects: [] });
    process.env.GABRIEL_EMBED_MODEL = 'local/from-env';
    assert.strictEqual(embedModel(), 'local/from-env');
    delete process.env.GABRIEL_EMBED_MODEL;
    console.log('  ok: env override wins');

    // 4: a broken projects.json fails open to the default
    dataDir({ version: 9, projects: [] });
    assert.strictEqual(embedModel(), DEFAULT);
    console.log('  ok: broken config fails open to the default');

    // 5: a tuned model that is not on disk -> getEmbedder resolves null (words-only), no throw, no download
    dataDir();
    assert.strictEqual(await embed.getEmbedder(true, 'local/missing'), null);
    process.env.GABRIEL_EMBED_MODEL = 'local/missing';
    assert.strictEqual(await embed.getEmbedder(true), null);
    delete process.env.GABRIEL_EMBED_MODEL;
    console.log('  ok: local/missing -> getEmbedder resolves null (argument and env)');
    console.log('ALL PASSED');
  } finally {
    delete process.env.GABRIEL_DATA;
    fs.rmSync(base, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
