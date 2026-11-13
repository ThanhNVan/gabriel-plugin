// Any other tool, through `brain.js context "<prompt>"`. Plain text out (the block only). No session unless --session is given.
// Rules folder: GABRIEL_RULES_HOME, then BRAIN_HOME, then ~/.claude. No file is loaded by default, so every rule can be injected.
'use strict';
const os = require('os'), path = require('path');
const { readCommon } = require('./common.js');

module.exports = {
  name: 'generic',
  readInput(raw) { return { ...readCommon(raw), sessionId: '' }; },
  readTouched: () => [],
  writeOutput: ({ text }) => text || '',
  rulesHome: () => path.resolve(process.env.GABRIEL_RULES_HOME || process.env.BRAIN_HOME || path.join(os.homedir(), '.claude')),
  defaultRuleFiles: ['CLAUDE.md'],
  contextFile: '',
  maxChars: undefined,
  setup: null,
};
