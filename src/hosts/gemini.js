// Gemini CLI. Hooks live in ~/.gemini/settings.json under "hooks" (see docs/HOSTS.md). Timeouts are in milliseconds.
'use strict';
const os = require('os'), path = require('path');
const { readCommon, toolInput, pathsFrom } = require('./common.js');

const rulesHome = () => path.resolve(path.join(os.homedir(), '.gemini'));

module.exports = {
  name: 'gemini',
  readInput: readCommon,
  // AfterTool: the file path is one of these fields in tool_input (relative paths are made absolute from cwd).
  readTouched(raw) {
    const { ti, cwd } = toolInput(raw);
    return pathsFrom(ti, ['file_path', 'absolute_path', 'path'], cwd);
  },
  // Only the model text. The hook output has no user-facing line here.
  writeOutput({ text }) {
    return text ? JSON.stringify({ hookSpecificOutput: { additionalContext: text } }) : '';
  },
  rulesHome,
  defaultRuleFiles: ['GEMINI.md'],
  contextFile: 'GEMINI.md',
  maxChars: undefined,
  setup: {
    configFile: () => path.join(rulesHome(), 'settings.json'),
    entries(root) {
      const brain = path.join(root, 'src', 'brain.js');
      const data = process.env.GABRIEL_DATA ? ` --data "${process.env.GABRIEL_DATA}"` : '';   // Gemini does not see Claude Code's settings.json env
      return {
        BeforeAgent: [{ hooks: [{ type: 'command', command: `node "${brain}" hook --host gemini${data}`, timeout: 60000 }] }],
        AfterTool: [{ matcher: 'write_file|replace|read_file', hooks: [{ type: 'command', command: `node "${brain}" touched --host gemini${data}`, timeout: 5000 }] }],
      };
    },
  },
};
