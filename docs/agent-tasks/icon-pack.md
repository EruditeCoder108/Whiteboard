# Task for a new agent: a third icon pack, and a guide to the board's features

Copy everything below the line into the new chat.

---

You are working on **Floating Whiteboard**, a teaching board for Indian classrooms, used mainly on big classroom touch panels and also on laptops. Stack: Electron + Preact + TypeScript, on Windows 11. Use Node for scripts (no Python here).

The lead agent keeps working in `D:\Projects 2\whiteboard\app`. **Never change anything in that folder.** Make your own worktree:

```
cd "D:\Projects 2\whiteboard\app"
git fetch origin
git worktree add "D:\Projects 2\whiteboard\app-icon-pack" -b feature/icon-pack origin/feature/tools-polish
cd "D:\Projects 2\whiteboard\app-icon-pack"
npm install
```

Check that `package.json` says version `1.7.0-beta.4`. If it does not, stop and say so. Commit to `feature/icon-pack` and push it. Do not open a PR or merge. `e2e/shots` is tracked and tests rewrite it, so never commit that folder. Do not change any code under `src/` in either part. Do the two parts in order.

## Part 1: a guide to the board's features

The owner wants to know everything the board can do. Write `docs/BOARD-GUIDE.md`, for a teacher who is not technical.

- **Leave out the basics:** pen, highlighter, eraser, undo, colours, text, new page.
- **Cover everything else:** every tile in the More menu, every Settings option, Subjects, the radial menu (press and hold), selecting an object and its action bar, the instruments, apparatus, science labs, students at the board, polls, recording, write on screen, panel check, sharing, and anything else you find.
- **For each one give:** what it does, where to find it, how to use it in a few steps, and any rule that is not obvious.

Hidden rules matter most. For example, a reagent bottle pours only when it stands right above the vessel, and each tap on its cap pours 10 mL. Look for rules like this in the code.

Base it on the code, not on older documents: `src/renderer/src/ui/` for what is on screen, and `src/renderer/src/engine/apparatus/` for the apparatus. Check each thing by running it where you can (`npm run dev`, or the scripts in `e2e/`). Mark anything you could not check as **not checked**. Group the guide by what a teacher wants to do. Use plain words, short lines and no code. Commit and push it.

## Part 2: a third icon pack, test sheet first

The app's current picture icons are too loud, and a little clumsy and childish. The owner wants a third pack with real taste. People will choose it in Settings, beside the current pictures and plain line icons.

**The look:** modern, calm and grown-up, like the icons in a well-designed current app.
- Simple clean shapes and a strong silhouette, recognisable at a glance.
- A small, muted palette: at most two or three colours per icon, and the same palette across the whole set.
- Soft, even depth at most: no glossy shine, no realistic textures.
- No thick cartoon outlines, faces, sparkles, wood grain or toy-like proportions.
- It must read clearly at 32 pixels, on both a white toolbar and a dark one, so avoid very pale or very dark colours as the main colour.
- Every icon must look like the same designer drew it: same angle, same corner roundness, same weight.

**First, only a test sheet, then stop.** Use image generation and make the images with a transparent background. Make these six: `pen`, `eraser`, `select` (an arrow pointer), `settings` (a gear), `science-labs` (a flask), `timer`.

Save them as transparent PNGs in `D:\Projects 2\whiteboard\art-masters-modern\test\`. Then, in the same folder, make `preview.png`, showing all six at real size (32 and 48 pixels) and large (128 pixels), on a white background and on a dark `#1f232b` background.

**Show the owner `preview.png` and stop.** Do not make any more icons until the owner approves the look. If they ask for changes, redo the six.

**After approval, make the rest.** Save each one as `D:\Projects 2\whiteboard\art-masters-modern\<name>.png`, with exactly these names:

apparatus, assistant, axes, background, calculator, canvas-board, capture, chalk, clock, compass, copy, dice, equation, eraser, exit, export, felt-marker, file-pdf, frame, geometry-box, graph, hand, hide, hide-toolbar, highlighter, keyboard, laser, lasso, link, lock, magnifier, mind-map, minimise, more, my-lessons, my-shelf, name-picker, new-lesson, notebook-board, number-line, open-folder, paintbrush, pdf-worksheet, pen, pencil, periodic-table, picture, pin, poll, protractor, record, recovery, redo, rename, reveal, ruler, save, save-copy, science-labs, scoreboard, screen-cover, search, select, set-square, settings, shapes, share-phones, show, slides, split-board, spotlight, sticky, subject-biology, subject-chemistry, subject-english, subject-hindi, subject-maths, subject-physics, subjects, table, tag, templates, text, timeline, timer, trash, undo, unlock, use-apps-below, video, write-over-screen

To see what each one is for, look it up in `src/renderer/src/ui/icons.tsx`. For `subject-english` and `subject-hindi`, draw a clean letter A and अ, and check that the letter is correct. Make `redo` the exact mirror of `undo`.

Then run:

```
node build/make-pack.cjs "D:\Projects 2\whiteboard\art-masters-modern" modern
```

This writes `src/renderer/src/assets/art-modern/`, and the app then offers the pack in Settings › Icons without any code change. Copy the `test` folder out of the masters folder before running this if it would get in the way. Note where each image came from in `src/renderer/src/assets/art-modern/SOURCES.md`, as the existing `assets/art/SOURCES.md` does. Run `npm run build`, open the app, choose the pack, and check the toolbar, the More menu and the radial menu (press and hold) on both a white and a dark board. Commit, push and report.
