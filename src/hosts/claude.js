// Claude Code. This is today's behavior: the same stdin fields and the same stdout bytes for the same input.
// Installed as a plugin (hooks/hooks.json), so setup.js writes nothing for it.
'use strict';
const os = require('os'), path = require('path');
const { readCommon } = require('./common.js');

module.exports = {
  name: 'claude',
  readInput: readCommon,
  // PostToolUse (Read, Edit, Write, MultiEdit, NotebookEdit): the file is in tool_input.
  readTouched(raw) {
    const ti = JSON.parse(raw).tool_input || {};
    const f = ti.file_path || ti.notebook_path || ti.path;
    return f ? [f] : [];
  },
  // The user's view (systemMessage) and the model's text (hookSpecificOutput.additionalContext).
  writeOutput({ text, note }) {
    if (text) return JSON.stringify({ systemMessage: note, hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } });
    return note ? JSON.stringify({ systemMessage: note }) : '';
  },
  rulesHome: () => path.resolve(process.env.BRAIN_HOME || path.join(os.homedir(), '.claude')),
  defaultRuleFiles: ['CLAUDE.md'],
  contextFile: 'CLAUDE.md',   // loaded every session, so its rules are never injected again
  maxChars: undefined,
  setup: null,                // a plugin: no hook file to write
};
