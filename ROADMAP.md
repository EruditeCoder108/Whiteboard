# Floating Whiteboard product roadmap

Planning date: 2026-10-06. Baseline: Electron app 1.1.0.
Status: Phases 1 and 2 complete; native agent foundation delivered in 1.3.0; recording/replay delivered early in 1.4.0. Remaining work in Phases 3–6 is planned.

The separate [science and teaching roadmap](docs/SCIENCE-ROADMAP.md) describes the physics-first expansion beyond the editor/workspace scope here. Its first milestone is the [canvas quality improvement](docs/CANVAS-AUDIT.md); science milestone labels do not replace this roadmap's proposed release numbers.

## The final product

**A fast, offline Windows whiteboard for teaching, annotating and visual thinking: natural ink, editable content, connected diagrams and reusable lessons in one portable local workspace.**

The same document supports three views:

| View | Purpose |
|---|---|
| Board | Create on an opaque canvas with ink, text, notes, diagrams, images and PDF references. |
| Overlay | Write over other applications using transparency, always-on-top controls and pointer pass-through. |
| Presentation | Navigate pages or framed sections, reveal prepared steps and use the laser with minimal interface. |

These views share content and undo history. Switching views should not require copying work into a second document. Ordinary drawing starts immediately; the board library and advanced tools do not become mandatory steps.

The proposed finished milestone is **2.0**. Intermediate version numbers and dates should be assigned as implementation scope becomes clear. Each phase must deliver a usable, tested build; the product does not need to wait until 2.0 to be useful.

## Product rules

- Preserve fast pen input, pressure, smoothing, palm rejection, two-finger navigation, barrel-button erasing and radial shortcuts.
- Keep the interface quiet: a small main toolbar, contextual object controls and optional side panels.
- All core workflows work offline without an account. Local save, recovery and portable files remain central.
- Text, diagrams and notes stay editable through export to our native format, reopening, duplication and undo.
- Object editing behaves consistently across ink, shapes, text and later assets. Some objects may expose different capabilities, but common actions use the same interaction model.
- Every new persistent feature includes schema validation, migration, undo/redo, save/reopen and export behavior.
- Prefer useful workflows over counting icons. Miro Lite is an interaction reference, not evidence of every capability in the full Miro product.

## Phase overview

| Phase | Release outcome | Main additions | Exit demonstration |
|---|---|---|---|
| 1 — Reliable foundation | Completed in 1.1.0 | Confirmed saves, recovery, safer imports, selection styling, configurable hold menu. | Recover work, retry a failed save, import a legacy board and edit without losing selection. |
| 2 — Complete object editor | Completed in 1.2.0 | Text, sticky notes, shape labels/styles, resize/rotate, groups, locking, order, lasso and contextual controls; laser repairs. | Create a labelled sketch with notes; group, transform, duplicate, save, reopen and edit it. |
| Native agent foundation | Completed in 1.3.0 | Compact semantic reads, atomic edits/layout, local MCP, offline starters and optional local/API assistant with drafts. | An external agent creates editable objects without a whiteboard API key; undo restores the previous board. |
| Lesson recording | Completed in 1.4.0 | Timed editable recordings, progressive ink, playback controls, local library, portable steps, frame reuse and silent WebM export. | Record a lesson, replay it, reopen the saved steps, and insert its final diagram on another board. |
| 3 — Connected diagrams | Build diagrams that survive rearrangement | Attached connectors, routing, arrowheads, labels, alignment, snapping and diagram starters. | Rearrange a flowchart or mind map while keeping its connections intact. |
| 4 — Local workspace and references | Prepare and organize complete boards | Named boards, pages, thumbnails, image paste/import/crop, locked references, portable assets and navigation. | Reopen a multi-page board on another machine with its images and editable objects intact. |
| 5 — Teaching and presentation | Deliver a prepared lesson | PDF annotation, typed equations, lesson backgrounds, frames, presentation navigation and step reveal. | Import a worksheet, prepare explanations and present the lesson from start to finish. |
| 6 — Export and finished release | Ship a dependable 2.0 product | Export preview/scopes, high-quality PNG/PDF, reusable templates, accessibility and release hardening. | Export a complete lesson, inspect the result, reopen the native file and resume editing. |

Basic export must support new objects in every phase. Phase 6 expands export choices and completes the release; it is not the first point at which new content can be exported.

