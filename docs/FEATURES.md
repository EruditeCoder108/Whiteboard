# Floating Whiteboard: the full feature list

What the finished app will do. Written 31 October 2026.

The aim is to be **better than Note3 / EasiNote and the panel makers' own apps in everything that
matters**: so good that panel makers and schools choose to ship it.

The gesture ring is not here. It's a separate college project, not part of the product.

**Status:**

| Mark | Meaning |
|---|---|
| ✅ | Built today |
| 🛠 | Track A2 (smart board mode, next) |
| 📚 | Track B (library) |
| 🎙 | Track C (AI) |
| ⏳ | Later |

Plan and reasons: [MASTER-PLAN.md](../MASTER-PLAN.md) · [SMARTBOARD-RESEARCH.md](SMARTBOARD-RESEARCH.md)

---

## Why a school picks us over Note3

| | Note3 / EasiNote | Floating Whiteboard |
|---|---|---|
| Price | Paid licence per device | **Free, open source (GPL-3.0)**, no account or subscription |
| Content | Generic tools | **NCERT-mapped animated library, Class 6–12, English + Hindi** |
| Lecture notes | None | **Notes from the teacher's own voice and board drawings, made into a PDF and shared by QR** |
| Ink | Soft pen | Soft pen **plus** real pen pressure, prediction for low lag, shape snapping |
| Hindi content | Not documented | Devanagari text, Hindi writing lines, Hindi labels in the library |
| Over other apps | Annotate | Annotate **plus** a click-through overlay, screen → page, and a replay you can export as a video |
| AI | None | Optional, teacher-controlled, and faithful to the lecture by default |
| Panel makers | Closed | Can be branded with their logo and shipped preinstalled, and IT can deploy it silently |

---

## 1. Writing and ink

| Feature | Status |
|---|---|
| Fast pen with real pressure, smoothing, and pointer prediction for low lag | ✅ |
| **Soft pen** for IR panels, which send no pressure: line width follows writing speed | ✅ |
| Pen styles: pen, pencil, brush, **chalk texture**, chisel marker | ✅ |
| **Slide to clear** the page, with Undo | ✅ |
| Highlighter that stays behind ink | ✅ |
| **A tool per input:** fine tip, thick end, finger and palm each get their own tool and colour, so turning the stylus around switches colour (told apart by contact size; needs tuning on a real panel) | ✅ |
| **Palm, fist or edge-of-hand erase** (wipes like a duster, sized to the hand) | ✅ |
| Stroke eraser, pixel eraser, clear page | ✅ |
| Calibration: "touch with a finger, now with your palm" | ✅ |
| **Students at the board:** several write at once, together or on 2, 3, 4 or 6 sides, each with their own colour, eraser and undo (tested with simulated touches) | ✅ |
| Shape snapping: hold still to turn a rough shape into a clean line, circle, rectangle or triangle | ✅ |
| Shapes, arrows, text, sticky notes | ✅ |
| Lasso and box select; move, resize, rotate; copy/paste; undo/redo | ✅ |
| Handwriting → typed text (English and Hindi), checked by the teacher first; needs a model the teacher connects | ✅ 🎙 |
| Handwritten maths → editable equation, checked by the teacher first; needs a model the teacher connects | ✅ 🎙 |
| Mind maps: one tap adds a branch in a clear spot, tied by a line that follows it | ✅ |
| Big named actions beside a selected object; bigger, smaller and bold within reach | ✅ |
| Mirror and flip (pictures really mirror; writing keeps reading the right way round) | ✅ |
| Links on objects (web addresses only), opened in the browser | ✅ |

## 2. Pages and lessons

