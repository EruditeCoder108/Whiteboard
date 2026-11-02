# Tools audit handoff — 2 November 2026

Branch: `feature/tools-audit`, based on `origin/main` at `1f23808`, version `1.7.0-beta.1`. Worktree: `D:\Projects 2\whiteboard\app-tools-audit`. The lead's `app` folder was left alone.

## The three parts

1. **Audit, `83f0bf7` (pushed):** [tools-audit.md](tools-audit.md). Twelve layout/size/surface configurations, 696 part visits, 2,064 setting actions, 288 on-part controls and 696 separate file-persistence checks. Screenshots and logs are outside the repo in `D:\Projects 2\whiteboard\audit-shots`.
2. **Science drawings, `250f461` (pushed):** [science-check.md](science-check.md). All 28 physics/chemistry parts reviewed and refined in code. Biology was excluded at the owner's request on 2 November and is unchanged. All 58 part data/control contracts are unchanged. The renderer check covered 430 states with no escaped or overlapping text.
3. **Picture assets:** eight replacements (`axes`, `pdf-worksheet`, `table`, `paper-squared`, `paper-graph`, `paper-ruled`, `paper-fourline`, `paper-hindi`) and two additions (`templates`, `apparatus`). All were generated with the built-in image tool and processed through `build/make-art.cjs`. Raw masters and per-picture prompt metadata are in `D:\Projects 2\whiteboard\art-masters`; [SOURCES.md](../../src/renderer/src/assets/art/SOURCES.md) records the prompts and master hashes. The axes received a lighter material revision after checking dark panels.

**New exports at the end of `ui/icons.tsx`: `ArtTemplates` and `ArtApparatus`.** The lead still needs to use them on the buttons. The artwork inventory includes both. Existing button sizes and styles are unchanged. All 109 image exports together are about 636 KiB, below the 3 MB budget.

[Picture preview at 38, 60 and 96 px, on both surfaces](../../../audit-shots/art-round2-preview.png).

## Ten worst findings within the retained physics/chemistry scope

The numbers refer to the original report; its biology findings are retained as historical evidence, without biology fixes.

| Report | Finding | Status on this branch |
|---|---|---|
| 1 | Concave lens displayed a positive focal length | Fixed |
| 2 | Zero force displayed 0.1 N | Fixed |
| 3 | Empty vessel displayed pH 7 | Fixed |
| 5 | Spring scale disagreed with the numerical weight | Fixed |
| 6 | Settings switch hidden behind the board toolbar at 1280 | Lead: protected UI files |
| 11 | Pendulum escaped its box and crowded its caption | Fixed; small-angle approximation disclosed |
| 12 | Empty burette retained a coloured liquid heel | Fixed |
| 13 | Magnetic field diagram lacked direction and exceeded its bounds | Fixed as a schematic |
| 14 | Balance assumes the same vessel mass and liquid density | Lead: `world.ts` |
| 15 | Weak glassware/support construction and proportions | Physics/chemistry drawings refined |

The resistor's fixed colour bands also need the lead's attention in `parts-electric.ts`; that file was intentionally untouched.

## Required final checks

| Command | Result |
|---|---|
| `npm run typecheck` | Pass, no errors |
| `npm test` | 470 passed, 0 failed (35 files) |
| `npm run e2e:apparatus` | 31 passed, 0 failed |
| `npm run e2e:icons` | 18 passed, 0 failed |
| `npm run e2e:theme` | 19 passed, 0 failed |
| `npm run e2e:labels` | 8 passed, 0 failed |

Logs: `D:\Projects 2\whiteboard\audit-shots\final-checks`. Tracked `e2e/shots` is restored before committing; test pictures are not committed.

## What remains to verify

Real panel input, palm rejection, display scaling, back-row readability and physical teaching acceptance were not tested. Native file dialogs were controlled/cancelled and external Office/import workflows were not certified by this audit. A science teacher should review the ideal lens and pendulum models, linear liquid levels in conical/round vessels, simplified pH/indicator/heating behaviour and the balance assumptions before quantitative lessons. See the specific limitations and sources in `science-check.md`.

The branch is for the lead to review. No PR or merge is performed by this task.
