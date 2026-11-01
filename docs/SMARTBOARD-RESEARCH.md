# Smart board research and redesign plan

Written **31 October 2026**, after the decision to make the app **smart-board first**: 65–86 inch
(and bigger) touch panels in classrooms, with pages instead of one endless canvas. Laptops and pen
tablets still work, but they are no longer what we design for.

This doc covers what the existing smart-board software does, what we can borrow (ideas and open
source code), how a big touch board changes the interface, and the redesign plan.

---

## 1. What teachers use today

| Software | Who makes it | What it does well | Our take |
|---|---|---|---|
| **SMART Notebook** | SMART (paid) | Biggest ready-made lesson library, page sorter, screen shade, magic pen, activities | The library is why schools pay. Our NCERT library is the answer. |
| **ActivInspire / Promethean Whiteboard** | Promethean | **Unified menu reachable from bottom, left and right**, Annotate floats over any source, split screen for several students, maths tools | Copy the "menu from either side" idea. A teacher standing at the left edge can't reach the right. |
| **myViewBoard** | ViewSonic | Movable floating toolbar, page add/reorder/duplicate/delete, background library, handwriting → text, **QR code to share the session** | Toolbar, page tools, backgrounds and QR share are all worth copying. Many of its extras need sign-in or a subscription. Ours stay free. |
| **BenQ EZWrite** | BenQ | Panel knows **finger vs stylus vs brush**, **palm or back of hand erases**, two pens | Palm erase is a must. We read contact size from the touch events. |
| **Teachmint X (EduAI)** | Teachmint (India) | Android panels with built-in AI tools, teacher sign-in by NFC card, sold with installation and training | Shows the Indian market wants AI on the board. Ours runs on any panel's PC and is open source. |
| **Note3 / EasiNote** | Guangzhou Shirui (CVTE / Seewo family); Note3 is resold by Prestigio and others (paid, per device) | Subject modes with their own toolboxes, "soft pen" ink that varies with speed, navigation map, gesture toolbar, screen cover, spotlight | Very widely used, because the same company builds many of the panels sold under other brands and its app ships with them. See section 1.1. |
| **OpenBoard** | Geneva education dept. (**GPL-3.0**) | Free, cross-platform, annotate documents, web widgets on the canvas | Same licence as us. Its look and pen feel are dated, and it has no library and no AI. This is the gap we fill. |
| **Xournal++** | Community (GPL-2.0+) | PDF annotation, many page backgrounds, **audio recorded and linked to strokes: tap a stroke to hear what was said then** | That last feature is exactly what our lecture notes need. |
| **Rnote** | Community (GPL-3.0) | Good pen feel, shape tools | Ideas only. |
| Microsoft Whiteboard, Samsung Flip | Big tech | Ink beautify, ink → table, templates | Ideas only. |

