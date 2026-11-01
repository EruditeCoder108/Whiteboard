# Changelog

## 1.6.0-beta.5 — My lessons, autosave, page sections — 2026-11-01

- **Every lesson saves itself.**
  - Each lesson is its own file in **Documents › Floating Whiteboard › Lessons**, written a moment after every change and again when the app closes.
  - There is no more "Save first?" question when starting or opening another lesson.
  - A board that never had a file gets one as soon as something is drawn, named after the date.
  - Ctrl+S still saves at once, and **Save a copy…** puts the lesson anywhere else.
  - The menu shows *Saved*, *Saving…* or *Not saved*.
- **New lesson** asks for a name (a chapter or topic), an optional subject or class (recent ones are one tap away) and Notebook or Canvas.
- **My lessons** (More menu, or Ctrl+O):
  - every lesson in a full-screen view, filed under its subject, newest first;
  - each card shows a picture of the first page, the date and the number of pages;
  - search by name or subject;
  - open, rename, change subject, make a copy, show in folder, or delete (to the Recycle Bin, so it can be restored);
  - lessons kept elsewhere on the PC appear too once they have been opened here.
- **Page sections.** In the page sorter, start a section at any page ("Warm-up", "Example", "Practice"). Headings show how many pages each section holds, can be renamed or removed, are saved in the lesson, and carry through notebook ⇄ canvas.

## 1.6.0-beta.4 — board surfaces — 2026-11-01

- **Boards that look like real boards.** The Background & paper sheet starts with eight surfaces:
  Whiteboard, Chalkboard, Green board, Slate, Navy board, Paper, Brown paper and Cool grey.
  - A chalkboard shows soft clouds of old chalk, faint eraser sweeps and a fine grain. Slate has
    mineral flecks; paper has faint fibres and gentle unevenness.
  - Textures are quiet, so writing stays clear, and the grain stays fine at any zoom.
  - **Texture** (Smooth, Chalk, Slate or Paper) and **Own colour** combine, so any colour can be a chalkboard.
  - Surfaces apply to the whole lesson, or to **Only this page**.
  - The surface is saved in the lesson, appears in pictures and PDFs, and fades with the board in "write over screen".
  - Textures are made in code: no image files, the same on every PC, and seamless (no visible repeat).

## 1.6.0-beta.3 — Background & paper (Note 3 deep dive §6) — 2026-11-01

- **Writing papers no longer stretch or crowd when you zoom a canvas.** Ruled, four-line, Hindi and
  music paper on the open canvas now follow the zoom, the way Squares does. Zoom in and finer bands
  fade in; zoom out and every other band fades away. The lines stay a comfortable distance apart and
  never become a solid block. Notebook pages and frames keep their paper fixed to the page, so they
  match the printout, and crowded lines fade out instead of piling up.
- **Every paper can be adjusted.**
  - **Spacing:** Small, Medium or Large, with − / + steps from 50% to 300%.
  - **Strength:** Faint, Normal or Strong.
  - **Line colour:** pick one, or keep the usual. Margins and baselines stay red.
  - **Restore the paper as designed** brings back the original settings without touching the writing.
  - The settings apply to this page, or to all pages with **All pages**.
  - New lessons start with your last choice.
  - Paper changes can be undone, and a run of adjustments counts as one change.
- **New papers:** isometric dots and an isometric grid for drawing solids. **Lesson layouts:** two
  columns (compare / contrast), three columns (predict / observe / explain), worked example and exit
  ticket.
- **Graph paper redrawn.**
  - Fine lines fade out smoothly as you zoom out, instead of disappearing at once.
  - Lines move smoothly instead of snapping to whole pixels.
  - Crossings are no darker than the lines themselves.
  - It keeps a fixed scale, because it's for measuring.
- **A picture behind the writing.**
  - Choose a picture file, or turn a selected picture into the background with **Use selected picture**. For example, import a PDF worksheet, select its page, and tap it.
  - Show the whole picture or fill the page (never stretched), pick its position and strength, and on a long page choose the first screen, every screen or the whole page.
  - The picture is copied into the lesson, so the USB stick can go.
  - It survives saving, reopening, copying a page, notebook ⇄ canvas, thumbnails, PNG and PDF.
  - Erasing and *Clear ink* leave it alone, and the message says so. Removing it can be undone.
