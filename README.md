# Floating Whiteboard

A fast, translucent, pen-first whiteboard for teaching, writing and screen sharing on Windows.
Electron + TypeScript + Preact, with a hand-written vector drawing engine.

Current release: **1.4.0 — Record, replay and reuse lessons**. See [CHANGELOG.md](CHANGELOG.md).

The proposed phases and finished 2.0 product are described in [ROADMAP.md](ROADMAP.md).
The separate long-term teaching/science expansion is in [SCIENCE-ROADMAP.md](docs/SCIENCE-ROADMAP.md),
with a measured [canvas audit](docs/CANVAS-AUDIT.md) as its first foundation milestone.

## Run it

```bash
npm install
node node_modules/electron/install.js   # npm 11 skips Electron's download script; run once
npm run dev                              # live-reloading dev build
npm run build && npm start               # production build, run locally
npm run dist                             # installer + portable .exe in dist/
npm run dist:portable                    # portable executable only
npm run dist:signed                      # release build; requires signing credentials
```

### Windows app trust

Development executables are unsigned unless signing credentials are configured. On this machine,
Windows blocked the new 1.4.0 executable under its app trust policy (Code Integrity events 3033/3077);
the file's Authenticode status was `NotSigned`. No current Defender malware detection for Whiteboard
was found during that investigation. This does not establish that an unsigned file is trusted.

