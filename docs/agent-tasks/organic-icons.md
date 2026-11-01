# Task for the second agent: natural, organic icons and images

Copy everything below the line into the other agent.

---

Next task. The lead reviewed and merged your earlier work (Share to phones, Capture). This one is about how the whole app looks.

You are working on **Floating Whiteboard**, a free GPL-3.0 teaching board for Indian classrooms (smart boards first, also laptops). Stack: Electron 44 + electron-vite, Preact + @preact/signals, Canvas2D, TypeScript. Repo: `D:\Projects 2\whiteboard\app` (GitHub `EruditeCoder108/Whiteboard`). Windows 11, PowerShell. There is no Python on this PC; use Node. `ffmpeg` is on PATH. Files use CRLF.

Before you start, read `docs/NEXT-CHAT-HANDOFF.md` (at least §1, §5, §6, §7), and the study report `D:\Projects 2\whiteboard\note3-study\Note-3-Final-Report.pdf`. **Do not list or open the images in the `note3-study` folder**: there are hundreds. The report has all you need.

## Fresh worktree from the latest main

The lead keeps working in `D:\Projects 2\whiteboard\app`. Never touch that folder.

```
cd "D:\Projects 2\whiteboard\app"
git fetch origin
git worktree add "D:\Projects 2\whiteboard\app-organic-icons" -b feature/organic-icons origin/main
cd "D:\Projects 2\whiteboard\app-organic-icons"
npm install
```

Check that `docs/CHECKLIST.md` starts with "Checklist 2". If it does not, stop and say so. Commit to `feature/organic-icons` and push it. Do **not** open a PR or merge.

## The goal

Today every button is a thin line drawing (Lucide). On a classroom panel, teachers have to read the labels to tell them apart. The owner wants the app to feel **natural and organic**: a paintbrush button looks like a paintbrush, a settings button is a real gear, an eraser is an eraser. Someone who has never seen the app should know what each main button does from its picture.

**Use image generation to generate these icons as images with transparent backgrounds.** Then process them and wire them in.

## The style (use this for every image)

**Illustrated classroom objects, handmade and warm.** Not photorealistic, not flat line icons, not glossy 2010 skeuomorphism, not cartoons.

- One object, three-quarter view, the same soft light from the upper left on every image.
- Natural matte materials: wood, brushed brass and steel, paper, felt, chalk, rubber, canvas, painted tin. Gentle surface texture.
- A bold, simple silhouette that fills about 90% of the square. Few details: it must read at 36 px.
- **Transparent background.** No cast shadow, ground shadow, glow, backdrop, or frame. The app adds its own shadow.
- **No words, letters, numbers, logos or brand marks** unless the list below asks for one.
- No faces or mascots. No purple gradients, sparkle effects or neon.
- Objects a teacher in an Indian school would recognise: chalk, a wooden duster, a geometry box, a slate.

One object per image, and keep the style the same across all of them.

**Do not copy Note 3.** The report's picture of it is for understanding only. Never use its screenshots as image input, never trace them, and never ship its assets. The app is open source, so everything in it has to be clean.

## One checkpoint with the owner

Do not generate everything first. Make these eight, in one go, as the style sample: **pen, eraser, settings gear, undo arrow, ruler, timer, camera-free "capture" monitor, Physics magnet.** Build a contact sheet showing them on light and on dark panel colours, at 128 px and at 36 px. Give the sheet to the owner and **wait for their okay or their comments.** After that, make the rest in the same chat or session, using the approved images as the style reference. This is the only stop.

## What to make

Filenames are the kebab-case names below (for example `pen.webp`). Group as you like while generating. A "(new)" entry is for a feature the lead is about to build: make the art now and leave it unused.

