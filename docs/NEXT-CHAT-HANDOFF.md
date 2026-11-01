# Next chat handoff

**Updated 1 November 2026 (Checklist 1 closed; Checklist 2 started; 1.6.0-beta.10).** Read this first in every new chat, then update it before the chat ends
(see the last section). Paths are relative to the repository root
`D:\Projects 2\whiteboard\app` unless they start with a drive letter.

## Start here: Checklist 2

**Checklist 1 is closed. The plan is now `docs/CHECKLIST.md` (Checklist 2).** The owner's order:

1. **Step 1: make the board on par with, and better than, every other whiteboard app**, with Note 3 as the baseline, improving it in every way. The look must feel **natural and organic**: a settings button is a gear people recognise, a paintbrush looks like a paintbrush.
2. **Step 2: the animation library. Step 3: lectures and AI.**
3. **Step 4, last: the large collection of scientific tools.** Not before.

- **The Note 3 study is finished:** `D:\Projects 2\whiteboard\note3-study\Note-3-Final-Report.pdf` (4 pages). **Do not open or list the images in that folder.** `study-export.pdf` there is only a one-page test export. The owner says the report is **not fully right and the lead decides**: treat it as input, not orders. Its ratings of our app come from the docs, not the code. The lead's main changes are in the checklist: it adds a tool per input, student zones, PowerPoint import and a phone poll, and it puts writing feel ahead of new features.
- **Icons belong to the second agent,** on `feature/organic-icons`, from `docs/agent-tasks/organic-icons.md`. It generates transparent pictures for the buttons and adds `ui/icons.tsx`, which exports the same names as `lucide-preact`. **Do not do icon work here.** Hold section A's look pass until that branch is merged; new UI code imports icons from `./icons` after that.
- **Next for the lead:** sections B onward of Step 1, in order, once the owner says go.
- **Branch:** start one from `main` for Step 1. See §6 for when PRs and installs happen.

---

## 1. What we are building

