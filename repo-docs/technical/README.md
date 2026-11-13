# Technical docs

Read these for how gabriel is built, how to change it, and what is known to be wrong.

| Doc | Read it when you want to |
|-----|--------------------------|
| [01-architecture.md](01-architecture.md) | Learn the parts, how they talk, the data files, and why they are built this way. Start here. |
| [02-modules.md](02-modules.md) | Find a file in `src/`, `src/hosts/`, `src/tune/`, `eval/` or `tools/`: its job, main exports, and who calls it. |
| [03-dev-workflow.md](03-dev-workflow.md) | Install, run the tests, add a host or a doc format or a tip, release, or rebuild a map. |
| [findings.md](findings.md) | See known gaps and where the docs and the code disagree. |

## Where to start

1. Read the architecture page, at least the parts table and the prompt flow.
2. Open the module row for the file you will change.
3. Run `npm ci`, then `npm test`, before you change code.

Other docs live in `docs/` (the lead docs for matching, hosts and eval). Treat them as leads: check the code first.