Sources: [OpenBoard (Wikipedia)](https://en.wikipedia.org/wiki/OpenBoard),
[OpenBoard overview, It's FOSS](https://itsfoss.com/openboard/),
[Promethean ActivPanel guide](https://learn.prometheanworld.com/wp-content/uploads/2021/12/GettingStartedGuide_TitaniumCobalt_December21.pdf),
[myViewBoard floating toolbar](https://myviewboard.com/kb/whiteboard-working-area/floating-toolbar),
[myViewBoard feature comparison](https://myviewboard.com/kb/whiteboard-working-area/wb-features-comparison1),
[BenQ inking (NSW Education)](https://t4l.schools.nsw.gov.au/resources/device_management_resources/main-learning-displays/mldvideosts/benqinteractivityanddigitalinking.html),
[Teachmint X panels](https://blog.teachmint.com/interactive-flat-panel-for-classrooms-in-india-2026),
[Xournal++ package listing](https://snapupdates.popey.com/snap/xournalpp),
[SMART vs ActivInspire (vendor)](https://www.smarttech.com/education/resources/blog/reasons-to-replace-activinspire-with-smart-notebook).
Most of these are vendor pages, so we treat them as feature lists, not reviews.

### 1.1 Note3 / EasiNote: the one Indian teachers already know
Note3 is described as "an updated and improved version of EasiNote". EasiNote's manual names
Guangzhou Shirui (the CVTE group, which also makes Seewo and MAXHUB) as its developer. CVTE builds
panels for many brands, so this family of apps reaches teachers by default. Its Android cousin
(the "Note" whiteboard app on panels like Speechi's) shows the same design ideas.

**What it does that we must match**
- **Subject modes:** Maths, Physics, Chemistry and English, each with its own toolbox
  ("Treasure Box"): grid and lined paper, compass, protractor, ruler, a physics on/off switch, and
  more. Teachers think in subjects, not in tool categories.
- **Soft pen:** the stroke gets thinner when you write fast and thicker when you write slowly, like
  a real brush or marker. **This matters for us:** IR panels report no pen pressure, so without it
  every line is the same width and handwriting looks dead. Our ink (perfect-freehand) can already
  do this; we just switch on speed-based width for touch input.
- **Pen tip, thick end and finger each have their own tool and colour.** For example, fine tip =
  green pen, thick end = red pen, finger = eraser. Turning the stylus around switches colour. The
  palm, fist or edge of the hand erases.
- **Navigation map:** a small overview for jumping around a big page. We need this for
  *Extend down* pages.
- **Page strip:** "+" adds a page, the page number opens previews, arrows go to the previous and
  next page.
- **Themed backgrounds:** writing lines, music staves, sports fields, and black, white or green
  boards, plus your own image.
- **More tools:** table (cells resize on their own), mind map (with handwriting recognition),
  handwriting → text, rough drawing → shape, and a sketch → clip-art suggestion.
- **Pair mode:** the board splits into 2–6 zones so several students write at once.
- Screen cover, spotlight, zoom, annotate over anything. We already have these.

**Where it is weak (our opening)**
- It is **paid per device** and closed source.
- The old EasiNote needs .NET 4 and Flash-era parts.
- It has **no NCERT library** and no Hindi content.
- It has **no lecture notes** from the teacher's own voice and board.
- Its look and feel are generic.

Sources: [Note3 product page (ASBIS)](https://catalog.asbis.com/product/psnte3),
[EasiNote user manual](https://www.manualsdir.com/manuals/796913/prestigio-easinote.html?page=4),
[EasiNote getting started (CCAC)](https://helpcenter.ccac.edu/en_US/easinote/easinote-guide-getting-started),
[Speechi Note tutorial](https://speechi.com/video-tutorial-getting-started-note-whiteboard-application/).

### What nobody does well (our chance)
1. **A modern, fast pen** that feels like a real marker on a big panel.
2. **An NCERT-mapped animated library** that is free, in English and Hindi.
3. **Lecture → notes that use the teacher's own words and the teacher's own board drawings.**
4. **Open source, offline and free.** No sign-in or subscription walls.
5. **Annotate over anything.** Our transparent overlay already does this better than most.

---

## 2. What we borrow

**Open source we can use (GPL-3.0 compatible)**
- **OpenBoard:** import its `.ubz` files (a zip of SVG pages), so schools moving from OpenBoard keep
  their old lessons. It is also a reference for backgrounds and tools.
- **Xournal++:** the audio-linked-strokes idea and its list of page backgrounds. Our board already
  records every stroke with a time, so we only need audio alongside it.
- **Openverse / Wikimedia Commons:** pictures with licence info, for the voice agent.

**Avoid**
- **tldraw:** its licence needs a paid key in production, so it isn't open source for our use.
- Anything NC/ND, same as the asset rules in the master plan.

**Ideas from the paid tools** (we write our own code)
- A menu reachable from left, right and bottom (Promethean).
- A floating toolbar that snaps where the teacher stands (myViewBoard).
- Palm erase and pen/finger by contact size (BenQ).
- A page sorter with thumbnails: add, duplicate, reorder, delete.
- A background library: chalkboard green/black, ruled, four-line English, graph paper, grid,
  dotted, music staff, coordinate axes, outline maps.
- QR code share. We serve it **over the school's local Wi-Fi from the board PC**, with no cloud
  account. When there's no Wi-Fi, the teacher exports the PDF to a pen drive.
- Split screen for 2–3 students writing at the same time.
- Screen capture → new page (freeze a video or slide and write on it).

---

## 3. How a big touch board changes the design

| Laptop / tablet habit | On an 86" board |
|---|---|
| Tooltips on hover | **No hover.** Every button needs a label or a clear icon, and long-press shows its name. |
| Keyboard shortcuts | **No keyboard.** Everything must be reachable by touch. Shortcuts stay as extras. |
| Top bar with window buttons | **The teacher can't reach the top**, especially short teachers and children. Controls live in the bottom third and on the sides. |
| One user at a screen | The teacher stands at the left or right edge. **The menu follows them.** |
| Pen vs finger is known | Most Indian panels are **IR touch: pen and finger both show up as "touch"**. We tell them apart by contact size: a thin tip draws, a palm erases, two fingers move. |
| Thin 2 px ink | Students sit 3–8 m away. **Thicker default ink, high-contrast colours, bigger default text.** |
| Infinite canvas, zoom % | **Pages the size of the screen**, flipped like a notebook. Zoom is rarely needed and lives in a menu. |
| 28 px buttons | **~4–6 cm physical buttons**: 56–58 px at normal Windows scaling, since one px is about 0.75 mm on a 65" panel and about 1 mm on an 86" one. |
| Settings in popovers | One clean settings sheet, with advanced options hidden away. |

**Hardware note.** Many Indian panels run Android, with an optional plug-in Windows PC (an "OPS"
slot). Our Electron app runs on that Windows PC, and on any Windows PC connected to the panel. An
Android build is a later, separate project.

---

## 4. The redesign plan (Track A2: smart board mode)

### 4.1 Two modes, one app
- **Board mode** (new default on big touch screens): full screen, pages, big touch UI.
- **Overlay mode** (today's app): the transparent window that writes over PowerPoint, YouTube or
  the desktop. It is kept and also opened from board mode with one button: *Write over screen*.
- First launch asks **"Smart board or laptop?"**, and the choice can be changed in settings. Screen
  size can't be read reliably, so we ask once rather than guess.

### 4.2 Layout (board mode)
- **Bottom toolbar**, about 60% of the width at most:
  - **Tools:** Pen · Highlighter · Eraser · Select · Shapes · Text · Laser · More.
  - **Pen settings on the bar itself:** 6 board colours and 3 thicknesses. Changing colour is one
    tap, never a popover. Teachers change colour constantly.
  - **Undo/Redo** as large buttons.
- **Snaps where the teacher stands.** Drag the bar left, centre or right, and a double-tap on the
  edge handle brings it to your side.
- **Edge handles** on the left and right edges at mid-height open the main menu from that side
  (Promethean-style).
- **Page control**, bottom corner: `‹ 3 / 12 ›`, ＋ new page, and a tap on the number opens the
  **page sorter** (thumbnails: drag to reorder, duplicate, delete, choose background).
- **Hidden from teachers** (moved to Settings → Advanced):
  - zoom %, pass-through and pin;
  - save status (shown only when saving fails);
  - agent/developer tools, raw recording controls.
- **No top bar** in board mode. Window buttons move into the main menu (*Minimise*, *Exit*).

### 4.3 Pages
- A page is a **fixed 16:9 sheet matching the screen**. Teachers can choose *Extend down* when a
  page fills up, but there is no infinite canvas by default.
- Per-page background from the background library.
- PDF import already makes one page per PDF page. It fits each page to the screen.
- Swipe with two fingers left/right, or use the page buttons, to turn pages.

### 4.4 Touch input
- Contact size from touch events (`width`/`height` on Pointer Events):
  - small → pen;
  - large (palm, back of hand) → eraser while it touches;
  - two fingers → pan or move a selection.
- We measure the thresholds on the real panel and add a small **calibration screen**: "touch with
  the pen, then with your palm".
- **Several writers at once.** In split-screen or "class mode", each finger or pen writes its own
  stroke.
- **Each input gets its own tool and colour:** pen tip, thick end, finger and palm can each be
  set (Note3-style), for example tip = blue pen, thick end = red pen, palm = eraser.
- **Soft pen for touch:** when the panel sends no real pressure, ink width follows writing speed.
- The pen tool keeps hold-to-snap shapes. We **thicken the default ink** and use stronger smoothing
  for finger and IR pens.

### 4.4b Subject toolboxes
One **Subjects** drawer with tabs: Maths, Physics, Chemistry, Biology, English, Hindi. Each tab
holds its instruments, backgrounds, equation snippets and, later, its Lesson Kit animations. This
is the same set of tools as today, sorted the way teachers think.

### 4.5 Visual polish (the "perfect UI" pass)
- **One size scale tied to mode:** board mode multiplies every control size.
- **Calm, solid toolbar:** no hairline borders, clear active state, labels under icons in board mode.
- **Animations:** 120–160 ms, with nothing that delays drawing.
- **Dark chalkboard theme** with ink colours tuned for it (white, yellow, light blue, pink, green).
- The interface stays in English (decided 31 Oct 2026). Hindi is in the content: Hindi lines
  paper, Devanagari text and Hindi library labels.
- **Accessibility:** focus rings, aria labels and enough contrast in both themes.

### 4.6 Classroom extras (after the core)
- Page sorter with backgrounds.
- QR share over local Wi-Fi.
- Screen capture → page.
- Split screen / pair mode (2–6 zones).
- Navigation map for extended pages.
- Table and mind map tools.
- Random name picker, dice.
- OpenBoard `.ubz` import.
- Handwriting → text. The Windows ink recogniser is offline but needs a native module; the cloud
  option is Gemini vision.

---

## 5. How this changes the AI lecture notes

The teacher said: **AI must not add its own content unless the teacher turns that on.**

**Default: faithful notes.** The AI only organises what the teacher said and drew:
- headings and order;
- cleaned-up sentences;
- fixed transcription mistakes;
- formulas typeset properly.

Nothing new is added.

**Optional extras, all off by default, each a switch in the notes settings:**
- short explanations where the teacher went quickly;
- a summary box;
- practice questions;
- translation (Hindi ⇄ English).

Anything added this way is printed in a **separate, clearly labelled "Added by AI" box**, so
students always know what came from the teacher.

**The AI reads the pages.** Pages make this much easier. For each page, the notes maker sends:
1. A **high-resolution snapshot of the page**.
2. **Crops of each drawing**. We know which strokes form which figure, because the board stores
   objects, not just pixels.
3. **The part of the transcript spoken while that page was on screen.**

A vision model (Gemini first, with the teacher's own key) then:
- reads the handwriting;
- understands the diagrams;
- writes notes that refer to them.

The PDF uses the **real board diagrams**, cropped cleanly, placed next to the text that explains
them. As in Xournal++, each section keeps its timestamp, so the app can replay that moment.
