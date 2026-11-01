# Floating Whiteboard — master plan

Written **31 October 2026**. This is the top-level plan. It sits above the detailed
[editor roadmap](ROADMAP.md) and [science roadmap](docs/SCIENCE-ROADMAP.md), and those still hold the
fine detail. Nothing here is built yet unless it says so.

## The goal in one line

**The best teaching board for Indian classrooms: a fast pen-first whiteboard, a large animated
science and maths library mapped to NCERT, and an AI helper that listens to the lecture and turns it
into notes.**

Everything core works offline on an ordinary school PC. AI features are optional extras.

**Direction change (31 Oct 2026): smart boards first.** We now design for 65–86 inch (and
larger) classroom touch panels: pages instead of an endless canvas, controls within reach at the
bottom and sides, touch-first input (palm erase, pen vs finger by contact size) and ink readable
from the back row. Laptops and pen tablets still work. The transparent "write over anything" overlay
stays as a second mode. Research, comparison and the redesign plan:
[docs/SMARTBOARD-RESEARCH.md](docs/SMARTBOARD-RESEARCH.md).

---

## 1. Where we are today (honest check)

**Good and worth keeping**
- Pen ink with pressure, smoothing, palm rejection, radial menu, laser pointer.
- Editable text, notes, shapes, groups, lock, undo, save/recovery.
- Lesson recording and replay with timed steps, plus WebM export.
- A real native agent interface (MCP plus a built-in assistant). It reads the board semantically,
  edits through a validated batch, checks the revision and shows a draft before applying. That is a
  solid design.

**Not good enough**
- The science library (14 labs). Physics is okay. Chemistry and biology look like "AI slop":
  shapes drawn in code with no art direction. **Decision: freeze it.** No more work goes into the
  old labs. They get rebuilt on the new Lesson Kit (section 3) and the old code is deleted once each
  replacement exists. Old saved boards keep opening and show the new version of the same topic.

**Missing everyday features** (checked in code: none of these exist yet)
- Images: no paste, no insert, no image object at all.
- PDF import and annotation, and multiple pages.
- Maths instruments: ruler, protractor, compass, set-square.
- Equation typing, a graph plotter, shape recognition (rough circle → perfect circle).
- Export to PDF, Hindi/Devanagari UI and fonts, a screen curtain/spotlight, a timer.
- Connected arrows (planned in the editor roadmap, phase 3).

OpenBoard, the open-source classroom whiteboard maintained by Geneva's education department, ships
most of the items above. A teacher switching to us will expect them.

**Agent gaps** (on first reading of `src/renderer/src/engine/agent.ts` and `src/main/assistant.ts`)
- It can create notes, text, shapes and arrows. It cannot insert a library lesson, an image or ink.
- It never sees the board as a picture. It only gets object lists, so its layout guesses are blind.
- The built-in assistant stops after 4 model rounds and 40 objects. That's fine for small edits but
  too little for "make notes from this lecture".
- It needs a model that supports tool calling. Small local models often don't.

**Known bug: laser flicker when scribbling** (fixed 31 Oct 2026)
In `src/renderer/src/engine/laser.ts`, one contact is drawn as a single path with one straight
colour gradient running from the oldest point to the newest. A scribble doubles back on itself, so
parts of the newest line sit "behind" the oldest point along that straight axis. Those parts get the
fully faded colour and vanish. As the head moves, the axis swings, so chunks disappear and come back.
When head and tail are under 1 px apart it also snaps to a flat colour. **Fix:** split each trail
into short time slices and draw each slice with its own opacity. Joins are hidden by drawing to an
offscreen layer first. Add a scribble case to `e2e/laser-audit.mjs`.

**Performance work worth doing**
- A spatial index (grid or R-tree) so the eraser and hit-testing don't scan every object. Matters on
  big boards. To be measured first.
- Pointer prediction (`getPredictedEvents`) to cut visible ink lag. Works with our current
  non-`desynchronized` canvas, which we keep because screen capture needs it.
- 3D rules (section 3) so many models on one board don't cost GPU while idle.
- A fixed **test PC**: Intel integrated graphics, 8 GB RAM, 1080p touch panel. Every release must
  feel smooth there, not just on the dev machine.

---

## 2. The library: what we will make

