# Miro hands-on study and local feature roadmap

Date: 2026-10-06. Reference: [Miro online whiteboard](https://miro.com/online-whiteboard/).
Comparison target: Floating Whiteboard Electron app 1.1.0.

## Scope and evidence

Used the user's existing Chrome tab and interacted with the embedded **Miro Lite** board without signing in. Created generic sample ink, shapes, text and a sticky note; connected and edited shapes; inserted a Flowchart template; grouped, moved, resized and ungrouped its contents; opened navigation and export controls. No personal files were uploaded. Account creation, sharing, collaboration, integrations and AI workflows were outside scope.

This is evidence of the anonymous Lite experience on this date, not a claim about the complete signed-in or paid Miro product. A visible control is distinguished from a verified result below. Performance, tablet pressure, touch input and full paid-product parity were not measured.

Screenshots:

- [Board and inserted template](miro-study/board-overview.jpg)
- [Selected and rotated shape with contextual editing controls](miro-study/shape-editing.jpg)
- [Image export preview and quality choices](miro-study/export-preview.jpg)

## Feature comparison

| Feature | What I actually checked in Miro Lite | Our current app | Recommendation |
|---|---|---|---|
| Freehand ink and presets | Opened the pen palette, changed a preset to blue and drew a stroke. Thickness and colour controls were exposed. | Pressure-sensitive pen, smoothing, marker, colour and size controls already exist. | Preserve pen latency and tablet ergonomics as new objects are added. Favourite brush presets would reduce repeated adjustments. |
| Erasers | Selected **Eraser**, crossed a disposable stroke and verified the whole stroke disappeared. **Precision Eraser** was named in its tooltip; a cut was attempted but the very thin result was not conclusively verified. | Whole-stroke and pixel erasing already exist. | Keep both modes accessible. Decide explicitly how erasing affects text, images and diagram objects. |
| Smart drawing and lasso | Selected **Smart drawing** and drew a diagonal; the selected result was still described as a Curve. Automatic recognition was not verified. A lasso icon was visible but its selection behavior was not tested. | Basic shapes and rectangular marquee selection; no recognition or lasso. | Add lasso selection after transforms. Recognition is a later experiment with preview, confidence checks and undo. |
| Standalone text | Created “Offline lesson demo”, changed font size from 14 to 64 and applied a bulleted list; the bullet was visible on canvas. | No text item type. | High priority: double-click editing, wrapping, size, colour, bold/italic, alignment and lists. |
| Sticky notes | Created a light-blue note, edited it to “Idea: paste images”, and changed size from L to M. Auto font size, colour, tag and emoji controls were visible. | No sticky-note item type. | High priority: editable notes with size presets, wrapping and keyboard duplication. Tags/emoji can follow. |
| Text inside shapes | Created a rectangle and typed “Start” directly into it. | Shapes are outlines only. | Treat a shape and its label as one object, with padding and alignment. |
| Shape styling | Changed border to dashed, rounded corners to 20, and fill to light yellow. Border thickness and opacity controls were visible. | Rectangle, ellipse, line and arrow; stroke colour and width. | Add fills, border patterns, opacity, corner radius, diamond and triangle. Shape-text styling should remain separate from border styling. |
| Resize and rotation | Resized a shape with a corner handle. Rotated it using the rotation handle, saw rotated geometry/text, and undid the change. | Selection supports moving and styling, without resize/rotation handles. | High priority: consistent transform handles for individual objects and multi-selection, including Shift constraints. |
| Attached connectors | Dragged from a shape's connection point to another shape; selected square/elbow routing; moved the connected shape and verified attachment and rerouting. A label was entered; readability at the low zoom was not verified. | Arrows are independent endpoint shapes. | Store endpoint references to object IDs and ports; add straight/elbow routes and labels. Moving a diagram should not require redrawing every arrow. |
| Connector styling | Type popup exposed straight, square and Bezier routes, normal/dashed/dotted patterns and line jumps; start/end and swap-end controls were visible. | One basic arrow style and independent lines. | Start with straight/elbow, arrowheads and labels. Curves, manual bends and line jumps can follow. |
| Grouping | Inserted a template containing 22 objects, grouped it, moved it intact, resized the group with contents scaling, and ungrouped it. The action changed back to “Group objects”. | Multi-selection and duplication exist, but no persistent groups. | Add persistent group membership, group selection, resizing, duplication and ungrouping. Remap internal connector references when duplicating a group. |
| Contextual editing | Selected shapes, notes, ink, text, connectors and groups exposed different relevant controls near the selection. | Selection colour and thickness controls are available in the dock. | Use one compact context toolbar driven by selection capabilities and mixed-value states. Keep it usable near screen edges and in small windows. |
| Arrange and style reuse | Opened Arrange: forward/front/backward/back and Move to layer were visible. Copy/paste style appeared in menus. Layer creation and actual reorder results were not verified. | Document order supplies drawing order; no exposed layer or style-copy commands. | Add front/back and lock first; copy/paste style next. A full layer panel is lower priority. Object alignment/distribution and snap-guide behavior were not verified in this study. |
| Templates | Opened the anonymous gallery and inserted Flowchart. It created editable diagram content plus an instruction document, rather than a screenshot. Its optional Run workflow showed Blocked and was not used. | No template library. | Build original, local templates from ordinary objects: flowchart, mind map, lesson plan, comparison, timeline and grids. Save a user's selection as a reusable template. |
| Navigation | Opened zoom presets, used Fit to screen, and displayed the minimap. Clicking/dragging inside the minimap did not establish viewport navigation, so only its display is verified. | Pan, pinch zoom, zoom controls, reset and fit content already exist. | Add fit selection and named sections/pages; a minimap becomes useful when boards grow. |
| Export | Opened image export: adjustable crop preview, Small JPG enabled, larger JPG and vector formats disabled with a paid-plan notice. Clicked Export; the dialog closed, but the download event timed out, so the file was not verified. Opened PDF export: low-quality raster option enabled; medium/high/vector disabled. | Whole-content PNG, clipboard image, and editable board files. | Add preview, selection/page/all scopes, resolution/background options and PDF. Validate actual files, not just dialog completion. |
| Additional tools | Clicking More tools produced a sign-up prompt; dismissed it. | Offline tools are available directly. | No assumptions about features behind this gate. Image/PDF import, frame creation, presentation tools and account-only capabilities were not tested. |

## Recommended implementation order

### Next release: object editing foundations

1. Add editable text, shape labels and sticky notes.
2. Add resize/rotate handles, persistent grouping, front/back and locking.
3. Add shape fill, border pattern, opacity and corner radius.
4. Add a context toolbar that handles single, multiple and mixed selections.
5. Add lasso selection once shared selection/transform behavior is stable.

Text, layout and transform behavior belong in the shared object model. Do not fake text or notes as exported bitmaps: they must remain editable after saving, undoing and reopening. Preserve existing ink appearance and legacy import.

**Acceptance:** create and edit text at different zoom levels; resize/rotate a mixed selection; group and duplicate it; save/reopen it; undo/redo each operation. Verify text focus does not trigger drawing shortcuts. Check small-window toolbar placement, transparent backgrounds and selection styling. Existing pen, eraser, recovery and export checks must continue to pass.

### Following release: connected diagrams

1. Add connector ports, attached endpoints, straight/elbow routing and arrowheads.
2. Add editable connector labels and shape quick-connect actions.
3. Add alignment/distribution commands and unobtrusive snapping guides. These are proposed improvements, not verified Miro behaviors from this session.
4. Add original offline flowchart and mind-map building blocks.

**Acceptance:** move, resize and rotate connected objects; duplicate a connected group; delete an endpoint and undo; save/reopen the graph; ensure routing and labels remain correct. Repeated edits should not leave dangling references or corrupt undo history.

### Then: complete teaching and reference workflows

1. Named local boards and pages/sections, page thumbnails and ordered navigation.
2. Paste/import local images, preserve aspect ratio, crop and lock reference material.
3. PDF page import and annotation, with original page assets preserved.
4. Local templates and user-created reusable snippets.
5. Export preview with selection/page/all scopes, background choice, PNG resolution controls and multi-page PDF.

Images, PDF import and presentation/page features are proposals based on our teaching use case; this session did not establish their behavior in Miro Lite.

**Acceptance:** reopen a multi-page lesson with locked reference images and annotations intact; export selected content and all pages; inspect output bounds, quality, text and transparency. Exercise missing/invalid asset handling and recovery backups.

## Where ours can be better for its purpose

- Keep the existing transparent, always-on-top overlay and pen/touch pass-through controls. Combine reference material with ink while retaining the ability to annotate other applications.
- Make object tools available offline with local saves, recovery and no account dependency.
- Offer local, high-quality export with clear size estimates and previews. The anonymous reference restricted high-resolution choices during this study.
- Make a complete lesson portable as one board package containing pages and assets, and preserve editability when reopening it.
- Keep pen workflows fast: radial shortcuts, favourite brushes, palm rejection and barrel-button erasing should coexist with diagram/text tools.
- Add teaching-focused presets and presentation navigation after the editor foundation: ruled/graph backgrounds, worked-example sections, revealable steps and a clean laser/presentation mode.

## Engineering implications in the current code

`src/renderer/src/engine/types.ts` currently defines only `StrokeItem | ShapeItem`; shapes contain endpoints, stroke colour and width. `items.ts` paints shape outlines and translates item coordinates. `SelectTool` in `tools.ts` supports marquee selection and movement. These are the main foundations to extend.

- Expand the validated document schema for editable text, richer shapes and later images/connectors/groups. Add migration and round-trip checks before changing saved content; v1.1.0 still writes format version 1.
- Centralize bounds, hit-testing and transforms so rotated objects behave consistently in selection, export and caching.
- Preserve immutable edit transactions and existing recovery behavior. Treat an object edit and dependent connector changes as one undoable operation.
- Use a DOM text editor over the canvas while editing, with consistent canvas/export layout after commit. Resolve font metrics and wrapping in one place.
- Keep relationships in stable IDs rather than pointer references. Reassign IDs and internal references on duplication/import.
- For assets, plan a portable local container and validated metadata rather than silently depending on arbitrary external file paths.
- Extend export bounds and painting for every new object type; scale-aware text and assets must work in both opaque boards and transparent overlays.

This study added documentation and screenshot evidence only. It did not change application behavior or claim that the next phase has already been implemented.
