# Task for the second agent: audit and polish the tools

Copy everything below the line into the other agent.

---

Good work on the classroom pictures. The lead reviewed them and merged them into `main`. Next task.

You are working on **Floating Whiteboard**, a teaching board for Indian classrooms (smart boards first, also laptops). Stack: Electron 44 + electron-vite, Preact + @preact/signals, Canvas2D, TypeScript. Repo: `D:\Projects 2\whiteboard\app`. Windows 11, PowerShell. There is no Python on this PC; use Node. `ffmpeg` is on PATH. Files use CRLF.

Before you start, read `docs/NEXT-CHAT-HANDOFF.md` (§1, §5, §6, §7) and `docs/CHECKLIST.md`.

## Fresh worktree from the latest main

The lead keeps working in `D:\Projects 2\whiteboard\app`. Never change anything in that folder. Remove your old worktree and start a new one:

```
cd "D:\Projects 2\whiteboard\app"
git fetch origin
git worktree remove "D:\Projects 2\whiteboard\app-organic-icons"
git worktree add "D:\Projects 2\whiteboard\app-tools-audit" -b feature/tools-audit origin/main
cd "D:\Projects 2\whiteboard\app-tools-audit"
npm install
```

Check that `package.json` says version `1.7.0-beta.1`. If it does not, stop and say so. Commit to `feature/tools-audit` and push it. Do **not** open a PR or merge. `e2e/shots` is tracked and every test run rewrites it: run `git checkout -- e2e/shots` before committing, and never commit it.

The owner's taste: modern, natural and restrained. Do not make things bigger or busier to fix them. No oversized fonts, nothing old-fashioned.

Do the three parts in order, and push after each one.

## Part 1: find what is wrong (report only, no fixes)

Use the real built app through Playwright (`e2e/lib.mjs`), as a teacher would use it, at **1280×720, 1366×768 and 1920×1080**, in **both layouts**, on a **white board and a chalkboard**. The owner's own laptop shows the app at 1280×720, so that size matters as much as the others.

Go through every tile in the More menu, every subject, every sheet, and **every one of the 58 parts** in the Apparatus cupboard: take it out, use every control and setting, move it, resize it, turn it, undo, save and reopen.

Write `docs/audit/tools-audit.md`: a numbered list, worst first. For each problem: what is wrong, how to make it happen, how bad it is, and a screenshot path. Keep the screenshots in `D:\Projects 2\whiteboard\audit-shots`, outside the repo.

**The lead is already fixing these, so leave them out:** the board toolbar not fitting 1280 wide, the streak inside brush strokes, the side tabs, pictures in places that do not need them, the radial menu.

## Part 2: make the apparatus accurate and good-looking

Check every part in `parts-bio.ts`, `parts-chem.ts` and `parts-physics.ts` as a Class 6–12 science teacher in India would, against NCERT syllabus facts.

- Fix wrong labels, wrong names, wrong proportions, and spellings that differ from what NCERT uses.
- Improve how they are drawn: real glassware proportions, cleaner shapes, labels that never overlap, in light and dark. Parts are drawn in code in their own units. Keep them drawn in code: no images in the parts.
- Use the facts, never copy a figure from a textbook or website.
- Add `docs/audit/science-check.md`: for each part, what you checked and what you changed. List anything you are unsure of, for the owner to check with a teacher.

**You may edit only:** the `paint` functions, names and labels in `engine/apparatus/parts-bio.ts`, `parts-chem.ts` and `parts-physics.ts`. Keep each part's `kind`, `w`, `h`, `params`, `controls` and `settings` as they are, so saved lessons keep working.

**Do not touch:** `world.ts`, `parts.ts`, `circuit.ts`, `optics.ts`, `chem.ts`, `examples.ts`, `parts-electric.ts`. If you find a science mistake in those, or a behaviour that is wrong, write it in the report for the lead.

## Part 3: second round of pictures

**Use image generation to generate these as images with transparent backgrounds,** in the same style as the existing set, then run them through `build/make-art.cjs`:

- **Replace, because they are pale or thin:** `axes`, `pdf-worksheet`, `table`, `paper-squared`, `paper-graph`, `paper-ruled`, `paper-fourline`, `paper-hindi`.
- **New:** `templates` (a few blank layout cards fanned out), `apparatus` (a wooden lab cupboard with glassware inside).

Masters go in `D:\Projects 2\whiteboard\art-masters`. Update `assets/art/SOURCES.md`. Add new exports at the end of `ui/icons.tsx`, and tell the lead their names; the lead will use them on the buttons.

**Do not touch:** `ui/Board.tsx`, `ui/Radial.tsx`, `ui/Editor.tsx`, `ui/kit.tsx`, `engine/input.ts`, `engine/board.ts`, `engine/ink.ts`. The lead is changing them now. In `styles.css`, add nothing.

## Tests you must pass before you finish

```
npm run typecheck
npm test
npm run e2e:apparatus
npm run e2e:icons
npm run e2e:theme
npm run e2e:labels
```

## When you're done, give back

1. The branch name and commit hash, pushed.
2. A short plain-language summary of each part.
3. The ten worst problems from the report.
4. The pass counts of the commands above. The last lines of each are enough.
5. The names of the new picture exports.
6. What you could not verify, and anything a real science teacher should check.
