# Task for a second agent: "Share to phones" (local Wi-Fi + QR code)

Copy everything below the line into the other agent.

---

You are working on **Floating Whiteboard**, a free GPL-3.0 teaching board for Indian classrooms (smart boards first, also laptops). Stack: Electron 44 + electron-vite, Preact + @preact/signals, Canvas2D, TypeScript. Repo: `D:\Projects 2\whiteboard\app` (GitHub `EruditeCoder108/Whiteboard`). Windows 11, PowerShell. There is no Python on this PC; use Node for scripts. Files use CRLF line endings.

Before you start, read `docs/NEXT-CHAT-HANDOFF.md` (project, owner's preferences, codebase map) and section 9 "After class" of `docs/NOTE3-COMPETITIVE-DEEP-DIVE-2026-11-01.md` (lines ~561–570). Your feature comes from there.

## Work in your own folder, never in the main checkout

Another agent (Claude, the lead) is editing `D:\Projects 2\whiteboard\app` at the same time on branch `feature/papers-backgrounds`. Do **not** switch branches, commit or edit files there. Make your own worktree from `main`:

```
cd "D:\Projects 2\whiteboard\app"
git worktree add "D:\Projects 2\whiteboard\app-qr-share" -b feature/qr-share main
cd "D:\Projects 2\whiteboard\app-qr-share"
npm install
```

Do all your work in `D:\Projects 2\whiteboard\app-qr-share`. Commit to `feature/qr-share` and push the branch. Do **not** open a pull request and do **not** merge. The lead reviews and merges.

## The feature

At the end of class, the teacher taps **Share to phones** in the Export sheet. The board PC starts a small, temporary web server on the school Wi-Fi and shows a big QR code. Students scan it with their phones and download the lesson PDF. No cloud upload is involved, but the phones must be on the same network as the PC, and the interface must say so plainly.

### Behaviour (required)

1. **Explicit session.** Nothing listens until the teacher starts sharing. A large **Stop sharing** button is always visible while sharing. Closing the panel, opening another lesson or quitting the app also stops it.
2. **Only the one exported file.** At start, the PDF is built with the existing renderer export: `board.exportPages({ split: true })` gives one PNG per sheet. The main process turns those PNGs into a PDF and keeps it in memory. The server serves exactly two things under an unguessable token path:
   - `GET /<token>/` → a tiny mobile-friendly HTML page: the lesson name, a big "Download PDF" button and a one-line note.
   - `GET /<token>/lesson.pdf` → the PDF, with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="<safe lesson name>.pdf"`.

   Everything else returns 404 with no body detail: no directory listing, no other files, no lesson JSON, and no wildcard routes. Accept only `GET` and `HEAD`. Use a token of at least 128 bits from `crypto.randomBytes`, base64url-encoded, and compare it in constant time.
3. **Expires.** The session ends after 30 minutes (show a countdown) or on Stop, whichever comes first. After that the URL returns 404 and the server is closed.
4. **Right network interface.** List the PC's non-internal IPv4 addresses (`os.networkInterfaces()`). Prefer a private range (10.x, 172.16–31.x, 192.168.x) and skip link-local 169.254.x. If there are several, let the teacher pick from a short list ("Wi-Fi 192.168.1.20", "Ethernet 10.0.0.5"). Bind the server to **that address only**, not 0.0.0.0, on a free port (try 8723, then let the OS choose). If no usable network exists, say "This PC isn't on a network. Save the PDF and share it by USB instead." and show the normal Save PDF tile.
5. **Reachability honesty.** The PC cannot verify that phones can reach it, so show a live **download counter** ("2 phones have downloaded it"). Below the QR, show the URL in large text so it can be typed. Add a "Not working?" hint: phones must be on the same Wi-Fi; school "guest" Wi-Fi often blocks devices from seeing each other; Windows may ask to allow the app through the firewall, so choose Private networks. Keep **Save PDF instead** (the existing manual export) one tap away.
6. **QR code.** Render it locally with the `qrcode` npm package (MIT), as a data URL or canvas. It must be large: at least 280 px on a smart board and readable from a few metres. Never use a web QR service.
7. **Safety limits.** At most 200 requests per minute per remote address (return 429 above that) and an idle timeout on sockets. Log nothing personal. The server must never read from disk after the PDF is built.

### Where the code goes (stay inside these files to avoid clashing with the lead)

You may **create**:
- `src/main/pdf.ts`: move the existing PNG-pages→PDF code out of the `files:save-pdf` handler in `src/main/index.ts` (around lines 421–441) into `export async function pagesToPdf(pages: ArrayBuffer[]): Promise<Buffer>`. `files:save-pdf` then calls it. Behaviour must stay the same: landscape A4, one image per sheet.
- `src/main/share.ts`: a `ShareServer` class: `start({ pdf, name, address }) → { url, expiresAt }`, `stop()`, `status() → { active, url, downloads, expiresAt }`, plus `listAddresses()`. Keep it pure Node (`http`, `crypto`, `os`) so it can be unit tested without Electron.
- `src/renderer/src/state/share.ts`: signals for the share panel (open/closed, status, chosen address) and the start/stop calls.
- `src/renderer/src/ui/Share.tsx`: the share panel, a full-height sheet or centred overlay with a big QR, the URL, countdown, download counter, Stop sharing, Save PDF instead and the hint.
- `tests/share.test.ts` (vitest) and `e2e/share.mjs`. Use `e2e/lesson.mjs` as the model for how e2e scripts start the built app, drive it through `window.__fw` and check results.

You may **edit**, keeping each change small:
- `src/main/index.ts`: IPC handlers `share:addresses`, `share:start(pages, name, address)`, `share:stop` and `share:status`, plus the `pagesToPdf` refactor. Stop the share on `before-quit`. Validate IPC input the way the existing handlers do (array of ArrayBuffers, at most 500 pages, address must be one returned by `listAddresses()`).
- `src/preload/index.ts` and `src/shared/api.ts`: add a `share` namespace.
- `src/renderer/src/ui/Lessons.tsx`: in `ExportSheet`, add one **Share to phones** tile next to Save PDF that opens your panel. Change nothing else in that file.
- `src/renderer/src/app.tsx`: mount `<SharePanel />` once.
- `src/renderer/src/styles.css`: add your styles **only in a new block at the very end of the file**, under a comment `/* ── share to phones ── */`.
- `package.json`: add the `qrcode` dependency (+ `@types/qrcode` dev) and an `"e2e:share": "electron-vite build && node e2e/share.mjs"` script.

Do **not** touch: anything in `src/renderer/src/engine/`, `src/renderer/src/state/store.ts`, `state/actions.ts`, `ui/Paper.tsx`, `ui/Board.tsx`, `CHANGELOG.md`, `docs/FEATURES.md`, `docs/NEXT-CHAT-HANDOFF.md`, or the version number. The lead updates those when merging.

### Style the owner wants

- The board is used by touch on a big classroom panel. Use large targets (at least 48 px, tiles like the existing `Tile` in `ui/kit.tsx`), plain words and no jargon ("Share to phones", not "Start HTTP server"). Use the existing look: reuse `Tile`, `Section` and `chip` classes, `panel`/`popover` styling and the dark-board variants already in `styles.css`.
- Match the surrounding code: short doc comments in plain English explaining *why*, compact TypeScript, no new frameworks.
- Offline-first: no network calls except the local server itself.

### Tests you must add and pass

`tests/share.test.ts` (vitest), at least these cases:
- the token page and the PDF are served, and the PDF has the right headers and bytes;
- a wrong token, `/`, `/<token>/../x`, `/<token>/lesson.json` and POST all return 404 or 405;
- the session expires (use fake timers or a short expiry option) and then returns 404 with the server closed;
- downloads are counted;
- the server binds only to the given address;
- `listAddresses()` skips internal and 169.254 addresses (mock `os.networkInterfaces`);
- requests over the rate limit get 429.

`e2e/share.mjs`: start the app, draw something, open Export → Share to phones, read the URL from the panel, fetch it from Node (`http.get` to the bound address), check the PDF starts with `%PDF`, press Stop, and check the URL now fails.

Before you finish, all of these must pass in your worktree:
```
npm run typecheck
npm test
npm run e2e:share
npm run e2e:lesson
npm run e2e:board
```

### When you're done, give back

1. The branch name and commit hashes, pushed to GitHub.
2. A short plain-language summary of what was built.
3. The full output of the five commands above (pass counts).
4. Anything you could not do or verify, for example "not tested on a real phone" or "Windows firewall prompt not seen in e2e".
5. Every file you changed outside the "may create / may edit" lists, with the reason. There should be none.
