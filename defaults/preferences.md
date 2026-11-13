# Default preferences

gabriel adds the lines below that fit your prompt. They are used only when your rules folder has no `preferences.md` of its own.
To change them, copy this file to your rules folder as `preferences.md` and edit it there.

## How to work
- Before adding a parameter, field, method or component, search for similar names and the same job. Trace the existing behavior and reuse what fits.
- Prove claims with cited facts. Never guess or state anything unverified.
- If context is missing or the request is vague, ask me first and do nothing until I answer.
- Keep all technical terms in English. Never translate them.
- Show % progress for every running task. When executing a plan, report tasks and steps done after each step. Long scripts print progress lines.
- Rewriting or shrinking a doc: shorter, every key idea kept.
- Simple search, lookup or extraction subagents: a cheap model. The main model for judgment and review.
- When the next task is unrelated, say so and suggest clearing the session to save tokens.
- After a task is done and verified: review the session history, then delete every temporary file and resource the task made. Keep deliverables, source data, my files and anything an active job needs.

## Secrets and system (never without me)
- Never commit or push. I do that.
- System, security and settings changes: I do them; give me the steps.
- Secrets: never type a key or password. Use an environment variable (`$env:NAME` or `$NAME`). Ask me for a key each session; never write it to a file.
- "Revert": put back only what you just did. "Out of scope": undo your changes there with `git checkout HEAD -- <files>`.
- PR comments: re-fetch all threads before and after, fix every one, never resolve them, offer draft replies.

## Project docs first
Before any plan, code, review or answer on a project:
- Read the project's docs: business rules and workflows (what each file must do and why), and technical docs (architecture, coding patterns, known bugs).
- Graph: query `graphify-out/` (`GRAPH_REPORT.md`, graph tools) for the callers and dependents of every touched file. Never read `graph.json` whole.
- Docs are a lead: confirm each claim in the real code and note the doc's verified commit.
- Bugs found but not fixed go in the project's known-bugs doc.
- No new backfill or data-changing script unless I ask; look for an existing one and list it.

## Plan exports
When I ask to export a plan (exporting does not run it):
- Goal and scope; a Progress table at the top (steps done and % per task, overall %), kept current.
- Numbered tasks with ordered steps. Each step has a check with its expected result; each task has an acceptance test.
- Per task: dependencies, inputs, outputs, and whether it can run alone. Add tests for the handoffs and the full flow.
- Mermaid diagrams (planned work, related workflows, code and data flow): triggers, decisions, handoffs, outputs, nodes tied to task numbers; split when clearer.
- Keep current behavior (from code or docs you read) apart from planned changes. Label assumptions and unknowns.
- Mark checks unrun. When executing, record results and fix failures before marking a step done.
