// Codex CLI. Hooks live in ~/.codex/hooks.json (see docs/HOSTS.md). Output is capped by Codex (about 2,500 tokens), so the block is cut.
'use strict';
const os = require('os'), path = require('path');
const { readCommon, toolInput, pathsFrom } = require('./common.js');

const rulesHome = () => path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
const PATCH_FILE = /^\*\*\* (?:Update|Add) File: (.+)$/gm;   // Delete File is skipped: the file is gone

module.exports = {
  name: 'codex',
  readInput: readCommon,
  // PostToolUse. apply_patch has no file_path: its paths are in the patch text (tool_input.command).
  // Other tools: a file_path or path field when there is one. Relative paths are made absolute from cwd.
  readTouched(raw) {
    const { ti, cwd, input } = toolInput(raw);
    const cmd = typeof ti.command === 'string' ? ti.command : '';
    if (input.tool_name === 'apply_patch' || cmd.includes('*** Begin Patch')) {
      return [...cmd.matchAll(PATCH_FILE)].map((m) => path.resolve(cwd, m[1].trim()));
    }
    return pathsFrom(ti, ['file_path', 'path'], cwd);
  },
  writeOutput({ text, note }) {
    const out = {};
    if (note) out.systemMessage = note;
    if (text) out.hookSpecificOutput = { hookEventName: 'UserPromptSubmit', additionalContext: text };
    return Object.keys(out).length ? JSON.stringify(out) : '';
  },
  rulesHome,
  defaultRuleFiles: ['AGENTS.md'],
  contextFile: 'AGENTS.md',
  maxChars: 9000,             // Codex caps hook output; gabriel stays well under it
  setup: {
    configFile: () => path.join(rulesHome(), 'hooks.json'),
    // Hook groups to add. Timeouts are in seconds for Codex.
    entries(root) {
      const brain = path.join(root, 'src', 'brain.js');
      const data = process.env.GABRIEL_DATA ? ` --data "${process.env.GABRIEL_DATA}"` : '';   // Codex does not see Claude Code's settings.json env
      return {
        UserPromptSubmit: [{ hooks: [{ type: 'command', command: `node "${brain}" hook --host codex${data}`, timeout: 60 }] }],
        PostToolUse: [{ matcher: 'apply_patch|Read|Edit|Write', hooks: [{ type: 'command', command: `node "${brain}" touched --host codex${data}`, timeout: 5 }] }],
      };
    },
  },
};