## Phase 1 — Reliable foundation: complete

Delivered in 1.1.0: serialized atomic saves; visible save completion and retry; five recovery snapshots; startup recovery and preservation of damaged originals; view/settings persistence; undoable selection styling; Python v10 import; validation; configurable radial-menu hold timing; small-window popover fixes.

The changelog records TypeScript/build validation and 119 automated checks. Those are prior release results, not a new test run for this roadmap. Physical pen/touch checks must be refreshed as input behavior changes.

## Phase 2 — Complete object editor: complete

Delivered in 1.2.0 through the three increments below, with format version 2, backward reading of old
boards, undoable edits, PNG rendering and save/reopen checks. The laser audit also delivered a thinner
core, separate touch paths, dense-input stability and consistent cleanup.

Release 1.2.1 refined average/slow laser motion into continuous smoothed paths and added pixel checks
for uneven sample joins. [Verified baseline](docs/RELEASE-1.2.1-QA.md).

**2A: selection and transforms.** Establish shared object bounds and transform behavior; add resize/rotation handles, aspect-ratio constraints, keyboard nudging, front/back order and locking. Single and mixed selections must behave predictably at different zoom levels. Update the native format with explicit migration before adding new saved fields.

**2B: editable content.** Add standalone text with wrapping, font size, colour, bold/italic, alignment and basic lists. Add labels inside shapes and sticky notes with size/colour presets. Add shape fill, opacity, dashed/dotted borders, rounded corners, diamond and triangle shapes. Double-click edits text; typing must suspend drawing shortcuts.

**2C: editing workflow.** Add persistent grouping/ungrouping, duplicate and object copy/paste, lasso selection, copy/paste style and a context toolbar. Show mixed values correctly. Fit selection and useful keyboard shortcuts complete the everyday workflow.

Done when a mixed collection of ink, labelled shapes, notes and text can be selected, grouped, transformed, duplicated, saved and reopened, with every edit undoable. Verify rotated hit-testing, text wrapping, group selection, locked objects and toolbar placement in small windows. Existing PNG output must include the new content.

Defer full layer management and rich document-editor features. Front/back and locking provide the first useful level of control without introducing a large layer interface.

## Phase 3 — Connected diagrams

Agent support grows alongside each phase. Phase 3 adds semantic connector commands and diagram
starters; Phase 4 adds board/page/asset discovery; Phase 5 adds frame and lesson navigation; Phase 6
adds export scopes. Every command uses the same document validation and undo behavior as manual edits.
The assistant and MCP adapter share these commands. Browser WebMCP integration can follow when the
platform API is stable and verified in the app's runtime; local MCP works independently of that API.

Core scope:

- Connectors attach to stable object IDs and connection points.
- Straight and elbow routing, selectable start/end arrowheads and editable labels.
- Move, resize and rotate objects without detaching their connections.
- Quick-connect from a shape to an existing or newly created shape.
- Alignment/distribution, optional grid snapping and temporary guide lines.
- Flowchart and mind-map starters built from editable local objects.

Done when a diagram can be rearranged, grouped, duplicated and reopened without broken endpoints. Duplication must reconnect internal edges to the new objects. Define deletion behavior explicitly: remove incident connectors in the same undo transaction; undo restores the diagram together. Connector endpoint dragging can intentionally detach or reconnect it.

Curved routing, manual bends, obstacle avoidance and line jumps follow only if the core workflow is solid. They are enhancements, not blockers for the first diagram release.

## Phase 4 — Local workspace and references

Core scope:

- Named boards, recent boards, rename, duplicate and recoverable removal.
- Pages with thumbnails, titles, reorder and duplicate; each page retains its view position.
- Clipboard image paste and local image import; aspect-ratio resizing, crop and lock.
- Portable native files containing the document and referenced assets, with safe validation and bounded resource usage.
- Board/page recovery, asset deduplication, fit page/selection and a minimap for larger canvases.

Pages are separate work areas in one document. Frames, introduced in Phase 5, are named regions within a page. Keeping that distinction clear avoids confusing navigation and export choices.

Done when a multi-page board opens on a second machine without relying on image paths on the original machine. Moving, cropping and duplicating reference images must preserve undo behavior and original image data. Verify missing/invalid assets, asset-bearing backups, board switching during a pending save and reopening after interruption.

