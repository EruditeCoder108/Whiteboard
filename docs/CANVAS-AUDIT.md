# Canvas navigation and background audit

Date: **2026-10-08**. Target: Floating Whiteboard **1.4.0**, source commit `21693d4`. Reference: the user's open anonymous [Miro Lite board](https://miro.com/online-whiteboard/).

**Recommendation: improve our existing camera/background renderer. A full whiteboard-engine replacement is not justified by these defects.** The dot-size fix is feasible at low measured drawing cost; completely smooth dense-board navigation still needs cache/performance work and physical-device validation.

This audit adds documentation, screenshots and a repeatable source-app test. The proposed background split exists only as an in-memory prototype inside an isolated test profile. The shipped renderer, the user's board and the current release version are unchanged.

## Infinite canvas and zoom limits are different

“Infinite canvas” normally means a virtual coordinate world viewed through a movable camera. It does not mean an infinitely large bitmap or an unlimited zoom factor. A practical editor can pan beyond the screen while keeping a bounded zoom range and finite memory.

Miro's [official board documentation](https://developers.miro.com/docs/boards) describes world coordinates and a viewport that changes during navigation. Our `view.ts` already implements the same broad camera idea, with a **5%–1600%** zoom range. The isolated test moved our camera to `(1,000,000, -1,000,000)` without allocating a canvas covering that entire area. That verifies large-world navigation, not unlimited mathematical precision.

The user observed a **20%–200%** range in this Miro Lite session. I independently observed 100%, 125% and 200%; attempts to use the displayed 400% preset did not establish a 400% result. This is evidence about that anonymous session, not a claim about all Miro plans or versions. Matching its narrower range is not the proposed fix.

## What was checked in Miro

Used the existing Chrome tab, opened the zoom menu and shape palette, dismissed the first-object hint, and compared the visible grid at different zoom levels. No sign-in, upload, collaboration or account features were used. A disposable rectangle gesture did not produce a verified object; object-scaling or dense-board performance parity is therefore not claimed.

The current anonymous board exposed a **line grid**. A dot-background setting was not established. The user's description of smooth dots/lines is the desired experience; this session does not independently prove Miro Lite's dot algorithm.

Observed grid lines remained visually thin as their positions/spacings changed with zoom. The spacing is not literally fixed at every zoom: the 100% and 200% views show different line spacing. A polished adaptive pattern can change density without making that change conspicuous. The 100% and 125% captures were made before the source benchmark window was launched.

- [Miro at 100%](canvas-audit/miro-100.png)
- [Miro at 125%](canvas-audit/miro-125.png)
- [Confirmed 200% view](canvas-audit/miro-200.png)

The visible DOM contained viewport-sized canvases. This does **not** establish Miro's proprietary rendering backend, cache structure, spatial index or GPU implementation. Browser UI observations are not source-code access. Techniques below are recommendations grounded in our source and public engine documentation, not guessed Miro internals.

## Verified issues in our renderer

| Finding | Evidence and consequence |
|---|---|
| Background and content share a raster cache | `board.ts` paints the grid into the same offscreen canvas as committed objects. Expensive-board zoom scales that whole image until a settled redraw. Dots and grid strokes temporarily grow and soften too. |
| Dot radius changes during a zoom preview | At a controlled 1.5× zoom, alpha-weighted dot area changed from **1.326 to 2.980 CSS-pixel²**, a **2.247×** increase, then returned to **1.326**. This matches scaling the dot radius by 1.5. This branch was deliberately forced for the isolated sharpness check and also occurs naturally on the dense benchmark. |
| Grid density switches abruptly | With the existing 40-unit base, 44.9% uses **35.92 px** spacing but 45.1% uses **18.04 px**. At 399% it is **159.6 px**, then **80.2 px** at 401%. The pattern jumps even though the zoom change is small. |
| Whole-image preview affects content fidelity | Raster scaling is a reasonable temporary optimization for ink, but it can blur detail until a full redraw. The background should have a separate fidelity policy. |
| Cache rebuilding can produce long frames | A rebuild scans the item list and paints visible objects. Bounds/outlines/paths already have immutable-item caches in `items.ts`; there is no spatial index in this paint loop. The 4,000-stroke test still had occasional long frames. |
| Pixel snapping can add small pan steps | The cache's non-preview offset is rounded to device pixels. The overlay uses camera coordinates directly. Source evidence identifies a possible alignment/feel issue; physical pan jitter was not measured. |

The camera math itself retained the zoom anchor exactly in the test. Ctrl+wheel, wheel scaling and a two-touch pinch also passed synthetic input checks. This does not certify a particular touchpad/tablet's real gesture feel.

## Prototype and performance evidence

The test removes decorative grid painting from the object cache and draws it into a separate **viewport-sized canvas** from the current camera. It reuses the current grid algorithm, so it fixes preview dot size but **does not yet fix abrupt density changes**. Fixed-radius dot area remained **1.326** before and during the same 1.5× preview.

Run: `node e2e/canvas-audit.mjs` against the built source app. It uses a disposable profile, hides its window and ignores external mouse input. The app already disables background throttling. **10 checks passed**, with no renderer exceptions and no unexpected camera changes.

The final recorded profile is approximately **1099 × 611 CSS pixels, DPR 1.5**, Electron 44.5.1 / Chromium 152. Each case has 90 scripted pan or zoom frames. Boards contain 0, 500 or 4,000 strokes; each stroke has 60 samples. The dense board has **240,000 samples**, and its camera starts at 35% zoom. The pairs use the same content, gesture sequence and zoom policy.

