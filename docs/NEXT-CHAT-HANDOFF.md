# Next chat handoff: three deeper science showcases and Windows packages

Updated **2026-10-27**. Work from the repository checkout containing `package.json`; paths below are repository-relative.

## Latest delivery — three deeper showcases

Branding/gallery update, **2026-10-27**: regenerated the owner's supplied logo with transparent
exterior, replaced README cover imagery with a detailed generated chemistry illustration, and
added editable HTML cover/social-card templates. `npm run branding` exports logo sizes, the cover
and 1280×640 repo cards with a separate safe-area guide using disposable profiles. The README now
includes six actual native scene captures and links the aspirational
[50+ lesson collection plan](SCIENCE-COLLECTION-PLAN.md). See
[provenance and exact prompts](assets/readme/GENERATION.md). Artwork is distinct from app screenshots;
no native simulations were changed by this update. Assets remain local until reviewed and committed.

Branding validation: `npm run branding` passed; 109 local links across thirteen documentation/template
files resolved; the local README preview loaded every image and showed no horizontal page overflow
in its narrow layout. Master and 512/256/64 px logo PNGs have alpha range 0–255 and transparent
corners. The final social PNG is 1280×640, 490,277 bytes; its guide overlay is exported separately.
Existing simulation test results below are historical, not rerun for this asset-only change.

Publication preparation, **2026-10-27**: the owner selected GPLv3. The local root licence and package
metadata now use GPL-3.0-only; runtime dependency notices are retained separately. README has original
cover artwork, official stack marks and synthetic renderer-based screenshots/GIF. See
[OPEN-SOURCE-READINESS.md](OPEN-SOURCE-READINESS.md), [USER-GUIDE.md](USER-GUIDE.md) and
[the media credits](assets/readme/README.md). GitHub was already public; no push or history rewrite
was performed. Local live-data hash evidence stays ignored, and machine-specific documentation
paths were made portable. All earlier staged work remains for the owner to review and commit.

User authorised three examples after criticising the simplistic eleven-demo visuals. New native IDs `flux-studio`, `indicator-studio`, `heart-studio` preserve the original IDs and saved objects. Read [SCIENCE-SHOWCASE-QA.md](SCIENCE-SHOWCASE-QA.md), its `showcase-qa/` keyframes/results and [INSTALL-ON-ANOTHER-PC.md](INSTALL-ON-ANOTHER-PC.md). Library initially features these three; Browse all/search/subjects/on-board navigation retains fourteen total.

Induction: a layered copper coil and draggable enamel magnet. Mouse/finger input records a bounded position-time trace; one gesture is one undo transaction, cancelled movement is transient, Play replays it. Item-aware state/duration are shared by runtime, transport, freeze, parser and semantic reads. Chemistry: original glass apparatus with gravity-level liquid, neck-connected streams, volume-dependent meniscus and liquid/vessel-clipped CO₂ bubbles. Heart: original vector cutaway with four chambers, muscular septum/thicker LV wall, moving valve leaflets/chordae, contraction, two circuits and four lesson stops. These are offline Canvas2D teaching illustrations with stated scientific approximations, not imported 3D/CFD or calibrated physiological models. No production dependency was added.

211 unit checks, 30 showcase workflow checks, 94 full-library checks, 44 projectile, 46 drawing/touch, 40 agent and 30 lesson-replay checks passed (495 source checks). Another 30 checks passed against the packaged runtime (525 combined). Visual QA caught and fixed an overlaid chemistry heading; fast/coalesced pointer-up preserves the final magnet position. Nine live data files retain their hashes, all 41 earlier staged paths remain, HEAD is `5cb4c02`. Physical-device/teacher review and lower-end performance remain unverified. Continuous science animation is still not recorded as a lesson timeline, although committed traces/frozen edits survive native replay.

`npm run dist:showcase` builds separate installer and portable previews under `dist/showcase-preview/`, without overwriting historical release outputs. Runtime is bundled; normal board/science needs no Node/Blender/API key. x64 Windows 10/11 target. Executables are unsigned; do not claim acceptance on another PC or bypass Windows protection. Never run the installer against the live profile for QA.