- The paper picker shows the page in view with its writing and a live sample on every paper tile,
  painted by the same code as the board.
- **Share to phones** (Export → Share to phones).
  - The board PC shares the lesson PDF on the school Wi-Fi with a big QR code and a link students can type.
  - Nothing goes to the cloud, but phones must be on the same network.
  - The link lasts 30 minutes, shows how many phones downloaded it, and stops with **Stop sharing**, closing the panel, opening another lesson or quitting.
  - Only that one PDF is reachable, behind an unguessable link.
  - The panel explains guest Wi-Fi and firewall problems and keeps **Save PDF instead** one tap away.
  - Built by a second agent from a written brief, reviewed and merged.

## 1.6.0-beta.2 — lesson integrity (Note 3 deep dive F1–F6, F9) — 2026-11-01

- **A lesson now carries how it looks.** The board colour is saved in the lesson (with an optional
  colour for a single page) and every page keeps its paper, its own paper start point and a name.
  A dark lesson opens dark on any computer, and opening it no longer changes your own default.
  Your last choice of colour and paper is what *new* lessons start with.
- **No more silent loss.** A plain canvas with a paper is saved in the format that keeps it.
  Turning a notebook into a canvas and back keeps each page's paper, colour and name, and keeps the
  paper lines lined up with the writing.
- **One file convention:** Ctrl+S saves the *lesson* (it asks where the first time, then overwrites
  the same file), Ctrl+Shift+S saves a copy, Ctrl+O opens, Ctrl+N starts a new lesson, Ctrl+E
  exports. The smart board's **More** menu has big New lesson / Open / Save lesson / Export tiles,
  and Open lists your recent lessons. New and Open ask before dropping unsaved work, and keep the
  replaced lesson as a recovery backup.
- **Pictures and PDFs match the board.** A PNG of the page includes the paper and board colour (or
  ink only on a see-through background); choose this page, everything, or the selection. A PDF of a
  page lengthened with "more space below" gives one readable sheet per screen. Blank pages with
  paper still print.
- **Page changes can be undone.** Deleting, moving or copying a page, removing a frame, turning the
  board into a notebook/canvas, and changing colour or paper bring up an *Undo* button (also Ctrl+Z
  and the page sorter). The offer ends as soon as something else changes. Pages can be named in the
  page sorter, and the name is saved.
- Paper picker: board colour for the whole lesson or "Only this page"; paper for this page or
  "All pages".
- Older settings and files keep working: the board colour and paper from before become the defaults
  for new lessons; files saved before this version open with your current colour.

## 1.6.0-beta.1 — smart board mode (Track A2) — 2026-11-01

- First launch asks "Smart board or laptop?". Smart board opens full screen with a bottom toolbar:
  labelled tools, six high-contrast inks (chalk colours on dark boards), three one-tap sizes,
  undo/redo, pages and a **More** menu of large tiles. The toolbar moves to the teacher's side;
  tabs on both edges bring the menu to whoever is standing there. Zoom %, pin and pass-through are
  tucked away; the save status shows only when saving fails.
- **Notebook and Canvas are separate kinds of board**, saved with the board. A notebook is a stack
  of fixed pages at one size (no zoom, no panning), turned with a two-finger swipe, Back/Next,
  PgUp/PgDn or a clicker, with a short slide; *More space below* lengthens a page and a page map
  scrolls it. A canvas is one endless board with optional numbered **frames** stepped through like
  slides. Converting lays pages out as frames and back, losing nothing.
- Page sorter with thumbnails: go to, reorder, duplicate, delete, add (frames on a canvas).
- Page paper per page: ruled, four-line English, Hindi lines, mm graph paper, squares, dots, music.
- Palm erase: a palm, fist or hand edge wipes like a duster, judged against the fingertip size
  learnt on this screen; optional calibration in Settings.
- Soft pen: on touch panels without pressure, ink width follows writing speed.
- Subjects drawer (Maths, Physics, Chemistry, Biology, English, Hindi) and a chalkboard theme.
- PDF import puts each PDF page on its own sheet (page or frame); PDF export of a notebook keeps
  whole sheets with their paper, blank ones included; a framed canvas exports one page per frame.