For distribution, use a trusted Windows code-signing identity and `npm run dist:signed`.
That command enables `forceCodeSigning`, so missing credentials fail the release build instead of
silently producing unsigned output. Electron-builder supports `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`
or the corresponding certificate-store/cloud signing configuration. Keep credentials outside the repo.
See [electron-builder's signing guide](https://www.electron.build/v26/docs/features/code-signing/code-signing-win/)
and [Microsoft's Smart App Control guidance](https://learn.microsoft.com/windows/apps/develop/smart-app-control/overview).

The portable app stores data in `%APPDATA%/Floating Whiteboard/` (`board.json` autosave, `settings.json`, `window.json`, `recordings.json`). Development builds may use `%APPDATA%/floating-whiteboard/` instead.

The top bar shows **Unsaved → Saving → Saved**, based on actual disk completion. A failed write shows
**Retry save**, and closing keeps the window open until the board and settings are saved. Pan and zoom
are autosaved too; pending settings are flushed on close.

Up to five prior board snapshots are kept as `board.backup-1.json` through `board.backup-5.json`.
Snapshots rotate at most once per minute during a session, so frequent strokes do not immediately
erase the recovery history. Use **Menu → Recovery backups…** to restore a snapshot; **Ctrl+Z** undoes
the restoration. Startup tries readable snapshots if the current autosave is damaged. Damaged originals
are retained as `board-damaged-<timestamp>.json` before a repaired save replaces them. With no usable
content, opening and closing alone preserves the damaged original.

## Using it

| | |
|---|---|
| **Draw** | pen / mouse / finger. Pen pressure changes line width. Barrel button or the eraser end = eraser. |
| **Radial menu** | press and hold anywhere (mouse, pen or finger). Inner ring: tools and actions. Outer ring: colours. Release over a slice. |
| **Eraser** | `E` picks it, `E` again switches **Stroke** (whole line) ⇄ **Pixel** (only what you rub). |
| **Hide interface** | `Tab` or the eye button. A faint pill stays top-right. |
| **Pass-through** | `Ctrl+Shift+Space` (works from any app) or the toolbar button. The board ignores the pointer so you can use the apps underneath; a blue "Back to drawing" pill stays clickable by mouse, pen and touch. |
| **Hide window** | `Ctrl+Shift+H` (global) |
| **Touch** | one finger draws (Settings → *Draw with finger*), two fingers pan and pinch-zoom. Touch is ignored while a pen is near. |
| **Laser pointer** | `K` |
| **Selection styling** | `V` or `Ctrl+A`, then click the colour dot. Change colour or thickness without losing selection; Ctrl+Z undoes the change. |
| **Text / notes** | `T` / `N`, click the board and type. Double-click or select and press `Enter` to edit. `Ctrl+Enter` finishes; `Esc` cancels. |
| **Shape labels and styles** | Select a shape, press `Enter` to add its label. The selection palette controls text, fill, borders, rounded rectangle corners and opacity. |
| **Resize / rotate** | Drag a selection handle. `Shift` keeps proportions or snaps rotation to 15°. Side resizing reflows text; text and notes grow to keep content visible. |
| **Group / lock / order** | `Ctrl+G` / `Ctrl+Shift+G`, `Ctrl+L`, and `Page Up` / `Page Down`. Locked objects can be selected and unlocked; editing and erasing respect locks. |
| **Lasso / nudge / fit** | `Q` for lasso, arrow keys to nudge (`Shift` for 10 units), `Ctrl+2` to fit selection. |
| **Object clipboard** | `Ctrl+C` / `Ctrl+V` copies editable objects inside the running app. `Ctrl+Alt+C` / `Ctrl+Alt+V` copies their style. Native text clipboard works while typing. |
| **Hold timing** | Settings → *Hold for menu* and *Hold delay*. Disable it or increase the delay for deliberate handwriting. |
| **Everything else** | `F1` |

Set the board **Opacity** to 0 in Settings to write directly over whatever is on screen.

**Open board** also imports Python v10 `.wbd`/JSON files, including shapes and variable-width ink.
Saving the imported board uses the current format; the original file is left intact. Ink appearance
may differ slightly because the two versions use different stroke renderers. Unsupported formats are
rejected; partially readable files report how many invalid objects were skipped. Board files are limited
to 50 MB. Settings and coordinates are validated before use.

Native saves now use **format version 2** for editable text, notes, transforms, groups and styles.
This release reads Electron version 1 and Python boards; version 2 files need app 1.2 or later.
Text drafts are included in autosave and flushed when closing. PNG and clipboard-image output include the new objects.

The laser uses continuous smoothed paths, a thin red core and a compact halo. Separate touch contacts and re-entry do not
connect to an old trail; fast movement retains its final endpoint. Trails fade after 2.4 seconds
and remain transient, outside saved board content and undo history.

## Record and replay a lesson

Open the **clapperboard button → Start recording**, then draw and edit normally. Pen and marker
strokes replay progressively with their captured timing and pressure; object creation, text commits,
edits, removal, grouping, layer changes, undo/redo and view changes become timed steps. Choose
**Selected diagram + new objects** to exclude unrelated existing board content.

The recording strip supports pause, resume and finish. Paused time is excluded; edits made while
paused are included together at the resume boundary. Finishing saves the lesson to the local library;
active recordings are checkpointed every two seconds and flushed on normal close.

**Play lesson** previews on a separate canvas. Use play/pause, speed, the scrubber, previous/next step,
or **Space / Left / Right / Esc**. Preview never changes the working board or its undo history.
**Keep this frame** or **Add finished diagram** inserts fresh editable objects as one undo step,
preserving your existing work and remapping object/group IDs.

**Save steps** creates a portable `.wbrp` recording; **Open file** imports it into the library for
later playback. **Export video** makes a silent 1280×720 WebM of the board at the selected playback
speed. Export encodes frames directly with a progress bar and cancellation. Camera following is optional;
the default fits the whole lesson. Export includes a brief initial and final hold. Limits: 100 local
recordings, 10,000 steps/100,000 object entries per recording, eight recorded hours, 50 MB for reusable
files/library and 256 MB for a video export. Transient laser trails, live typing, microphone audio,
desktop apps and UI clicks are not captured. Start recording before creating the lesson; previous
unrecorded gestures cannot be reconstructed from the final diagram.

## Agent tools — no OpenAI key required

Open the sparkle button in the top bar. **Planning board**, **Compare ideas** and **Arrange selection**
work immediately offline and create ordinary editable objects in one undo step.

**External agents:** enable the local connection and copy its MCP configuration into your agent client.
The agent uses its own model connection; the whiteboard does not need a provider key. The adapter
requires Node.js 22 or newer. Access starts off every session, binds only to `127.0.0.1`, and uses a
random session token. Disabling closes the connection and revokes its file. Configuration contains
paths, never the token. [Setup, examples and command contract](docs/AGENT-INTEGRATION.md).

**Optional in-app assistant:** connect an existing local Ollama or compatible server, find/select a
tool-capable model, and prepare a draft. Review its thumbnail and apply it as one undo step. A local
model needs no OpenAI key; a model and inference server are not bundled with the app. HTTP is limited
to localhost; remote endpoints require HTTPS. Chat Completions and Responses formats are available.
Provider-specific features and model quality vary. Optional keys are encrypted by Electron safeStorage
in the main process, bound to the exact endpoint, and omitted from renderer configuration.

The assistant sends the prompt and a compact text/object snapshot to the configured endpoint only
when requested. It makes at most four model requests per prompt, has a Stop button, and does not apply
model output automatically. The external agent API validates complete batches before applying, respects
locks, checks document revisions and supports safe retries for the last 100 successful transactions.

## Layout

```
src/main/         window, global hotkeys, pass-through pill, atomic autosave
src/preload/      the only bridge between the page and Node
src/shared/       the typed IPC contract
src/renderer/src/
  engine/         pure TypeScript drawing engine (no DOM needed for most of it)
    items.ts        stroke outlines (perfect-freehand), hit-testing, pixel-erase splitting
    doc.ts          document + diff-based undo/redo
    board.ts        render loop, offscreen cache, view, commands
    tools.ts        pen, eraser, shapes, select, hand, laser
    input.ts        pointer router: mouse / pen / touch / long-press
    radial.ts       radial menu logic
  state/          signals store, actions, shortcuts
  ui/             Preact components
tests/            unit tests (vitest)
e2e/              Electron tests (playwright) + real OS-input tests (e2e/os/)
```

## Tests

```bash
npm test                    # unit tests
npm run e2e                 # build + UI tests
npm run e2e:phase1           # recovery, real write failure, styling, import, small-window checks
npm run e2e:phase2           # editable objects, transforms, groups, zoom, save/reopen and small windows
npm run e2e:laser            # sharpness, fast/dense input, separate touch contacts and fading
npm run e2e:agent            # local MCP, semantic edits, drafts, key storage and cancellation
node e2e/agent.mjs "dist/win-unpacked/Floating Whiteboard.exe"
node e2e/phase2.mjs packaged # same object workflow against dist/win-unpacked
node e2e/laser-audit.mjs packaged
node e2e/portable.mjs        # actual portable launcher, payload and save/close checks
node e2e/window.mjs         # window behaviour + performance
node e2e/os.mjs             # REAL mouse/touch/pen injected through Windows APIs over a backdrop window
```

`e2e/os.mjs` moves your real cursor and injects touch/pen input for ~40 seconds; don't touch the machine while it runs.

## Design decisions worth knowing

- **No `desynchronized` canvas.** It lowers latency but uses a hardware overlay that screen-capture APIs
  (Zoom, Teams, OBS) cannot see, so the board shows up black when shared. Found with the OS-level test.
- **Items are immutable.** Every edit (draw, erase, move, recolour) is "remove these / add those", so
  undo/redo is one small mechanism.
- **Committed strokes live in an offscreen cache larger than the viewport.** Panning reuses the
  cached bitmap until the viewport needs more content; `e2e/performance.mjs` measures a 4,000-stroke board.
- **Pass-through uses a second tiny window** instead of hover tricks, because touch and pen never produce
  the hover events a single click-through window would need.