The library has **four kinds of content**. Teachers need all four, and they cost very different
amounts to make.

| Kind | What it is | Example | Effort each |
|---|---|---|---|
| **Diagrams** | Clean labelled drawings, editable, you can write on them | Parts of a flower, eye, electric bell, lab setups | Small |
| **Explainers** | Short animations with steps and stops, like a mini video you control | Mitosis, digestion, how a dry cell works | Medium |
| **Simulations** | You change sliders and drag things; real maths runs underneath | Projectile, lens ray diagrams, circuits, pendulum | Medium–large |
| **3D models** | Rotate, zoom, hide parts, cut open, label | Heart, eye, cell, molecules, solar system, solids | Medium–large |

**Diagrams are the most used and the cheapest, so we make lots of them early.** A teacher draws the
same 50–100 NCERT diagrams every year. Giving those as clean, editable, labelled drawings is the
biggest daily time-saver.

### Organisation
- By **NCERT class (6–12) → subject → chapter**, with search. Other boards (state boards, ICSE) are
  mapped later.
- Subjects: **Physics, Chemistry, Biology, Maths**, plus a small **Earth & Space** section (solar
  system, earth layers, seasons). Maths matters: it's taught every day and our tools for it are weak.
- Every label in **English and Hindi** from the start. Other Indian languages are added later through
  the same label files.

### Long-term size (a direction, not a promise)
About **200 diagrams, 60 explainers, 40 simulations and 40 3D models**. That's roughly 340 items,
covering most of what NCERT Classes 6–12 science and maths needs on a board.

### First wave: prove the kit with one of each
1. **3D heart**: rotate, hide parts, cutaway, labels, beating animation (replaces the old heart).
2. **Mitosis explainer**: step through the stages with stops and labels.
3. **Ray optics bench**: drag lenses and mirrors, see the rays and image form (replaces old optics).
4. **Glassware set in 3D**: beaker, flask, test tube, burette with real volumes, used for one
   titration/indicator lesson (replaces the old apparatus).
5. **30 Class 10 science diagrams** in the new style.
6. **Maths instruments**: ruler, protractor and compass on the board.

When these six look and feel great on the test PC, we copy that pattern to everything else. If the
first six don't hit the bar, we fix the kit before making more.

### Then, packs in this order
1. **Class 10 Science** (board-exam year, biggest demand): light, electricity, magnetism, life
   processes, control and coordination, carbon compounds, acids/bases.
2. **Class 9 Science**: motion, force, gravitation, sound, atoms, cell, tissues.
3. **Maths 6–10**: geometry constructions, mensuration solids (3D with nets), graphs, trigonometry.
4. **Classes 11–12** Physics, Chemistry (molecule shapes, orbitals) and Biology (anatomy in 3D).
5. **Classes 6–8**: simpler versions, reusing the same parts.

---

## 3. How we will build it (the Lesson Kit)

The old labs look bad for one reason: **the art was made by writing drawing code.** The fix is a
proper split:

> **Art is drawn by artists' tools. Motion is written in code. Science is a pure formula.**

### Three layers for every lesson
1. **Science model**: plain maths, `state = model(parameters, time)`. No drawing in it. Saving,
   pausing, scrubbing and replay always agree because time is just a number.
2. **Art**: SVG drawings made in **Inkscape** (free, GPL) or 3D made in **Blender** (free, GPL). Each
   moving part has a name (`left-ventricle`, `valve-mitral`).
3. **Lesson script**: a small data file (JSON) that says which parts move with which state, which
   labels appear, and where the guided stops are.

A rough idea of the lesson file:

```json
{
  "id": "bio.heart.3d",
  "ncert": ["10.6", "11.18"],
  "kind": "model3d",
  "asset": "models/heart.glb",
  "labels": { "left-ventricle": { "en": "Left ventricle", "hi": "बायाँ निलय" } },
  "stops": [
    { "title": "Four chambers", "show": ["atria", "ventricles"], "camera": "front" },
    { "title": "Blood path", "play": "circulation", "from": 0, "to": 3.2 }
  ]
}
```

**Why a data file:** it is quick to make many lessons, a teacher can't break the code, and later an
**AI can write these files** (section 4C). That's how "AI makes new lessons" becomes realistic.

