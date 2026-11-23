// Shared reading helpers for the host adapters. Each host reads its own stdin shape and returns the same four fields.
'use strict';
const path = require('path');

const str = (v) => (typeof v === 'string' ? v : '');

// Prompt hook stdin (UserPromptSubmit / BeforeAgent): the prompt, the session, the folder and the transcript.
function readCommon(raw) {
  const input = JSON.parse(raw);
  return { prompt: String(input.prompt || ''), sessionId: str(input.session_id), cwd: str(input.cwd), transcriptPath: String(input.transcript_path || '') };
}

// Post-tool stdin: the tool input (an object, or {} when missing).
function toolInput(raw) {
  const input = JSON.parse(raw);
  return { input, ti: input.tool_input || {}, cwd: str(input.cwd) };
}

// The first non-empty string among ti[keys], made absolute from cwd when given. [] when none.
function pathsFrom(ti, keys, cwd) {
  const f = keys.map((k) => ti[k]).find((v) => typeof v === 'string' && v);
  return f ? [path.resolve(cwd, f)] : [];
}

module.exports = { readCommon, toolInput, pathsFrom };
