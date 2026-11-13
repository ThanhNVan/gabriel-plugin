// GitHub Copilot (CLI and VS Code agent). Copilot drops the output of a userPromptSubmitted command hook, so gabriel cannot add the map
// to each prompt (see docs/HOSTS.md). Copilot calls `brain.js context "<prompt>" --host copilot` itself, told to by its instructions file.
// No postToolUse hook either: `touched` learns only after a map was shown in the same session, and Copilot never gets one from a hook.
'use strict';
const os = require('os'), path = require('path');
const { readCommon } = require('./common.js');

const rulesHome = () => path.resolve(process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot'));

module.exports = {
  name: 'copilot',
  readInput(raw) { return { ...readCommon(raw), sessionId: '' }; },
  readTouched: () => [],
  writeOutput: ({ text }) => text || '',
  rulesHome,
  defaultRuleFiles: ['copilot-instructions.md'],
  contextFile: 'copilot-instructions.md',
  maxChars: undefined,
  setup: null,
};
