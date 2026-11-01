# Task for the second agent: "Capture to lesson"

Copy everything below the line into the other agent.

---

Good work on Share to phones. The lead reviewed it and merged it into `main` unchanged. Next task.

You are again working on **Floating Whiteboard**, a free GPL-3.0 teaching board for Indian classrooms (smart boards first, also laptops). Stack: Electron 44 + electron-vite, Preact + @preact/signals, Canvas2D, TypeScript. Repo: `D:\Projects 2\whiteboard\app` (GitHub `EruditeCoder108/Whiteboard`). Windows 11, PowerShell. There is no Python on this PC; use Node. Files use CRLF.

Before you start, re-read `docs/NEXT-CHAT-HANDOFF.md` (it has changed: §6 papers and background pictures are now built). Then read section 9 "During class" of `docs/NOTE3-COMPETITIVE-DEEP-DIVE-2026-11-01.md`, the five numbered steps of "Capture to lesson".

## Fresh worktree from the latest main

The lead keeps working in `D:\Projects 2\whiteboard\app`. Never touch that folder. Remove your old worktree and start a new one from the current `origin/main`:

```
cd "D:\Projects 2\whiteboard\app"
git fetch origin
git worktree remove "D:\Projects 2\whiteboard\app-qr-share"
git worktree add "D:\Projects 2\whiteboard\app-capture" -b feature/capture origin/main
cd "D:\Projects 2\whiteboard\app-capture"
npm install
```

Check that `git log --oneline -3` shows the merge of `feature/qr-share`. If it does not, stop and say so. Commit to `feature/capture` and push it. Do **not** open a PR or merge.

## The feature

While explaining a YouTube video, a slide, a PDF in another app or a website, the teacher taps **Capture**. They choose what to grab: a whole screen, one window, or a region of a screen they drag out. The board's own window and controls must **not** appear in the picture. The still lands in the current lesson as a **locked picture** they can write on immediately. It is saved, exported and shared through the normal pipeline because it is an ordinary image item.

### Behaviour (required)

1. **Entry points.** Add a **Capture** tile to the smart board's More menu, as one tile in the existing tile list in `ui/Board.tsx`. Add a **Capture screen…** item to the laptop Insert menu (find it in `ui/Popovers.tsx` or `ui/Insert.tsx`; add one item only). Add the shortcut **Ctrl+Shift+C** in `state/shortcuts.ts`. It must not fire while editing text (follow how the other shortcuts are guarded).
2. **Choose the source.** A full-screen chooser sheet shows large thumbnail tiles for each display ("Screen 1", "Screen 2") and each open window (title and app icon when available), from Electron's `desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize, fetchWindowIcons: true })` in the **main process**. Leave out the board's own windows: the main window and the floating controls window, by their media source ids or titles. Show a Refresh tile and a Cancel tile. Use big touch targets.
3. **Hide ourselves while capturing.** Before grabbing a screen, hide the board without losing state: `win.setOpacity(0)` plus the control window, or `win.hide()`, whichever leaves no trace in the capture. Wait about 150–250 ms for the compositor, grab, then restore exactly: fullscreen, always-on-top, pass-through and bounds as before. Restore even if the capture throws (`try/finally`). A window source doesn't need hiding.
4. **Full resolution.** Grab at the display's real pixel size (`screen.getAllDisplays()`, `size × scaleFactor`) by requesting a `thumbnailSize` of that size, so the capture is sharp. Downscale only through the existing `rasterize()` (max side 2400, WebP) in `engine/media.ts` when inserting.
5. **Region.** After grabbing a screen, show the still full-window inside the app with a drag-to-select rectangle (touch and mouse). Offer large **Use whole screen**, **Use this area** (enabled once a rectangle exists) and **Cancel** buttons. Let the rectangle be adjusted by dragging its corners; corners need at least 44 px touch handles.
6. **Insert.** The result becomes an `ImageItem` with `locked: true`.
   - **Notebook:** if the current page is empty, place it on this page; otherwise on a **new page after this one**. Use `board.addSheet(items, frame, reuseEmptyPage)` the way `importPdf` in `state/insert.ts` does: fit the picture into the 1600×900 sheet with a small margin.
   - **Canvas:** use the next frame, again via `board.addSheet`.

   Afterwards show a toast: "Captured · it is locked, write on it freely", with an **Undo** action if easy (otherwise just the toast; Ctrl+Z already removes it).
