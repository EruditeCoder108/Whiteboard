# Three deeper offline science showcases

Implemented 2026-10-12 in `app`, on `main` at source HEAD `5cb4c02` with pre-existing local changes preserved. No commit/push or live-profile migration. The original eleven lab IDs/model definitions remain available. The three new native entries have separate IDs and model version 1:

| Showcase | Interaction and illustration | Scientific boundary |
|---|---|---|
| `flux-studio` / Induction studio | Enamel bar magnet, layered copper coil, field guides, signed meter, SI position/velocity/flux and voltage graph. Finger or mouse drag records a position-time trace; replay follows that trace. | Gaussian flux per turn, width 0.13 m; Faraday derivative exact for this prescribed envelope. Piecewise-linear hand positions, no field solver or circuit load. Meter needle saturates illustratively; numerical voltage stays exact for the model. |
| `indicator-studio` / Colour chemistry studio | Glass flasks lift, tip, pour and return to the bench. Liquid stays horizontal while glass rotates. Streams join the neck to the current meniscus. Bubbles are clipped to both vessel and liquid, and appear only after recent CO₂ formation. Continuous approximate pH palette, amount readouts and lesson stops. | Vented ideal dilute acetic-acid/bicarbonate mixture at 25°C. 20 mL initial indicator/water; liquid and stoichiometric amounts conserved. Fixed-iteration charge-balance pH calculation. Fluid shapes, mixing, bubble motion and indicator palette are illustrations, not CFD, kinetics or a calibrated colour test. |
| `heart-studio` / Inside the heartbeat | Original vector cutaway of four chambers, thicker left-ventricular wall, septum, valve leaflets, chordae, contraction and two guided circuits. Four lesson stops and adjustable illustrative bpm. Dark/bright red encode oxygen content. | Human double-circulation teaching diagram. Front-view left is the person's right. Phase durations, flow-marker travel and normalised chamber filling are qualitative, not measured pressure/volume or diagnostic physiology. Inlet and outflow valves never open together. |

These are richer **native 2D illustrations**, not imported 3D assets. Runtime needs no external asset downloads, API or network. No new production dependency was added. Chemistry and heart teaching references: [ACS cabbage indicator](https://www.acs.org/education/activities/red-cabbage-indicator.html), [NIH/NHLBI blood flow](https://www.nhlbi.nih.gov/health/heart/blood-flow) and [heart anatomy](https://www.nhlbi.nih.gov/health/heart/anatomy). A public-domain NIH BioArt heart was downloaded only as a temporary anatomy reference; its SVG is not bundled or represented as our cutaway.

## Lifecycle and structure

`showcase-models.ts` defines pure state, input schemas and trace validation. Separate `flux-studio.ts`, `indicator-studio.ts`, `heart-studio.ts` render through the shared `Studio` drawing helpers. Native board rendering, frozen lesson frames, thumbnails and PNG export use the same scene functions. Graph sample caches follow immutable lab identity.

An optional bounded `gesture` belongs only to the induction studio: 2–800 strictly increasing `{t,x}` samples, 0–30 s, ±0.34 m. The final stationary segment makes release stop voltage. One drag commits one native history transaction; cancellation commits nothing. Item-aware state/duration are shared by runtime, transport, freeze, defensive parsing and semantic reads. Presentation edits preserve transient clocks; changing scientific inputs or recorded motion resets them. Unknown/old labs retain their established compatibility behavior.

The library initially features three showcases; **Browse all**, search/subjects/topics and **On this board** reach all fourteen experiments. Inspector lesson stops seek without mutating saved content. Play/pause, step, scrub, freeze-and-annotate, undo, native save/reopen and PNG remain ordinary board workflows. Continuous science playback is still not recorded as a lesson timeline; a committed hand trace and frozen edits are captured as native edits.

## Verification

- TypeScript and production build pass.
- **211 unit checks / 15 files pass**: independent Faraday numerical derivative, stopped/doubled-turn invariants, long-trace save/replay/clamping, malformed trace rejection, reaction volume/reactant conservation including extreme amounts, phase/valve invariants and existing editor/storage/agent/replay checks.
- **30 showcase Electron checks pass**, disposable input-isolated profile; [results](showcase-qa/results.json). Finger drag, coalesced final pointer-up, one-step undo/redo, cancellation, transient playback, lesson stops, step/freeze, deterministic rendered pixels after backward seeks, pen annotation, existing ink preservation, actual PNG decoding, disk save and fresh-process reopening. Minimum-window bounds and fully reachable insertion action checked. External requests blocked; zero requests and uncaught renderer errors.
- **94 full-library checks pass** for all fourteen entries and compact navigation; [results](showcase-qa/library/library-results.json). Historic eleven-entry evidence is retained in `science-qa/`.
- **44 original projectile, 46 drawing/touch, 40 agent and 30 lesson-replay checks pass**, including native ink preservation, object lifecycle, loopback transaction validation, editable recording/replay and actual WebM decoding. Source total: **495 checks**. Older recovery/object/laser integration suites were not rerun in this slice; their related unit suites passed.
- **30 packaged-runtime checks pass** against `dist/showcase-preview/win-unpacked/Floating Whiteboard.exe`; [results](showcase-qa/packaged-results.json). Same offline, gesture, graph, PNG, disk-save and restart workflow. Combined source/packaged total: **525 checks**. NSIS setup and portable launcher files were built; neither wrapper was installed/launched as a user on a second PC.
- **Nine live data files are byte-for-byte unchanged**, including board, five backups, recordings/backup and MCP adapter; hash comparison retained only in the local ignored QA report. All 41 pre-existing staged paths remain staged; HEAD remains `5cb4c02`. Legacy regression screenshots in `e2e/shots` were restored after QA, leaving prior evidence intact.

## Windows preview packages

`npm run dist:showcase` builds x64 NSIS setup and a single-file portable launcher in the separate ignored `dist/showcase-preview/` folder. Both package Electron **44.5.1**, local renderer code and the optional MCP adapter. Historical release outputs are untouched. [Package hashes, sizes and Authenticode results](showcase-qa/packages.json) identify the actual files. Both have **NotSigned** status; the builder's generic “signing” log is not proof of a signature. No signing credentials were supplied.

Only the unpacked packaged runtime was launched with a disposable `--user-data-dir`; the user's installed app was not restarted or replaced. Packaged success on this machine does not establish Windows trust or hardware behaviour on another PC. [Installation/board-transfer instructions](INSTALL-ON-ANOTHER-PC.md) explain setup vs portable, OS/architecture and the bundled-runtime boundary.

Visual inspection covers acid pour, base pour/reaction, final result and all four heart stages, with paper/blueprint captures under [showcase-qa](showcase-qa/). The raised flask initially covered a heading; the heading was moved outside the pouring area. Bench contact, stream connections, fluid level, bubble confinement, labels and graph cursors were inspected at native 1000×640 resolution.

All QA uses explicit disposable profiles; UI captures briefly show a non-focusable, mouse-ignoring window beyond every connected display. Nothing selects/restarts the live board. See [installation instructions](INSTALL-ON-ANOTHER-PC.md) for the standalone preview packages.

Not established: physical pen/finger feel, another-PC installation, lower-end performance, screen-sharing responsiveness or expert curriculum/anatomy review. The motion graphs do not claim calibrated fluid or physiological simulation. Trusted Windows signing remains unresolved.
