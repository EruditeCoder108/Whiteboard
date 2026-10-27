# Contributing to Floating Whiteboard

Thanks for helping make explanations clearer. Useful contributions include reproducible bugs,
accessible controls, scientific corrections, pen/touch improvements and focused editor features.

## Start with a small, reviewable change

Read [the roadmap](ROADMAP.md), [the user guide](docs/USER-GUIDE.md) and, for labs,
[the science scope](docs/SCIENCE-SHOWCASE-QA.md). Describe the behaviour you intend to improve
before a large architectural change. Keep simulation assumptions visible and label illustrative
behaviour honestly. Do not add a provider or network requirement to normal drawing/science workflows.

## Development

Use Node.js 22.12+ and npm on Windows. After cloning:

```bash
npm ci
node node_modules/electron/install.js
npm run dev
```

Before submitting code, run checks relevant to the change:

```bash
npm run typecheck
npm test
npm run build
```

For end-to-end checks, isolate profiles and input:

```powershell
New-Item -ItemType Directory -Force .work | Out-Null
$env:TEMP = (Resolve-Path .work).Path
$env:TMP = $env:TEMP
$env:FW_QA_ISOLATE = '1'
node e2e/showcases.mjs
```

The harness creates disposable user-data directories. Never test against a real teaching board,
its backups or someone else's recordings. `e2e/os.mjs` injects real desktop input; run it only
when you intentionally want a physical-input test and can leave the machine alone.

## Changes that fit the app

- Keep document items immutable and use the shared edit/history transaction model.
- Keep animation clocks transient; deliberate input edits and frozen frames belong in native files.
- Preserve save/reopen, undo, lock, object ordering and PNG behaviour when adding an object type.
- Use the same lab renderer for the board, thumbnails and export.
- Validate imported documents and external agent commands at their boundaries.
- Measure visible performance and physical input separately from headless or scripted checks.
- Add tests for real failure cases and scientific invariants, not copies of implementation details.

## Issues and pull requests

Use a small synthetic board to reproduce the issue. Include the app/source version, Windows version,
input type and expected/actual behaviour. Screenshots or short recordings are useful after checking
them for private content. A pull request should explain the final change and the validation performed.

Do not commit personal boards, local profile files, tokens, `.env` files, signing certificates or
generated installers. Check third-party licences before copying code, artwork or equipment models.

Contributions to this project's own code are made under **GPL-3.0-only**. Retain existing copyright
and dependency notices. Submit only material you have the right to contribute. See [LICENSE](LICENSE),
[third-party notices](THIRD_PARTY_NOTICES.md) and [security reporting](SECURITY.md).
