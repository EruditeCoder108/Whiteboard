# Task for the second agent: Tables

Copy everything below the line into the other agent. Give it to the agent once it has finished or stopped the Note 3 study.

---

New task. First, the Note 3 study: `D:\Projects 2\whiteboard\note3-study\REPORT.md` is still marked "in progress". If you can still finish the parts it lists under "Not yet checked", finish them and give back its Top 10 and Top 5 lists before you start this. If you have stopped, say so plainly and move on. Either way the report stays outside the repository.

You are again working on **Floating Whiteboard**, a free GPL-3.0 teaching board for Indian classrooms (smart boards first, also laptops). Stack: Electron 44 + electron-vite, Preact + @preact/signals, Canvas2D, TypeScript. Repo: `D:\Projects 2\whiteboard\app` (GitHub `EruditeCoder108/Whiteboard`). Windows 11. There is no Python on this PC; use Node. Files use CRLF. Never edit files with PowerShell `Get-Content`/`Set-Content` (it garbles UTF-8).

Before you start, re-read `docs/NEXT-CHAT-HANDOFF.md` (§5 and §7 especially) and §8.3 of `docs/NOTE3-COMPETITIVE-DEEP-DIVE-2026-11-01.md`.

## Fresh worktree from the latest main

The lead keeps working in `D:\Projects 2\whiteboard\app`. Never touch that folder.

```
cd "D:\Projects 2\whiteboard\app"
git fetch origin
git worktree remove "D:\Projects 2\whiteboard\app-capture"
git worktree add "D:\Projects 2\whiteboard\app-tables" -b feature/tables origin/main
cd "D:\Projects 2\whiteboard\app-tables"
npm install
```

Check that `src/renderer/src/engine/shelf.ts` exists (My shelf is merged). If it does not, stop and say so. Commit to `feature/tables` and push it. Do **not** open a PR or merge.

## The feature

A teacher taps **Table**, chooses a size, and gets a real table on the board: rows, columns and typed text in the cells. It behaves like every other object: it moves, resizes, copies, undoes, saves in the lesson, goes on My shelf and comes out in PNG and PDF.

Text tables only. Handwriting inside cells is not part of this task: ink drawn over a table simply stays ink on top of it.

### Behaviour (required)

1. **Entry points.** A **Table** tile in the smart board's More menu, section "Add to the page" (`ui/Board.tsx`), and a **Table** item in the laptop Insert menu (`ui/Insert.tsx`).
2. **Choose the size.** A small touch-friendly chooser: rows and columns with large + and − buttons and a live preview, plus **Insert** and **Cancel**. Default 3 × 3. Limits: 1–20 rows, 1–12 columns. It lands in the middle of the visible board (`board.visibleRect()`), selected, sized to fit the view.
3. **Type in a cell.** With the table selected, tap a cell to edit it. Use a real text field over the cell, like `ui/Editor.tsx` does for text (IME and Hindi typing must work). Enter adds a new line in the cell; Tab and Shift+Tab move to the next and previous cell; Esc or a tap outside finishes. One finished cell edit is one Undo step. Empty cells are fine.
4. **Text always fits.** The table must never clip or overflow. Wrap with the shared `wrapText` from `engine/text.ts`, using `fontOf` (it includes the Devanagari font), and let a row grow when its text needs more height, so the table gets taller. Check conjuncts in Hindi, for example "क्षेत्रफल" and "विद्यार्थी".
5. **Change the shape.** When a table is selected, the selection toolbar's "…" panel (`ui/Editor.tsx`) offers: add row, add column, remove row, remove column (on the cell last tapped, otherwise at the end), and a **Heading row** switch (first row bold with a soft fill). Removing a row or column that has text in it is allowed; Undo brings it back. Each is one Undo step.
6. **Resize.** The normal selection handles resize the whole table. Dragging a line between two columns or two rows changes just those two. The grab zone must be at least 44 px wide on touch, in screen pixels at any zoom. Column widths and row heights have a sensible minimum, so text never collapses to nothing.
7. **Style.** Border colour and thickness follow the object's `c` and `w`, so the existing colour and thickness controls work. Text follows `textColor` the same way. It must be easy to read on dark boards and on white ones: a new table takes the current ink colour, the way text does.
8. **Everything else just works**, and you must prove it: move, rotate, lock, group, duplicate, copy/paste, delete, undo/redo, save and reopen, notebook ⇄ canvas conversion, PNG and PDF export, replay not crashing, and My shelf (save a table, insert it into another lesson, and on a board of another colour its lines and text must stay readable).