**Main tools (board toolbar and laptop toolbar)**
`select` (a chunky arrow cursor, like a cut-out wooden pointer) · `pen` (fine-tip whiteboard pen) · `highlighter` (yellow chisel marker) · `eraser` (wooden-backed felt classroom duster) · `shapes` (wooden circle, square and triangle blocks) · `text` (a single letterpress block with a capital T) · `laser` (slim metal laser pointer with a red dot) · `subjects` (canvas school satchel with books) · `hand` (open palm, in a natural neutral style, not a person) · `lasso` (coiled rope loop) · `sticky` (yellow paper note, one corner curling) · `undo` (a thick curved wooden arrow, pointing left) · `page-back` (a thick straight arrow, pointing left) · `new-page` (white sheet with a green plus) · `frame` (empty thin wooden picture frame) · `more` (four small painted wooden tiles in a square) · `menu` (three stacked wooden bars)

Do not generate `redo` and `page-next`: make them by mirroring `undo` and `page-back` in your script, so the pairs match exactly.

**Writing tools** (new; the lead is adding them as pen styles)
`pencil` · `paintbrush` (round brush with wet paint on the tip) · `chalk` (a white stick, slightly worn) · `felt-marker` (thick whiteboard marker)

**Lessons and files**
`new-lesson` (a fresh notebook with a green plus) · `my-lessons` (books standing on a wooden shelf) · `open-folder` (a manila folder, open) · `save` (a manila folder with a soft green tick, not a floppy disk) · `save-copy` (two overlapping sheets with a green tick) · `export` (a sheet with a curved arrow leaving it) · `recovery` (a rolled-up document with a small clock) · `trash` (a plain tin dustbin) · `rename` (a pencil over a paper label) · `tag` (a brown card label on string) · `search` (a brass magnifying glass)

**Add to the page**
`picture` (a framed landscape photo print) · `my-shelf` (a wooden crate holding papers and small objects) · `capture` (a computer monitor with a corner-bracket crop mark on its screen) · `pdf-worksheet` (a printed worksheet with blank grey lines, no writing) · `table` (a hand-ruled paper grid) · `equation` (a slate with a chalk capital sigma Σ) · `graph` (graph paper with one curved blue line) · `number-line` (a wooden strip with even tick marks and two arrow ends, no numbers) · `axes` (two crossed wooden sticks with arrow tips, like x and y axes) · `periodic-table` (a printed wall chart with coloured blocks, no writing) · `geometry-box` (an open tin geometry box with its instruments) · `ruler` · `set-square` · `protractor` · `compass` (a metal drawing compass with a pencil) · `science-labs` (a conical flask with green liquid) · `calculator` (a chunky desk calculator with blank keys) · `video` (a small film reel) (new) · `audio` (a desktop microphone) (new) · `link` (two chain links) (new) · `slides` (a small stand with a projected blank slide) (new) · `mind-map` (three paper cards joined by string) (new) · `timeline` (a wooden rail with three pegs) (new)

**Teach**
`spotlight` (a stage lamp with a soft beam) · `reveal` (a sheet half hidden behind a sliding paper) · `screen-cover` (a fabric roller blind, half down) · `timer` (a brass kitchen-style countdown timer) · `stopwatch` (new) · `clock` (a round classroom wall clock with no numbers) (new) · `record` (a film clapperboard, blank) · `write-over-screen` (a monitor with a pen resting across it) · `use-apps-below` (a hand tapping through a transparent sheet onto a monitor) · `assistant` (an open notebook with a small brass star on it; no robot, no sparkles) · `magnifier` (a large round reading lens with a wooden handle) (new) · `name-picker` (a tin of wooden sticks) (new) · `dice` (two wooden dice, showing real dot patterns) (new) · `scoreboard` (a small wooden flip scoreboard with blank cards) (new) · `split-board` (a slate divided into two halves by a wooden strip) (new) · `poll` (a small paper ballot box) (new)

