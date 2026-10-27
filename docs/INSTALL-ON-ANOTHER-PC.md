# Install Floating Whiteboard on another computer

The current science preview is built into two standalone Windows executables in `dist/showcase-preview/`:

| File | How to use it |
|---|---|
| `Floating-Whiteboard-Setup-1.4.0-showcase.exe` | Copy to the other PC, double-click, choose the installation folder and finish setup. A desktop shortcut is created. |
| `Floating-Whiteboard-Portable-1.4.0-showcase.exe` | Copy the single file to the other PC and double-click. Installation is unnecessary; it unpacks its bundled runtime when starting. |

Use **64-bit Windows 10 or 11 on an Intel/AMD PC**. This build targets x64; it is not a 32-bit Windows, native ARM, macOS or Linux package. Electron's upstream [platform support](https://github.com/electron/electron#platform-support) starts at Windows 10. Windows 11 is the preferred current target. Hardware responsiveness on other PCs remains to be measured.

Normal drawing, science animation, saving and PNG export need **no Node.js, Python, Blender, account, API key or Internet connection**. Electron/Chromium and the app's code are bundled. A dedicated graphics card is not required by the native Canvas2D showcases; actual driver and device behaviour still needs testing. Optional external MCP integration separately requires Node.js 22+; it is not needed for using the whiteboard.

## Moving a board

On the original PC, use **Menu → Save board…** and copy the native board file. On the other PC, use **Menu → Open board…**. This transfers editable lab parameters, saved frames, recorded magnet movement and annotations. Pause and **Freeze** a lab first when you want a particular instant to reopen. Playback itself is transient.

Both packages keep autosave and settings in `%APPDATA%/Floating Whiteboard/` on that PC. A portable executable does not automatically carry the live board on a USB stick. Lesson recordings are separate from a saved board; export/import them through the lesson library if needed.

## Windows trust

These local preview executables are **unsigned**. Windows SmartScreen, Smart App Control or an organisation's policy can warn about or block them. Building an EXE does not establish that another computer will accept it. A trusted code-signing identity is needed for dependable wider distribution; `npm run dist:signed` fails when credentials are missing. Do not disable Windows protection to test this preview.

The preview is built with `npm run dist:showcase`. See [the showcase QA report](SCIENCE-SHOWCASE-QA.md) for packaged-runtime evidence and the limitations of the checks actually performed. No installer was run against the user's live profile.