| Case | Current frame interval p95 | Split-background p95 | Current render CPU p95 | Split render CPU p95 |
|---|---:|---:|---:|---:|
| Empty board, zoom | 17.9 ms | 17.0 ms | 1.9 ms | 0.5 ms |
| 500 strokes, pan | 17.1 ms | 17.3 ms | 0.2 ms | 0.5 ms |
| 500 strokes, zoom | 19.1 ms | 18.3 ms | 4.1 ms | 3.8 ms |
| 4,000 strokes, pan | 18.5 ms | 18.8 ms | 0.2 ms | 0.8 ms |
| 4,000 strokes, zoom | 16.9 ms | 17.7 ms | 0.2 ms | 0.7 ms |

These are background source-runtime measurements on one machine, not a foreground video benchmark or a guarantee of frame rate on every device. JavaScript timing does not capture all asynchronous GPU/compositor work. The dense cases reached maximum intervals of **74.6/104.4 ms** in the current renderer and **77.5/127.0 ms** in the prototype. Typical performance is encouraging, but those outliers prevent calling dense-board interaction flawless. Viewport size, DPR, overlap, object complexity and active animations all matter.

Earlier exploratory measurements are excluded: the temporary always-on-top test window overlapped Chrome, and external browser gestures could affect its camera. The corrected final run explicitly checks for that contamination. A same-canvas compositing experiment was also abandoned; its exploratory results are not used to claim a performance regression.

Raw evidence: [source-results.json](canvas-audit/source-results.json). Reproduction: [canvas-audit.mjs](../e2e/canvas-audit.mjs). Pixel captures show the actual source board canvas on a white background, without the hidden window's UI:

- [Scaled cached dots during a forced preview](canvas-audit/our-dots-preview.png)
- [Sharp fixed-radius dots after redraw](canvas-audit/our-dots-settled.png)

## Proposed production improvement

1. **Render decorative backgrounds independently of the content cache.** Derive positions from camera/world coordinates each navigation frame; keep dot radii and line thickness in screen pixels and align correctly for DPR. Cover only the viewport. Estimate: one extra RGBA viewport buffer is about 6 MB at the measured profile, excluding browser/GPU copies.
2. **Blend grid levels gradually.** Use a shared world-anchored hierarchy with compatible levels, controlled opacity and hysteresis. Dots/lines enter and leave smoothly around density thresholds. Avoid a visible whole-pattern replacement or brief doubled darkness at intersections.
3. **Keep scientific coordinates separate.** Decorative density adapts for comfortable navigation. A lab's labelled axes/rulers retain known physical units and scale, with readable tick spacing and labels. Never use decorative dots as a hidden physical ruler.
4. **Preserve bounded work.** Retain ink caching, then evaluate spatial indexing/tiled invalidation for rebuild spikes. Reuse immutable geometry caches. Bound pixel memory explicitly, especially at high DPR; the current minimum cache margin can exceed its nominal 40-million-pixel target on very large profiles.
5. **Make input policy explicit.** Preserve pointer-anchored zoom and existing pinch math; test wheel modes and modifier behavior, fit/reset, fractional DPR, toolbar animations and content/overlay alignment. Change gesture sensitivity only after actual device feedback.

Smooth background adjustment is achievable without increasing the zoom range or constructing a huge bitmap. The appropriate result is a measured implementation with regression gates, not a promise of unlimited complexity at a fixed frame rate.

## Existing engines and reuse

| Option | Assessment for this app |
|---|---|
| **Improve our current engine** | Recommended first. Fixes are localized and retain pen/overlay, document formats, native agent commands and editable recordings. We control the scientific object/runtime boundary. |
| **Excalidraw** | A real permissively licensed alternative: the [official repository](https://github.com/excalidraw/excalidraw) describes an MIT-licensed infinite-canvas editor with pan/zoom and an embeddable React package. Consider an isolated migration spike only if measured renderer limits remain; its object model, React integration, recording and custom labs need adaptation. It is not a drop-in background fix. |
| **tldraw** | Useful engineering reference and a possible SDK choice. Its [performance documentation](https://tldraw.dev/sdk-features/performance) describes spatial indexing/culling, cached geometry, detail control and debounced zoom. Its [custom grid example](https://tldraw.dev/examples/custom-grid) demonstrates a separate DPR-aware camera-driven canvas. The [current SDK licence](https://tldraw.dev/community/license) is source-available and requires an appropriate production licence; it is not a permissive open-source substitution. |

No upstream source code or package was copied/installed in this audit. If we later reuse implementation code, pin the revision, retain its licence/notices and validate our actual pen, overlay, replay and simulation workflows.

## Implementation acceptance gates

- Dot radius and line thickness remain stable during slow, fast and continuous zoom, including an expensive content cache. Density transitions are visually unobtrusive in both directions and both themes.
- World anchoring is stable while panning/zooming through negative coordinates and across grid levels. Pointer, pinch and fit operations preserve their intended anchors; content and overlays agree.
- Repeat empty, 500-object and dense stress cases, reporting long-frame outliers as well as p95. Check memory ceilings and supported DPR/window sizes. Test at least one lower-end classroom device before broad performance claims.
- Verify native pen/touch/trackpad feel and screen sharing; do not reintroduce the known capture problems from desynchronized canvases.
- Existing source checks for document editing, save/recovery, agents, laser and replay continue to pass after the production renderer changes.

This is **S0** of the [separate science roadmap](SCIENCE-ROADMAP.md). It should precede continuous physics animation, which will need its own live rendering layer and bounded runtime.
