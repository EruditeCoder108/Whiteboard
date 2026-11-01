# Task for the second agent: study the whole Note 3 app (report with screenshots)

Copy everything below the line into the other agent. Give it to the agent only after it has finished
Capture to lesson.

---

New task, separate from the code. **Do not change any code or any file in the repository.** This is research.

Note 3 (the "Note" app by Shirui/Seewo, installed and possibly open on this PC; the window may belong to `note.exe` or `easirunner.exe`) is the classroom teaching board we take inspiration from. The owner has used it and says it feels polished and "organic". Our app (Floating Whiteboard, see `docs/FEATURES.md` and `docs/CHECKLIST.md` for what we already have) aims to match and then beat it.

**Your job:** go through the **entire** Note 3 app, every toolbar, menu, panel, subject drawer, tool, setting and dialog, and document everything worth seeing, understanding or learning from. The lead developer will use your report to decide what to build next and how it should look and behave.

## Where to put the results

Create the folder `D:\Projects 2\whiteboard\note3-study\`. It is outside the repository on purpose: these are screenshots of someone else's product, for reference only, and nothing from them is copied into our app. Put all screenshots and the report `REPORT.md` there.

## What to cover (all of it)

Work through the app systematically, area by area. For every feature:
- take a screenshot of it in use (full window), plus a close-up where detail matters;
- write the exact clicks to reach it;
- write what it does, in plain words;
- give your judgement: what Note 3 does well, and what is clumsy or missing.

Areas to cover at least:

1. **First impression:** the start screen, the default board, the layout of all toolbars (bottom left, centre, right, edges) and how the toolbars move or hide.
2. **Writing:**
   - pens (types, colours, sizes, chalk, highlighter, brush, any special pens such as rainbow or laser) and how the ink looks up close;
   - eraser (sizes, area erase, palm erase, clear page);
   - selection (move, resize, rotate, copy, lock, layering).
3. **Shapes, text, tables, formulas, any recognition** (shape or handwriting recognition) and how editing works.
4. **Backgrounds and boards:**
   - every built-in background (blackboard, green board, white, paper, grids, lines, music, templates, maps, sports fields, others), each with a full screenshot, one with writing, and a close-up of the texture;
   - measured hex colours for the main boards;
   - custom pictures and colours, per-page or all pages.
5. **Pages:** adding, ordering, the page overview, page turning, page sizes, infinite canvas or not, zoom and pan.
6. **Subject tools** (the left-edge panel: maths, English, physics, chemistry, "note" and anything else): open each, screenshot every tool inside (rulers, protractor, compass, function plotter, periodic table, circuits, molecule builder, word or pinyin tools…), and note what each does.
7. **Resources and insertion:** images, video, audio, documents (PDF or PPT import?), web pictures, the cloud or resource library (note anything that needs sign-in, don't sign in), screenshot/capture tools.
8. **Teaching tools:** timer, spotlight, curtain or screen shade, magnifier, random picker, voting, desktop annotation (writing over other apps), screen recording, the "mode" switch.
9. **Files:** new, open, save, save as, export (formats: PDF, images, its own format?), print, import, autosave behaviour, recent files, where files go, how lessons are organised (folders, courses, chapters?).
10. **Settings:** every settings page, with a screenshot of each.
11. **Feel:** animations, page-turn effects, sounds, response speed, how the UI looks on dark vs light boards, touch-friendliness (size of buttons), anything that makes it feel "organic" or professional.

## Rules

- Use computer control only on the Note app (and File Explorer to save files). Do not sign in to anything, accept terms, buy or upgrade anything, or change Windows settings. If Note 3 asks for that, skip that part and note it.
- Undo or erase anything you draw, close dialogs and leave Note 3 as you found it. Never overwrite existing Note 3 files; if you must save one to test saving, use a new name inside `note3-study`.
- Name screenshots clearly and in order, for example `02-pens-menu.png`, `15-blackboard-closeup.png`, `31-maths-protractor.png`.

## The report (`REPORT.md`)

Use plain language, grouped by the areas above. In each section:
- what the feature is and how to reach it;
- the screenshots, by file name;
- what it does well;
- what is weak.

Finish with:
1. **Feature table:** every Note 3 feature, and whether our app has it (check `docs/FEATURES.md`): yes, partly or no.
2. **Top 10 things worth adopting,** in priority order for Indian classrooms on smart boards, each with one sentence on why.
3. **Top 5 things Note 3 does badly** that we should do better.
4. The background colours table (hex) and your notes on what makes its boards look real.
5. Anything you couldn't reach or check.

When done, give back the folder path, the number of screenshots, and the "Top 10" and "Top 5" lists.