A recent-board library stays optional: opening the app still gives immediate access to the last board or a blank board.

## Phase 5 — Teaching and presentation

Core scope:

- Import selected PDF pages as reference pages and annotate above them. Preserve the source pages and annotation editability; editing arbitrary PDF source text is outside scope.
- Typed equations with editable source and offline rendering. Start with a useful supported subset rather than a full mathematical notebook.
- Blank, ruled, graph and dot backgrounds; reusable worksheet and worked-example layouts.
- Named frames within a page, an ordered presentation path and a simple way to reveal prepared steps.
- Clean presentation controls, next/previous navigation, keyboard shortcuts and the existing laser pointer.
- Favourite pen/highlighter presets accessible during teaching and overlay use.

Done when a user can prepare a worksheet lesson, switch between board and overlay views, present its pages/frames, annotate live and reopen it without losing equations, references or reveal state. Check screen sharing with the real capture path, as well as physical pen/touch behavior.

Defer OCR, handwriting-to-text, handwriting-to-math, recording and slide-deck import. These require separate accuracy, input or media workflows and should not delay the core lesson experience.

## Phase 6 — Export and finished release

Core scope:

- Export preview with current selection, frame, page or whole-document scopes.
- PNG resolution and background/transparency controls, plus clipboard image output.
- High-quality PDF with page sizing and ordered multi-page output. Preserve vector ink/text where feasible; image and PDF references retain the quality of their source assets.
- An original local template library: flowchart, mind map, comparison, timeline, lesson plan and worksheet layouts.
- Save a selection or page as a user template; insert it as normal editable objects.
- Keyboard access, labelled controls, readable contrast, display scaling and tooltips/help.
- Performance tuning for realistic mixed boards, reliable packaging, clear release notes and final regression checks.

Done when output files have been inspected for cropping, page order, text/font consistency, transparency and sharpness; a portable native file can be transferred and reopened; saving/recovery failures are handled; and the packaged app completes the entire final-product scenario below.

SVG export and a full layer panel are optional follow-ons. Do not advertise unrestricted vector fidelity until text, transforms, assets and PDF references have been validated in the output.

## What a finished 2.0 session looks like

1. Open the app and begin writing immediately, or choose a saved lesson.
2. Add a few titled pages, paste a reference image and import worksheet pages from a PDF.
3. Write with the pen; add typed headings, equations, notes and a connected diagram.
4. Group and rearrange content, lock references and reuse a saved example/template.
5. Present the lesson with page/frame navigation, reveal prepared steps and annotate another application through overlay mode.
6. Export selected material or the whole lesson to a clear PNG/PDF.
7. Close and reopen the board, recover an earlier snapshot if needed, or transfer one editable file to another machine.

All seven steps work without logging in or using a cloud service.

## Delivery and quality gates

Before Phase 2, capture the current drawing/input and rendering baseline on this machine. Set measurable targets from that baseline rather than inventing unsupported frame-rate or latency promises.

Each increment requires:

- Relevant unit and integration checks for new persistent state and meaningful failure cases.
- A hands-on workflow check, including small-window/zoom behavior when affected.
- Migration and save/reopen checks using old boards and the current native format.
- Undo/redo and export checks for every added object type.
- A packaged Windows build and concise release notes when the increment ships.
- Physical input and screen-capture checks whenever the affected input/window path changes.

Do not repeat the entire test matrix for a documentation-only change. Complete broad regression gates for releases and focused checks for individual increments.

The highest-risk work is shared transforms/text layout in Phase 2, relationship preservation in Phase 3, portable assets/recovery in Phase 4, and PDF/font fidelity in Phases 5–6. Address those in small increments with visible results. Estimate calendar dates after the first transform/text increment establishes the implementation cost.

## After the finished milestone

Optional future experiments: reliable shape recognition with reversible previews; OCR; handwriting conversion; advanced connector routing; SVG export; richer layer management; recording; and additional platform support.

Cloud storage, accounts and multiplayer collaboration remain outside this roadmap. Optional user-configured
model APIs are supported following the user's 2026-10-07 request, alongside local models and external
agents. No core capability requires a cloud service or an account.

## References

- [Current app and usage](README.md)
- [Completed Phase 1 release](CHANGELOG.md)
- [Hands-on Miro Lite comparison and evidence](docs/MIRO-FEATURE-STUDY.md)
