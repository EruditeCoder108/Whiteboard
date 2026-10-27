# S0 renderer continuation — 2026-10-08

Started from clean `main`, commit `5cb4c02`. Changes remain local in the app repository; version 1.4.0. The user asked to finish this renderer slice and start the native projectile lab in a new chat. No projectile model, lab object or UI has been retained in production.

## Implemented

- A viewport-sized background canvas below committed ink and live pen/laser/selection canvases. The background is never scaled with the expensive content-cache preview.
- Fixed 1.2 CSS-pixel dots and 1 CSS-pixel grid lines. Coordinates retain subpixel camera movement, including fractional DPR and negative world positions.
- A world-origin powers-of-two lattice. The coarse subset stays visible; intervening dots/lines enter through smoothstep opacity. At a spacing boundary the retained subset matches the outgoing lattice. Reversing zoom uses the same stateless function without hysteresis lag.
- Background changes bypass content-cache rebuilds. Document-only edits reuse the existing background. The cache margin can shrink to zero on large viewports; a viewport itself larger than 40 million pixels still cannot fit inside that target.
- Existing item types, native format, save/recovery, input routing and lesson contracts remain unchanged.

## Verification

Production harness: `node e2e/canvas-audit.mjs` (or `npm run e2e:canvas`). It forwards to `e2e/science-canvas.mjs`, launches a disposable profile, hides its Electron window and ignores external mouse input. Pixel checks occur before a renderer reload so their temporary readback canvases are discarded before timing. Hidden-window rAF proved unreliable after reload, so the final harness explicitly drives the real `Board.frame` from a nominal 16 ms timer. These intervals measure scripted scheduling/render work, not visible compositor FPS.

Evidence: [s0-results.json](science-qa/s0-results.json), plus original canvas captures [light dots](science-qa/s0-dots-light.png), [dark dots](science-qa/s0-dots-dark.png), [light lines](science-qa/s0-lines-light.png), [dark lines](science-qa/s0-lines-dark.png).

Pixel gates cover preview/settled dot area, empty content-cache alpha, line thickness across 5%–1600%, density boundaries in both modes/themes, zoom anchoring, wheel and pinch input, distant negative world positions, clearing the background and renderer exceptions. Density pixel checks allow up to 2% relative alpha difference: Canvas alpha quantization at these low opacities can account for one 8-bit step. Pure lattice tests separately verify mathematical continuity at the boundaries.

An initial run passed dot-size/thickness/anchor checks but exposed the too-tight 1% raster threshold and poor timing with readback canvases still present. Its timings are not a reliable baseline comparison. The final production results are recorded separately below; do not infer Miro parity from either run.

Current results: **13 production grid/gesture checks passed**, **161 unit tests passed**, TypeScript checking and source build passed. The first unit run had one disk-save test exceed its 5-second timeout; a serial full run with a 15-second timeout passed all tests. No persistence implementation or test assertions were changed to achieve that result.

Dot alpha-weighted area was **1.32636 CSS-pixel²** before zoom, during a forced expensive-cache preview, and after settling. The tested content cache had no grid pixels. Line thickness and lattice continuity gates passed in both themes; captures were visually inspected.

Reference profile: approximately **1099×611 CSS pixels, DPR 1.5**, Electron 44.5.1. Each of twelve final scripted cases uses 90 frames and 0, 500 or 4,000 strokes (up to 240,000 samples). Renderer CPU p95 ranged from **0.3 to 4.4 ms**. Very dense cases still had scheduler intervals as long as **3.76 seconds** in this source test environment. The timer intervals and historical rAF measurements are not directly comparable, and these outliers prevent claiming consistently smooth dense-board performance. This slice fixes decorative sharpness/density; it does not resolve every content-cache/compositor stall.

Live-profile integrity: SHA-256 hashes for `board.json`, all five board backups, `recordings.json` and its backup matched before and after implementation/testing. Tests never loaded the live profile.

Existing object workflows: **35 passed**. Laser checks: **14 passed**. Native agent/MCP/assistant workflows: **40 passed**. Lesson recording, seeking, save/reopen, repeated video export and cancellation: **30 passed**. Together with 161 unit and 13 grid checks, **293 checks passed**. Laser pixel probes were updated to use `board.liveCv` rather than the previous second-canvas position; drawing and OS capture probes received the same fix. The slow-curve trail check reads its transient state inside the input evaluation to avoid IPC scheduling expiring samples before inspection; its assertions remain unchanged. Real OS-input tests were not run.

## Limits and next work

This is the decorative-renderer slice of S0. Trusted Windows signing, physical pen/touch/trackpad feel, screen-sharing checks and lower-end classroom hardware remain unverified. The existing cache can still have long rebuild frames on very dense boards. No general spatial-index rewrite was attempted.

The next chat should implement the native projectile lab described in [NEXT-CHAT-HANDOFF.md](NEXT-CHAT-HANDOFF.md). Keep models in SI, separate frame placement/size from physical parameters, and distinguish frozen lab edits from continuously animated lesson replay. No OpenAI key is required.
