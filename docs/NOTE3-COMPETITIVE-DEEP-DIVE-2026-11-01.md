# Whiteboard vs Note 3: a deep product and implementation study

**Research date:** 1 November 2026, India time.  
**Project:** Floating Whiteboard, the Windows application in the `app` repository.  
**Inspected local version:** 1.6.0-beta.1, branch `feature/smartboard-a2`, commit `7d8aeb20aac3922ce458a18412ccc0cf8d914c96`.  
**Verified GitHub main:** `dbb1d5cd284fff66b8a21febdff7f91409a04799`.  
**Purpose:** understand Note 3, identify what our board still lacks, and recommend a build order consistent with the master plan.

## The finding that matters most

**We already have much of the everyday teaching toolkit. The next improvement should make a complete lesson dependable from opening it to sharing it.** More icons alone will not establish that this is a better classroom board.

The latest branch adds the right foundations: a reachable toolbar, soft pen, palm erasing, subject shortcuts, writing papers, fixed Notebook pages, an endless Canvas with frames, PDF worksheets, equations, graphs and geometry instruments. Several older planning statements still describe these as missing.

The most important remaining work is:

1. **Make lesson appearance portable.** Colours, papers and future wallpapers must survive saving, reopening, conversion and export. Isolated diagnostics reproduced paper metadata loss in two paths; the native schema also omits board colour.
2. **Finish the classroom file workflow.** A teacher at the panel needs obvious New lesson, Open, Save editable lesson, Recent lessons and Export controls.
3. **Make output match the lesson.** Current PDF output is raster based; long pages shrink onto a landscape A4 sheet, and the content-cropped PNG path omits paper.
4. **Validate input on real panels.** Palm size, passive pen tips, simultaneous writers, display scaling and screen capture depend on the hardware and driver.
5. **Add reusable teaching material.** A personal resource shelf, diagrams, simple manipulatives, connected diagrams and prepared reveals will save teachers repeated work.
6. **Then deliver the proposed differentiators:** a reviewed NCERT library with English/Hindi content, followed by optional lecture notes and voice commands.

The master plan's overall direction remains strong. Its priority now needs to move from adding the first version of tools to proving a whole teaching session.

## Contents