### Shared design system (to kill the "AI slop" look)
- One colour palette (clear, textbook-like, colour-blind safe), one line weight scale, one label
  style, one arrow style, one graph style.
- Fonts: **Noto Sans + Noto Sans Devanagari** (OFL licence, free to bundle).
- No random glows or gradients. Every effect must explain something.
- Every scene starts from **real reference pictures** (textbook figure, photo, specimen) and is
  checked side by side before release.
- A **teacher review** is required before anything is marked "classroom ready".

### 2D and 3D: when to use which
- **2D by default.** It's clearer, faster on weak PCs and easy to write on.
- **3D only when turning or cutting open teaches something**: anatomy, molecules, solids, planets,
  apparatus.

### 3D engine rules
- **Three.js** (MIT) for 3D, bundled locally.
- **One shared 3D renderer for the whole board.** Browsers allow only a handful of 3D contexts, so we
  never give each model its own.
- A model only renders while you touch it or it plays. When idle it becomes a still picture on the
  board, so 20 models on a board cost nothing.
- Each lesson has budgets (polygons, texture size, load time) checked on the test PC.
- Glassware and simple apparatus are **generated by code** (a profile spun around an axis), so the
  real inside volume and liquid level are exact.
- Molecules: our own ball-and-stick renderer in Three.js for small NCERT molecules, from free
  structure data. A specialist viewer (3Dmol.js, BSD) is added only if we need proteins.
- A physics engine (Rapier, Apache-2.0) only if a lesson really needs collisions. Most physics is
  exact formulas.

### Equations and maths
- **MathJax** (Apache-2.0) for typed equations: pure SVG output, so equations stay sharp, and chemistry such as `\ce{H2O}` works.
- Own graph plotter and geometry instruments.

---

## 4. Where assets come from (free, allowed licences only)

**Allowed:** CC0, public domain, CC BY, CC BY-SA (kept as separate asset files with credits), and
MIT/BSD/Apache code. **Never** "NC" (non-commercial) or "ND" (no-derivatives). Every asset gets a
record (source link, author, licence, file hash, what we changed), as described in
[the asset research](docs/EDUCATIONAL-3D-ASSETS-RESEARCH.md). An asset without a record does not ship.

| Need | Main source | Notes |
|---|---|---|
| Human anatomy 3D | **Z-Anatomy** (CC BY-SA 4.0), selected **NIH 3D** items | Cleaned in Blender, parts named, made smaller |
| Biology 2D | **NIH BioArt** (public-domain entries) + our own SVG | Check each entry |
| Planets, Earth | **NASA** images and 3D resources (mostly public domain) | Check each file |
| Molecules | **RCSB PDB** (CC0); **PubChem** structure data | Check PubChem source terms per record |
| Glassware, apparatus | **We generate them in code** | Exact sizes and volumes |
| Materials, lighting, props | **Poly Haven**, **ambientCG**, **Kenney** (all CC0) | Friendly extra objects |
| Specimens, historic instruments | **Smithsonian Open Access** (CC0 items only) | Per item |
| Everyday real objects | **NVIDIA SimReady library** (see below) | Only CC0/CC BY items |

### About the NVIDIA release
On **21 Oct 2026** NVIDIA announced the **SimReady Central Library**: 2,000+ 3D assets on Hugging Face,
in OpenUSD format. It is useful but secondary for us:
- It is built for **robots and factory/warehouse simulation**: boxes, shelves, tools, machines, everyday
  objects. It has no anatomy and no chemistry glassware.
- **Licences differ per asset**, and some are non-commercial. We'd take only CC0/CC BY ones.
- The files are USD. We convert them to GLB in Blender and shrink them.
- **Use it for** real-looking props: tools for "simple machines", objects on an inclined plane, a
  pulley or trolley, everyday items for density/floating lessons.

---

## 5. AI features

AI is **optional and off by default**. The teacher chooses a provider: a local model on the PC, or a
cloud API with their own key. The app already supports both, through any OpenAI-style endpoint.
**Gemini comes first** because it takes long audio and images in one request. The key is pasted in
settings, stored encrypted on the PC (Electron `safeStorage`) and never put in the repo. The free
tier is fine for building and demos. Google may use free-tier data to improve its products, so
real classroom audio needs a paid key or offline transcription.