**Board and app**
`settings` (a solid steel gear) · `background` (a rolled length of green board material) · `canvas-board` (a wide sheet of paper rolling off into the distance) · `notebook-board` (a spiral-bound notebook) · `hide-toolbar` (a toolbar-shaped wooden tray with a soft "away" arrow) · `show` (an open eye, softly drawn) · `hide` (a closed eye, softly drawn) · `laptop` · `smart-board` (a large wall-mounted panel with a stand) · `minimise` (a window shrinking down to a tray) · `exit` (an open wooden door with a soft arrow leaving through it) · `keyboard` · `pin` (a brass drawing pin) · `lock` (a brass padlock, closed) · `unlock` (a brass padlock, open) · `copy` (two overlapping paper sheets) · `share-phones` (a phone showing a blank square code pattern) · `file-pdf` (a sheet with a red corner band and no text)

**Subjects**
`subject-maths` (a set square and a compass crossed) · `subject-physics` (a red horseshoe magnet with paper clips) · `subject-chemistry` (a test-tube rack with two coloured tubes) · `subject-biology` (a green leaf with visible veins) · `subject-english` (a blank slate; add a capital A in your script) · `subject-hindi` (a blank slate; add अ in your script)

**Papers and strips (small preview tiles)**
`paper-squared` · `paper-graph` · `paper-ruled` · `paper-fourline` · `paper-hindi`: generate a blank paper corner only, then draw the correct lines in your script. Real teachers check these lines, so a generator's guess is not good enough.

**Empty and welcome pictures (640 px wide, not square)**
`empty-lessons` (a tidy empty wooden shelf with one book) · `empty-shelf` (an empty wooden crate) · `welcome-board` and `welcome-laptop` (for the first-launch layout chooser)

**Letters and science must be correct.** Generators garble text and Devanagari. For `subject-english` and `subject-hindi`, generate the slate blank and put the real glyph on it in your script using an installed font (Nirmala UI for Devanagari). For `text` and `equation`, reject anything that is not exactly T or Σ, and composite the glyph yourself if needed. Check every image against what it shows: real dice dots, a compass that could work, a sigma the right way round. Reject and regenerate rather than ship something odd.

## What stays in code (do not generate these)

- **Small universal glyphs, keep Lucide:** close X, tick, plus, minus, chevrons, grip, ellipsis, play, pause, skip and step buttons, bold, italic, align, lists, heading, rows and columns, group and ungroup, front and back, rotate, fit-to-view, and the Science catalogue's own controls. A picture at 15 px is mud.
- **Things that must match exactly what they do, keep Lucide or the existing code:** the shape picker (circle, square, triangle, diamond, line, arrow), ink colour dots, size dots, the eraser size ring.
- **Anything on the board itself is out of scope:** the ruler, protractor, set square and compass *on the board* are painted in `engine/instruments.ts` with real measurements, and papers, number lines, axes, graphs and tables are all exact drawings. Leave them. Board textures are also out of scope.
- **`build/icon.png`, the app's own icon: leave it.**
- **No science apparatus collection.** The owner has scheduled a large set of scientific tools for the end of this run. `science-labs` and the subject pictures are the only science art in this task.

## How to process and store

- Put the 1024 px originals **outside the repository** in `D:\Projects 2\whiteboard\art-masters\` so the public repo stays small.
- Write `build/make-art.cjs`: it takes the masters and writes `src/renderer/src/assets/art/<name>.webp`. A dev dependency such as `sharp` is fine if it installs cleanly; otherwise use ffmpeg. The processed WebP files are committed, so nobody needs the tool to build the app.
- For each image the script must: **check the alpha is real** (fail if the corners are not fully transparent; generators often paint a fake checkerboard), trim the empty edge, centre on a square with an even margin, resize to 192×192, and write WebP with alpha. Mirror `redo` and `page-next`. Composite the glyphs and paper lines.
- Budget: about 30 KB per icon, under 3 MB for the whole set. Report the real total.
- Commit `src/renderer/src/assets/art/SOURCES.md` listing, for each file, the tool, date and prompt, and whether it was edited. The repo is public and this is what lets the project answer questions about its art later.

## How to wire it in (this keeps merges clean)

The lead is changing the UI at the same time, so do not rewrite call sites.

1. Create `src/renderer/src/ui/icons.tsx`. It exports **the same names as `lucide-preact`**, so existing code keeps working: `export const SlidersHorizontal = art('settings')`, and `export { X, Plus, ChevronLeft, … } from 'lucide-preact'` for the glyphs that stay.
2. `art(name)` returns a component that accepts the same `size` and `strokeWidth` props, and renders `<img class="art" src alt="" draggable={false} />` at a size scaled up from `size`. Load the files with `import.meta.glob` so the paths work in the packaged `file://` app. A missing file falls back to the Lucide icon, so nothing ever shows as broken. `pointer-events: none`, so the button keeps every tap.
3. In each UI file change only the import line: `from 'lucide-preact'` becomes `from './icons'`.
4. Where one Lucide icon means two things today, change that one use to a new export, for example `Atom` is both Physics and Periodic table, `MonitorUp` is both Capture and Write over screen, `Calculator` is also Squared paper and the Maths subject, `LineChart` is also Graph paper, `BookOpen` is also English and Four-line paper, `SlidersHorizontal` is Settings, `Blinds` is Screen cover, `Clapperboard` is Record. Touch those lines only.

