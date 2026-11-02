# Checklist 2: the best whiteboard, then the big things

Plain-language progress. ✅ done · 🔄 being built now · ⬜ not started.
The full feature list is in `FEATURES.md`; the details of each release are in `CHANGELOG.md`. The finished first list is `CHECKLIST-1-done.md`.

**The order:** first make the board itself better than every other whiteboard (Note 3 is the baseline). Then working scientific tools, then the big things.

## Step 1: on par with, and better than, every whiteboard app

*Compared with Note 3, SMART Notebook, Promethean, myViewBoard, BenQ EZWrite, OpenBoard, Xournal++ and Microsoft Whiteboard.*

**A. It looks natural**
- ✅ Real pictures for buttons: a paintbrush looks like a paintbrush, settings is a gear *(second agent)*
- ✅ One look for every panel and sheet: quiet, warm surfaces, light and dark
- ✅ Clear buttons at sensible sizes (touch targets grow on the board, the type does not); one look for "this is selected"
- ✅ Clean up clipped labels and awkward wording; a test now checks every sheet

**B. Writing feels right**
- ✅ Pen styles: pencil, paintbrush, chalk, thick marker
- ✅ A tool per input: pen tip, thick end and finger can each be a different tool and colour *(the size check needs a real panel)*
- ✅ Slide to clear the page, and an eraser that is quick to reach

**C. Objects are easy to handle**
- ✅ Big action bar beside whatever is selected: lock, copy, delete, flip, front and back, save to shelf
- ✅ Mirror and flip
- ✅ Text styling within easy reach
- ✅ Links on objects
- ✅ Mind maps

**D. Instruments and graphs**
- ✅ Clearer ruler, set square, protractor and compass: big handles, readable measurements
- ✅ Easier graph entry, without leaving the board

**E. Pages and templates**
- ✅ Templates: Venn diagram, KWL chart, worksheet, steps, cycle
- ✅ Reusable timeline, for history and processes
- ✅ More papers: logarithmic, polar, playing fields (football, cricket, basketball, kabaddi)
- ⬜ Outline maps of India and the world *(waits for the owner: the borders must follow an official source)*
- ✅ Crop a picture by hand, on the page or behind the writing

**F. Everyday classroom tools**
- ✅ Magnifier
- ✅ Fast timer presets, stopwatch and a clock
- ✅ Random name picker, dice, team scoreboard
- ✅ Two to six students writing in their own zones *(tested with simulated touches; needs a real panel)*
- ✅ Quick poll from students' phones over school Wi-Fi (no cloud, no sign-in)

**G. Bring lessons in**
- ✅ PowerPoint slides as pages: exact when Office is on the PC *(Office route not tested: no Office here)*, editable text and pictures without it
- ✅ Video and audio clips on a page (up to 28 MB each, kept in the lesson)
- ✅ Open OpenBoard lessons as pictures to write on *(tested on a sample built to the format, not a real OpenBoard file)*
- ✅ Faster window capture

**H. Handwriting recognition (optional, with correction)**
- ✅ Handwriting to typed text, English and Hindi *(built on a stand-in model; how well it reads needs a real one, and a key from the teacher)*
- ✅ Handwritten maths to an editable equation *(same note)*

**I. Tested on a real smart board** *(needs a panel; moved from Checklist 1)*
- ⬜ Pen, finger and palm on the actual panel
- ⬜ Two people writing at the same time
- ⬜ Display scaling (125%, 150%, 200%) and a slow school PC

## Step 2: working scientific tools (now)

*More than Note 3 offers (about 10 to 12 for each subject), and they really work. Not hundreds.*

- ✅ Parts that connect into real circuits: 17 parts, from cells, bulbs and switches to meters, a galvanometer, capacitors and a motor
- ✅ Physics apparatus that works: pendulum, spring balance, magnet and compass, lenses, mirror, prism and rays, vernier
- ✅ Chemistry apparatus that works: glassware, titration with real pH, burner and thermometer, balance, atomic shells
- ✅ Biology apparatus that works: microscope, cell models, inside a leaf, stoma, breathing model, osmosis, DNA, flower
- ✅ Ready-made examples to start from (circuits, rays, titration, heating)
- ⬜ Pictures for the apparatus tiles and more parts, if teachers ask for them

## Step 2b: polish before the library

*The owner tested 1.7.0-beta.1. The tools we have come first, then the 3D library.*

- ✅ Toolbar fits every screen, including 1280 wide
- ✅ Brush without the streak; quieter side tabs; pictures only where they help
- ✅ Radial menu rebuilt
- ✅ Panel check screen for the real board
- ✅ Audit of every tool and part; science accuracy *(second agent; biology findings still open)*

### Done in 2b (1.7.0-beta.2, 1 Nov 2026)

- [x] One layout: laptop mode and the first-launch question removed.
- [x] The notebook page sits clear of the toolbar with a slim margin; a pen in the margin writes nothing; Hide toolbar gives the full screen.
- [x] Write on the screen, as clean as Note 3's: only a small bar, on a page of its own. No opacity slider.
- [x] Panel check, radial menu, brush fix, quieter edge handles, toolbar at every width.
- [ ] Try all of it on the real board (2 Nov 2026) and bring back the Panel check report.
- [x] Icon packs in Settings: Pictures and Simple lines.
- [x] Merge the second agent's `feature/tools-audit`; fix toolbar overlap, balance masses and resistor bands.
- [ ] Biology findings from `docs/audit/tools-audit.md` (owner kept biology out of the audit pass).
- [x] Board guide merged: `docs/BOARD-GUIDE.md`.
- [x] Physics apparatus redrawn in one professional look; wires visibly reach their terminals (owner, 2 Nov).
- [ ] Chemistry apparatus in the same look.
- [ ] Biology apparatus: use good open-licence art, not drawings made in code (owner, 2 Nov).
- Paused by the owner (2 Nov), for later: the third icon pack. Its brief is `docs/agent-tasks/icon-pack.md`.

## Step 3: the animation library (Lesson Kit)

- ⬜ 3D heart, mitosis, ray optics, 3D glassware
- ⬜ 30 Class 10 diagrams and maths tools

## Step 4: lectures and AI

- ⬜ Lecture recording across pages, with audio
- ⬜ AI lecture notes from the teacher's voice and board (faithful by default)
- ⬜ Voice commands

**Not planned for now:** Flash, a built-in browser, novelty stamps, page-turn sounds, decorative frames, Word export.

---
*Updated 2026-11-02 · version 1.7.0-beta.4, with the physics redraw on `feature/tools-polish`.*
