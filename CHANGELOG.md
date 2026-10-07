# Changelog

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
