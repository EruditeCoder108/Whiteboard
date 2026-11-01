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
| Pen styles: marker, pencil, brush, **chalk texture** | 🛠 ⏳ |
| Highlighter that stays behind ink | ✅ |
| **A tool per input:** fine tip, thick end, finger and palm each get their own tool and colour, so turning the stylus around switches colour | 🛠 |
| **Palm, fist or edge-of-hand erase** (wipes like a duster, sized to the hand) | ✅ |
| Stroke eraser, pixel eraser, clear page | ✅ |
| Calibration: "touch with a finger, now with your palm" | ✅ |
| **Several writers at once** (20 touches); pair mode splits the board into 2–6 zones, each with its own pen | 🛠 ⏳ |
| Shape snapping: hold still to turn a rough shape into a clean line, circle, rectangle or triangle | ✅ |
| Shapes, arrows, text, sticky notes | ✅ |
| Lasso and box select; move, resize, rotate; copy/paste; undo/redo | ✅ |
| Handwriting → typed text (English and Hindi) | ⏳ 🎙 |
| Handwritten maths → typeset equation | ⏳ 🎙 |
| Table tool (cells grow on their own) and mind map | ⏳ |

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
| **Background library, per page:** white, black and green chalkboard, ruled, four-line English, Hindi writing lines, mm graph paper, squares, dots, music staff | ✅ |
| More papers: isometric, outline maps of India and the world, your own image | ⏳ |
| Templates: Venn diagram, timeline, KWL chart, worksheet | ⏳ |
| Home screen with recent lessons, a new lesson and open-from-pen-drive | 🛠 |
| Autosave that never loses work | ✅ |

## 3. Import, export and sharing

| Feature | Status |
|---|---|
| Pictures: paste, drop, insert | ✅ |
| PDF worksheets and textbook pages: one page each, write on them | ✅ |
| PowerPoint: present it under the overlay now; import it as pages later | ✅ / ⏳ |
| OpenBoard lesson import (`.ubz`) | ⏳ |
| Export as PDF: a notebook exports whole sheets with their paper (blank ones included), a framed canvas one page per frame | ✅ |
| Export a page as a picture | ⏳ |
| Record the board, replay it step by step, export the replay as a video | ✅ |
| **QR code share over the school's Wi-Fi** (students scan, PDF downloads; no cloud) | ⏳ |
| PDFs small enough to forward on WhatsApp | 🎙 |

## 4. Teaching tools

| Feature | Status |
|---|---|
| **Subjects drawer:** Maths · Physics · Chemistry · Biology · English · Hindi, each with its own tools and papers (lessons join with the library) | ✅ |
| Ruler, set square, protractor, compass, with pen strokes snapping to their edges | ✅ |
| Equations, maths and chemistry (MathJax + mhchem), editable later | ✅ |
| Graph of a function (several functions, editable) | ✅ |
| Number line, fraction bars, coordinate grid, geometry shapes with measurements | ⏳ |
| Calculator, unit converter, periodic table | ⏳ 📚 |
| Spotlight, curtain (screen cover), timer and stopwatch | ✅ |
| Magnifier | 🛠 |
| Random name picker, dice, team scoreboard | ⏳ |
| Screen capture → new page (freeze a video or slide and write on it) | 🛠 |
| Video and audio clips on a page | ⏳ |

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
| **Board mode** (big touch panels) and **laptop mode**, chosen at first launch | ✅ |
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