- Fixes: pen prediction no longer flickers ahead of the mouse; e2e test windows stay off-screen.
- The interface stays in English; Hindi lives in the content.

## Unreleased — teaching essentials (Track A) — 2026-10-31

- Laser: fix sections of a fast scribble vanishing and reappearing. The trail is now painted in short
  time slices with per-pixel "newest wins" compositing, so it fades by age along the path.
- Pictures: paste (Ctrl+V), drag-and-drop or Insert → Picture. Large images are downscaled to
  2400 px and stored as WebP. Autosave writes each picture once as a content-addressed file
  (`assets/`), so board.json stays small; unused pictures are cleaned up after a day.
- Pages: page bar, PgUp/PgDn (presentation clickers), per-page camera and undo history.
  Board format 4 stores pages and a shared picture table; formats 1–3 still open.
- PDF worksheets: each PDF page becomes a board page with the page locked underneath, ready to
  annotate. Export all pages as one landscape-A4 PDF.
- Equations: LaTeX with live preview and a symbol palette, including chemistry (`\ce{…}`); the
  equation follows the pen colour and stays editable (double-click).
- Graphs: plot up to five functions (`2x^2-1`, `sinx`, `|x|`…) with a safe hand-written parser,
  crisp at every zoom and editable.
- Maths instruments: ruler, set square, protractor and compass. Pen strokes started on an edge
  stay exactly on it; the compass sweeps true arcs at a labelled radius.
- Shape snapping: hold the pen still at the end of a stroke to turn a rough line, circle,
  rectangle, diamond or triangle into a clean one.
- Presenter tools: spotlight, drag-to-reveal curtain, countdown/stopwatch timer with chime.
- Devanagari and other Indian scripts use Nirmala UI consistently on the board and in editors.
- Performance: hit-testing rejects by cached bounds first; pen ink is drawn one predicted sample
  ahead to hide display latency.
- New dependencies: pdf.js 4.10.38 and MathJax 3.2.2 (Apache-2.0), loaded on first use.
- Essential checks: `npm run e2e:track-a` (15), plus the existing drawing, laser, objects,
  recovery, replay and agent suites and 212 unit tests.

## 1.5.0-beta.1 — 2026-10-27

- Package the fourteen-experiment science preview for public Windows x64 downloads, as separate
  installer and portable EXEs. Add a reproducible `dist:preview` command and direct README links.
- Include the regenerated logo, GPLv3 licence and retained dependency notices in the packaged app.
  Publish source, checksums and explicit unsigned-prerelease limitations with the release.
- Add the README animation gallery, chemistry cover, editable repo card and 50+ lesson collection
  plan. The historical implementation and QA notes below describe the included science work.

## Unreleased showcase preview — 2026-10-12

- Add three separate native studios while preserving the original eleven models: finger-driven induction with saved hand-motion replay, illustrated glass apparatus with connected pouring streams and confined CO₂ bubbles, and a four-chamber heart cutaway with valve/contraction stages.
- Feature the three showcases in the compact library; retain Browse all, search and on-board navigation. Add guided lesson stops, explicit approximations and shared paper/blueprint illustrations for the board, thumbnails, frozen frames and PNG.
- Validate recorded position/time inputs and use item-aware clocks, freeze, parsing and semantic state. A hand movement is one undo transaction; playback is transient and offline.
- Add scientific/reference and disposable workflow evidence in `docs/SCIENCE-SHOWCASE-QA.md`; build installer/portable previews separately with `npm run dist:showcase`. These previews remain unsigned; see `docs/INSTALL-ON-ANOTHER-PC.md`.

## Unreleased — 2026-10-08

