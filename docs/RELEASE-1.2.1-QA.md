# Release 1.2.1 verification

Verified on Windows on 2026-10-07. This is the baseline before native agent integration.

The laser now renders each contact as a continuous, smoothed path with a thin 1.8 CSS pixel core and a compact halo. Separate contacts do not connect. Trails remain transient and expire without changing the board or undo history.

| Check | Result |
|---|---|
| TypeScript | Passed |
| Unit tests | 133 passed |
| Existing drawing UI | 46 passed |
| Save/recovery UI | 22 passed, including real filesystem failure and retry |
| Object editor UI | 35 passed against source and packaged 1.2.1 |
| Laser UI/pixel checks | 14 passed against source and packaged 1.2.1 |
| Packaged app | 7 passed |
| Actual portable launcher | 7 passed, including extracted payload version and save/close |
| Windows injected input and desktop capture | 31 passed in 1.2.0 before the final path smoothing |

The Windows input checks use injected mouse, touch and pen events. They do not establish behavior on every physical tablet. Slow and average speed laser captures were inspected after the 1.2.1 refinement.

Evidence: [average laser](../e2e/shots/laser-average.png), [slow laser](../e2e/shots/laser-slow.png), [dense laser](../e2e/shots/laser-dense.png), [object editor](../e2e/shots/phase2-board.png), [small window](../e2e/shots/phase2-small-window.png), [portable launcher](../e2e/shots/portable-1.2.1.png).

Machine measurements: 4,000 strokes / 240,000 points, pan mean 27.84 ms and p95 17 ms; rebuilding the cache can cause spikes. A 1,500-sample laser path rendered in about 0.19 ms mean. These measurements are not physical input latency claims or a controlled comparison against earlier releases.

Portable: `dist/Floating-Whiteboard-portable-1.2.1.exe`, 101,061,209 bytes.

SHA256: `90E4CE3E718E088FA6A214C5E02E42224E29E26EB5ADD406B87A043A3E5F749F`.