7. **Optional, only if everything above is done and tested:** a third button, **Use as page background**, that calls `board.setArt({ src, fit: 'fit', opacity: 1, align: [.5, .5], span: 'first' })` instead of inserting an item.
8. **Limits, stated honestly.** Some windows (DRM video, some hardware-accelerated players) capture black. If a capture comes back fully black, show "That window could not be captured (it may be protected). Try capturing the whole screen instead." Do not claim it captured. On a laptop, a black capture of a DRM video is expected; that's fine.
9. **Privacy.** Nothing is uploaded or written to disk except through the normal autosave of the lesson. Release the thumbnails when the chooser closes.

### Where the code goes (stay inside these files)

You may **create**:
- `src/main/capture.ts`: list sources (without our own windows) and grab one at full size, returning PNG bytes or a data URL plus width and height. It must be testable: keep the Electron calls behind small injectable functions so the source filtering and size logic can be unit tested.
- `src/renderer/src/state/capture.ts`: chooser and region state, plus the insert logic.
- `src/renderer/src/ui/Capture.tsx`: the chooser and the region selector.
- `tests/capture.test.ts` (vitest): source filtering (own windows left out), full-size computation for DPR 1, 1.25, 1.5 and 2, region → crop rectangle maths, black-image detection, and the insert placement (fits 1600×900 with margin, keeps aspect).
- `e2e/capture.mjs`: start the built app, open the chooser, check that tiles appear and our own window is not listed, capture a screen (in e2e, stub the main-process grab through `app.evaluate` if real capture is unavailable off-screen), use a region, and check a locked picture landed on a new page and survives `board.serialize()` → `board.load()`. Model it on `e2e/papers.mjs` and `e2e/share.mjs`.

You may **edit**, small changes only:
- `src/main/index.ts`: IPC `capture:sources` and `capture:grab(sourceId)`, plus the hide/restore of our windows. Check `e.sender` like `share:start` does.
- `src/preload/index.ts`, `src/shared/api.ts`: a `capture` namespace.
- `src/renderer/src/ui/Board.tsx`: one tile in the More menu.
- `ui/Popovers.tsx` or `ui/Insert.tsx`: one menu item.
- `src/renderer/src/state/shortcuts.ts`: Ctrl+Shift+C.
- `src/renderer/src/app.tsx`: mount `<CapturePanel />` once.
- `src/renderer/src/styles.css`: only in a new block at the very end, under `/* ── capture to lesson ── */`.
- `package.json`: an `"e2e:capture"` script. Add no new runtime dependencies; Electron already has everything.

Do **not** touch: `src/renderer/src/engine/*` (call `board.addSheet`, `board.setArt`, `rasterize` and `imageFromBlob` as they are), `ui/Lessons.tsx`, `ui/Paper.tsx`, `state/store.ts`, `state/actions.ts`, `CHANGELOG.md`, `docs/FEATURES.md`, `docs/NEXT-CHAT-HANDOFF.md`, or the version. The lead is changing the export code and the page sorter at the same time.

### Style the owner wants

Same as before. The interface is touch-first on a big classroom panel, with large tiles (reuse `Tile`, `Section` and `chip`), plain words ("Capture", "Use this area", not "Acquire media source") and the existing dark-board variants. Match the surrounding code: short doc comments in plain English that say *why*, compact TypeScript, no new frameworks. Offline-first.

### Tests you must pass before you finish

```
npm run typecheck
npm test
npm run e2e:capture
npm run e2e:papers
npm run e2e:lesson
npm run e2e:board
npm run e2e:share
```

### When you're done, give back

1. The branch name and commit hash, pushed.
2. A short plain-language summary.
3. The pass counts of the seven commands above. The last lines of each are enough; skip the build logs.
4. What you could not verify, for example a real second monitor, DRM windows or the smart board.
5. Any file changed outside the lists, with the reason. Expect none.