### 5A. Lecture → beautiful PDF notes (best college-project candidate)
**Can it be done? Yes.** We already have half of it: the board records timed steps.

How it works:
1. **Microphone.** One wireless collar mic (the kind with a small USB receiver) plugged into the PC.
   The PC sees it as a normal mic. A second mic adds little, so start with one.
2. **Transcribe while teaching.** Offline with **whisper.cpp** (MIT). Hindi/Hinglish is the weak
   spot: stock Whisper does poorly on mixed Hindi-English speech, so we test Indian fine-tuned models.
   A cloud speech API is an optional "high accuracy" mode. Each sentence gets a timestamp.
3. **Line it up with the board.** The recording already knows what was drawn and when, so each part
   of the speech is matched to the board picture at that moment.
4. **Make notes.** At the end the teacher presses *Make notes*. For every page, the AI gets the
   page snapshot, clean crops of each drawing, and the speech from while that page was shown. A
   vision model reads the handwriting and diagrams. It turns all of this into sections, headings,
   definitions and typeset formulas, with the real board diagrams placed beside the text that
   explains them.
   **Faithful by default:** the AI only organises and cleans up what the teacher said and drew,
   and adds nothing of its own. Extras (explanations, summary, practice questions, translation)
   are separate switches, all **off** by default. Anything they add is printed in a labelled
   "Added by AI" box.
5. **The teacher checks and edits** the draft. Nothing goes out unchecked, because AI can get facts
   wrong.
6. **PDF.** Electron can print to PDF with nothing extra installed. Includes the school name, date,
   subject and class.

Must-haves: a clear "recording" light, recording only when the teacher starts it, audio kept on the
PC, and the option to delete audio after the notes are made. Student voices are personal data under
India's DPDP Act, so the default is **keep the transcript, delete the audio**.

### 5B. Voice commands during class ("Saathi, draw …")
**Can it be done? Yes, with care.**
- **Trigger:** start with a **button / shortcut / glove gesture** (push-to-talk). Teachers talk
  non-stop, so a wake word fires by mistake often. Add a wake word later using a distinctive name
  ("Saathi") spotted in the live transcript, so no extra model is needed.
- **What it can do:** everything the agent can do now, plus the new abilities the agent needs:
  insert a library lesson ("show the 3D heart"), insert a diagram, insert an image, make a table or
  mind map, set a timer, go to the next page.
- **Images from the internet:** search **Openverse** and **Wikimedia Commons**. Both return licence
  info, and we stamp the credit under the image. Optional AI image generation through the teacher's
  API key.
- **Safety:** the AI's change appears as a **draft**, and one tap (or a glove pinch) applies it. The
  agent already works this way.
- **Agent upgrades needed:** new operations (insert lesson, insert image, insert diagram, draw ink),
  a picture of the board sent to vision-capable models, and smarter "find empty space" placement.

### 5C. AI makes new lessons and 3D (later)
**Realistic version:** the AI **assembles** lessons from our kit by writing a lesson file (section 3)
out of existing parts, art and models. For example: "a lesson on the human ear using the ear model,
stopping at each bone".

**Not realistic yet:** AI generating *accurate* scientific 3D models from scratch. Today's
image-to-3D tools make nice-looking props but get anatomy and apparatus wrong, and often have
licence limits. We keep that as an experiment for props only, clearly marked "AI-generated, not
checked".

---

## 6. Gesture ring / glove (college project)

**Can it be done? Yes. It's a very good demo.** The trick that makes it easy: **the ESP32-S3 can
pretend to be a Bluetooth mouse and keyboard.** Windows sees a normal mouse, so it controls the
whole computer and our whiteboard with no driver and no special software.

### Parts (rough)
- **ESP32-S3 Super Mini**: has Bluetooth LE, and its touch pins sense your finger.
- **Motion sensor:** choose a **BNO085** (does the angle maths itself, easiest for a beginner) or a
  **BMI270 / ICM-42688-P** (cheaper, you do the maths). The old **MPU6050** works but drifts and is
  noisy, so avoid it if you can.
- **Pinch sensor:** copper tape on thumb and index finger wired to two touch pins. Touching them
  together = click. Simple and reliable.