| Feature | Status |
|---|---|
| Pages: add, delete, PgUp/PgDn and presentation clickers | ✅ |
| **Two kinds of board: Notebook or Canvas.** A notebook is a stack of fixed 16:9 pages, each at one fixed size (no zoom, no panning); a canvas is one endless board, free to zoom and pan, with no pages | ✅ |
| **Frames on a canvas:** mark sheet-sized areas, numbered, and step through them with Back/Next like slides; the infinite canvas and pagination together | ✅ |
| Turn a notebook into a canvas (pages become frames side by side) and back again; nothing is lost | ✅ |
| **More space below:** a page grows a screen at a time (up to 8), and empty space can be removed again | ✅ |
| **Turning pages:** two-finger swipe, toolbar Back/Next, PgUp/PgDn or a presentation clicker, with a quick slide (on a canvas the same controls fly between frames) | ✅ |
| PDF worksheets: a page each in a notebook, a frame each on a canvas; slides fill the sheet, portrait sheets sit at a readable width and the sheet grows to fit | ✅ |
| **Page sorter:** thumbnails, reorder, duplicate, delete | ✅ |
| **Page map** for a long page (drag to scroll) | ✅ |
| **Background library, per page:** white, black and green chalkboard, ruled, four-line English, Hindi writing lines, graph paper, squares, dots, music staff | ✅ |
| Realistic board surfaces: chalkboard, green board, slate, navy board, paper, brown paper (texture + colour, any combination; whole lesson or one page) | ✅ |
| Isometric dots and grid; lesson layouts (two columns, three columns, worked example, exit ticket) | ✅ |
| Paper spacing, strength and line colour, for this page or all pages; restore as designed | ✅ |
| Writing papers follow the zoom on a canvas (no stretched or crowded lines); graph paper keeps its scale | ✅ |
| Your own background picture: fit or fill, position, strength, long-page placement; kept in the lesson, survives erase/clear, save, convert and export | ✅ |
| Semi-log, log-log and polar papers; football, cricket, basketball and kabaddi fields, drawn to true proportions | ✅ |
| Outline maps of India and the world (the borders must follow an official source) | ⏳ |
| Templates: Venn diagrams, KWL chart, two columns, timeline, steps, cycle, worksheet; all ordinary objects | ✅ |
| Crop a picture by hand, on the page or behind the writing | ✅ |
| **My lessons:** every lesson filed by subject with a first-page picture and date; search, open, rename, copy, show in folder, delete to the Recycle Bin | ✅ |
| New lesson with a name, subject or class, and notebook or canvas | ✅ |
| **Tables:** typed text in rows and columns; Tab between cells; rows grow to fit; add, remove, drag lines, heading row; Hindi; behaves like any other object | ✅ |
| **Prepared reveals:** hide objects until named steps; large Next button, clicker support, cards to tap; state saved in the lesson; exports keep answers hidden unless asked | ✅ |
| **Light and dark mode** for the whole app: Auto follows the board, or Light or Dark | ✅ |
| **Export preview** with sheets to leave out, and **print-friendly PDFs** of dark boards | ✅ |
| **Calculator** (degrees, writes its answer on the board) and **periodic table** (118 elements, offline, onto the board) | ✅ |
| **Writing strips:** four-line and Hindi bands as objects | ✅ |
| **Number line and coordinate axes:** measured objects with their own range, step, name and unit; fraction labels; same scale both ways; points marked exactly on the scale | ✅ |
| **Attached arrows and lines:** follow the objects they hold, live; edge of a box or a spot on a picture; end handles to re-attach; straight or elbow; kept through copies, My shelf, files and conversion | ✅ |
| **My shelf:** save a selection or whole page once, reuse a fresh editable copy in any lesson; by subject, with search, rename, delete; ink adapts to the board colour; carry it to another PC as one file | ✅ |
| Every lesson saves itself to its own file (Documents › Floating Whiteboard › Lessons); Ctrl+S saves at once | ✅ |
| Page sections: headings in the page sorter ("Warm-up", "Practice"), saved with the lesson | ✅ |
| Autosave that never loses work | ✅ |

## 3. Import, export and sharing