### Data model

```ts
/** A table of typed text. `cols` and `rows` are fractions of the width and height, each list adding up to 1. */
export interface TableItem extends ObjectMeta {
  t: 'b'
  id: string
  c: string           // lines
  w: number           // line thickness
  p: Rect
  angle?: number
  cols: number[]
  rows: number[]
  cells: string[][]   // rows × cols
  fontSize: number
  textColor?: string
  head?: boolean      // the first row is a heading row
}
```

Items are immutable: every edit replaces the item and goes through History as one op. Add `'b'` to the `Item` and `BoxItem` unions and to `isBox`. Validate strictly when reading a file (`engine/serialize.ts`): sizes within the limits, fractions finite and positive, `cells` matching `rows × cols`, each cell a string within `MAX_TEXT_LENGTH`. A bad table is skipped like any other bad item, never a crash. The file format version does not change.

### Where the code goes

You may **create**:
- `src/renderer/src/engine/table.ts`: pure logic, testable without a canvas: add/remove row and column, divider drag, which cell a point is in, row growth from measured text, painting.
- `src/renderer/src/ui/Table.tsx`: the size chooser and the cell editor.
- `tests/table.test.ts`, `e2e/tables.mjs` (model it on `e2e/shelf.mjs`, using real clicks where you can).

You may **edit**, small and additive changes only, because the lead is building attached arrows in the same engine files at the same time:
- `engine/types.ts`, `engine/items.ts` (bounds, painting, hit test), `engine/serialize.ts`, `engine/shelf.ts` (`readableOn`: the table's `c` and `textColor`), `engine/agent.ts` (its kind name).
- `engine/board.ts`: only `insertTable` and `updateTable` next to `insertGraph` and `updateGraph`, plus the smallest hook needed to open a cell for editing. Add them; do not move or reformat anything.
- `engine/tools.ts`: only the smallest hook needed for divider dragging, if you cannot do it from the selection handles.
- `ui/Board.tsx`, `ui/Insert.tsx`: one entry each. `ui/Editor.tsx`: the caption and the "…" panel entries. `app.tsx`: mount once. `state/store.ts`: popover names only.
- `styles.css`: only in a new block at the very end, under `/* ── tables ── */`. Include dark-board variants.
- `package.json`: an `"e2e:tables"` script. Add no new dependencies.

Do **not** touch: `state/lesson.ts`, `state/shelf.ts`, `ui/Shelf.tsx`, `ui/Lessons.tsx`, `ui/Paper.tsx`, `src/main/*`, `CHANGELOG.md`, `docs/FEATURES.md`, `docs/CHECKLIST.md`, `docs/NEXT-CHAT-HANDOFF.md`, or the version.

### Style the owner wants

Touch-first on a big classroom panel: large targets, everything labelled in plain words ("Add row", not an icon alone), no hover-only controls. Match the surrounding code: short comments in plain English that say *why*, compact TypeScript, no new frameworks. Offline-first. Look at your screenshots in `e2e/shots/` on both a white and a dark board before you call it done.

### Tests you must pass before you finish

```
npm run typecheck
npm test
npm run e2e:tables
npm run e2e:shelf
npm run e2e:lesson
npm run e2e:board
npm run e2e:replay
```

Keep the tests to what matters; do not write hundreds.

### When you're done, give back

1. The branch name and commit hash, pushed.
2. A short plain-language summary.
3. The pass counts of the commands above. The last lines of each are enough; skip the build logs.
4. What you could not verify, for example a real touch panel or an on-screen keyboard.
5. Any file changed outside the lists, with the reason. Expect none.
