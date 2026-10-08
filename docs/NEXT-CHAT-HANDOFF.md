# Next chat handoff: science roadmap and canvas improvement

Updated **2026-10-08**. Workspace: `D:\Projects 2\whiteboard`. Actual project/repository: **`D:\Projects 2\whiteboard\app`**.

## User's direction

Build an excellent offline teaching whiteboard with accurate, labelled, paper/blueprint-style science demonstrations. Start with Indian high-school physics; eventually expand to biology/anatomy, chemistry and mathematics. Prioritize 2D and useful projected depth. Optional AI/voice should operate the app through native, efficient agent commands.

The user asked for a **separate long-term science roadmap**, broad curriculum research for Classes 9–12, a small exciting starter set, and a scalable structure. They did not ask to enumerate every chapter/diagram now. They also asked to compare Miro's canvas and candidly assess zoom/grid/dot quality and performance.

Latest emphasis: Miro's dots/lines feel consistently sharp and smoothly adjusted during zoom. Match that experience; extending zoom limits is not the goal. A limited zoom range and a large virtual canvas are separate concepts. The user observed 20%–200% in the current anonymous Lite board.

The user wants autonomous implementation/checking when work is authorized, clear evidence and candid limits. They currently have **no OpenAI API key**. Manual physics and external MCP use must remain independent of a built-in AI provider. They previously authorized pushing work to GitHub, **only for the `app` project**. Do not include root Python files or `android-library`.

## Read these first

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
- This planning/audit turn added the two documents above, this handoff, evidence screenshots/JSON and a canvas audit script, and linked the new track from README/current roadmap. **No production renderer or scientific runtime was changed.** App version remains 1.4.0.
- A previous release pass reported **278 source checks**. That count is historical; this turn ran the new canvas audit, not the entire suite. The corrected full audit passed **10 checks**; the atomic visual capture path also completed successfully.
- Trusted distribution remains unresolved: the unsigned 1.4.0 portable executable was blocked by Windows Code Integrity / Smart App Control. `npm run dist:signed` fails closed without signing credentials. Do not disable protection or claim the portable launcher passed. Source-app Electron tests work.
- Preserve the user's open whiteboard and recordings. It has been used for a live editable “why area grows faster” explanation through MCP. Use a disposable profile for QA.

## What the canvas audit proved

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
$env:TEMP = 'D:\Projects 2\whiteboard\app\.work'
$env:TMP = $env:TEMP
npm run build
node e2e/canvas-audit.mjs
node e2e/canvas-audit.mjs visual  # only atomic camera-verified pixel captures
```

The new harness hides its own Electron window, ignores external mouse input and checks that scripted camera state does not drift. This matters: an earlier always-on-top test window overlapped Chrome, making Miro clicks affect the test app and invalidating those exploratory timings. Those results are excluded. Do not recreate that interference while doing browser comparisons.

Hidden windows may time out on `page.screenshot`; the audit exports actual board canvas pixels. Capture rendering and pixels atomically and check camera/cache zoom; pending view animations can make an apparently “settled” screenshot use a different camera. `visual-captures.json` verifies both images at the same 2.5× camera.

Miro testing used the user's Chrome tab and anonymous Lite UI. Its line grid was visible; a dot-mode option and a drawn object were not established. Do not claim access to proprietary renderer internals or benchmark parity with a populated Miro board. The Chrome connection became unavailable later; reacquire current inventory through computer-use if further testing is needed. Do not copy the ephemeral board-access token into documentation or Git.

For production renderer changes, run appropriate unit/type/build checks and existing object/laser/agent/replay regressions. Verify real pen/touch/trackpad feel and screen sharing separately. Source checks cannot establish lower-end hardware performance, Windows trust or physical device feel.

## Suggested opening prompt for the next chat

> Continue Floating Whiteboard in `D:\Projects 2\whiteboard\app`. Read `docs/NEXT-CHAT-HANDOFF.md`, `docs/SCIENCE-ROADMAP.md` and `docs/CANVAS-AUDIT.md`, then verify the current Git state. Implement science phase S0 first: smooth, sharp, world-anchored dots and line grids during zoom/pan, with measured performance and regression checks. Keep the existing document/pen/overlay/MCP/replay behavior intact and preserve my live board. Then begin one complete native projectile-motion lab under the new science architecture, without requiring an OpenAI API key. Push only the app repository and report what was actually verified.

The prompt is a suggested scope for the user to authorize in the new chat; it is not evidence that S0 or the projectile lab has already been implemented.
