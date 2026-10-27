# Native projectile lab — 2026-10-08

This records the first projectile delivery. The subsequent eleven-demo expansion adds the compact Animation library, baseball props and Explore/Explain defaults; see [SCIENCE-DEMO-QA.md](SCIENCE-DEMO-QA.md) for current validation counts and limits. The projectile workflow was rerun successfully after that expansion.

Implemented locally in `the repository checkout`, continuing `main` at `5cb4c02` with the existing staged S0 grid changes preserved. A successful remote fetch confirmed 0 ahead/0 behind at the start. Version remains 1.4.0 with these changes unreleased. No live app restart, profile replacement, dependency installation or external provider is required for the model.

## Delivered teacher workflow

Flask button → Insert projectile lab → edit numeric/range controls or drag the circular launch-vector handle → play/pause/reset/step/scrub → inspect apex/impact → freeze and annotate → save/reopen/export PNG. Angle and gravity presets support quick experiments. A complementary-angle overlay shares the physical axes; equal ranges apply at zero initial height only.

The lab is one immutable native object. It supports select/move/uniform resize/rotate/duplicate/group/lock/order/undo using existing editor operations. Moving/resizing changes presentation only; pointer manipulation pauses at the current transient instant. Erasers remove surrounding annotations and preserve the lab, as they preserve editable text; use selection/Delete to remove a frame. Ink above/below the frame keeps ordinary stacking order during animation.

The paper and blueprint scenes contain a travelled path, a dashed future path, equal-time markers, velocity/resultant/component arrows, labelled equal-scale metre axes, height-time and vertical-velocity-time graphs, current position/speed, total time/range/peak height, kinetic/potential/total energy and equations. Graphs and numbers derive from the same state as the projectile. Reveals are undoable. Marker radius is illustrative. Velocity arrows share a gain for their components and auto-fit to available space; their numeric values are in m/s, not measured from the position axes.

## Scientific and file contracts