New code: `showcase-models.ts`, `studio-drawing.ts`, `{flux,indicator,heart}-studio.ts`, `showcase-scenes.ts`, `ShowcaseGuide.tsx`, `tests/showcases.test.ts`, `e2e/showcases.mjs`. Keep all existing staged changes and historical QA. Grids were not revisited. Live profile is read-only; QA profiles are disposable. Verify Git state afresh.

## Earlier delivery — eleven demos and compact library

The user approved **eleven animations**, including a flask/pouring/colour-change reaction apparatus. All eleven now insert as native editable lab objects. Read [SCIENCE-DEMO-QA.md](SCIENCE-DEMO-QA.md), its results/screenshots, the updated science roadmap and changelog. The set is 7 physics, 3 chemistry, 1 biology: projectile, lenses/mirrors, magnet/coil, circuits/bulbs, pendulum/spring, waves, forces/friction, states of matter, atoms/reactions, circulation, and cabbage-indicator vinegar/bicarbonate apparatus.

Flask → Animation library provides search, subject/topic filters, responsive cards and an On this board list. The stretched insertion-button icon is fixed. Native baseball props and Explore/Explain modes are implemented; new labs start with the simpler view. All controls are offline. Model assumptions are visible and scientific/illustrative behaviours are distinguished. Apparatus pH is an idealised, vented-CO₂ approximation; colours/timing are illustrative. This is not a reviewed curriculum pack.

New entries: `engine/science/models.ts`, `catalogue.ts`, `experiments.ts`, `props.ts`, `ui/science/Catalogue.tsx`, `Inspector.tsx`, `Preview.tsx`, `tests/science-models.test.ts`, `e2e/science-library.mjs`. Lab parameters now use per-model numeric schemas; existing projectile files remain readable. Keep board format 3 / frozen replay format 2 and the established regional ordered rendering contract. Generic recordings still do not capture continuous scientific motion.

Validation: **512 checks passed** (203 unit, 78 library, 44 projectile, 46 drawing, 22 recovery, 35 objects, 14 laser, 40 agent, 30 replay), plus TypeScript/build. Continue with teacher/subject review, real hardware/visible performance, model-aware lesson replay and useful direct handles (currently projectile only). Do not reimplement these models or reopen decorative grid research. Test with disposable profiles. UI capture briefly renders a non-focusable input-isolated QA window beyond every connected display, then hides it; never select/restart the live window. Existing staged S0 work is preserved; additions remain local/uncommitted. Verify Git afresh.

## Earlier projectile delivery — still relevant foundation

The first **native offline projectile lab is now implemented**, built and exercised locally. Read [PROJECTILE-LAB-QA.md](PROJECTILE-LAB-QA.md), the updated [SCIENCE-ROADMAP.md](SCIENCE-ROADMAP.md), README and changelog before continuing. Do not reimplement S1 or reopen decorative-grid research without a reproduced regression.

- Entry: flask button → Insert projectile lab. One persistent `t:'l'` item, lab/model v1, SI parameters, presentation frame, reveal flags/theme and exact deliberate `frozenTime`.
- Physics: closed-form evaluate/seek, x right/y up, constant downward gravity, no drag, level ground, optional initial height. Landing velocity is immediately before impact. Parameters/limits/units are visible in the inspector.
- Interaction: direct launch handle, numeric/range controls, angle and gravity presets, play/pause/reset/1⁄30 s step/scrub, apex/impact, freeze-and-annotate. One lab plays at a time; offscreen/pass-through/lesson-preview labs pause. Slider and handle previews never autosave or add undo entries.
- Scene: paper/blueprint, travelled/dashed future paths, equal-time dots, component vectors, calibrated axes, height/vertical-velocity graphs, energy/equations and complementary-angle comparison.
- Lifecycle: ordinary select/move/uniform resize/rotate/duplicate/group/lock/order/undo, save/reopen/recovery and PNG export. Moving/resizing preserves model parameters and transient time; manipulation pauses playback. Ink remains in normal stacking order during regional animation redraw.
- Files: lab boards use native format **3**; ordinary boards retain **2**. Frozen lab recordings use replay format **2**; old format-1 recordings remain readable. Unsupported lab/model versions keep validated settings and display a warning/placeholder without running scientific calculations.
- Native saves retain the deliberately frozen instant; playback/scrub time is transient. PNG captures the current preview. Generic recordings capture frozen edits and annotations, **not continuous scientific motion**.
- Semantic reads expose compact saved SI state. Dedicated science commands, model-aware continuous recording/seek/video, unavailable-version raster fallback, teacher/device validation and other models remain next work.