**Sizes and states.** The current icons are 22 px on the board toolbar, 24 px in tiles, 15–17 px in laptop toolbars and menus. Pictures need more room: about 34–38 px on the board toolbar and in tiles, about 24 px in laptop toolbars and menus. Keep the buttons' outer size if you can; if a label or a tile no longer fits, adjust that button's CSS. Check the toolbar still fits at 1366×768 in board mode.

- **Selected:** today it is a solid blue fill with a white icon, which would look wrong under a picture. Use a soft accent tile, a ring and a slight lift.
- **Disabled:** a CSS grey filter and lower opacity.
- **Danger (Exit):** keep the red label.
- **Dark panels:** add a soft CSS `drop-shadow` and a faint light rim so dark objects stay visible on the dark theme and dark boards. Check the chalkboard board in particular.
- Nothing may flash in late: decode the toolbar's images at startup.

## Where the code goes

You may **create**: `src/renderer/src/ui/icons.tsx`, `src/renderer/src/assets/art/*`, `build/make-art.cjs`, `tests/icons.test.ts` (every name maps to a real file, every file is used, size budget), `e2e/icons.mjs` (the main toolbar, More menu and subject sheet show pictures that actually loaded, `naturalWidth > 0`, on light and dark; takes screenshots).

You may **edit**, small changes only:
- the `lucide-preact` import lines in `src/renderer/src/ui/**`;
- the individual lines in step 4 above;
- `src/renderer/src/ui/kit.tsx` and `BBtn` in `ui/Board.tsx`, for sizes and classes only;
- `ui/Lessons.tsx` and `ui/Shelf.tsx` empty states, and the first-launch chooser, to use the empty and welcome pictures;
- `src/renderer/src/styles.css`, only in a new block at the very end under `/* ── natural icons ── */`;
- `package.json`: an `"e2e:icons"` script and the dev dependency;
- `e2e/theme.mjs` and `e2e/science-library.mjs`, only if they look for `svg` and need to accept `img.art` too.

Do **not** touch: `src/renderer/src/engine/*`, `src/main/*`, `state/*`, `CHANGELOG.md`, `docs/FEATURES.md`, `docs/CHECKLIST.md`, `docs/NEXT-CHAT-HANDOFF.md`, or the version.

## Tests you must pass before you finish

```
npm run typecheck
npm test
npm run e2e:icons
npm run e2e:theme
npm run e2e:board
npm run e2e:lesson
npm run e2e:tools
```

Test windows run off-screen; keep it that way. **Look at your screenshots**: they catch what the tests do not.

## When you're done, give back

1. The branch name and commit hash, pushed.
2. A short plain-language summary.
3. Screenshots, by path: board toolbar and More menu on a white board and on the chalkboard, the subject sheet, and the laptop toolbar.
4. The pass counts of the commands above. The last lines of each are enough.
5. The final count and total size of the art, and any images you were not happy with.
6. What you could not verify, for example the look on a real panel from the back of a room.