- `engine/science/projectile.ts`: pure analytic flight/evaluate/seek/samples. x right, y up; constant downward gravity, no drag, point mass, level landing plane y=0. Optional initial height. Positions in metres, velocity in m/s, time in seconds, mass in kg, energy in J. The launch control stores degrees and explicitly converts to radians for trigonometry.
- Reference: [NCERT XI Motion in a Plane §3.9](https://ncert.nic.in/textbook/pdf/keph103.pdf), with `y(t)=h₀+v₀sinθ·t−gt²/2`. `T=(v₀sinθ+sqrt((v₀sinθ)²+2gh₀))/g`; `R=v₀cosθ·T`. At impact, velocity is immediately **before** contact; the model stops there. The handoff had checked the official source on this date; re-fetch attempts in this continuation timed out. Independent analytical references are tested locally.
- Ranges: speed 0–100 m/s, angle 0–90°, height 0–100 m, g 0.1–30 m/s², mass 0.01–100 kg. All are finite and validated. Earth 9.81, Moon 1.62 and Mars 3.71 are labelled approximate constant-gravity presets. No bounce, drag, negative-angle launch, Earth curvature or changing gravity is modelled.
- `runtime.ts`: transient per-item clocks evaluated from a monotonic origin. No per-frame integration, persistent shapes, autosave changes or undo entries. One lab plays at a time. Offscreen, pass-through and lesson-preview labs pause. Step is 1/30 s; arbitrary seeks evaluate the closed form.
- `scene.ts`: bounded 120-segment paths/graphs, at most 240 when sampling is requested explicitly. Canvas/PNG/frozen lesson replay use the same renderer. Immutable scene geometry is cached. Animation repaints the frame region through the normal ordered item cache; unrelated cached ink is retained. This is regional repaint, not a separate compositor layer or a spatial-index rewrite.
- Native lab v1/model `projectile` v1 stores exact parameters, frame rectangle/angle, theme, reveals and `frozenTime`. Lab-containing boards use **format 3**, ordinary boards continue to save **format 2**. Existing Electron/Python readers remain. Lab floats retain their precision; existing ink keeps its established 0.01-coordinate/0.001-pressure save precision.
- Play/scrub time is transient. Snowflake or **Freeze & annotate** commits the deliberate starting instant as one edit. Parameter edits restart at zero. Native save/recovery/reopen uses the freeze; PNG renders the current preview synchronously before encoding. Slider/launch previews never enter persistent history, and cancellation discards them.
- Frozen lab records use **replay format 2**, protecting older readers from silently dropping a lab. Previous format-1 recordings remain supported. Parameter/time/reveal edits and annotations are generic recorded edits. Continuous scientific motion and transport events are **not** recorded; dedicated model-aware replay/video is future work.
- Unsupported lab/model versions retain validated settings and show an explicit compatibility placeholder with calculation/playback disabled. A saved raster fallback for unavailable future versions is not implemented.
- Semantic `whiteboard_read` includes a compact lab kind/model/version, parameter values with an explicit unit map (angle in degrees), exact saved time, reveals and supported-model SI state/flight values. Dedicated science creation/transport MCP commands are not yet exposed.

## Verification

Commands use `TEMP`/`TMP` under `app/.work`. Electron QA uses disposable profiles; the lab window is hidden, offscreen/input-isolated and never loads the live profile. Sandbox Electron launch failed; the normal execution approval mechanism allowed the same disposable test to run. No Windows protection was disabled.

```powershell
npm test -- --maxWorkers=1 --testTimeout=15000
npm run typecheck
npm run build
node e2e/projectile.mjs
```

Unit checks: **185 passed**, including 20 projectile/lifecycle tests plus a real disk backup/recovery check for a lab. Analytical cases include 20 m/s at 30°/g=10, complementary angles, elevated launch, a 45 m drop, horizontal and vertical launch, zero-duration limits, exact apex/pre-impact velocity, energy conservation for five gravity values, seek order independence, frame-size independence, version/malformed-input handling, independent clocks, frozen edit undo and frozen replay seek/round-trip.

Native workflow: **44 checks passed**, with [machine-readable results](science-qa/projectile-results.json). Covers manual insertion/editing, transient slider/cancel/release, one-step vector changes, playback/step/scrub, gravity validation, checkpoints, themes, freeze/draw/erase/undo, shape lifetime, lock, stacking, duplication, one-active/offscreen clock rules, semantic read, real disk save/restart, decoded PNG, 500-stroke animation, minimum-window controls, explicit incompatible-version UI and renderer exceptions. The manual workflow runs with renderer HTTP(S) requests blocked and makes none; the semantic-read check uses the existing authenticated loopback connection from the Node harness. No model inference or API key is used.

Existing disposable regression workflows also passed: **46 drawing**, **22 recovery**, **35 object**, **14 laser**, **40 agent/assistant** and **30 lesson/replay/video** checks. TypeScript and source build passed. No grid implementation changed in this continuation. The old unsupported-version tests now use version 4, since version 3 is intentionally supported.

One repeat of the older, externally interactive phase-1 harness reported three intermittent failures (close/view flush, compact settings geometry and damaged-primary preservation). The same source build passed all 22 checks in a fresh profile without a persistence change. The cause was not established. `e2e/lib.mjs` now offers `inputIsolated: true` / `FW_QA_ISOLATE=1`, placing QA windows offscreen with native mouse input and focus disabled while retaining Playwright input. Projectile QA opts in before startup and after reopening. The affected regression workflows were rechecked with isolation; real OS-input tests leave this opt-in flag unset.

Visuals inspected from actual production PNG output: [blueprint](science-qa/projectile-blueprint.png), [paper](science-qa/projectile-paper.png), [annotated freeze](science-qa/projectile-annotated.png). Minimum-window geometry is checked at 420×320. The new lab does not autoplay, panel entrance respects reduced motion, and controls use native labelled inputs/buttons.

The 90-frame script includes 500 cached strokes/10,000 samples at approximately 1099×611 CSS pixels, DPR 1.5. It records rendering CPU median/p95/max and confirms zero full cache rebuilds, stable document revision/undo and scientific progression. See the latest JSON for exact timings. Hidden-window compositor rAF is unreliable, so the harness drives production `Board.frame()` from a nominal 16 ms timer. These are scripted CPU measurements, **not visible compositor FPS, physical input latency or a universal smoothness claim**. Earlier dense-board stalls remain unresolved.

Live profile SHA-256 hashes for the board, five board backups, recordings and recording backup match before/after. The tests never opened that profile. The source app is rebuilt; an already running older app loads these changes only when the user chooses to reopen it.

## Remaining gates

Physical pen/touch/trackpad interaction, real screen sharing, visible animation on lower-end classroom devices and teacher/subject-expert review remain. Continuous scientific lesson/video contracts, dedicated science MCP actions, additional models and future-version raster fallback are later work. Trusted Windows release signing remains the previous unresolved distribution gate; no packaged-release claim is made here.