| Feature | Status |
|---|---|
| Pictures: paste, drop, insert | ✅ |
| PDF worksheets and textbook pages: one page each, write on them | ✅ |
| PowerPoint as pages: exact through Office when it is on the PC; with no Office, editable text, pictures, tables and shapes | ✅ |
| OpenBoard lesson import (`.ubz`), as pictures to write on | ✅ |
| Export as PDF: a notebook exports its sheets with their paper (blank ones included), a framed canvas one page per frame; long pages split by screen | ✅ |
| Export a page, everything or the selection as a picture (paper and board colour included, or ink only) | ✅ |
| Lesson files: New, Open, Save now, Save a copy, recent lessons; open from a pen drive | ✅ |
| Board colour, paper and page names saved with the lesson; kept through notebook ⇄ canvas | ✅ |
| Undo for page and board changes (delete, move, copy, convert, colour, paper) | ✅ |
| Record the board, replay it step by step, export the replay as a video | ✅ |
| **QR code share over the school's Wi-Fi** (students scan, PDF downloads; no cloud; 30-minute link, Stop sharing, download count) | ✅ |
| PDFs small enough to forward on WhatsApp | 🎙 |

## 4. Teaching tools

| Feature | Status |
|---|---|
| **Subjects drawer:** Maths · Physics · Chemistry · Biology · English · Hindi, each with its own tools and papers (lessons join with the library) | ✅ |
| Ruler, set square, protractor, compass, with pen strokes snapping to their edges | ✅ |
| Equations, maths and chemistry (MathJax + mhchem), editable later | ✅ |
| Graph of a function (several functions, editable) | ✅ |
| Fraction bars, geometry shapes with measurements | ⏳ |
| Unit converter | ⏳ 📚 |
| **Working apparatus** (More › Apparatus, or Subjects): 58 parts that really work: 28 for physics, 17 for chemistry, 13 for biology | ✅ |
| **Real circuits:** cells, batteries, AC supply, switches, resistors, rheostat, bulbs, LEDs, diodes, capacitors, coils, ammeter, voltmeter, galvanometer, fuses, motor, buzzer; drag between terminals to wire them; meters read true values; bulbs burn out and fuses blow; short circuits warn | ✅ |
| **Light:** a ray box shines through lenses, mirrors and a prism on the page; white light splits into its colours | ✅ |
| **Chemistry:** glassware with liquid levels, titration with worked-out pH and real indicator colours, burner that heats what is above it, thermometer and pH paper that read the vessel they stand in, balance, atomic shells to krypton | ✅ |
| **Biology:** microscope with a focus knob and three slides, glass slide, plant and animal cells, bacterium, nerve cell, inside a leaf, a stoma that opens and closes, flower, breathing model, osmosis, DNA | ✅ |
| Ready-made set-ups: Ohm's law, series and parallel, charging a capacitor, titration, heating, prism and more | ✅ |
| Instruments with finger-sized buttons and live readings: a line's length along the ruler, a protractor arm that reads the angle, the compass radius | ✅ |
| Graph entry by tapping: keys, common curves, live preview, zoom | ✅ |
| Spotlight, curtain (screen cover), timer and stopwatch | ✅ |
| Magnifier that redraws the board, so writing stays sharp | ✅ |
| Clock, with the date; timer presets that start on one tap | ✅ |
| **Ask the class:** a poll from students' phones over the school's own network, with no account; the result can go on the board | ✅ |
| Name picker (roll numbers or names, everyone gets a turn), dice, team scoreboard | ✅ |
| Screen capture → new page (freeze a screen, window or area and write on it; Ctrl+Shift+C) | ✅ |
| Video and audio clips on a page, kept in the lesson (up to 28 MB each) | ✅ |

## 5. Write over anything (overlay mode)

