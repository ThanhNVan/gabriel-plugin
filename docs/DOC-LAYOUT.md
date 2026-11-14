# Doc layout for a code base

The layout `/gabriel:setup` writes and `/gabriel:refresh-docs` keeps. It is for developers. Docs are a lead: the code is the proof.

The docs folder is not in the code repo. Setup makes `<name>-code-docs/` next to the code. It holds `docs/` (this layout) and `graphify-out/` (the graph). The code repo stays clean.

## Folders

```text
<repo>/docs/
├─ README.md               the index: "Which doc?" table, how the docs connect, commit checked
├─ business/
│  ├─ README.md            what the product is for, list of docs and workflows
│  ├─ 01-domain-map.md     the main parts of the business and who owns what
│  ├─ 02-business-rules.md the rules, each with the file that enforces it
│  ├─ 03-state-machines.md each entity with states: the states and what moves it
│  ├─ GLOSSARY.md          terms, one line each
│  └─ workflows/
│     └─ W01-<name>.md     one main flow, from trigger to result
└─ technical/
   ├─ README.md            list of docs, where to start
   ├─ 01-architecture.md   the parts, how they talk, key decisions
   ├─ 02-modules.md        each module: its job, its owner, its main types
   ├─ 03-dev-workflow.md   build, test, run, and how to add a feature
   └─ findings.md          known bugs and places where docs and code disagree
```

Make a file only when there is something real to put in it. A small repo may need only `README.md`, `technical/01-architecture.md` and two workflows. Never leave an empty file or a "TBD" section.

Number files in reading order. Keep the numbers when a file is removed, so links do not break.

## Workflow page

Each `workflows/W<nn>-<name>.md` has these parts, in this order:

1. **Trigger:** what starts it (a user action, an API call, a job, an event).
2. **Steps:** a numbered list. Each step names the file or class that does it.
3. **Diagram:** one Mermaid `sequenceDiagram` or `flowchart`.
4. **Rules and states:** links to the rules and states it uses. Do not copy them.
5. **Result:** what changed (data, events, emails) and where to check it.

## Keep it lean

Over-detailed docs go stale fast and hide the one fact the reader needs. Every line must help someone do a task or understand a decision.

Check a folder with `node tools/check-docs.js <docs folder> [--code <repo>] [--no-size]`. It reports size, long code blocks, line numbers, placeholders, broken links and (with `--code`) missing code paths, then `check-docs: <n> hits`.

- **One fact, one place.** Write it once and link to it. Repeated facts drift apart.
- **Name the code, do not copy it.** Give the file path and the class or function name. No code blocks longer than 5 lines. No line numbers: they change with every edit.
- **No per-method or per-field docs.** The code and its types say that. Document the job, the flow and the why.
- **No guesses.** Write only what you checked in the code. Put open points in `findings.md`.
- **No future sections.** No "planned", "maybe later" or empty headings.
- **Size limits.** A doc over 300 lines, or a workflow page over 120, is too long: split it or cut it.
- **Diagrams:** one screen each (about 15 nodes), a one-line caption above, real file or class names on the nodes, labels in double quotes.

## Index (`docs/README.md`)

- A "Which doc?" table: a reader's question, then the doc to open first.
- One Mermaid diagram of how the docs link to each other and to the code.
- `Checked against commit: <sha>`. `/gabriel:refresh-docs` updates it.
