# Release 1.3.0 verification

Verified on Windows on 2026-10-07. Portable packaging succeeded with Electron 44.5.1.

| Check | Result |
|---|---|
| TypeScript | Passed |
| Unit tests | 147 passed across 10 files |
| Existing drawing UI | 46 passed |
| Save/recovery UI | 22 passed, including real filesystem failure and retry |
| Object editor UI | 35 passed |
| Laser UI/pixel checks | 14 passed |
| Agent integration, packaged app | 40 passed |
| Packaged core drawing/save/close | 7 passed |
| Actual portable launcher and extracted agent adapter | 10 passed |
| Windows injected mouse/touch/pen and desktop capture | 31 passed |

The 352 checks above are the final distinct test matrix; earlier successful runs are not added to
that total. The agent workflow also passed 36 source-build checks before four additional cases were
added and verified in the packaged app. Existing toolbar tests now find controls by accessible names,
and zoom checks wait for the target zoom rather than assuming animation finishes after a fixed delay.

## Agent evidence

The packaged tests launch the bundled adapter as a real stdio child process, negotiate MCP revision
2025-11-25, discover tools, and read/write the live board. The same semantic contract serves direct
authenticated loopback calls and the optional assistant. Checks cover:

- Access off on startup, loopback binding, rejected unauthenticated/Origin/alternate-Host requests,
  token-free copied configuration, and revocation of both connection file and endpoint.
- Compact paginated reads, complete targeted long-text reads, stable IDs and semantic resizing.
- Atomic rejection of a bad later operation, group/lock protection, dry runs, revision conflicts,
  duplicate-request protection, undo/redo and saving agent-created objects normally.
- Offline starters; model discovery without a key; local drafts before mutation; concurrent edit
  invalidation; application and one-step undo; Responses support and cancellation.
- Actual Electron encrypted key storage, secret-free renderer configuration, main-process key use
  with the configured local fixture endpoint, and removal on endpoint changes.
- Minimum window containment, renderer errors and extracted portable resource availability.

The actual portable wrapper separately enables its extracted agent connection, reads its editable
board through that connection, and disables it successfully.

Visual evidence: [draft thumbnail](../e2e/shots/agent-draft.png),
[minimum window](../e2e/shots/agent-small-window.png),
[portable app](../e2e/shots/portable-1.3.0.png),
[slow laser](../e2e/shots/laser-slow.png), [Windows laser capture](../e2e/shots/os-laser.png).

## Scope of verification

Model tests use a local HTTP fixture implementing the documented Chat Completions/Responses tool-call
shapes. No paid provider or real language-model generation was used. These tests establish connection,
draft validation and application behavior, not model reasoning quality, vendor-wide compatibility,
token prices or performance of a particular local model. A local inference server/model is not bundled.
Client configuration and capability discovery are tested with the stdio adapter; a particular user's
Codex/other MCP client configuration has not been changed automatically.

The Windows checks inject events through Windows APIs and inspect desktop captures. A few injector
diagnostic errors were logged, while all asserted gestures passed. This is not a physical tablet test
or a claim about every pen/touch device.

## Artifact

`dist/Floating-Whiteboard-portable-1.3.0.exe` — **101,072,224 bytes**.

SHA256: `0E4B1C319648BC7A6B87C0F61D7FD05A5E85AD88B569D59C3BF22FD33BC186B1`.

The native board format remains version 2. Earlier portable 1.2.1 is preserved alongside this build;
its verification record is [here](RELEASE-1.2.1-QA.md).