| Feature | Status |
|---|---|
| Transparent board over PowerPoint, YouTube, browser or desktop | ✅ |
| Click-through to the app underneath, then back to drawing | ✅ |
| Opened from board mode with one button: *Write over screen* | ✅ |

## 6. The library (Lesson Kit)

| Feature | Status |
|---|---|
| **NCERT-mapped**, searched by class → subject → chapter | 📚 |
| **Four kinds of content:** labelled diagrams, step-by-step explainers, simulations with sliders, 3D models you rotate and cut open | 📚 |
| Labels in **English and Hindi**; hide labels for a quick class quiz | 📚 |
| First wave: 3D heart, mitosis, ray optics, 3D lab glassware, 30 Class 10 diagrams, maths instruments | 📚 |
| Everything offline, with the licence credit on every asset | 📚 |
| Draw on top of any animation; drop it onto a page | 📚 |
| Old science labs replaced one by one | 📚 |

## 7. AI (optional, off by default, teacher's own key)

| Feature | Status |
|---|---|
| Provider choice: Gemini first, any OpenAI-style API, or a local model. Key stored encrypted. | 🎙 (OpenAI-style ✅) |
| **Lecture notes:** a collar mic records the lecture and it is transcribed live with timestamps | 🎙 |
| **Faithful notes by default:** only what the teacher said and drew, organised and cleaned up | 🎙 |
| **AI reads every page:** handwriting and diagrams, using the real board drawings in the PDF | 🎙 |
| Extras **only if the teacher turns them on**: explanations, summary, practice questions, translation. Each is marked "Added by AI". | 🎙 |
| Teacher reviews and edits before sharing | 🎙 |
| PDF with school name, class, subject and date | 🎙 |
| Tap a section → replay that moment of the board, Xournal++-style | 🎙 |
| Audio deleted after notes by default (DPDP Act) | 🎙 |
| **Voice commands** (push-to-talk, wake word later): "next page", "show the 3D heart", "draw axes", "insert a picture of a volcano" | 🎙 |
| Picture search with licence info (Openverse, Wikimedia Commons) | 🎙 |
| AI changes appear as a draft first, applied with one tap | ✅ (agent) |
| Board agent for power users (MCP) | ✅ |
| AI-assembled lessons from the library | ⏳ |

## 8. Interface

| Feature | Status |
|---|---|
| **One layout on every screen**, from a big touch panel to a small laptop; the page sits clear of the toolbar | ✅ |
| **Write on the screen:** the board disappears, a small bar remains, and the writing is kept on its own page | ✅ |
| **Bottom toolbar that snaps to the teacher's side**, plus menus from the left and right edges | ✅ |
| Colours and pen sizes **on the toolbar**: one tap, no popover | ✅ |
| Buttons 4–6 cm across on the panel, labels under icons | ✅ |
| Thick default ink and high-contrast colours, readable from the back row | 🛠 |
| Light theme and **chalkboard theme** (toolbar goes dark on a dark board) | ✅ |
| Internals hidden: zoom %, pin and pass-through tucked away; save status only on error | 🛠 |
| Settings for teachers, plus an *Advanced* page for IT | 🛠 |
| Radial tool menu (press and hold) | ✅ |

## 9. For schools, IT and panel makers

| Feature | Status |
|---|---|
| Works fully offline; no account, no subscription, no ads | ✅ |
| Free and open source (GPL-3.0) | ✅ |
| Runs on the panel's Windows PC module (OPS) or any Windows PC | ✅ |
| Linux build; Android version | ⏳ |
| **Smooth on low-end school PCs** (target: 60 fps ink on an i3/Celeron OPS) | 🛠 benchmark |
| Silent install for IT; settings from a config file; updates on or off | ⏳ |
| **Branding for panel makers and schools:** logo on the splash and notes, preinstalled | ⏳ |
| Teacher profiles (own lessons and settings, optional PIN) | ⏳ |
| Student voices and lesson data stay on the PC | ✅ / 🎙 |
