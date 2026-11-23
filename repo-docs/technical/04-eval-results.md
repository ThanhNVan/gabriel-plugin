# Eval results: Makillez

The map scores for the Makillez doc set, and the baseline they are compared with. The eval is `eval/eval-map.js` (see [docs/EVAL.md](../../docs/EVAL.md)).

## Run 2026-11-23

Makillez scores 77% strict (342/447) and 80% right doc or code (359/447). Strict means the right doc and section.

- Command: `node eval/eval-map.js --project makillez`
- Commit: `7fe9276`. The graph and maps were built at `1e50f8d`.
- Settings: meaning model on, learned links ignored.
- Questions: 447 Makillez, 3 unrelated.

| Measure | Score |
|---|---|
| Strict | 342/447 (77%) |
| Right doc or code | 359/447 (80%) |
| Unrelated kept quiet | 2/3 |
| Tier middle, strict | 265/343 (77%) |
| Tier hard, strict | 77/104 (74%) |
| Search time | 497 ms average, 1034 ms slowest |
| Block size | 2565 chars average, 3085 largest |

### By question set

Sets `dev` to `blind` were used for tuning. Sets `blind2` to `blind6` were read after their first runs.

| Set | Strict | Right doc or code |
|---|---|---|
| dev | 41/45 (91%) | 43/45 (96%) |
| held | 45/51 (88%) | 47/51 (92%) |
| fresh | 27/29 (93%) | 28/29 (97%) |
| train2 | 38/45 (84%) | 39/45 (87%) |
| blind | 30/36 (83%) | 31/36 (86%) |
| blind2 | 23/30 (77%) | 25/30 (83%) |
| blind3 | 32/34 (94%) | 33/34 (97%) |
| blind4 | 29/34 (85%) | 30/34 (88%) |
| blind5 | 9/11 (82%) | 10/11 (91%) |
| blind6 | 12/12 (100%) | 12/12 (100%) |

### By area (strict)

ARCH 25/29, CTX 15/16, EVT 23/24, AUTH 26/26, GW 12/12, FE 17/17, DEP 18/20, WF 21/83, BUG 57/60, CI 11/12, AIPO 14/15, SRCH 13/14, FP 14/15, RUN 15/17, IHM 17/19, PAT 17/19, NON 2/2, CODE 23/45, DOC 1/1, SEED 1/1.

## Baseline

The baseline is the best result on the current 447-question set: 343/447 strict (77%), from 2026-11-19, after the tuned meaning model was kept.

| Run (447 questions) | Strict | Right doc or code |
|---|---|---|
| 2026-11-19, tuned model kept (baseline) | 343/447 | not recorded |
| 2026-11-19, before the tune | 338/447 | 355/447 |
| 2026-11-18, compare run | 330/447 | 352/447 |

Not used: 2026-11-03 scored 92% strict (411/446). The setup has changed since then: the tech fallback set, the Makillez wiki and the tuned model. Whether the questions and scoring still match was not checked.

## Compare

Today is 1 question below the baseline (342 against 343 strict). That is within noise, so there is no real change.

| Measure | Baseline | 2026-11-23 | Change |
|---|---|---|---|
| Strict | 343/447 | 342/447 | -1 |
| Right doc or code | not recorded | 359/447 | none to compare |
| Unrelated kept quiet | 2/3 | 2/3 | 0 |

## Notes

- Workflow questions (WF) are the main loss: 21/83 strict, 62 of the 105 strict misses.
- Finding the asked function (CODE) stays weak: 23/45. See gap 2 in [findings.md](findings.md).
- The blind sets were read after their first runs. A new set (`blind7`) is needed for an honest unseen number.