- Expand to eleven native offline experiments: seven physics, three chemistry and one biology, including pouring flasks, cabbage-indicator colour changes and CO₂ bubbles. Model-specific controls, deterministic state, graphs and explicit assumptions share the existing transport, undo, freeze, save/reopen and PNG lifecycle.
- Replace the single-entry Science panel with a searchable responsive Animation library, subject/topic filters and an On this board list. Fix the stretched insertion-button icon and keep actions accessible in compact windows.
- Add native stitched baseball props and Explore/Explain views. New labs start with fewer technical details; existing saved reveals remain. Add 18 model/reference tests and a 78-check disposable offline library workflow; see `docs/SCIENCE-DEMO-QA.md`.
- Add a native offline projectile lab with deterministic SI equations, a draggable launch vector, numeric/range controls, launch/gravity presets and labelled assumptions/units.
- Render paper/blueprint frames with travelled/future trajectories, equal-time markers, velocity components, synchronized height/vertical-velocity graphs, conserved-energy readouts, equations and a complementary-angle comparison.
- Add play/pause/reset, 1/30-second stepping, exact scrubbing, apex/impact checkpoints and deliberate freeze-and-annotate. Animation creates no document objects or undo entries; offscreen labs pause and one lab plays at a time.
- Integrate select/move/uniform resize/duplicate/group/lock/order/undo, frozen-time save/reopen/recovery and current-frame PNG export. Lab-containing boards use format 3; ordinary boards retain format 2. Unsupported models display a compatibility placeholder without recalculation.
- Include compact SI lab summaries in semantic reads and frozen lab edits in replay format 2. Continuous scientific animation recording and dedicated model transport commands remain future work.
- Add analytical references and disposable Electron teacher-workflow checks; see `docs/PROJECTILE-LAB-QA.md`.
- Refine square graph paper with neutral low-contrast lines, smooth four-way subdivisions and consistent density from 5% to 1600%. Compensate overlapping grid layers so intersections do not darken at density boundaries.
- Refresh viewport canvases when display scale changes without a window-size change. Add square-grid pixel checks at 100%, 125%, 150% and 200% display scaling.
- Render decorative dots and line grids on an independent viewport canvas, keeping their size sharp during expensive ink-cache zoom previews.
- Fade compatible, world-anchored grid subdivisions smoothly in both directions; retain continuous subpixel pan positions and fractional-DPR rendering.
- Background/theme changes no longer rebuild committed ink. Avoid redundant background painting during document edits and remove the forced minimum cache margin on large screens.
- Add production grid pixel/gesture/performance checks in disposable Electron profiles.
- Update pixel QA probes to identify the live canvas explicitly after adding the background layer.

## 1.4.0 — 2026-10-07

- Record manual and agent board edits as compact, timed, editable steps; pen/highlighter strokes retain point timing and pressure.
- Pause/resume recording, save a local lesson library, export/import reusable `.wbrp` files, and flush recordings on close.
- Play/pause, scrub, change speed, restart and step forward/backward in a separate preview; the working board and history remain intact.
- Add a finished diagram or the current frame to any board with fresh object/group IDs in one undo step.
- Export silent, seekable 1280×720 WebM video with cancellation and explicit frame encoding, independent of whether the window is visible.
- Add native `whiteboard_replay` MCP controls, keeping agent transaction labels as teaching steps.
- Prevent compact shape labels from clipping by adapting padding and fitting rendered text inside their existing geometry.
- Add a signed-release build command that fails when signing credentials are missing; document the Windows app trust block found during release checks.

## 1.3.0 — 2026-10-07

The whiteboard now has native agent commands and useful creation tools without requiring an OpenAI key.

- Agent panel with offline planning/comparison starters and selection arrangement; all objects remain editable.
- Compact board reads and atomic create/update/move/layout/group/remove batches, with stable IDs,
  targeted long-text reads, revision checks, lock protection, previews, undo and retry protection.
- Opt-in local MCP connection for external agents, with a bundled stdio adapter and copied configuration.
  It starts off each session, binds to loopback, authenticates requests and closes when disabled.
- Optional local or compatible API assistant with model discovery, Chat Completions/Responses formats,
  draft thumbnails, explicit application and cancellation. No model or account is required for the board.
- Optional keys use main-process encrypted storage, are omitted from renderer configuration, and are
  cleared when the configured endpoint changes. Model requests have bounded output and retry limits.

Native board format remains version 2. Validation and provider-test limits are recorded in
[release verification](docs/RELEASE-1.3.0-QA.md); setup and examples are in
[agent integration](docs/AGENT-INTEGRATION.md).

