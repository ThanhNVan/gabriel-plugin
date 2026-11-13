// Where things live. Code: the plugin folder (may be replaced on update). Data: one folder per user, never inside the plugin.
const os = require('os'), path = require('path');
const NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const checkName = (n) => { if (!NAME.test(String(n))) throw new Error('bad project name: ' + n); return n; };
const pluginRoot = () => path.resolve(__dirname, '..');
const dataDir = () => path.resolve(process.env.GABRIEL_DATA || process.env.BRAIN_DATA || path.join(os.homedir(), '.claude', 'gabriel-data'));
const rulesHome = () => path.resolve(process.env.BRAIN_HOME || path.join(os.homedir(), '.claude'));
const modelsDir = () => path.join(dataDir(), 'models');
const projectsFile = () => path.join(dataDir(), 'projects.json');
const docsDir = (n) => path.join(dataDir(), 'docs', checkName(n));
const privateDir = (n) => path.join(dataDir(), 'private', checkName(n));
module.exports = { pluginRoot, dataDir, rulesHome, modelsDir, projectsFile, docsDir, privateDir, checkName };
