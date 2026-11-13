# 03 State machines

Two things have real states in the code: a doc set's map, and a learned link. Rules that move them are in [02-business-rules.md](02-business-rules.md).

## Doc-set map

A doc set is a project in `projects.json`. Its map lives in `mk.db`, one set of rows per doc set. The states are:

| State | Meaning | How to see it |
|---|---|---|
| Missing | No rows for this doc set yet. | `brain.js mk-status` says "no map". |
| Building | A build is running. The lock file `mk.lock` (for the default set) or the build is in progress. | Lock file younger than 10 minutes. |
| Ready | Rows match the current docs, graph, format and model. | `mk-status` says "ok". |
| Stale | Rows exist, but a source changed. The old rows still serve. | `mk-status` says "STALE". |

```mermaid
stateDiagram-v2
  [*] --> Missing
  Missing --> Building : build-mk runs (setup, add-docs, update, retrain)
  Building --> Ready : integrate commits the new rows (R17)
  Building --> Missing : build fails and no old rows exist
  Building --> Stale : build fails and old rows stay (R17)
  Ready --> Stale : a doc, the graph, the format or the model changed (R16)
  Stale --> Building : background check starts a build (R18) or update runs
  note right of Missing
    Only the default doc set is rebuilt in the background.
    Other doc sets are built on request (R19, R22).
  end note
```

Notes:

- A lock file older than 10 minutes counts as no lock. A new build may then start (R18).
- The background check runs at most once a minute (R18). It is not a state. It only starts a build from Stale.

## Learned link

A learned link joins a doc or code neuron to a code neuron. It is made when a file is opened or edited after a map was shown (see [W05](workflows/W05-learning-from-use.md)). Its weight grows each time, fades with time, and is removed when it is too weak or a neuron is gone.

| State | Meaning | Used in search? |
|---|---|---|
| New | Confirmed once (`n` = 1). | No (needs 2, R23). |
| Confirmed | Confirmed at least twice. Its weight halves every 45 days (R23). | Yes, only to spread (R24). |
| Faded | Weight under 0.02. | No. Removed at the next map build (R23). |
| Removed | Gone from `learn`. | Not stored. |

```mermaid
stateDiagram-v2
  [*] --> New : file touched after a map (R25)
  New --> Confirmed : touched again on the same neuron pair, n >= 2
  Confirmed --> Confirmed : touched again, weight moves toward 1
  New --> Faded : weight under 0.02 with time
  Confirmed --> Faded : weight under 0.02 with time
  Faded --> Removed : next map build (integrate)
  Confirmed --> Removed : a neuron is gone at the next map build
  Removed --> [*]
```

Notes:

- A link that is New or Confirmed is kept only when its neurons still exist (`integrate()`).
- `brain.js learn-show` lists the strongest links with their faded weight. `brain.js learn-reset` removes all of them.
