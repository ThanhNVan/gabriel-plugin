// One short tip per session, in the user note only (the model never sees it). Off with "tips": false in projects.json.
// Tips go in order, one per session, then start over. The place is kept in <data>/tip-index.
"use strict";
const fs = require("fs"),
  path = require("path");
const paths = require("./paths.js");

const TIPS = [
  "Added or changed docs? Run /gabriel:update. It maps only the doc sets that changed.",
  "Not sure the map is current? /gabriel:status shows each doc set and when its map was built.",
  'Name the project in your prompt ("in <project>, how do I ...") to get its map from any folder.',
  'Working on many projects at once? Start the prompt with the project name, then the skill: "in project A, ...".',
  "The map is a lead, not proof. Ask Claude to open the doc or file it names and confirm in the code.",
  "Lines with ↔ are one-hop links in the code graph. Run /gabriel:refresh-docs <code folder> after code changes to keep them current.",
  "Write a few test questions for a doc set (eval-cases.json), then /gabriel:retrain <name>. New weights are kept only if they score better.",
  "gabriel learns from the files you open after a map. Open the file it named and it ranks that file higher next time.",
  'A prompt you want gone from "Similar earlier prompts"? node src/brain.js forget "<words>".',
  "Docs about your stack (framework guides, API references) help too: add them with /gabriel:add-docs <name> <folder>.",
  "Stack docs from the web age too. /gabriel:update --stack fetches them again (it asks first).",
  "Code changed a lot? /gabriel:refresh-docs <code folder> updates the graph, fixes the docs it touches and shrinks them, keeping every key idea.",
  "Best results: run /graphify on the code, then write architecture, workflow and business docs from the graph.",
  "Want gabriel in Codex or Gemini too? node src/setup.js --host codex shows the hook config. Nothing is written until --apply.",
  "Use your own rules: a preferences.md in your rules folder replaces gabriel's default preferences.",
  'Tired of tips? Set "tips": false in projects.json.',
  'Working in one project all session? Type "gabriel use <name>": the map then shows only that doc set. "gabriel use auto" undoes it.',
  'Pinned and the map looks empty? The question may belong to another doc set. Naming that set in the prompt does not help while pinned: type "gabriel use auto" first.',
  'Not sure which doc sets you have? Type "gabriel use ?": gabriel lists their names.',
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
