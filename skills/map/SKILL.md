---
name: map
description: Use when a "… map" or fallback docs block from gabriel is in the prompt context: how to read it and how far to trust it.
---

Read the map like this:

- Name the doc or file it points to, then confirm it in the real code or doc before you use it.
- A `↔` line is a one-hop graph link with no direction. It does not say who calls whom.
- A `2 links away` line is a code name two strong links from a top code name, with the same name stem. It is a lead too: confirm it in the code.
- A fallback block holds public background docs. It is reading, not a rule of this repo. Say so when you use it.
- The map is a lead, not proof. Its header date or commit can be old.
- A session can be pinned. Then each note starts with `📌 pinned: <set>` and the map searches only that set. If the question clearly belongs to another set, tell the user to type `gabriel use auto`.