**Floating Whiteboard**: free, open-source (GPL-3.0) teaching software for Indian classrooms.
**Smart boards come first** (65–86" touch panels), and it still works on laptops. There are three pillars:

1. **A board teachers prefer to Note3/EasiNote.** Fast ink, notebook pages, tools that are easy to reach and
   simple to use. Internals stay hidden.
2. **An NCERT-mapped animated library** (diagrams, explainers, simulations, 3D), with English and Hindi
   content. The interface itself stays English.
3. **Optional AI**, using the teacher's own Gemini key:
   - lecture → notes PDF that is *faithful* (only what the teacher said and drew);
   - voice commands, later.

The gesture ring is a separate college project and is **not** part of the product.

## 2. Where everything is

| What | Where |
|---|---|
| Overall plan, tracks, rules | `MASTER-PLAN.md` |
| Full feature list with status (the scorecard) | `docs/FEATURES.md` |
| Smart-board research, competitor table, redesign plan | `docs/SMARTBOARD-RESEARCH.md` |
| **The owner's Note3 deep dive: the working guide for the next chats** | `docs/NOTE3-COMPETITIVE-DEEP-DIVE-2026-11-01.md`, written by the owner. **Read it fully.** Commit it on the first branch. |
| 3D/asset licence research | `docs/EDUCATIONAL-3D-ASSETS-RESEARCH.md` |
| Release history | `CHANGELOG.md` |
| **The owner's progress checklist (plain language)** | `docs/CHECKLIST.md` (Checklist 2). **Work through it in order; tick it after every milestone.** The finished first list: `docs/CHECKLIST-1-done.md`. |
| GitHub | `EruditeCoder108/Whiteboard` (public); PRs #1–#14 merged, `main` = 1.6.0-beta.10 |
| Installed app (owner's laptop) | `%LOCALAPPDATA%\Programs\Floating Whiteboard` (per-user NSIS install, Start menu + desktop shortcut) |
| Latest installer | `dist\Floating Whiteboard Setup 1.6.0-beta.10.exe` (ignored by git). **Rebuilt per whole checklist step: see §6.** |
| Older unrelated projects in the parent folder | `..\android-library`, `..\*.pyw` (the original Python board). Leave them alone. |

## 3. State right now

- **`docs/CHECKLIST.md` is the owner's plain-language progress list and the plan.** Checklist 1 is finished and archived. Tick items (✅ / 🔄 / ⬜) whenever a milestone starts or finishes; keep it
  short and jargon-free. `FEATURES.md` stays the detailed feature list.
- `main` = **1.6.0-beta.10**, installed on the owner's laptop. **All of Step 2 is built and merged** (PRs #11–#14): My shelf, attached arrows, number line and axes, tables, reveals, light/dark mode, print-friendly PDFs, export preview, calculator, periodic table, writing strips. Built before it (see `CHANGELOG.md`):
  - lesson integrity (F1–F6, F9; PR #4);
  - Background & paper (§6; PR #5);
  - Share to phones (second agent; PR #6);
  - textured board surfaces (PR #7);
  - My lessons + autosave + page sections (PR #8);
  - Capture to lesson (second agent; PR #9).
- **Owner's direction (2026-11-01):** a *professional* smart-board app, finished properly and not rushed. Checklist 2 holds the order (see "Start here"); real-panel testing is now section I of its Step 1. Board textures are "almost enough"; tune them only if asked.
- **A second agent (ChatGPT) works in parallel** from written briefs in `docs/agent-tasks/` (the owner pastes them).
  - It works in its own worktree (`D:\Projects 2\whiteboard\app-<task>`), pushes its branch and never merges.
  - The lead reviews, merges through a PR, and writes the CHANGELOG/FEATURES/CHECKLIST entries. The owner now trusts
    it: review lightly (safety-critical parts plus the merge), then polish.
  - Done: `qr-share.md` and `capture.md`. **Waiting on it:** `organic-icons.md`.
  - Its Note 3 study is superseded by the owner's own PDF (see "Start here"). The lead built Tables at the owner's request.
  - Write further briefs only when the owner asks. A good independent task if they do: logarithmic, polar and map papers (mostly new files).
- **Note 3 is installed on this PC** (Start menu name "Note"; its window belongs to `note.exe` / `easirunner.exe`). Do not drive it unless the owner asks: the study is done.
- **Deep dive progress:**
  - **Done:** §7 F1–F6 and F9 (titles + sections); §6 (all of 6.2–6.8); §9 Capture, local QR share, organised lessons
    with autosave.
  - **Open:**
    - F7 (simultaneous writers, needs a panel) and F8 (multipage recording, a big track);
    - print-friendly dark export and export preview (end of Step 2);
    - logarithmic, polar and map papers;
    - manual crop of a filled background picture (position presets only today);
    - a check at 125/150/200% Windows scaling on hardware;
    - capture polish: grabbing one window requests full-size thumbnails of every window, which is slow with many open.
- **Checks green on `main`:**
  - typecheck clean, vitest 377;
  - e2e: tables 33, tools 19, export 18, reveals 34, theme 19, scale 25, connectors 33, shelf 31, lesson 44, papers 34, capture 26, board 25, share 21, track-a 15, run 46, phase1 23, phase2 35, grid 30,
    canvas 13, replay 30, agent 40, laser 15;
  - phase2 and laser can flake once when run straight after many suites; a rerun passes.
- **Never tested on a real touch panel.** Swipe feel, palm threshold, soft-pen width, IR pens and tile sizes are
  unverified on hardware (Step 3).

## 4. What to do next

**Checklist 2, in order ("Start here" above).** The notes below are background.

The owner's deep dive (`docs/NOTE3-COMPETITIVE-DEEP-DIVE-2026-11-01.md`) has been the working guide: use its priorities and its "required outcome" for each item. Where it and `MASTER-PLAN.md` disagree on order, its "make a whole lesson dependable first" wins.

**A. On the checklist:**
- **Step 1, section I:** real-panel acceptance with the owner (pen/palm, two writers F7, scaling, a slow PC). It needs a panel.

The look of a page is `PageLook` (`engine/pages.ts`): paper, color, title, origin, spacing, strength, lines, art.
`engine/scene.ts` turns it into a `Backdrop` painted everywhere; `engine/grid.ts` plans each paper as `PaperPass`es
(testable without a canvas). Extend these; never add a parallel paper path.

**B. The big tracks, when the owner picks one:**
- **Track B, Lesson Kit** (the biggest differentiator): see `MASTER-PLAN.md` §2–4. The first wave is a 3D heart,
  mitosis, ray optics, 3D glassware, 30 Class 10 diagrams and maths tools. One shared Three.js
  renderer; art made in real art tools, motion in code, science as formulas. The old 14 science labs
  are frozen and get replaced as the new ones land.
- **Track C, AI lecture notes** (the owner's college project): see `MASTER-PLAN.md` §5A:
  - collar mic → transcription → Gemini reads the page snapshots, figure crops and time-aligned
    transcript → notes PDF;
  - **faithful by default**; extras are teacher switches and are printed in "Added by AI" boxes;
  - key stored with Electron `safeStorage`; the free tier is for development only (it may use the data).

**C. Whenever a panel is available:** tune palm size, swipe thresholds and soft-pen speeds, then do
simultaneous writers (F7).

## 5. Codebase map

Electron 44 + electron-vite, Preact + `@preact/signals`, Canvas2D, TypeScript.

| Area | Files |
|---|---|
| Main process | `src/main/lessons.ts` (recent list, lesson file link, safe save/open of user-chosen paths), `src/main/index.ts` (window: transparent and frameless, own resize handles, fullscreen, pass-through, IPC, PDF via `printToPDF`); `storage.ts` (atomic saves, backups, content-addressed `assets/`); `assistant.ts`; `agent-bridge.ts` + `mcp/whiteboard-mcp.cjs` (MCP agent) |
| Bridge | `src/preload/index.ts`, `src/shared/api.ts` (add any new IPC in **all three** places) |
| Board engine | `engine/board.ts` (the hub: pages, view, render loop, notebook/canvas kinds, frames, look, structural undo, export). `colour.ts`, `scene.ts` (backdrop = colour + paper, used by screen, thumbnails, PNG, PDF), `convert.ts` (carries look both ways). `input.ts` (pointer routing: pen, touch, mouse, palm, pinch, swipe), `tools.ts` (pen with soft pen and prediction, eraser, shapes, text, laser), `items.ts` (item geometry and painting via perfect-freehand), `doc.ts` (immutable items + History/EditOps), `serialize.ts` (formats 1–4), `pages.ts` (sheet maths, `BoardKind`), `convert.ts` (notebook ⇄ canvas), `grid.ts` (papers), `view.ts`, `instruments.ts`, `recognize.ts`, `media.ts`, `graph.ts`, `laser.ts`, `agent.ts`, `science/` (old labs, frozen) |
| State | `state/lesson.ts` (lesson file: path, dirty, new/open/save/recent), `dialog.ts` (+`ui/Dialog.tsx`, big-button questions), `state/store.ts` (`S` signals; `PERSISTED` settings plus validation in `applySettings`), `actions.ts`, `insert.ts` (pictures, PDF import/export, equations), `shortcuts.ts`, `autosave.ts`, `replay.ts` |
| UI | `app.tsx` (shell, load/save, chooses the board or laptop chrome); `ui/Board.tsx` (board toolbar, More menu, page sorter, edge tabs, page rail, layout chooser); `Lessons.tsx` (lesson + export sheets); `Panels.tsx` (laptop chrome); `Popovers.tsx` (settings etc.); `Insert.tsx` (laptop page bar, equation/graph editors); `Paper.tsx`, `Subjects.tsx`, `Calibrate.tsx`, `Present.tsx`; `kit.tsx` (Btn, Swatch…); `styles.css` (board styles at the end) |
| Tests | `tests/*.test.ts` (vitest, pure logic). `e2e/*.mjs` (Playwright driving the real built app; helpers in `e2e/lib.mjs`) |

**Key ideas:**
- **World units ≈ 1 mm on an 86" board at 100%.** A sheet is `PAGE_W 1600 × PAGE_H 900` per screen; `extent`
  adds screens downward (max 8).
- **Notebook:** `board.pages[]`, each with items, view, history, paper and `frame`. The view is locked by
  `clampToFrame` (fit zoom only, vertical scroll).
- **Canvas:** one page plus `frames[]` of the same `Frame` shape.
- **The board kind, frames and appearance live in the board file** (format 4: `kind`, `frames`, root `color`, per-page and
  per-frame `paper`/`color`/`title`/`origin`), not in settings. `S.bgColor`/`S.grid` are only mirrors of the visible
  page: change them through `board.setColor` / `board.setPaper` (or `actions.setBackground` / `actions.setPaper`), never
  by writing the signal. `S.defaultColor`/`S.defaultPaper`/`defaultSpacing`/`defaultStrength`/`defaultLines`
  (persisted) are what *new* lessons start with. `S.here` is the look the picker edits (paper, colour, style, art).
- **Papers:** `planPaper()` returns passes in CSS px; one path per pass, so crossings never darken. Spacing scales the
  view; strength scales alpha (capped at .7, always lighter than ink). Writing papers on the open canvas use
  `writingLevels(zoom)` (power-of-two sizes with a crossfade); pages/frames/exports never adapt, so print matches.
  Graph/isometric keep a fixed scale and only fade. Layouts need the page's screens (`cells`).
- **Board surface** = colour + texture. `lessonTexture` (file root `texture`) with a per-page/frame `look.texture`
  override, exactly like colour; `board.setSurface({color, texture}, onlyHere)`. `texture.ts` makes two seamless
  layers in code (grain tile 1:1, cloud tile drawn ×7) and paints them at screen scale, anchored to the world.
- **Lessons and files:** every lesson has a file. `state/lesson.ts` autosaves it 1.5 s after each change
  (`lesson.flush()`, also on close), creating it in the library (`lessons.create`) when it has none. Main
  `lessons.ts`: the library folder (`Documents\Floating Whiteboard\Lessons`, or `FW_LESSONS_DIR`, which `e2e/lib.mjs`
  sets so tests never write to the real Documents), `library.json` index (subject, pages, kind, first-page thumb),
  rename/duplicate/remove (Recycle Bin via `shell.trashItem`). UI: `ui/Lessons.tsx` `LessonLibrary` and
  `NewLessonSheet`, mounted in `app.tsx` (popover names `lessons`, `new-lesson`).
- **My shelf:** main `shelf.ts` keeps each item in its own folder under `userData\shelf` (`meta.json` with name, subject and picture;
  `board.json` in the lesson format, pictures inline, checked by `parseBoard`). `.wbshelf` is the whole shelf as one file. `engine/shelf.ts` is pure:
  `freshCopies` (new ids and groups, unlocked), `placeInView`, `readableOn` (ink that would vanish on this board changes), `pageAt`. `state/shelf.ts` and
  `ui/Shelf.tsx` are the rest (popover names `shelf`, `shelf-save`); board hooks are in the "my shelf" part of `board.ts`. Teacher items stay apart from
  the future reviewed Lesson Kit. Not built from §8.2: folders/tags (subject and search cover it for now) and credits.
- **Tables:** `TableItem` (`t: 'b'`): `cols`/`rows` are shares of the size, `cells` the text. `engine/table.ts` is pure and also paints; `ui/Table.tsx` has the size chooser and the cell field. `fitItem` grows rows through `fitTable`. A tap on a cell of the selected table comes from `SelectTool` (`editTableCell`); so does dragging a divider. A long table can run past the page: teachers widen it or use "more space below".
- **Prepared reveals:** `ObjectMeta.step` (`RevealStep`: n, name, shown, cover) lives on each object. `engine/reveals.ts` is pure; `items.ts` holds the hidden mode (`hide`/`ghost`/`show`) and `concealed()`, which every hit test respects. Exports flip the mode only for one synchronous paint (`renderRect`), so the classroom screen can never flash an answer.
- **Theme:** `darkUi` in `store.ts` sets the `dark` class on `.window`; the variables are at the "light and dark mode" block of `styles.css`. **Ink colours still follow `isDarkBg`, the board, not the theme.** New colours: use the variables; `npm run e2e:theme` measures contrast on every surface, so add new popovers to its list.
- **Export:** `exportPages` takes `print`, `hidden`, `scale`, `onSheet`, `cancelled`; `ui/ExportPreview.tsx` uses the same path at a small scale, so the preview cannot disagree with the PDF.
- **Number line and axes:** `ScaleItem` (`t: 'n'`), a box with `x` and optional `y` (`ScaleAxis`: min, max, step, den, name), `points` by value. `engine/scale.ts` is pure and
  also paints; `ui/Scale.tsx` is the editor (popover `scale`, mounted in `app.tsx`). `equal` axes letterbox inside any box, so resizing never distorts a unit.
- **Attached arrows:** a line or arrow `ShapeItem` may hold `from`/`to` (`Anchor`: an object id, plus `at`, a spot in fractions, on pictures, graphs and
  labs) and `elbow` ('h'/'v'). `p` always holds the real position, so painting, export and replay need nothing special. `engine/connectors.ts` is pure.
  `Board.commit` runs `withConnectors`, which moves attached arrows inside the same undo step: edit through `commit`, never `history.push` directly. Anything that
  copies objects with new ids must call `remapAnchors` or `withNewIds`. A new object type is attachable automatically; give it a `p` box.
- **Page sections:** `look.section` on the page (or frame) where a section starts; `board.setSection`/`sectionAt`;
  headings in the page sorter (`SectionHead` in `ui/Board.tsx`).
- **Background picture** (`look.art`): stored in the assets table like pictures (`art.a` key), placed per screen of
  the sheet by `artTargets`/`placeArt`. Not inherited by new pages or frames. `board.setArt`, `pictureToBackground`,
  `state/background.ts`.
- **Structural undo:** `board.changed({label, snap})` makes a page/board-level change undoable (`undoStructure`, Undo
  toast, Ctrl+Z) until the next change or page turn. Ops take `this.structure()` *before* `leavePage()`.
- Items are immutable. Every edit is an EditOp in History, per page. Autosave serializes everything.
  Pictures are saved once as assets.
- Settings: add a key to `S`, to `PERSISTED`, and to the enum/range validation in `applySettings`.

## 6. Owner's preferences and decisions (follow these)

- **Explain in easy, plain language.** Short summaries; the owner isn't deep in the code.
- **The owner delegates decisions** ("you are the boss"). Make the call, state it in one line, move on.
- **Quality over test volume.** Run the essential suites only; don't write hundreds of tests. Over-deliver
  on how well the app actually works and how fast it is.
- **Git:** feature branch → commits → **PR + merge only when a whole checklist step is done** (the owner's request). Never
  push to main directly. Commits use the owner's GitHub noreply identity (already set globally).
- **No Hindi interface.** Hindi lives in content: papers, library labels, Devanagari text.
- **Notebook pages never zoom or pan.** The canvas is a separate board kind; frames give it pagination.
- **AI notes are faithful by default** (see above). AI reads the board pages and diagrams.
- **Smart board first:** big targets, everything reachable at the bottom and sides, no hover-only UI,
  internals hidden.
- Free and open-source assets only (CC0/PD/CC BY/CC BY-SA; never NC/ND). No AI-slop visuals. **Exception chosen by the owner (1 Nov 2026):** interface icons and pictures are AI-generated by the second agent, with a strict shared style and each one checked by eye; `assets/art/SOURCES.md` records them.
- **One PR and one laptop install per whole checklist step, not per item, and do not stop to ask between items** (owner, 1 Nov 2026): spend tokens and usage on building the app. Mid-task, just continue.
- **Keep context small:** never view whole folders of images or large files when the text or a small part will do (the owner has asked for this by name).
- **When a chat gets long and the next task is new, not a continuation:** update this file and give
  the owner a short starter prompt for the new chat.

## 7. Working tips (learnt the hard way)

- **Backslashes in Bash heredocs are halved here.** Anything with a regex backslash must be edited with the Edit tool,
  not a script written through a heredoc. No Python on this PC: for multi-edit scripts write Node (`node file.js`,
  `fs` + exact replacement, convert CRLF → LF → CRLF).
- Direct writes to `S.bgColor`/`S.grid` in e2e no longer work; use `w.board.setColor` / `setPaper`.
- **Never edit files with PowerShell `Get-Content -Raw` / `Set-Content`:** Windows PowerShell 5 reads UTF-8 without a
  BOM as ANSI and garbles characters like … ’ ⇄ (it happened to `e2e/phase1.mjs`). Use the Edit tool, or Node
  (`fs.readFileSync(f, 'utf8')`). Use the Edit tool for `package.json` version bumps too.
- Full-screen sheets (the library, New lesson, dialogs) must be mounted in `app.tsx`, not inside `BoardBar` or
  `Popovers`; inside the toolbar container they are boxed in and their buttons can't be clicked.
- Opening/creating a lesson over unsaved work shows a dialog (`role=alertdialog`); e2e must click *Don’t save* / *Cancel*.
- Popovers are rendered by `Popovers()` in laptop mode and by `BoardBar` in board mode; render a new sheet in only one.

- **GitHub CLI** isn't on PATH in Claude's shells. Use `'/c/Program Files/GitHub CLI/gh.exe'` (Bash) or
  `& 'C:\Program Files\GitHub CLI\gh.exe'` (PowerShell). It's logged in as EruditeCoder108.
- **Bash heredocs that contain backticks or `${…}` break** in this environment. For multi-line or
  multi-file edits, use the Edit tool, or write a Python script to the scratchpad and run it. A tiny
  exact-replacement helper pattern (`subs.py` + a spec file of `(path, old, new)`) worked well. Files use
  **CRLF**: preserve line endings with `open(..., newline='')`.
- **e2e:**
  - `npm run e2e:<suite>` builds first. When running `node e2e/x.mjs` directly, run `npx electron-vite build` first.
  - Test windows run **off-screen** (`FW_E2E_OFFSCREEN=1`, set by `launch()`). Never let tests flash on the
    owner's screen; real mouse input there caused flaky failures.
  - `launch()` pre-answers the first-launch question as laptop. Pass `{ layout: null }` to see the chooser,
    or `'board'` for the board layout.
  - A fresh laptop board is a **canvas**. Suites that test pages call `board.convertTo('notebook')` first.
  - `window.__fw` exposes `board`, `S`, `insert`, `replay` for checks.
- **Don't permanently delete user files.** Move them to the Recycle Bin (PowerShell
  `Microsoft.VisualBasic.FileIO.FileSystem` with `SendToRecycleBin`).
- **Look at screenshots** (`e2e/shots/*.png`) after UI work. They have caught overlap and flicker bugs.
- Fullscreen in board mode sets always-on-top `screen-saver`. Dialogs still work.

## 8. Commands

```bash
npm run typecheck
npx vitest run
npm run e2e:board          # board layout, notebook/canvas, palm, paper, subjects
npm run e2e:papers         # paper settings, zoom-adaptive papers, background picture lifecycle
npm run e2e:lesson         # lesson files, appearance in the file, export
npm run e2e:shelf          # My shelf: save, reuse, ink on other boards, whole pages, carry to another PC
npm run e2e:connectors     # attached arrows, end handles, elbows, copies; frames not stacking
npm run e2e:scale          # number line and axes: editor, fractions, units, marked points
npm run e2e:reveals        # prepared reveals
npm run e2e:theme          # light and dark: every surface readable
npm run e2e:export         # export preview and print-friendly
npm run e2e:tools          # calculator, periodic table, writing strips
npm run e2e:tables         # tables
npm run e2e:share          # share to phones: local server, QR, stop/expiry
npm run e2e:track-a        # pictures, PDF, equations, graphs, instruments, pages
node e2e/run.mjs; node e2e/phase1.mjs; node e2e/phase2.mjs; node e2e/laser-audit.mjs; node e2e/agent.mjs; node e2e/replay.mjs
npx electron-vite build && npx electron-builder --win nsis --x64 --publish never   # installer in dist/
```

Silent reinstall (PowerShell, only when the app isn't running):
`Start-Process 'dist\Floating Whiteboard Setup <version>.exe' -ArgumentList '/S' -Wait`

## 9. Updating this file

At the end of each chat, or before switching to a new one:
- Update **§3 State right now** and **§4 What to do next**.
- Add any new owner decisions to §6 and new gotchas to §7.
- Keep it short. Detailed history belongs in `CHANGELOG.md` and the PRs, not here.