Implementation entry points: `engine/science/{projectile,runtime,scene}.ts`, `ui/science/Science.tsx`, `state/science.ts`, plus existing board/items/tools/transforms/serialize/replay/agent adapters. No provider, download or API key is needed.

Post-delivery direction: the user wants familiar objects and subtle harmless quirks across animations so lessons feel inviting to children. That visual slice is now implemented alongside the eleven-entry library, as described above. Cosmetic details must not imply unmodelled spin, drag or bounce. Carry the same restrained playful style into later optics, induction and other labs. See the updated science roadmap's next implementation slice.

Git continuation baseline: `main` at `5cb4c02`; successful `git fetch origin` confirmed 0 ahead/0 behind. Existing S0 changes were already staged and have been preserved. Lab changes are additional local working-tree work. No commit/push was requested in this continuation. Verify current status afresh. The live app/profile was never restarted or opened by QA; before/after board/backup/recording hashes matched. Source output is rebuilt; the live older process can load it when the user chooses to reopen.

Verification and screenshots are in [PROJECTILE-LAB-QA.md](PROJECTILE-LAB-QA.md) and [projectile-results.json](science-qa/projectile-results.json). Run `npm test -- --maxWorkers=1 --testTimeout=15000`, `npm run typecheck`, `npm run build`, then `node e2e/projectile.mjs`. Use `.work` for TEMP/TMP and disposable profiles. Electron launch may need normal sandbox escalation; keep the test window hidden/input-isolated. Existing drawing/recovery/object/laser/agent/replay checks also passed.

The remainder of this document describes the **pre-lab handoff and earlier renderer history**. Its statements that the lab is unimplemented, format is only 2, and the next task is to start S1 are historical.

## Latest instruction — read before the historical context

Later screenshot feedback asked to prioritize a flawless square grid. The line renderer now uses neutral low-contrast four-way graph paper, compensated intersections and display-scale refresh. Dots retain the S0 implementation. See [SQUARE-GRID-QA.md](SQUARE-GRID-QA.md) for this follow-up; the S0 descriptions and totals below are historical.

The user asked to **finish the grid work and move the main native projectile lab into a new chat**. Do not spend another planning/audit cycle on decorative grids. Implement the projectile lab next; revisit S0 only for a concrete regression.

S0 is now implemented locally: `engine/grid.ts` paints a separate viewport background, fixed 1.2 CSS-pixel dots and 1 CSS-pixel lines; powers-of-two subdivisions fade smoothly and share the world origin. Grid/theme changes do not invalidate cached ink, and background painting is skipped when only document content changes. The cache keeps its preview/pan policy; its margin can now shrink to zero rather than exceed the nominal pixel budget solely to maintain a minimum margin.

Verification and measured limits: [SCIENCE-S0-QA.md](SCIENCE-S0-QA.md), [production results](science-qa/s0-results.json). `node e2e/canvas-audit.mjs` now forwards to `e2e/science-canvas.mjs`, using a disposable hidden profile. Historical prototype results remain in `docs/canvas-audit/`; the historical script is available in Git at `5cb4c02`.

Current source checks: **293 passed** (161 unit, 35 object, 14 laser, 40 agent, 30 replay and 13 grid/gesture), plus TypeScript/build. The dense-board scripted run still recorded long stalls; S0 is a decorative-renderer delivery, not a claim of flawless dense-board performance. See the QA file for regression details and scheduler limitations. Proceed to the lab without another grid research cycle.

Git was clean on `main` at `5cb4c02` when this continuation began. The S0 changes and this handoff are in the working tree; verify current status rather than assuming they were committed or pushed. App version remains 1.4.0 and native board format remains version 2. No lab schema or runtime changes remain in production. A draft model was started during this chat and removed when the user explicitly deferred the lab.

The user's live profile and recordings were never opened through the test app. Do not restart or replace their live app to demonstrate a change. Keep QA profiles separate.

## Next implementation scope

Start **one working native projectile lab**, with the existing board as its host:

1. A provider-independent SI model: uniform downward gravity, no drag, point mass, a level landing plane, optional initial height. Document x right/y upward and the velocity immediately before impact. Parameter ranges/units and assumptions must be visible. Pure deterministic evaluate/seek functions; no per-frame solver drift.
2. A versioned native lab item storing parameters, frame geometry, reveal settings and deliberately frozen starting time. Animation must not create persistent shapes or undo entries per frame. Moving/resizing the frame affects presentation only; axes keep a labelled physical scale.
3. Science entry → insert projectile frame → direct launch-vector handle and compact inspector → play/pause/reset/step/scrub → freeze and annotate. Show the trajectory, velocity components, labelled axes, height-time graph and useful time/range/height/energy readouts.
4. Shared object lifecycle: select/move/uniform resize/duplicate/lock/order, one-step intentional edits, undo/redo, save/reopen/recovery and PNG snapshots. Preserve surrounding ink and stacking order while animating. Handle unsupported model versions explicitly.
5. Analytical reference tests and actual teacher workflow in a disposable Electron profile. Begin with [NCERT XI, Motion in a Plane, §3.9](https://ncert.nic.in/textbook/pdf/keph103.pdf), equations 3.37–3.42. This source was checked again on 2026-10-08. Test complementary angles, apex velocity, landing, initial height, zero/vertical launch, conservation of mechanical energy, and frame-size independence.
6. Give semantic reads a compact lab summary. Dedicated model transport/MCP commands and continuously animated lesson replay need explicit contracts; do not claim today's generic edit recorder captures scientific animation. Frozen parameter/time edits can use the existing recording foundation if validated.

No OpenAI API key is available or required. Manual science must work completely offline. Optional AI/provider configuration is outside this first-lab dependency path.

Follow `SCIENCE-ROADMAP.md`, but deliver this narrow model before adding optics, induction, broad chapter inventories or additional architecture. Keep `ROADMAP.md` as the separate editor/workspace roadmap.

## User's direction

Build an excellent offline teaching whiteboard with accurate, labelled, paper/blueprint-style science demonstrations. Start with Indian high-school physics; eventually expand to biology/anatomy, chemistry and mathematics. Prioritize 2D and useful projected depth. Optional AI/voice should operate the app through native, efficient agent commands.

The user asked for a **separate long-term science roadmap**, broad curriculum research for Classes 9–12, a small exciting starter set, and a scalable structure. They did not ask to enumerate every chapter/diagram now. They also asked to compare Miro's canvas and candidly assess zoom/grid/dot quality and performance.

Latest emphasis: Miro's dots/lines feel consistently sharp and smoothly adjusted during zoom. Match that experience; extending zoom limits is not the goal. A limited zoom range and a large virtual canvas are separate concepts. The user observed 20%–200% in the current anonymous Lite board.

The user wants autonomous implementation/checking when work is authorized, clear evidence and candid limits. They currently have **no OpenAI API key**. Manual physics and external MCP use must remain independent of a built-in AI provider. They previously authorized pushing work to GitHub, **only for the `app` project**. Do not include root Python files or `android-library`.

## Read these first

0. [SCIENCE-S0-QA.md](SCIENCE-S0-QA.md) — current renderer checks, limits and local change status. Treat the canvas audit below as historical.
1. [SCIENCE-ROADMAP.md](SCIENCE-ROADMAP.md) — authoritative new science track, current baseline, official syllabus sources, starter models, integrated teacher flow, scalable model/runtime/board/agent architecture, phases S0–S6 and release gates.
2. [CANVAS-AUDIT.md](CANVAS-AUDIT.md) — verified renderer defects, Miro observations/limits, prototype results, proposed production change and alternatives.
3. [ROADMAP.md](../ROADMAP.md) — existing editor/workspace roadmap. Keep it distinct from the new science track.
4. [README.md](../README.md) and [CHANGELOG.md](../CHANGELOG.md) — app usage, MCP/replay features and Windows signing limitation.
5. [canvas-audit.mjs](../e2e/canvas-audit.mjs), [source-results.json](canvas-audit/source-results.json), [visual-captures.json](canvas-audit/visual-captures.json) — reproducible checks, measured results and camera-verified pixel captures.

Then inspect these implementation files:

- `src/renderer/src/engine/board.ts`: committed cache, grid, zoom preview, pan blit, redraw scheduling, view animation and bounds.
- `engine/view.ts`: world/screen transforms, pointer-anchor zoom, clamp and fit math.
- `engine/input.ts`: mouse/pen/touch/wheel/pinch routing.
- `engine/items.ts`: immutable bounds, outline and path caches, drawing and culling helpers.
- `src/renderer/src/app.tsx` and `styles.css`: current board/live canvases and stage layout.
- `state/store.ts`, `state/actions.ts`, `ui/Panels.tsx`: backgrounds, zoom/settings, controls and persistence.
- `engine/types.ts`, `serialize.ts`, `doc.ts`, `agent.ts`, `replay.ts`, `replay-render.ts`: persistent object types, validation/history and agent/recording contracts to extend later.
- `e2e/lib.mjs`, `performance.mjs`, `phase2.mjs`, `laser-audit.mjs`, `agent.mjs`, `replay.mjs`: existing QA helpers and regression workflows.

Paths above are relative to `app`; engine/state/UI shorthand is under `src/renderer/src`.

## Current product and repository state

- Electron/TypeScript/Preact custom Canvas2D vector editor, **1.4.0**. Native editable shapes/text/notes, grouping/transforms/locking, pen tools, local recovery, semantic agents/MCP and editable lesson recording/replay already exist.
- GitHub: `https://github.com/EruditeCoder108/Whiteboard`, branch `main`. Code baseline is `21693d4c85d59ee50085f92e630fff348bbf9fe0`; any later documentation commit should be checked with `git log`/`git status` before resuming.
- The **previous planning/audit chat** added the two documents above, the original handoff, screenshots/JSON and a prototype script. The **current continuation** implemented the S0 renderer described at the top. No scientific runtime was retained. App version remains 1.4.0.
- A previous release pass reported **278 source checks**. That count is historical; this turn ran the new canvas audit, not the entire suite. The corrected full audit passed **10 checks**; the atomic visual capture path also completed successfully.
- Trusted distribution remains unresolved: the unsigned 1.4.0 portable executable was blocked by Windows Code Integrity / Smart App Control. `npm run dist:signed` fails closed without signing credentials. Do not disable protection or claim the portable launcher passed. Source-app Electron tests work.
- Preserve the user's open whiteboard and recordings. It has been used for a live editable “why area grows faster” explanation through MCP. Use a disposable profile for QA.

## What the historical canvas audit proved

The app already uses a movable virtual camera, not a bitmap covering the entire world. Its zoom range is 5%–1600%. Synthetic checks retained a pointer's world anchor, navigated the camera to ±1,000,000, and passed Ctrl+wheel, zoom-aware wheel pan and two-touch pinch without ink.

Two concrete defects:

1. Decorative dots/lines are rendered into the committed-object cache. When an expensive board uses a scaled cache preview, dot radius and line width grow/blur, then return on redraw. A controlled 1.5× preview increased painted dot area **2.247×**; the separate-background prototype kept it exactly stable.
2. Grid spacing changes discretely. 44.9% → 45.1% changes screen spacing 35.92 → 18.04 px; 399% → 401% changes 159.6 → 80.2 px. Smooth adaptive level transitions are still needed.

The prototype patches methods **in memory only** in a throw-away profile. It omits grid from the expensive object cache and draws a fresh DPR-aware viewport background canvas. It reuses the existing density algorithm, so it **has not** solved density snapping.

Reference profile: about 1099×611 CSS px, DPR 1.5, Electron 44.5.1. Each of 12 cases has 90 scripted frames, with 0/500/4,000 strokes; dense content has 240,000 samples. The final input-isolated run had no unexpected camera changes. Background drawing adds roughly 0.3–0.6 ms to typical pan/preview render CPU in this profile. Dense p95 frame intervals were roughly 17–19 ms, but maximum intervals reached 75–127 ms. Do not promise flawless dense-board performance or claim this is a physical tablet/foreground video test.

Recommended next change: independent decorative background rendering, fixed screen-pixel dot radius/line thickness, world anchoring, smooth compatible grid-level opacity transitions/hysteresis and DPR alignment. Preserve content caching. Measure long-frame outliers; improve spatial indexing/tiled invalidation only when justified. Bounds/outlines/paths are already cached; do not describe them as recomputed every frame.

Decorative grid density can adapt. Scientific axes/rulers must retain explicit SI units and calibrated scale. Resizing a future lab's board frame changes presentation, not its physical model.

## Research and product decisions

Curriculum baseline is **CBSE/NCERT 2026–27**, not every Indian board. The roadmap links official documents:

- IX: motion/graphs, forces/friction, work/energy/simple machines, sound. The new IX structure differs from older book lists.
- X: optics, circuits/power, magnetic effects. Motor/induction/generator appear as formative material; overlapping exam notes require clarification before exam-specific badges.
- XI: mechanics/gravitation, matter/thermal/fluids, gases and oscillations/waves.
- XII: fields/circuits/magnetism/induction/AC, optics and modern physics/electronics.

Start **projectile → optics → induction**, then circuits, oscillations and waves. These are proposals, not implemented models. The roadmap intentionally avoids an exhaustive chapter inventory and fixed release dates.

Keep models independent of UI/board pixels/providers: parameter schemas with SI units, documented assumptions, versioned model IDs, deterministic time/seek, derived scene geometry/graphs, native lab items, semantic edits and agent commands. Animation must not generate undo entries or persistent shape objects every frame. Add model-aware recording/seek/export; existing generic edit recording alone does not replay scientific models.

Teacher experience: Science catalogue → insert lab frame → drag meaningful handles → play/pause/step/scrub → reveal vectors/labels/graphs → freeze and annotate → save/replay/reuse/export. Optional speech/AI comes after tested models; use constrained native commands rather than arbitrary generated code.

Excalidraw is a plausible MIT-licensed reference/alternative but migration is substantial. tldraw is useful engineering reference and SDK, but its current source-available licence requires appropriate production licensing. No upstream code/package was copied or installed in this turn. Keep our renderer first; do not begin a rewrite just to fix dots.

## Testing lessons and practical commands

Use PowerShell, with `app` as the working directory. Set TEMP/TMP inside `app/.work` for build/test tools; prior sandbox temp behavior caused ENOENT/EPERM. Electron integration tests/loopback may need normal escalation through the approval mechanism.

```powershell
$env:TEMP = (Resolve-Path .work).Path
$env:TMP = $env:TEMP
npm run build
node e2e/canvas-audit.mjs
node e2e/canvas-audit.mjs visual  # only atomic camera-verified pixel captures
```

The new harness hides its own Electron window, ignores external mouse input and checks that scripted camera state does not drift. This matters: an earlier always-on-top test window overlapped Chrome, making Miro clicks affect the test app and invalidating those exploratory timings. Those results are excluded. Do not recreate that interference while doing browser comparisons.

Hidden windows may time out on `page.screenshot`; the audit exports actual board canvas pixels. Capture rendering and pixels atomically and check camera/cache zoom; pending view animations can make an apparently “settled” screenshot use a different camera. `visual-captures.json` verifies both images at the same 2.5× camera.

Miro testing used the user's Chrome tab and anonymous Lite UI. Its line grid was visible; a dot-mode option and a drawn object were not established. Do not claim access to proprietary renderer internals or benchmark parity with a populated Miro board. The Chrome connection became unavailable later; reacquire current inventory through computer-use if further testing is needed. Do not copy the ephemeral board-access token into documentation or Git.

For production renderer changes, run appropriate unit/type/build checks and existing object/laser/agent/replay regressions. Verify real pen/touch/trackpad feel and screen sharing separately. Source checks cannot establish lower-end hardware performance, Windows trust or physical device feel.

## Ready-to-use prompt for the next chat

> Continue Floating Whiteboard in `<repository-root>`. Read `docs/NEXT-CHAT-HANDOFF.md`, `docs/SCIENCE-SHOWCASE-QA.md`, `docs/SCIENCE-ROADMAP.md` and `docs/INSTALL-ON-ANOTHER-PC.md`, then verify Git and preserve all local/staged changes and my live board. Fourteen offline labs already exist, including three deeper studios. Inspect their actual keyframes/results before proposing changes. Prioritise thoughtful interaction, scientific/teacher review and physical-device feedback over adding more simplistic entries. Use disposable QA profiles. No OpenAI API key is available. Revisit grids only for a concrete regression. Keep the roadmap and handoff current and report checks actually run; unsigned Windows trust remains a distribution limitation.

The projectile and showcase implementations already exist. The next implementation slice should follow the user's actual feedback; do not restart an obsolete grid/projectile plan.
