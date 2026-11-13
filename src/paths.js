// Where things live. Code: the plugin folder (may be replaced on update). Data: one folder per user, never inside the plugin.
// The rules folder depends on the host (claude, codex, gemini, generic); the data folder is shared by all hosts.
const fs = require('fs'), os = require('os'), path = require('path');
const hosts = require('./hosts/index.js');
const NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const checkName = (n) => { if (!NAME.test(String(n))) throw new Error('bad project name: ' + n); return n; };
const pluginRoot = () => path.resolve(__dirname, '..');

let chosen = null;   // set by setHost() from the --host flag; otherwise GABRIEL_HOST, otherwise claude
const activeHost = () => chosen || process.env.GABRIEL_HOST || 'claude';
const setHost = (name) => { chosen = hosts.get(name).name; return chosen; };
const hostAdapter = () => hosts.get(activeHost());
const rulesHome = () => hostAdapter().rulesHome();
const defaultRuleFiles = () => hostAdapter().defaultRuleFiles.slice();
const contextFile = () => hostAdapter().contextFile;

// Order: GABRIEL_DATA, then BRAIN_DATA, then the old folder ~/.claude/gabriel-data when it exists, then ~/.gabriel (new installs).
const dataDir = () => {
  const env = process.env.GABRIEL_DATA || process.env.BRAIN_DATA;
  if (env) return path.resolve(env);
  const old = path.join(os.homedir(), '.claude', 'gabriel-data');
  return fs.existsSync(old) ? old : path.join(os.homedir(), '.gabriel');
};
const modelsDir = () => path.join(dataDir(), 'models');
const projectsFile = () => path.join(dataDir(), 'projects.json');
const docsDir = (n) => path.join(dataDir(), 'docs', checkName(n));
const privateDir = (n) => path.join(dataDir(), 'private', checkName(n));
module.exports = { pluginRoot, dataDir, rulesHome, modelsDir, projectsFile, docsDir, privateDir, checkName, activeHost, setHost, hostAdapter, defaultRuleFiles, contextFile };
