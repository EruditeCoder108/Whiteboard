# Square-grid refinement — 2026-10-08

The user supplied zoom captures of the app and Miro Lite and asked to prioritize the square grid. This refines the local S0 renderer already in the working tree. No upstream renderer code was copied.

## Result

- Neutral grey graph paper: reference-line opacity is 7.5% on light boards and 16% on dark boards. Subdivisions are fainter while entering or leaving. The selected board colour is preserved.
- At 100%, 20-world-unit subdivisions and an 80-world-unit reference lattice. Adaptive levels keep fine spacing between 8 and 32 CSS pixels and retained spacing between 32 and 128 CSS pixels across 5%–1600%; crowded subdivisions fade away. This is decorative graph paper, not calibrated scientific axes.
- Levels share the world origin. Negative coordinates, distant views, reverse zoom and pan use deterministic camera calculations. One-CSS-pixel strips retain continuous subpixel motion.
- The complete fine lattice is painted first; a compensated source-over pass tops up reference lines. This fixes the reproduced darker intersections and their visible change at density boundaries. At each boundary only one pass remains.
- Grid pixels remain independent of ink-cache scaling. A resolution media-query listener refreshes all three canvases when DPR changes without a CSS-size change, re-arms itself and is removed on unmount.
- Dots retain their existing implementation and setting; removing them was unnecessary for this square-grid work.

## Verification

`npm test -- --maxWorkers=1 --testTimeout=15000`: **164 passed**. TypeScript checking and source build passed.

`node e2e/square-grid.mjs` / `npm run e2e:grid`: **30 checks passed**, covering 12 zoom values, light/dark boards and DPR 1, 1.25, 1.5 and 2, plus preview/settled equality, camera translation, distant views, clearing, renderer exceptions and automatic display-scale refresh. Electron uses a disposable profile and an input-isolated test window.

Raster gates: reference-line alpha-weighted width stays within 12% of intended CSS width/opacity; boundary changes remain within one 8-bit alpha code at every pixel; visible horizontal/vertical line centroids match within 0.26 physical pixels. Centroids omit subdivisions below four total alpha codes or 10% of reference-line coverage because near-invisible coverage is dominated by quantization. Exact world-lattice continuity is also checked in unit tests. An initial point-by-point axis-opacity assertion was replaced with geometric centroids because Canvas antialiasing differs by orientation; grid positions were not changed to pass this check.

Chromium emulation changes real resolution while retaining CSS viewport dimensions to exercise the mounted resolution listener. Synthetic DPR overrides separately exercise production resize/rendering at four scales. A physical move between Windows displays remains a manual check.

`node e2e/canvas-audit.mjs`: **13 existing checks passed**, including dot preview size, line thickness, density transitions, Ctrl+wheel, wheel pan and pinch. The low-contrast transition gate now recognizes changes limited to one 8-bit alpha code and includes the square-grid boundaries. The harness also runs historical scripted content benchmarks; this task makes no new compositor-FPS or dense-board performance claim.

See [zoom overview](grid-qa/square-overview.png), [100% light](grid-qa/square-light-100.png), [1600% light](grid-qa/square-light-1600.png), [100% dark](grid-qa/square-dark-100.png) and [pixel results](grid-qa/square-grid-results.json). Captures are production canvas pixels; the overview crops them at native CSS spacing.

The source app is rebuilt locally. A currently running older process needs reopening to load the new build. Packaged-release signing, physical pen/trackpad feel and very dense content-cache stalls are outside this refinement's verified results.
