# Next chat handoff

**Updated 1 November 2026 (after the Lesson integrity milestone).** Read this first in every new chat, then update it before the chat ends
(see the last section). Paths are relative to the repository root
`D:\Projects 2\whiteboard\app` unless they start with a drive letter.

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
| GitHub | `EruditeCoder108/Whiteboard` (public); PRs #1–#3 merged, lesson integrity on branch `feature/lesson-integrity` |
| Installed app (owner's laptop) | `%LOCALAPPDATA%\Programs\Floating Whiteboard` (per-user NSIS install, Start menu + desktop shortcut) |
| Latest installer | `dist\Floating Whiteboard Setup 1.6.0-beta.2.exe` (ignored by git) |
| Older unrelated projects in the parent folder | `..\android-library`, `..\*.pyw` (the original Python board). Leave them alone. |

## 3. State right now

- `main` at `ff7bf8d` (1.6.0-beta.1). Branch **`feature/lesson-integrity`** (version **1.6.0-beta.2**) holds the
  finished **Lesson integrity** milestone; see `CHANGELOG.md`. Merge it via a PR before starting the next one.
- **Deep dive progress:** §7 **F1, F2, F3, F4, F5, F6 and F9 are done** (appearance in the file, per-page and
  per-frame look, conversion keeps paper, PNG/PDF match the board, one save convention with big lesson tiles and
  recents, undo for page changes, page names). **Not done:** F7 (simultaneous writers, needs a panel),
  F8 (multipage recording, belongs to C0), page *sections* (F9 asked "titles and small sections"; only titles built),
  print-friendly export for dark boards, export preview, §6 spacing/strength/custom wallpaper, §5/§8/§9 beyond the above.
- **Checks green on the branch:** vitest 244 pass. e2e: board 25, lesson 38 (new), track-a 15, run 46, phase1 23,
  phase2 35, laser 15, agent 40, replay 30, grid 30, canvas 13.
- **Never tested on a real touch panel.** Swipe feel, palm threshold, soft-pen width, IR pens, and the size of
  the new lesson tiles are unverified on hardware.

## 4. What to do next (recommended order)

**The owner's Note3 deep dive (`docs/NOTE3-COMPETITIVE-DEEP-DIVE-2026-11-01.md`) drives the next chats.**
Read the whole document first, not just §7. Work through it iteratively, one milestone per branch:
1. Fix its concrete findings (§7, F1–F9; A below).
2. Then build what it says we're missing:
   - the gap inventory (§5);
   - backgrounds, wallpapers and grids (§6);
   - teaching tools and reusable content (§8);
   - the before / during / after class lesson workflow (§9).
3. Use its priorities and its "required outcome" for each item.
4. After each milestone:
   - tick off what's done in `docs/FEATURES.md`;
   - note in §3 below which deep-dive sections are complete;
   - pick the next section.
5. Where the deep dive and `MASTER-PLAN.md` disagree on order, the deep dive's "make a whole lesson
   dependable first" wins. The library (Track B) and AI notes (Track C) come after.

**A. Next deep-dive milestone: A2.3/A2.4 "Papers, backgrounds and capture".** Lesson integrity (F1–F6, F9) is done.
Pick from the deep dive in this order, one branch each, and tell the owner in plain words after each:
1. §6 backgrounds: paper spacing / strength / line colour, remembered presets, **custom background image** (fit/fill,
   opacity, kept as a retained asset, survives save/convert/export), isometric paper. The paper model is now
   `PageLook {paper, color, title, origin}` (`engine/pages.ts`), painted by `engine/scene.ts` everywhere. Extend that,
   do not add a parallel one.
2. §8 reusable content: personal resource shelf, tables, connectors/mind maps, number line/axes, prepared reveals.
3. §9 workflow: Capture to lesson (screen/window → locked reference), print-friendly export of dark boards, export
   preview, local-Wi-Fi QR share, page sections.
4. Finish F9 (sections), F8 and F7 when the foundations/panel exist.
Keep working iteratively unless the owner redirects.

**B. Then the owner picks the next big track:**
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
  by writing the signal. `S.defaultColor`/`S.defaultPaper` (persisted) are what *new* lessons start with.
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
- **Git:** feature branch → commits → **PR + merge only at major milestones** (the owner's request). Never
  push to main directly. Commits use the owner's GitHub noreply identity (already set globally).
- **No Hindi interface.** Hindi lives in content: papers, library labels, Devanagari text.
- **Notebook pages never zoom or pan.** The canvas is a separate board kind; frames give it pagination.
- **AI notes are faithful by default** (see above). AI reads the board pages and diagrams.
- **Smart board first:** big targets, everything reachable at the bottom and sides, no hover-only UI,
  internals hidden.
- Free and open-source assets only (CC0/PD/CC BY/CC BY-SA; never NC/ND). No AI-slop visuals.
- **Rebuild and reinstall** the owner's app at milestones (commands below), so the installed copy stays current.
- **When a chat gets long and the next task is new, not a continuation:** update this file and give
  the owner a short starter prompt for the new chat.

## 7. Working tips (learnt the hard way)

- **Backslashes in Bash heredocs are halved here.** Anything with a regex backslash must be edited with the Edit tool,
  not a script written through a heredoc. No Python on this PC: for multi-edit scripts write Node (`node file.js`,
  `fs` + exact replacement, convert CRLF → LF → CRLF).
- Direct writes to `S.bgColor`/`S.grid` in e2e no longer work; use `w.board.setColor` / `setPaper`.
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