- **Small LiPo battery (300–500 mAh) + charger board**, if your Super Mini has no charging circuit.
  Check your exact board.

### How it works
- **Moving the cursor:** use the **gyroscope (turning speed)** like a TV air-mouse, not the
  accelerometer for position. Position from an accelerometer drifts away within seconds; every
  hobby air-mouse uses rotation.
- **Clutch:** the cursor moves only while you hold a "move" pose (e.g. thumb resting on the middle
  finger), so you can reset your hand like lifting a mouse.
- **Smoothing:** a "One Euro filter" removes hand shake but stays fast.
- **Gestures:** pinch = click/draw; pinch-and-hold = drag/draw a line; double pinch = undo; quick
  flick left/right = previous/next page; twist = open the radial tool menu. Gestures are sent as
  keyboard shortcuts the board already understands, so no app changes are needed for a first demo.
- **Later:** a whiteboard mode where a gesture triggers the voice agent (5B), and a small settings
  page for sensitivity.

**Honest limit:** air-drawing is great for pointing, laser, arrows, circling and highlighting. Neat
handwriting from across the room is hard for anyone, so pair it with shape recognition (rough
circle → clean circle) to make it look good.

---

## 7. The order we build things

There are four tracks. The college project tracks (C and D) don't depend on the library, so they can
start now.

**Track A: Board essentials**: done on 31 Oct 2026 (see [CHANGELOG](CHANGELOG.md)). The
interface stays in English (decided 31 Oct); Hindi lives in the content. Still to do: a full spatial index (only a bounds check so far, which is enough for typical boards) and
benchmarks on the test PC.
1. Fix the laser flicker, plus a scribble test.
2. Images (paste/insert), pages, PDF import and annotation.
3. Maths instruments, equations (MathJax), graph plotter, shape recognition.
4. Export PDF, Hindi UI and fonts, curtain/spotlight, timer.
5. Performance: spatial index, pointer prediction, test-PC benchmarks.

**Track A2: Smart board mode (next).** Do this first, because every later screen (library,
notes) is built on it. Detail: [docs/SMARTBOARD-RESEARCH.md](docs/SMARTBOARD-RESEARCH.md),
section 4.
1. Board mode vs overlay mode, plus the first-launch choice. A size scale for big panels.
2. New layout: bottom toolbar with colours and sizes on it, snapping to the teacher's side; edge
   menus; page control and page sorter. Developer and rarely used controls hidden.
3. Screen-sized pages, the background library, and *Extend down*.
4. Touch input: palm erase, pen/finger by contact size, calibration, several writers at once.
5. Visual polish pass, chalkboard theme.
6. Then the extras: QR share over local Wi-Fi, screen capture → page, split screen, OpenBoard
   import.

**Track B: Library**
1. Build the Lesson Kit: lesson file format, design system, 2D scene kit, shared 3D viewport,
   asset records.
2. First wave of six (section 2). Fix the kit until they're great.
3. Delete the old labs as their replacements land. Keep old saved boards opening.
4. Packs: Class 10 Science → Class 9 → Maths → 11–12 → 6–8.

**Track C: AI** (college project candidate)
1. Mic capture + offline transcription with timestamps.
2. Lecture → notes → PDF (needs Track A's images and PDF export, or a simple first version).
3. Push-to-talk voice commands + new agent operations.
4. Later: AI-assembled lessons.

**Track D: Gesture ring** (college project candidate)
1. Breadboard: ESP32-S3 + sensor + pinch, working as a Bluetooth mouse.
2. Smoothing, clutch, gestures as shortcuts.
3. Wearable ring/glove, battery, case.
4. Hook into the board: tool switching, laser, voice trigger.

**Suggested college project:** a **"hands-free AI classroom"**: the ring for control, the voice
helper for commands and auto-generated lecture notes, all on our board. It shows hardware, AI and
software together, and every piece is useful afterwards.

---

## 8. Rules that don't change

- Core teaching works **offline, without an account, on a normal school PC**.
- Nothing is called "classroom ready" until a teacher has checked it.
- Every asset has a licence record; no NC/ND content ships.
- AI never changes the board without showing a draft, and never sends audio or board content
  anywhere the teacher hasn't chosen.
- Science stays honest: illustrations are labelled as illustrations, and simplified models state
  what they leave out.