Validated: TypeScript and portable packaging passed; 147 unit tests, 46 drawing checks,
22 recovery checks, 35 object checks, 14 laser checks, 40 packaged agent checks,
7 packaged core checks, 10 actual portable checks and 31 Windows input/capture checks passed.

## 1.2.1 — 2026-10-07

- Laser trails now paint as continuous smoothed paths, eliminating the beaded segment joins
  visible during average and slow movement. A continuous colour gradient handles fading,
  with the same thin core, compact halo and exact pointer endpoint.
- Added pixel checks for opacity spikes at sample joins and a slow curved-motion screenshot.

Validated: 133 unit tests, 46 drawing UI checks, 22 recovery checks, 35 object editing checks,
14 laser checks, 7 packaged checks and 7 actual portable launcher checks passed.
See [release verification](docs/RELEASE-1.2.1-QA.md) for evidence and measurement limits.

## 1.2.0 — 2026-10-07

Phase 2 turns ink and shapes into editable visual content and repairs the laser pointer experience.

- Inline text and sticky notes with wrapping, colour, size, bold/italic, alignment and lists.
- Shape labels, fills, opacity, solid/dashed/dotted borders, rounded rectangles, diamonds and triangles.
- Resize and rotation handles, proportional transforms, keyboard nudging and fit selection.
- Persistent groups, independent group duplication, locking, front/back order and lasso selection.
- Object copy/paste within the app, copy/paste style, and contextual controls that handle mixed selections.
- Text side resizing keeps font size and reflows content; text and notes grow to avoid clipping.
- Format version 2 round-trips every object style while reading earlier Electron and Python boards.
- Draft typing participates in autosave and shutdown flushing. New objects render in PNG output.
- Scrollable context controls and a compact dock fit the minimum window; rotation grips stay accessible.
- Thin, fixed laser core and compact halo replace the broad overlapping layers. Separate touch contacts
  and pointer re-entry start fresh paths; lift endpoints and coalesced hover samples are retained.
- Laser trails no longer drop 80-point batches at 400 samples. Smooth expiry, stale-sample protection
  and head cleanup prevent dense-trail flicker, backward jumps and a stuck pointer after tool changes.
- Touch laser works with finger ink drawing disabled. Laser content stays transient and unsaved.

Validated on Windows: 133 unit tests, 46 drawing UI checks, 22 recovery checks, 35 object-editing checks,
12 laser checks and 31 Windows-injected input/capture checks passed. The packaged 1.2.0 app passed
the 35 object workflows, 12 laser checks and 7 version/save/close checks. See the 1.2.1 entry for the
subsequent slow-motion laser refinement.

Version 2 board files require app 1.2 or later; earlier board files continue to open here.

## 1.1.0 — 2026-10-06

Phase 1 builds on the Electron app with reliability and everyday editing improvements.

- Confirmed, serialized atomic autosaves; shutdown waits for board, settings and window writes.
- Visible save status and retry; failed saves keep the window open with unsaved work intact.
- Five rotating recovery snapshots, an undoable restoration panel, automatic recovery on startup,
  and retention of damaged originals before replacement.
- Pan/zoom persistence and flushing of pending preferences on immediate close.
- Selection colour and thickness controls; undo/redo retains the full selection, including objects
  that already matched the chosen style.
- Python v10 board import, including conversion of XY pairs and variable-width stroke samples.
- Strict format/version, colour, coordinate and pressure checks; validated and bounded settings.
- Configurable radial-menu hold delay and an option to disable hold activation.
- Scrollable popovers for small windows, labelled toolbar controls and explicit file-operation errors.
- Regression tests for disk failure/retry, save races, corrupted-file recovery, mixed selection edits,
  legacy import, immediate close, minimum-size windows and preservation of unrecoverable originals.

The board file format remains version 1; existing Electron boards continue to open.

Validated on Windows: TypeScript checking and portable build passed; 44 unit tests,
46 existing Electron UI checks, 22 phase 1 UI checks, and 7 packaged-app checks passed.
The phase 1 checks include an actual filesystem write failure and subsequent retry.

## 1.0.0

Initial Electron/TypeScript implementation, with pen/touch drawing, shapes, erasing, radial menu,
transparent overlay, pass-through controls, undo/redo and image/board export.
