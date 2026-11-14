// One short tip per session, in the user note only (the model never sees it). Off with "tips": false in projects.json.
// Tips go in order, one per session, then start over. The place is kept in <data>/tip-index.
"use strict";
const fs = require("fs"),
  path = require("path");
const paths = require("./paths.js");

const TIPS = [
  "Changed or added docs? Run /gabriel:update. It rebuilds only the maps that need it.",
  "Is the map out of date? Run /gabriel:status. It shows when each map was built.",
  'Want a project\'s map from any folder? Start your prompt with its name: "in <project>, how do I ...".',
  'Asking about a different project? Put its name first: "in <project>, ...". gabriel then uses that project\'s map.',
  "The map is a hint, not proof. Ask Claude to open the file it names and check the code.",
  "Lines with ↔ are code that links to the line above. After big code changes, run /gabriel:refresh-docs <code folder> to update them.",
  "Want better maps? Write a few test questions in eval-cases.json, then run /gabriel:retrain <name>. It keeps the new ranking only if it scores better.",
  "gabriel learns from you. When you open a file the map named, that file ranks higher next time.",
  'Want an old prompt gone from "Similar earlier prompts"? Run: node src/brain.js forget "<words>".',
  "Docs for your tools help too (framework guides, API docs). Add them with /gabriel:add-docs <name> <folder>.",
  "Downloaded stack docs get old. Run /gabriel:update --stack to fetch them again. It asks first.",
  "Big code change? Run /gabriel:refresh-docs <code folder>. It updates the code graph and fixes the docs that changed.",
  "For the best maps: run /graphify on your code, then write architecture, workflow and business docs from it.",
  "Use Codex or Gemini too? Run: node src/setup.js --host codex. It shows the setup. Nothing changes until you add --apply.",
  "Want your own rules? Put a preferences.md in your rules folder. It replaces gabriel's default one.",
  'Don\'t want tips? Add "tips": false to projects.json.',
  'Working in one project all session? Type "gabriel use <name>". The map then searches only that project. Type "gabriel use auto" to undo.',
  'Pinned to one project and the map is empty? Your question may be about another project. Type "gabriel use auto" first.',
  'Forgot your project names? Type "gabriel use ?" to list them.',
  "Code line numbers without ✓ may be old. Run /gabriel:add-docs <name> --repo <code folder> --relink to check them against your code on every prompt.",
];

// The tip for this session, or '' (tips off, no session id, or already shown this session). Never throws.
function tipFor(sessionId) {
  try {
    const dir = paths.dataDir();
    const pf = paths.projectsFile();
    if (
      !fs.existsSync(pf) ||
      JSON.parse(fs.readFileSync(pf, "utf8")).tips === false
    )
      return "";
    const sid = String(sessionId || "").replace(/[^A-Za-z0-9_-]/g, "");
    if (!sid) return "";
    const mark = path.join(dir, "seen", sid + ".tip");
    if (fs.existsSync(mark)) return "";
    fs.mkdirSync(path.dirname(mark), { recursive: true });
    fs.writeFileSync(mark, "");
    const idxFile = path.join(dir, "tip-index");
    const i =
      (Number(fs.existsSync(idxFile) ? fs.readFileSync(idxFile, "utf8") : 0) ||
        0) % TIPS.length;
    fs.writeFileSync(idxFile, String(i + 1));
    return "💡 Tip: " + TIPS[i];
  } catch {
    return "";
  }
}

module.exports = { TIPS, tipFor };