- [1. Scope, evidence and limits](#1-scope-evidence-and-limits)
- [2. What the recent work actually delivers](#2-what-the-recent-work-actually-delivers)
- [3. What Note 3 provides](#3-what-note-3-provides)
- [4. Why a teaching board feels complete](#4-why-a-teaching-board-feels-complete)
- [5. Our current gap inventory](#5-our-current-gap-inventory)
- [6. Backgrounds, wallpapers and grids](#6-backgrounds-wallpapers-and-grids)
- [7. Concrete findings in the current source](#7-concrete-findings-in-the-current-source)
- [8. Teaching tools and reusable content](#8-teaching-tools-and-reusable-content)
- [9. A better lesson workflow](#9-a-better-lesson-workflow)
- [10. Recommended delivery order](#10-recommended-delivery-order)
- [11. Acceptance scenarios](#11-acceptance-scenarios)
- [12. Corrections to the existing plans](#12-corrections-to-the-existing-plans)
- [13. Evidence ledger and source links](#13-evidence-ledger-and-source-links)

## 1. Scope, evidence and limits

### What was investigated

- The current Windows application's source, recent local commits, GitHub commit history and live remote branch references.
- The master plan, editor roadmap, existing smart-board research, full feature list and relevant QA documents.
- The official **Note3 User Guide, document version 1.0.2, July 2024, 93 pages**. Its relevant sections were read, and eight pages were rendered locally for visual inspection: pages 9, 25, 26, 58, 62, 78, 84 and 86. [Official manual](https://prod-cdn.prod.asbis.io/s3/cms/document/80/bc/80bcca968eba8ea466cacaa276a34a27/note3_user_guide.pdf).
- Official documentation from Prestigio/ASBIS, CVTE, Speechi, ViewSonic, BenQ, Promethean, SMART, OpenBoard, Xournal++ and W3C.
- Small Node diagnostics executing bundles of our existing serialization and conversion functions, using synthetic lesson data.

### What the evidence means

| Label | Meaning in this report |
| --- | --- |
| **Reproduced** | Executed an isolated code diagnostic and observed the result. |
| **Source-confirmed** | The relevant implementation path was read; a full UI/device reproduction was not performed. |
| **Vendor-documented** | An official manual or product page describes the capability. It is not an independent quality measurement. |
| **Recommendation** | Proposed product behaviour or engineering work. It is not implemented by this report. |
| **Unverified** | The available evidence does not establish the claim. |

**This was not a hands-on benchmark of a licensed Note 3 installation.** No Note 3 installer was run, no competitor account was created, and no smart panel was physically tested. Our live board/profile was not opened or modified. No broad application test suite was rerun for this documentation task.

The original question's “Note tree” was confirmed to mean **Note 3**. “On a” was a spoken phrase, not another brand. The Android library in the parent workspace is outside scope.

The reference to PW is useful context for the kind of teaching experience desired. This research did **not** establish that all PW teachers or centres use a particular Note 3 version. Do not turn that into an institutional endorsement or a market-share claim.

## 2. What the recent work actually delivers

### GitHub and local development are at different stages

A live `git ls-remote` check returned GitHub `main` at `dbb1d5c`. The local checkout is eight commits ahead of that baseline on `feature/smartboard-a2`. The queried remote did not return a branch ref named `feature/smartboard-a2`.

| Stage | Relevant commits | What changed |
| --- | --- | --- |
| Merged teaching essentials | `9102774`, `7b07097`, `51814a7`, merge `fe2251a` | Master plan; laser fix; pictures; pages; PDF worksheets/export; equations; graphs; instruments; hold-to-snap shapes; presenter tools. |
| Merged first smart-board layout | `b306f43`, `1af0275`, `c56bd7a`, merge `dbb1d5c` | Smart-board direction, soft pen, bottom toolbar, edge menus, page sorter and first-launch layout choice. |
| Newer local A2 work | `a9092d3`, `92ab69c`, `76e33ea` | Palm eraser/calibration, paper library, subject drawer and dark-board chrome. |
| Newer local interaction work | `3100844`, `8bb9a1e`, `ef0d7f0` | English interface decision; pen prediction refinement; page gestures, extension and map. |
| Current local head | `718d2b2`, `7d8aeb2` | Version 1.6.0-beta.1; separate Notebook/Canvas kinds, frame navigation and conversion. |

GitHub evidence: [teaching-essentials merge](https://github.com/EruditeCoder108/Whiteboard/pull/1), [smart-board merge](https://github.com/EruditeCoder108/Whiteboard/pull/2), [current verified main commit](https://github.com/EruditeCoder108/Whiteboard/commit/dbb1d5cd284fff66b8a21febdff7f91409a04799).

**A local feature, a merged feature and a shipped installer are different states.** The version string alone does not prove a release was published or tested on another panel.

### The product direction, reconciled

The master plan aims at Indian classrooms, ordinary school PCs and 65–86 inch touch panels. Its major tracks are:

- **Core board:** offline writing, presentation, portable lessons and reliable input.
- **Lesson Kit:** reviewed diagrams, explainers, simulations and selected 3D models, organised by NCERT class, subject and chapter.
- **Optional AI:** lecture notes and commands, teacher-controlled and reviewed before sharing.

Keep the interface **English**, with Hindi in writing papers, typed content and lesson labels. That is the later explicit decision in commit `3100844`. The gesture ring is a separate college project according to the full feature list; it should not block the board release.

The current source still contains the fourteen existing science experiments. The master plan calls for freezing and replacing that older content through the new Lesson Kit. A working older lab is not evidence that the new library architecture or content collection has been delivered. [Local planning evidence: C1–C3 below.](#local-source-evidence)

## 3. What Note 3 provides

### Identify the product before comparing it

Prestigio describes Note3 as an updated EasiNote product for Windows devices. Its public product page highlights subject tools, navigation, movable controls, soft ink and presentation tools. ASBIS lists a lifetime licence for one device. These are documented product attributes; vendor claims about engagement or learning effectiveness were not independently tested. [Prestigio introduction](https://prestigio-solutions.com/news/unveiling-note3-the-return-of-easinote-transforming-education-and-business-presentations/), [product overview](https://prestigio-solutions.com/product/note3-interactive-whiteboard-software), [licence specification](https://catalog.asbis.com/product/psnte3).

The following compact inventory comes from the Windows manual. Page numbers refer to the printed PDF pages. The right column identifies a workflow to evaluate in our product, not a claim about Note 3's internal implementation.

| Documented Note 3 capability | Manual pages | Workflow to evaluate here |
| --- | --- | --- |
| Solid colours; subject papers; custom wallpapers | 24–26 | Choose a suitable writing surface. |
| Soft/calligraphy ink; laser; multipoint writing | 57–58 | Write without repeated setup. |
| Gesture erasing | 59 | Correct work while retaining the selected pen. |
| Roaming overview | 62 | Recover orientation on a large board. |
| Page grouping and sorting | 64–68 | Prepare and navigate a long lesson. |
| Preparation, presentation and desktop modes | 70–72 | Move between preparation and delivery. |
| Personal/system resources | 41–43 | Reuse prepared material. |
| Object cloning, links and animations | 44–49 | Reuse objects and reveal steps. |
| Image cropping/background assignment | 55–56 | Work with reference material. |
| Audio/video playback and frame capture | 56 | Explain a selected media moment. |
| Screenshots and document camera | 35–38 | Bring external material into the lesson. |
| Handwriting/shape recognition | 59–63 | Clean up selected writing. |
| Handwritten formula recognition | 75 | Enter mathematical notation. |
| Coordinate scales, axes and grids | 76–79 | Explain quantities with explicit scales. |
| Geometry instruments/calculator | 79–82 | Demonstrate constructions. |
| Circuits, resultant forces | 83–85 | Assemble subject demonstrations. |
| Atoms, periodic table, apparatus | 85–93 | Access subject-specific material. |
| Mind maps | §3.1.3.3.11 | Build connected explanations. |

Source for this inventory: [Note3 Windows manual](https://prod-cdn.prod.asbis.io/s3/cms/document/80/bc/80bcca968eba8ea466cacaa276a34a27/note3_user_guide.pdf). The manual establishes these functions, not their speed, recognition accuracy or scientific correctness.

### Keep adjacent products separate

There are similar names across Windows software and panel-native Android apps. Their capabilities must not be combined into one imaginary Note 3 edition.

| Product/reference | What the official source establishes | Useful implication for our board |
| --- | --- | --- |
| **CVTE Note / Note 5 references** | CVTE describes a Windows teaching application and separately names Note 5 in its education solution. [Application](https://global.cvte.com/product_ad_note), [education solution](https://global.cvte.com/solutions_edu_coll). | Keep version and platform explicit in future comparisons. |
| **Speechi Note, Android** | Its tutorial demonstrates separate finger/fine-tip/thick-tip settings, writing backgrounds, image/PDF work, tables, mind maps and pair mode with 2–6 zones. [Tutorial](https://speechi.com/video-tutorial-getting-started-note-whiteboard-application/). | Tip assignment, tables and activity zones are relevant benchmarks. This source alone does not prove those exact features in Windows Note 3. |
| **myViewBoard 2.0** | Local backgrounds, saved backgrounds, grid overlay and explicit current-page/all-pages application are documented. [Background management](https://myviewboard.com/kb/en_US/create-lessons/background-management). | Background scope should be visible and predictable. |
| **myViewBoard 3.0** | Files, pages, tabs, custom images and navigation are documented together. [Page management](https://www.viewsonic.com/solution/kb/en_US/mvb30-lesson-creation/mvb3-page-management). | Lesson organisation deserves its own workflow. |
| **BenQ EZWrite 6** | Background patterns can survive project/PDF/image output. Custom images are supported. Its dual-pen documentation specifies Android on BenQ Board. [Backgrounds](https://www.benq.com/en-us/education/user-manual/software/ezwrite-6-whiteboard/change-background.html), [annotation](https://www.benq.com/en-us/education/user-manual/software/ezwrite-6-whiteboard/annotation.html). | Export parity and platform-qualified input claims are basic requirements. |
| **Promethean Whiteboard** | The vendor documents line colour and spacing adjustments for different activities and learners. [Getting started](https://www.prometheanworld.com/gb/news-article/how-to-get-started-with-the-activpanel/). | A paper picker should offer useful size controls, not only preset names. |
| **SMART Notebook** | The current Gallery includes teaching resources, images, widgets, backgrounds, sounds and 3D objects. [Gallery documentation](https://support.smarttech.com/docs/software/notebook/current/en/creating-lessons/using-the-gallery.cshtml?label=SMARTNotebookFilter&value=SMARTNotebook_26). | Resource reuse is a larger advantage than decorative wallpaper quantity. |
| **OpenBoard** | The official project wiki documents a resource library, multimedia, widgets, screencasting and desktop annotation. [Project wiki](https://github.com/OpenBoard-org/OpenBoard/wiki). | Our earlier statement that OpenBoard has “no library” is inaccurate. |
| **Xournal++** | PDF backgrounds remain distinct from annotations; its documentation explains related portability/synchronisation considerations. [PDF guide](https://xournalpp.github.io/guide/pdfs/). | Treat source documents as retained references when higher output fidelity is needed. |

## 4. Why a teaching board feels complete

This section is product analysis, not a claim about competitor source code or measured teacher behaviour.

### The teacher repeats a small number of actions

Write, change colour, erase, add space, switch page, bring in a worksheet, reveal an answer and save the lesson. If those actions are easy to reach and preserve context, the board feels quick even without a large feature list.

Our bottom toolbar and edge menus already address reach. The next work should preserve state across these repeated actions: the correct paper on the next page, the previous page's scroll position, a usable pen after erasing, and a saved file that looks the same on another PC.

### Preparation and live teaching have different needs

During preparation, teachers can name pages, arrange a diagram and create reveals. During class, the same content needs large controls and minimal accidental editing. A single floating toolbar cannot substitute for both workflows.

We should retain one lesson model while exposing preparation and presentation views. Notebook/Canvas should continue to describe document structure; Board/Laptop should describe interface layout; Overlay should describe interaction with other applications. Avoid making these overlapping concepts look like interchangeable “modes”.

### A resource collection removes repeated drawing

A teacher may use a familiar circuit, coordinate plane or cell diagram repeatedly. A reusable object with labels and a reliable insertion size can be more useful than a large animation gallery.

This supports the master plan's emphasis on diagrams. It also suggests building a **teacher's own resource shelf** early, using ordinary objects already supported by the board.

### Familiarity reduces the cost of switching

Use recognisable controls for Pen, Eraser, Back, Next, Pages, Background and Save. Introduce our advantages through the task being performed: insert a reviewed diagram, switch its labels to Hindi, hide labels for a quiz, freeze a simulation and annotate it.

Do not require a teacher to understand MCP, file formats, renderers or AI providers before beginning an ordinary class.

## 5. Our current gap inventory

**Built** means code exists on the inspected local branch. It does not mean a packaged build or physical panel has passed acceptance. **Partial** means an important workflow or contract is incomplete. Priorities are recommendations, not commitments.

| Area | Current status | What remains | Priority |
| --- | --- | --- | --- |
| Board layout and reachable controls | Built | Real reach/scaling checks; file actions in board view. | P1 |
| Pressure pen, soft pen, prediction | Built | Panel-specific writing feel and latency measurements. | P1 |
| Palm erase and calibration | Built | Cold-start, edge-of-hand, multi-contact and driver variation checks. | P1 |
| Fine tip / thick tip / finger assignments | Partial | Separate input profiles where the device exposes a reliable distinction. | P1 |
| Several simultaneous writers | Missing in current router | Independent per-pointer strokes; deliberate navigation policy. | P2 |
| Split activity zones | Planned | Start with two zones after simultaneous writing works. | P2 |
| Pen/highlighter/laser | Built | Useful remembered presets; additional textures only after demand. | P2/P3 |
| Shape snapping | Built | Evaluate reversibility and accidental recognition on real handwriting. | P1 |
| Stroke/pixel erasers | Built | Predictable behaviour on locked references and mixed objects. | P1 |
| Notebook pages, sorter, extension/map | Built | Titles, sections and structural undo/recovery. | P1/P2 |
| Endless Canvas and frame navigation | Built | Per-frame appearance and conversion preservation. | P1 |
| Solid colours and writing papers | Partial | Portable colour; paper scope; metadata preservation. | P0/P1 |
| Custom wallpaper/background image | Missing as a first-class background | Fit, crop, opacity, replacement and retained asset. | P1 |
| Paper spacing/colour/strength controls | Missing | Small useful settings plus remembered presets. | P1 |
| Isometric/logarithmic/polar papers | Missing | Add by subject demand after the base model is sound. | P2 |
| Images: paste, drop, insert | Built | Crop, source-quality options and reference/background distinction. | P1/P2 |
| PDF worksheets | Partial | Raster import works; retain originals and offer selective import later. | P1/P2 |
| PDF output | Partial | Page size, long-page pagination, preview and sharpness. | P1 |
| PNG output | Partial | Page/selection/content scopes; include-paper option; board access. | P1 |
| PowerPoint | Overlay available | A clear capture/PDF-conversion route; native slide import later. | P2 |
| Editable local lesson files | Built | Touch-first New/Open/Save, names, recents and appearance portability. | P0/P1 |
| Autosave and recovery | Built | Real failure/restore workflows; never promise zero data loss. | P1 |
| Personal resource shelf | Missing | Save/reinsert a selection or page, folders/tags and thumbnails. | P2 |
| Tables | Missing | Editable cells, resize and structured save/export. | P2 |
| Mind maps / attached connectors | Missing as structured tools | Stable relationships when nodes move; shared connector model. | P2 |
| Ruler, protractor, compass, set square | Built | Shared logical measurement units and physical-panel usability. | P1 |
| Typed maths/chemistry equations | Built | Good touch entry; handwriting conversion remains separate. | P2 |
| Function graphs | Built | Axis labels/units, explicit tick intervals and classroom manipulatives. | P2 |
| Handwriting-to-text / maths recognition | Planned | Accuracy evaluation, English/Hindi coverage, reversible results. | P3 |
| Calculator / unit converter / periodic table | Missing as general tools | Small offline utilities integrated with subject workflows. | P2 |
| Circuit/chemistry symbol assembly | Partial | Existing labs are not a general reusable component palette. | P2 |
| Spotlight, curtain, timer | Built | Prepared object/region reveals and presentation ergonomics. | P2 |
| Screen capture to lesson | Missing as integrated workflow | Choose source, capture cleanly, return to a locked reference. | P1 |
| Document camera / embedded media | Missing as lesson objects | Snapshot-first camera flow, then retained playable media. | P2/P3 |
| Lesson recording / WebM | Built foundation | Whole-lesson page/frame semantics and future audio synchronisation. | P1/P2 |
| Local Wi-Fi QR sharing | Planned | Explicit session, reachability checks and manual export fallback. | P2 |
| NCERT Lesson Kit | Planned replacement architecture | Reviewed assets, metadata, bilingual labels and useful search. | P2 |
| Lecture transcription and notes | Planned | Audio, timestamps, board references, review and export. | P3 |
| Voice commands | Planned | Page/asset operations and push-to-talk interaction. | P3 |
| Optional assistant / MCP | Built foundation | Native page, asset and lesson operations; richer visual context. | P2/P3 |
| School deployment and profiles | Partial/planned | Trusted package verification, deployment settings and practical support. | P2 |

Evidence: [C4–C18](#local-source-evidence). The inventory follows source inspection and the current feature list; it does not certify every listed workflow through UI testing.

## 6. Backgrounds, wallpapers and grids

### 6.1 These are different parts of a lesson

The feature should be called **Background & paper** in the interface. It needs clear behaviour for four different things:

| Part | Purpose | Suggested behaviour |
| --- | --- | --- |
| Board colour | White, black, green or another base | Store in the lesson; support page/frame overrides. |
| Paper pattern | Rules, dots, graph squares, writing bands, staves | Parameterised, sharp at export, anchored to the page/frame. |
| Background artwork | A teacher's diagram, worksheet or school template | Retained asset, locked against ordinary selection, replaceable. |
| Teaching content | A picture, graph, table or editable diagram | Normal object with the shared editing lifecycle. |

A photograph inserted behind ink can be a useful workaround, but it does not supply background-specific controls. Conversely, an editable diagram should not be flattened into a wallpaper simply to avoid implementing object behaviour.

### 6.2 The current papers are a useful start

The source contains **Plain, Dots, Squares, Ruled, Four-line, Hindi lines, Graph paper and Music**. Board colour is a separate setting. New notebook pages inherit the current paper; individual notebook pages can retain different paper names. [C4, C5, C7 and C10.](#local-source-evidence)

That covers a meaningful part of the initial requirement. The immediate gap is control and persistence, rather than a need to add dozens of decorative images.

For each paper, offer a few large, useful controls:

- **Spacing:** small, medium, large, plus a numeric option under More.
- **Strength:** faint, normal, strong, with a live sample underneath real ink.
- **Line colour:** sensible defaults on light/dark boards; custom colour optional.
- **Scope:** This page; All existing pages; Default for new pages.
- **Restore preset:** return to the original paper without touching the drawing.

Default to This page. Applying to all existing pages should be one reversible action. Existing pages should not silently change when the teacher only wants a default for future pages. ViewSonic's explicit page/all-page choices and Promethean's spacing controls provide relevant documented precedents. [ViewSonic](https://myviewboard.com/kb/en_US/create-lessons/background-management), [Promethean](https://www.prometheanworld.com/gb/news-article/how-to-get-started-with-the-activpanel/).

### 6.3 Start the background collection with teaching surfaces

| First collection | Why it belongs early |
| --- | --- |
| Clean white, dark and green surfaces | Everyday lessons and readable ink. |
| Ruled, four-line and Hindi writing papers | Already built; add age-appropriate spacing controls. |
| Fine/major graph paper | Graphing and working layouts with explicit logical scale. |
| Coordinate plane and number line | Prefer editable teaching objects with labels and scale. |
| Isometric dots/lines | Solids, spatial reasoning and geometric sketching. |
| Music staves | Already built; adjustable spacing improves usability. |
| Teacher-imported background | Worksheets, diagrams, school-specific material. |
| A few original lesson layouts | Compare/contrast, worked example, prediction/observation and exit ticket. |

Later additions can include logarithmic/polar papers, sports fields and licensed map outlines. BenQ's documented additions of isometric and logarithmic backgrounds show these are established teaching options, but they need not all be first-release requirements. [EZWrite release note](https://knowledge.benq.com/en/benq-service-genie/ezwrite6-android-release-notes-for-v1.7.4.0).

Avoid busy textures behind equations. A “chalkboard” can remain a quiet green or dark surface; chalk texture is a separate pen-style decision. Make a small, coherent collection using original or properly sourced assets under the existing asset policy.

### 6.4 Custom wallpaper must have a complete lifecycle

Recommended flow:

1. Background & paper → Image → choose a local file or current picture.
2. Show the whole page preview.
3. Choose **Fit** or **Fill**; permit repositioning/cropping for Fill.
4. Adjust opacity and base colour if required.
5. Choose page scope and apply.

Fit preserves the complete source. Fill preserves aspect ratio while cropping; it should not stretch a scientific diagram. On an extended page, explicitly choose whether artwork belongs to the first sheet, repeats per sheet or covers the full long surface.

Ordinary erasing and Clear ink should preserve the background. Replacing/removing it should be undoable. The original asset reference, placement and crop must survive native save, duplication, conversion, recovery, thumbnails and output. Do not require the original USB stick to remain connected after import.

Keep **Reset background**, **Clear ink** and **Delete page** as distinct actions. The teacher should be able to erase a solved worksheet without erasing the worksheet itself.

### 6.5 Squares and Graph paper currently use different renderers

This distinction matters when deciding whether the grid is already good enough.

**Squares (`lines`) and Dots:** a dedicated background canvas; world-anchored lattices; zoom-dependent density; fixed screen-space marks. Squares uses compatible powers-of-four levels with smooth fading and compensated reference-line opacity. The prior square-grid QA covers density boundaries and several DPR values. That is existing engineering to preserve, not a missing feature. [C4 and C15.](#local-source-evidence)

**Graph paper (`graph`):** a separate ruled-paper branch draws fixed 10/50-world-unit lines. It rounds positions in CSS space, omits a level when spacing falls below four pixels, and does not use the Squares transition/opacity method. Other ruled papers also use a different threshold and line placement. These are source-level differences; this research did not perform a new pixel or video comparison of their zoom behaviour. [C4.](#local-source-evidence)

The older grid QA should not be presented as proof that every newly added paper has equally smooth zoom, matching export or correct page anchoring.

### 6.6 Decorative grids and measurement must remain separate

Adaptive Squares is good for visually organising a canvas. Its visible density changes as the view changes. That is not a suitable implicit ruler for measured graphs.

For measurement, define explicit logical units and scales:

- Graph axes carry independent x/y ranges, tick intervals, labels and units.
- A geometry construction uses a stated logical centimetre/unit scale shared by its instruments.
- A printable paper can specify spacing in physical millimetres at a chosen output size.
- A panel's visual paper remains a teaching aid unless physical screen calibration is deliberately supported.

The current source comment calls fixed graph spacing “millimetre graph paper”, but the renderer's units are world units. It does not establish physical millimetres on an arbitrary display or on the current landscape-A4 output. The label should avoid implying calibrated measurement. [C4, C8 and C13.](#local-source-evidence)

### 6.7 What “perfect” should mean for our grid

Treat these as acceptance criteria:

| Property | Required observation |
| --- | --- |
| Stable anchoring | Ink remains aligned with its paper after scrolling, converting, reopening and exporting. |
| Smooth movement | No large jumps in line position or abrupt strong-pattern flashes during normal navigation. |
| Consistent density | Decorative grids adapt; measured papers preserve the stated logical scale. |
| Balanced intersections | Crossings do not become distracting dark dots. |
| Legible contrast | Paper is visible where useful and stays weaker than ordinary lesson ink. |
| Display scaling | Check 100%, 125%, 150% and 200% Windows scaling and real display changes. |
| Output agreement | A preview explains page size and pagination; output preserves the selected paper. |
| Bounded cost | Measure background work independently of expensive ink/content work. |

No evidence collected here establishes that Note 3 renders without flaws, or that we have beaten its ink latency. Its screenshots cannot answer those questions.

### 6.8 Proposed persistence design

This is a design proposal, not a migration implemented by the research:

```ts
type BackgroundSpec = {
  color: string
  paper?: {
    preset: PaperPreset
    spacing: number       // documented logical units
    strength: number
    color?: string
    origin: [number, number] // local to its page or frame
  }
  artwork?: {
    assetId: string
    fit: 'contain' | 'cover'
    opacity: number
    crop?: [number, number, number, number]
  }
}

// Proposed: document defaults plus explicit page/frame overrides.
// UI preferences are separate from saved lesson appearance.
```

Use the same background description for screen rendering, thumbnails, native storage, recovery, replay and export. Defaults can reduce duplication, but a portable lesson needs resolved appearance even on a PC with different preferences.

Add an explicit schema migration when introducing this model. Preserve older formats' reading behaviour and choose sensible fallback colours. Do not silently repurpose format 4 fields in a way older builds misread.

## 7. Concrete findings in the current source

These findings are about our implementation, not hypothetical missing competitor features. No production code was changed during this research.

### F1. Board colour does not travel with the editable lesson

**Priority: P0. Evidence: source-confirmed; serialized field inventory inspected.**

`S.bgColor` is a setting, while portable lesson serialization writes objects, page/frame information, paper names and image assets. Neither the page structure nor the serialized root contains a background colour. Export functions receive the current global colour separately. [C5, C7 and C10.](#local-source-evidence)

**Consequence:** a saved lesson does not carry its authored colour to another installation. White handwriting prepared on a dark board can be opened against that installation's light background. This is a portability risk established by the schema; a second-PC UI reproduction was not performed.

**Required outcome:** store appearance with the lesson, support page/frame overrides, and test a dark lesson reopened under a light local preference. Changing the default colour for future lessons must not alter existing lessons.

### F2. An unframed Canvas can drop its paper during save

**Priority: P1. Evidence: reproduced with the existing functions.**

The serializer's older-format shortcut accepts a plain single Canvas without images or nondefault frame geometry. It does not check whether that canvas has a paper setting. The old single-board output has no paper field. [C5.](#local-source-evidence)

Diagnostic input: a plain Canvas, one synthetic ink stroke, `paper: 'fourline'`, default frame, portable save. Result:

```json
{
  "savedVersion": 2,
  "savedHasPaper": false,
  "savedHasPages": false,
  "parsedPaper": null
}
```

A Notebook with the same input did write `paper: 'fourline'`.

**Required outcome:** use a format that preserves every nondefault appearance value; verify paper round-trips for empty/ink-only/image-containing canvases, with and without frames.

### F3. Notebook conversion preserves ink but loses individual papers

**Priority: P1. Evidence: reproduced at conversion-function level; wrapper source read.**

`notebookToCanvas()` returns items and geometry-only frames. `canvasToNotebook()` returns items and frame geometry. Paper metadata has no place in that round-trip, and the board wrapper applies the current paper across the converted structure. [C6 and C7.](#local-source-evidence)

Diagnostic input: two notebook pages, respectively Four-line and Graph paper. Output after conversion and return:

```json
{
  "inputPaper": ["fourline", "graph"],
  "restoredPaper": [null, null],
  "restoredItemCount": 1
}
```

The synthetic ink object remained present. Therefore, “all ink preserved” and “the lesson is preserved without loss” are different claims.

**Required outcome:** retain per-frame appearance in Canvas, restore it to Notebook pages, and include paper origins, titles and future background assets in conversion tests.

### F4. PNG and PDF do not share the same paper behaviour

**Priority: P1. Evidence: source-confirmed.**

Notebook/framed-Canvas PDF preparation calls `renderSheet()`, which paints paper. The existing content-cropped PNG path calls `renderPng()`, which paints a solid fill and objects without invoking the paper renderer. [C7 and C11.](#local-source-evidence)

**Required outcome:** provide explicit Page, Selection and Content scopes; include paper/background options and use a shared scene-rendering contract. A teacher exporting graph-paper working should not lose the graph accidentally.

Also, a wholly empty notebook returns no PDF output even if its pages have paper. Blank pages are retained when at least one page contains an object. This matters if printable blank practice papers become a promised workflow.

### F5. Long-page PDF output can make the lesson too small

**Priority: P1. Evidence: source-confirmed; scale consequence inferred from the export geometry.**

`renderSheet()` creates one tall PNG for an extended page. The main-process exporter fits each supplied image onto one landscape A4 sheet. An eight-screen-long notebook page therefore becomes one tall image reduced to the height of that A4 page. It is not automatically split into eight readable sheets. [C7 and C13.](#local-source-evidence)

**Required outcome:** offer a preview with choices such as Split by screen, A4 portrait/landscape, or a deliberate long-page output. Show page boundaries before export and avoid cutting a line of working through a boundary where practical.

Current output is PNG content embedded in PDF. Equations may originate as SVG and ink as vectors, but that does not make the final PDF vector or its text searchable. PDF worksheets are also rasterized on import. [C7–C9 and C13.](#local-source-evidence)

Preserve the simple raster route as a reliable fallback. Higher-quality export can later combine original PDF references with vector ink/text and rasterise only content that needs it.

### F6. Native file actions are not exposed clearly in Board mode

**Priority: P1. Evidence: source-confirmed UI inventory.**

The current Board menu offers PDF output and insertion, but no direct New lesson, Open editable lesson or Save editable lesson tile. Native Open/Save operations exist elsewhere, and keyboard shortcuts remain available. The default Ctrl+S action saves a PNG; Ctrl+Shift+S saves the editable board. [C11, C12 and C14.](#local-source-evidence)

**Required outcome:** make the normal lesson lifecycle available through large touch controls. Decide a consistent save convention and label native save separately from image/PDF export. A panel user should not need to discover laptop-only controls or keyboard combinations.

### F7. Simultaneous touch writers need a different input path

**Priority: P2. Evidence: source-confirmed.**

The router follows a primary pointer/tool. Additional touches are either ignored during active writing or interpreted as navigation when appropriate. This is not independent multiwriter stroke handling. [C16.](#local-source-evidence)

**Required outcome:** implement an explicit mode for two simultaneous writers with independent pointer state, then extend only where useful. Define what happens when a palm lands, a finger moves an object, a pen draws or another writer opens a toolbar. Do not assume a panel's advertised touch-point count proves application support.

### F8. Full lecture replay is not established by the current recorder

**Priority: P1 before promoting whole-lesson recording. Evidence: source-confirmed API boundary; end-to-end behaviour unverified here.**

The recorder is started and fed the current page's item list and view. It does not receive a complete notebook, page IDs, frame order or paper history through those calls. [C17.](#local-source-evidence)

**Required outcome:** specify recording events for page/frame activation, appearance changes, assets and scientific time before claiming a faithful multipage lecture replay. Audio and generated notes must share that event timeline later. Existing edit replay and silent WebM export remain useful foundations.

### F9. Page operations need a stronger recovery contract

**Priority: P1/P2. Evidence: source-confirmed.**

The page-deletion UI explicitly says it cannot be undone. Page/frame metadata currently focuses on geometry and paper rather than titles and section organisation. [C5, C7 and C12.](#local-source-evidence)

**Required outcome:** make structural actions recoverable, add page titles and small lesson sections, and preserve them through duplicate, reorder, conversion and native file operations. Avoid treating ordinary object undo as proof of whole-document structural undo.

### Reproducing the isolated diagnostics

The research used `esbuild` to bundle the current `serialize.ts` and `convert.ts` modules for Node. It invoked their exported functions directly with synthetic pages, a synthetic stroke and no user data. The script and results are retained locally under the ignored research workspace:

- [Diagnostic script](<D:/Projects 2/whiteboard/app/.work/note3-research/probe.mjs>)
- [Observed JSON results](<D:/Projects 2/whiteboard/app/.work/note3-research/probe-results.json>)

From the application repository, the diagnostic command is `node .work/note3-research/probe.mjs`. These are focused observations, not a replacement for UI, recovery or release tests. The report includes the material results so it remains useful without the temporary workspace.

## 8. Teaching tools and reusable content

### 8.1 Subject drawers should grow beyond shortcuts

The current drawer correctly groups existing tools by Maths, Physics, Chemistry, Biology, English and Hindi. It does not yet supply the curriculum collection proposed in the master plan. [C18.](#local-source-evidence)

| Subject | Next useful additions | Suggested implementation direction |
| --- | --- | --- |
| Maths | Number line, coordinate axes, fraction bars, measured angles, solids/nets | Editable native objects with shared scales and clean labels. |
| Physics | Circuit symbols, force arrows, ray-diagram components, graph labels | Reusable diagrams first; simulations where interaction teaches a relationship. |
| Chemistry | Periodic table, apparatus symbols, atom/bond diagrams, reaction templates | Structured source data, correct notation and clear distinction between illustration and simulation. |
| Biology | Reviewed labelled diagrams and hide-label quizzes | Start with the planned Class 10 diagram pack; use 3D when rotation/cutaway adds understanding. |
| English | Adjustable writing bands, word/sentence cards, text reveal | Reuse the same text, paper and reveal systems. |
| Hindi | Writing bands, reliable Devanagari content, bilingual diagram labels | Keep menus in English; verify font shaping, conjuncts and output. |

This is an expansion of existing systems, not six independent editors.

### 8.2 Build a personal resource shelf

Recommended first version:

- Save a selection or full page to My resources.
- Give it a title, subject and optional folder/tags.
- Show a thumbnail and search by the teacher's own terms.
- Reinsert a fresh editable copy with fresh object IDs.
- Preserve internal groups, assets, relationships and credits.
- Export/import a resource collection for another classroom PC.

Keep **teacher resources** separate from **official reviewed lessons** in the interface. A teacher-created item should not acquire an implied scientific review badge merely because it is in the library.

### 8.3 Use shared foundations for tables, diagrams and activities

Build attached connectors once, then use them for mind maps, flowcharts and labelled scientific diagrams. A mind map should preserve relationships when a node moves; arrows drawn near text do not supply that behaviour.

For tables, store rows, columns and editable cell content. Begin with text tables before handwriting-aware cells. Support clear borders, touch resizing, selection, undo, copy/paste and export.

For repeated objects, offer Duplicate and later a clone-source option. Fractions, counters and circuit elements benefit from this more than elaborate transition effects.

### 8.4 Add prepared reveals before a large animation editor

The existing screen curtain can reveal a region during class. A prepared explanation also needs object-specific steps: question, first hint, second hint, answer, explanation.

Start with Show/Hide at named steps and a large Next step button. Preserve the revealed state in saved lessons and output choices. Later, the same step model can coordinate library explainers and replay.

### 8.5 Keep recognition optional

Typed MathJax equations and hold-to-snap geometry already cover useful tasks. Handwriting-to-text or handwriting-to-maths needs a separate evaluation: English/Hindi content, mixed notation, subscripts, correction speed, offline availability and restoring the original ink.

Present a preview and keep the original until accepted. Do not delay portability and export improvements for a recognition feature that only works reliably on selected examples.

### 8.6 Input support should follow observed capabilities

Contact-size heuristics can assist palm/tip classification, but hardware may not expose usable contact geometry. The Pointer Events specification permits default geometry when the actual size is unavailable. Independent thin/thick/finger tools cannot be promised universally from browser events alone. [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/#pointerevent-interface).

Recommended capability handling:

1. Prefer genuine pen/device signals when present.
2. Calibrate contact-size distinctions only when reported sizes vary meaningfully.
3. Offer a simple Manual/Automatic choice and an obvious fallback.
4. Keep palm rejection and deliberate palm erasing as distinguishable behaviours.
5. Save device/layout preferences without embedding a particular panel's classification thresholds into every lesson file.

Measure actual touch target sizes on the installed panel. CSS dimensions alone do not prove the existing “4–6 cm buttons” target across resolutions, Windows scaling and panel sizes.

## 9. A better lesson workflow

### Before class

Open a recent named lesson or create a new one. Choose Notebook for structured pages or Canvas for a spatial explanation. Set a background preset, import selected worksheet pages and insert reusable material. Name the important pages and prepare a few reveals.

The teacher should be able to do this on a laptop and bring one editable file to the classroom. That makes portable appearance, assets and font behaviour more urgent than account synchronisation.

### During class

Write immediately. Keep pen colours and erasing within reach. Back/Next should behave predictably for the current document kind; a presenter clicker should not move the wrong object or interfere with text editing. Adding space should preserve the page's paper and orientation.

When explaining a browser, video or slide, provide **Capture to lesson**:

1. Choose a window/display or region.
2. Hide capture controls from the result.
3. Capture the intended source, including a paused media frame when available.
4. Return to the current lesson with a locked, readable reference.
5. Annotate, save and export it through the normal pipeline.

BenQ documents a related capture/import workflow, including platform-specific differences. Our implementation should state its own source/capture limits rather than assume it can capture every protected or hardware-rendered surface. [Floating-tool documentation](https://www.benq.com/en-us/education/user-manual/software/ezwrite-6-whiteboard/ez-floating-tool.html).

### After class

Save the editable lesson, inspect export preview and choose a clear PDF layout. Offer print-friendly output as an explicit option for dark boards; preserve the authored version separately. If changing ink/background colours for printing, make it previewable and avoid losing meaningful colour distinctions.

Then share using a file, USB, or an explicitly started local share session. A QR code is only a way to encode a link; it does not establish that students can reach the board's PC.

For local Wi-Fi sharing, test school client isolation, Windows firewall and the selected network interface. Use an expiring token, expose only the selected exported file, show Stop sharing, and retain a manual-file fallback. Do not expose the lesson workspace as a browsable directory.

Keep the promise precise: **no cloud upload for local sharing, but a working local connection is still required.** BenQ's documented QR route uses a cloud download and is therefore a different architecture. [BenQ sharing documentation](https://www.benq.com/en-us/education/user-manual/software/ezwrite-6-whiteboard/save-files.html).

### Later: notes and voice

The lecture-notes goal depends on stable page IDs, board events, retained assets, audio timestamps, teacher review and export. Build these foundations once. Preserve the source board and timestamps alongside generated text so a note can point back to what was actually said or drawn.

Keep core classes fully usable with AI off. Provide explicit recording and provider controls; confirm the intended retention behaviour through the product design rather than treating an audio-deletion default as a complete compliance claim.

## 10. Recommended delivery order

These are proposed increments with observable exit conditions. They do not assign dates before implementation cost is known.

| Order | Increment | Scope | Exit condition |
| --- | --- | --- | --- |
| **A2.1** | Preserve lesson appearance | F1–F3, per-page/frame background state, schema migration and conversion. | A mixed-paper dark/light lesson reopens on a second profile and round-trips through Canvas with appearance intact. |
| **A2.2** | Finish touch-first lesson files | New/Open/Save editable lesson, names, recents, structural recovery. | A teacher can prepare, save, reopen and copy a lesson using only the panel. |
| **A2.3** | Output that matches the board | PNG scopes, PDF preview/sizing/pagination, include-paper and print-friendly options. | Inspect a real worksheet, a long worked example and a dark lesson in exported files. |
| **A2.4** | Refine papers and capture | Spacing/strength/scope, custom backgrounds and Capture to lesson. | A teacher imports their own background, annotates a captured slide and exports matching output. |
| **A2.5** | Physical-panel acceptance | Input fallbacks, pen/palm tests, reach/scaling, performance and actual screen-sharing path. | The agreed target panel and low-end PC complete the core session without blocking defects. |
| **B0** | Reusable teaching objects | Personal shelf, attached connectors, basic tables, axes/number lines and named reveals. | Reuse a diagram, rearrange it, teach it and reopen it with relationships intact. |
| **B1** | Prove the Lesson Kit | Design system, asset records, reviewed initial diagrams, one representative interactive lesson of each selected kind. | Teachers can find, insert, explain, label/hide labels and export the first reviewed set. |
| **B2** | Expand curriculum packs | Class 10 first, following the master plan; grow based on real use. | A coherent chapter pack works offline and passes content review. |
| **C0** | Lecture event/audio foundation | Explicit recording state, page-aware timeline and timestamped audio. | A real mixed-page lesson can be replayed and navigated reliably. |
| **C1** | Optional notes and commands | Draft notes, teacher review, source references, push-to-talk and native operations. | A teacher corrects and exports a faithful set of notes; normal teaching still works without AI. |

Local QR sharing can follow A2.3 as an independent increment. Multiwriter/pair mode can follow stable input handling. Do not let either delay fixing appearance loss.

**Start B1 with the highest-value diagrams.** The master plan's ambition is hundreds of items, but success should first mean a small number of accurate, visually coherent resources that teachers reuse. The first representative 3D/explainer/simulation pieces should prove the kit without holding a useful diagram pack hostage to the hardest asset.

The school-deployment track can proceed alongside this work: verify the actual installer on a clean PC, document updates and rollback, check standard-user operation, and provide a short teacher guide. A proposed OEM logo or silent-install setting is not evidence of a ready institutional deployment.

## 11. Acceptance scenarios

These are future acceptance gates unless explicitly covered by the isolated diagnostics above. They were not all performed during this research.

### 11.1 Background and portable-lesson matrix

| Scenario | Required result |
| --- | --- |
| Dark page with white ink → file → light-default installation | Opens with authored background and readable ink. |
| Four-line + Graph + Hindi pages → Canvas → Notebook | Every page retains its pattern, origin, content and order. |
| Plain Canvas with paper and no image | Paper survives native save/reopen. |
| Custom image background from USB → eject USB → reopen | Background remains available. |
| Duplicate page, replace background, undo | Original and duplicate retain independent appearance. |
| Clear ink on a worksheet | Worksheet and paper remain; erased work can be recovered. |
| Page with no ink but intentional paper | Export follows the advertised blank-paper policy. |
| Notebook extended to eight screens | Export preview produces readable, deliberate pagination. |
| PNG page vs PDF page vs thumbnail | Content, paper, cropping and colour agree for the chosen scope. |
| Papered frame at nonzero/negative world coordinates | Paper aligns locally and remains aligned after conversion. |

### 11.2 Input and panel matrix

Test at least one pressure pen setup and the intended classroom IR/passive-pen panel. Include cold start, missing/constant contact size, narrow/broad tips, finger, palm, fist/edge of hand, and reconnecting the touch cable.

Check writing immediately after calibration and before a touch-history warm-up; the current palm classifier uses recent touch sizes. Test a palm landing during writing, another finger arriving, lift/cancel events, erasing near locked material and returning to the selected pen.

For future multiwriter mode, test independent strokes, simultaneous erasing and conflicting navigation. For ordinary mode, verify that the second hand does not unexpectedly create marks or change pages.

Measure reach and readability with the actual mounted height, a left-handed teacher, a shorter teacher, a presenter clicker and a student at the back of the room. Test the real OBS/Teams/Zoom capture route used by the classroom rather than relying only on application screenshots.

### 11.3 Performance and lesson duration

Use the agreed low-end test PC and record its CPU, GPU, RAM, resolution, scaling and driver. Use representative sessions: many handwritten pages, a worksheet PDF, several pictures and a few interactive resources.

Measure stroke response, long-frame outliers, page switches, memory growth, import/export time and recovery after failure. A smooth empty canvas or an isolated background timing does not prove a 90-minute class will remain smooth.

Set numerical release budgets after obtaining a repeatable baseline. Keep measured observations separate from the feature list's aspirational 60-fps target.

### 11.4 Teacher comparison exercise

Run the same short lesson in our app and an available licensed Note 3 installation:

1. Open a saved worksheet lesson.
2. Choose graph paper and write a calculation.
3. Erase a mistake and change colour.
4. Add a page, return to the previous one and find a prepared example.
5. Draw a construction and reveal an answer.
6. Capture an external reference.
7. Save an editable copy and export notes.

Record time spent finding tools, unnecessary actions, recovery from mistakes and the teacher's own preference. Use at least a maths/science teacher and a language/primary teacher. This supplies the evidence needed to claim a better workflow; a manual comparison alone cannot.

## 12. Corrections to the existing plans

Do these during the next documentation reconciliation; this report does not rewrite the older plans.

| Existing statement or ambiguity | Correction |
| --- | --- |
| Images, PDFs, pages, equations and instruments are still missing | Implemented in source; distinguish merged and newer local features. |
| Track A2 is entirely “next” | Much of A2 exists locally; remaining work includes the contracts and acceptance gaps above. |
| Hindi UI is part of the required core | Later decision keeps UI English; Hindi belongs in content, papers and labels. |
| Notebook is a fixed board with no movement | Fixed-size pages; extended pages still scroll vertically. Canvas is the freely navigable document kind. |
| Conversion means nothing is lost | Ink is preserved in the tested paths; paper metadata is not. Narrow the claim until appearance is preserved. |
| Background library is complete | Preset patterns exist; custom image backgrounds, parameters and portable colour are incomplete. |
| A screenshot/PNG is equivalent to a page export | Current PNG crops to content and omits paper; PDF preparation has different semantics. |
| PDF output has vector equation/ink quality | Current PDF pipeline flattens the composed page to PNG first. |
| Autosave “never loses work” | Describe verified recovery behaviour and known failure handling, without an absolute guarantee. |
| Recording means full lecture capture | Current replay foundation needs explicit multipage/audio/appearance semantics. |
| OpenBoard has no library | Its official project documents a library and multimedia/widgets. |
| All Note/Note3/Note5 features are interchangeable | Record product, version, platform and source for every competitor claim. |
| Competitors have no Hindi, NCERT content, AI or lecture notes | Use “not established in the reviewed edition/documentation” unless directly verified. |
| Button dimensions or FPS are achieved facts | They remain targets until measured on the intended panel/PC. |
| Gesture ring belongs in the board release | The later feature list separates it as a college project. |

Our strongest product claim to work toward is:

> A dependable offline classroom board with portable lessons, useful teaching tools, reviewed NCERT resources and optional teacher-controlled notes.

Each part can be demonstrated. “Better than every competitor at everything” cannot guide a practical release or substitute for teacher testing.

## 13. Evidence ledger and source links

### External sources

All links were accessed during research on 1 November 2026. Manuals and platform-specific help pages can describe older or limited editions; the report identifies those boundaries. Search-result crawl timestamps were not treated as software release dates.

| ID | Source | What it supports |
| --- | --- | --- |
| N1 | [Note3 User Guide v1.0.2, 93 pages](https://prod-cdn.prod.asbis.io/s3/cms/document/80/bc/80bcca968eba8ea466cacaa276a34a27/note3_user_guide.pdf) | Windows feature inventory and inspected figures. |
| N2 | [Prestigio Note3 product](https://prestigio-solutions.com/product/note3-interactive-whiteboard-software) | Product positioning and Windows support. |
| N3 | [Prestigio introduction, 16 July 2024](https://prestigio-solutions.com/news/unveiling-note3-the-return-of-easinote-transforming-education-and-business-presentations/) | EasiNote relationship and edition context. |
| N4 | [ASBIS PSNTE3 catalogue](https://catalog.asbis.com/product/psnte3) | Lifetime, one-device licence listing; no India price assumption. |
| R1 | [CVTE Note application](https://global.cvte.com/product_ad_note) | Related Windows application. |
| R2 | [CVTE education solution](https://global.cvte.com/solutions_edu_coll) | Separate Note 5/Android solution context. |
| R3 | [Speechi Note tutorial, 18 March 2026](https://speechi.com/video-tutorial-getting-started-note-whiteboard-application/) | Android Note interaction examples; not a Windows feature certification. |
| R4 | [myViewBoard 2.0 backgrounds](https://myviewboard.com/kb/en_US/create-lessons/background-management) | Local images, saved backgrounds and explicit application scope. |
| R5 | [myViewBoard 3.0 page management](https://www.viewsonic.com/solution/kb/en_US/mvb30-lesson-creation/mvb3-page-management) | File/page/tab organisation and backgrounds/navigation. |
| R6 | [EZWrite 6 backgrounds](https://www.benq.com/en-us/education/user-manual/software/ezwrite-6-whiteboard/change-background.html) | Background patterns, retained output and custom images. |
| R7 | [EZWrite 6 annotation](https://www.benq.com/en-us/education/user-manual/software/ezwrite-6-whiteboard/annotation.html) | Platform-qualified dual-pen behaviour. |
| R8 | [EZWrite 6 save/share](https://www.benq.com/en-us/education/user-manual/software/ezwrite-6-whiteboard/save-files.html) | Cloud QR sharing distinction. |
| R9 | [EZ Floating Tool](https://www.benq.com/en-us/education/user-manual/software/ezwrite-6-whiteboard/ez-floating-tool.html) | Capture/import and platform boundaries. |
| R10 | [EZWrite Android v1.7.4.0 release note](https://knowledge.benq.com/en/benq-service-genie/ezwrite6-android-release-notes-for-v1.7.4.0) | Isometric and logarithmic background additions. |
| R11 | [Promethean ActivPanel introduction](https://www.prometheanworld.com/gb/news-article/how-to-get-started-with-the-activpanel/) | Line-colour/spacing controls in the described Whiteboard. |
| R12 | [SMART Notebook current Gallery](https://support.smarttech.com/docs/software/notebook/current/en/creating-lessons/using-the-gallery.cshtml?label=SMARTNotebookFilter&value=SMARTNotebook_26) | Reusable teaching-resource categories. |
| R13 | [OpenBoard official project wiki](https://github.com/OpenBoard-org/OpenBoard/wiki) | Existing library, multimedia, widgets and desktop annotation. |
| R14 | [Xournal++ PDF guide](https://xournalpp.github.io/guide/pdfs/) | Separate PDF-background/reference model. |
| R15 | [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/#pointerevent-interface) | Contact geometry and input capability limitations. |

### Local source evidence

These links target the inspected workspace. They are deliberately local for newer work that is not on the verified GitHub main. The commit hash at the top fixes the baseline; later edits can change line numbers and behaviour.

| ID | Owning source | Relevant evidence |
| --- | --- | --- |
| C1 | [Master plan](<D:/Projects 2/whiteboard/app/MASTER-PLAN.md:1>) | Product goal, Lesson Kit, AI and build tracks. |
| C2 | [Full feature list](<D:/Projects 2/whiteboard/app/docs/FEATURES.md:1>) | Intended finished product and evolving status claims. |
| C3 | [Editor roadmap](<D:/Projects 2/whiteboard/app/ROADMAP.md:1>), [earlier smart-board research](<D:/Projects 2/whiteboard/app/docs/SMARTBOARD-RESEARCH.md:1>) | Existing phases and comparison statements needing reconciliation. |
| C4 | [Grid and paper renderer](<D:/Projects 2/whiteboard/app/src/renderer/src/engine/grid.ts:1>) | Presets, adaptive Squares/Dots, ruled-paper path and thresholds. |
| C5 | [Native serialization](<D:/Projects 2/whiteboard/app/src/renderer/src/engine/serialize.ts:196>) | Page schema, legacy shortcut and format-4 contents. |
| C6 | [Notebook/Canvas conversion](<D:/Projects 2/whiteboard/app/src/renderer/src/engine/convert.ts:1>) | Geometry/item conversion without per-page paper state. |
| C7 | [Board engine](<D:/Projects 2/whiteboard/app/src/renderer/src/engine/board.ts:1>) | Page lifecycle, conversion wrapper, rendering and output paths. |
| C8 | [Image handling](<D:/Projects 2/whiteboard/app/src/renderer/src/engine/media.ts:1>) | 2400-pixel maximum raster side, re-encoding and image cache. |
| C9 | [Import/export actions](<D:/Projects 2/whiteboard/app/src/renderer/src/state/insert.ts:1>) | PDF raster import, worksheet placement and PDF preparation. |
| C10 | [Settings/state](<D:/Projects 2/whiteboard/app/src/renderer/src/state/store.ts:1>) | Global colour preference and paper state. |
| C11 | [User actions](<D:/Projects 2/whiteboard/app/src/renderer/src/state/actions.ts:1>) | File save/open, PNG output and colour changes. |
| C12 | [Board toolbar/menu](<D:/Projects 2/whiteboard/app/src/renderer/src/ui/Board.tsx:1>), [paper picker](<D:/Projects 2/whiteboard/app/src/renderer/src/ui/Paper.tsx:1>) | Touch controls, background UI and deletion wording. |
| C13 | [Main-process PDF export](<D:/Projects 2/whiteboard/app/src/main/index.ts:393>) | Raster pages fitted to landscape A4 through printToPDF. |
| C14 | [Keyboard shortcuts](<D:/Projects 2/whiteboard/app/src/renderer/src/state/shortcuts.ts:1>) | Native-save/image-save discoverability. |
| C15 | [Previous square-grid QA](<D:/Projects 2/whiteboard/app/docs/SQUARE-GRID-QA.md:1>), [grid tests](<D:/Projects 2/whiteboard/app/tests/grid.test.ts:1>) | Historical verified Squares behaviour; not new ruled-paper QA. |
| C16 | [Input router](<D:/Projects 2/whiteboard/app/src/renderer/src/engine/input.ts:1>), [ink tools](<D:/Projects 2/whiteboard/app/src/renderer/src/engine/tools.ts:1>) | Primary-pointer handling, palm calibration and soft-pen behaviour. |
| C17 | [Replay state](<D:/Projects 2/whiteboard/app/src/renderer/src/state/replay.ts:1>) | Current-page recorder inputs and replay foundation. |
| C18 | [Subject drawer](<D:/Projects 2/whiteboard/app/src/renderer/src/ui/Subjects.tsx:1>), [item types](<D:/Projects 2/whiteboard/app/src/renderer/src/engine/types.ts:1>), [agent schema](<D:/Projects 2/whiteboard/app/src/shared/agent.ts:1>) | Existing shortcuts/object kinds and remaining native-operation scope. |

### Research result status

- Created this report only; no production application code, roadmap, release, GitHub branch or Android-library file was changed.
- Three background-related diagnostic observations are recorded in section 7; other concrete findings identify their source-only or inferred status.
- Competitor behaviour is documented evidence unless stated otherwise. Physical panel performance, teacher preference and a licensed Note 3 comparison remain acceptance work.
