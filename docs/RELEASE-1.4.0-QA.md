# Release 1.4.0 verification

Verified on Windows on 2026-10-07, using Electron 44.5.1 and an isolated test profile.

| Check | Result |
|---|---|
| TypeScript | Passed |
| Production build | Passed |
| Unit tests | 159 passed across 11 files |
| Existing object editing UI | 35 passed |
| Laser UI and pixel checks | 14 passed |
| Native agent and optional assistant integration | 40 passed |
| Recording, playback, files and video | 30 passed |
| Production dependency audit | No known vulnerabilities reported |
| Signed-release guard | Correctly refuses unsigned output when credentials are missing |

These are **278 distinct source checks**. Earlier repeated runs are not added to the total.
The 1.3.0 packaged/Windows injection matrix is historical evidence, not a fresh 1.4.0 result.

## Recording and playback evidence

Checks exercise real pen events and the authenticated local agent bridge. They cover point timing and
pressure, paused time, agent teaching labels, undo/redo, atomic local persistence, play/pause and
backward seeking, document and revision preservation, and blocking pointer/keyboard/MCP edits during
preview. Reusing a diagram preserves existing content, remaps IDs, and is one undo step.

The file checks invoke the actual main-process save/open handlers with isolated dialog destinations,
export/import a `.wbrp`, and verify persistence after app restart. Panel and playback controls fit the
minimum 420 by 320 window. No renderer errors were observed.

Video checks write a real WebM, decode and play it in a separate hidden local test window, assert
1280 by 720 resolution and the expected finite duration, and seek to visible content in the final
diagram. Three consecutive additional off-screen exports succeed; retry clears an earlier video error.
Cancellation releases the exporter. The product's strict content security policy remains intact.

An intermittent empty MediaRecorder export found during regression testing was fixed by encoding
explicit canvas frames with WebCodecs and Mediabunny, using a separate, lazy-loaded bundle. Export
respects encoder backpressure, yields for cancellation, includes seek metadata, and enforces a
256 MB output limit. It does not depend on real-time compositor capture.

Visual evidence: [library](../e2e/shots/replay-library.png),
[playback](../e2e/shots/replay-playback.png),
[minimum window](../e2e/shots/replay-small-window.png),
[small playback controls](../e2e/shots/replay-small-playback.png).

## Windows executable trust limitation

The new unsigned executable was blocked by the local Windows app trust policy before packaged
tests could start. Code Integrity logged events **3033 and 3077** for
`dist/1.4.0/win-unpacked/Floating Whiteboard.exe`; Authenticode reported `NotSigned`.
Smart App Control was enabled. No current Defender malware detection for Whiteboard was found.
This investigation identifies a signing/trust block and does not certify executable safety.

No Windows protection was disabled or exception added. The open user app and its board were preserved.
The source-app checks passed, but **1.4.0 packaged execution is not verified on this machine**.
The unsigned portable is a development artifact, not a trusted public release.

`npm run dist:signed` enforces signing for distribution. A trusted code-signing identity is still
required; see the [Windows app trust notes](../README.md#windows-app-trust). Signing credentials,
local connection tokens, recordings, user data, dependencies and generated executables are excluded
from the GitHub source repository.

## Feature boundaries

Record before drawing to capture its history. Previously unrecorded gestures cannot be recovered
from a finished diagram. Text commits and permanent board edits are recorded; transient laser trails,
uncommitted typing, audio, desktop windows and UI clicks are not. Video is silent WebM.
The native board format remains version 2; the replay file format starts at version 1.
