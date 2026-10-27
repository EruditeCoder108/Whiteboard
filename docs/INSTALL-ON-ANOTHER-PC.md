# Install Floating Whiteboard on another computer

Download the **1.5.0-beta.1 Windows x64 prerelease** from
[GitHub Releases](https://github.com/EruditeCoder108/Whiteboard/releases/tag/v1.5.0-beta.1).
Choose either of these standalone executables:

| File | How to use it |
|---|---|
| [Installer EXE](https://github.com/EruditeCoder108/Whiteboard/releases/download/v1.5.0-beta.1/Floating-Whiteboard-Setup-1.5.0-beta.1-x64.exe) | Download to the other PC, double-click, choose the installation folder and finish setup. A desktop shortcut is created. |
| [Portable EXE](https://github.com/EruditeCoder108/Whiteboard/releases/download/v1.5.0-beta.1/Floating-Whiteboard-Portable-1.5.0-beta.1-x64.exe) | Download the single file to the other PC and double-click. Installation is unnecessary; it unpacks its bundled runtime when starting. |

Use **64-bit Windows 10 or 11 on an Intel/AMD PC**. This build targets x64; it is not a 32-bit Windows, native ARM, macOS or Linux package. Electron's upstream [platform support](https://github.com/electron/electron#platform-support) starts at Windows 10. Windows 11 is the preferred current target. Hardware responsiveness on other PCs remains to be measured.

Normal drawing, science animation, saving and PNG export need **no Node.js, Python, Blender, account, API key or Internet connection**. Electron/Chromium and the app's code are bundled. A dedicated graphics card is not required by the native Canvas2D showcases; actual driver and device behaviour still needs testing. Optional external MCP integration separately requires Node.js 22+; it is not needed for using the whiteboard.

## Moving a board

On the original PC, use **Menu → Save board…** and copy the native board file. On the other PC, use **Menu → Open board…**. This transfers editable lab parameters, saved frames, recorded magnet movement and annotations. Pause and **Freeze** a lab first when you want a particular instant to reopen. Playback itself is transient.

Both packages keep autosave and settings in `%APPDATA%/Floating Whiteboard/` on that PC. A portable executable does not automatically carry the live board on a USB stick. Lesson recordings are separate from a saved board; export/import them through the lesson library if needed.

## Windows trust

These preview executables are **unsigned**. Windows SmartScreen, Smart App Control or an organisation's policy can warn about or block them. Building an EXE does not establish that another computer will accept it. A trusted code-signing identity is needed for dependable wider distribution; `npm run dist:signed` fails when credentials are missing. Do not disable Windows protection to test this preview.

The public preview is built with `npm run dist:preview`, under `dist/windows-preview/`. The older
`dist:showcase` script and 1.4.0 QA snapshots remain historical. See
[release scope and validation](releases/v1.5.0-beta.1.md) and
[the showcase QA report](SCIENCE-SHOWCASE-QA.md). No installer is run against the user's live profile.

The release includes `SHA256SUMS.txt`. To compare a download with its recorded hash:

```powershell
Get-FileHash .\Floating-Whiteboard-Setup-1.5.0-beta.1-x64.exe -Algorithm SHA256
```

Checksums verify file identity; they are not a Windows code-signing certificate. The source archive
for the release is available beside the binaries. Use that tag when rebuilding or reviewing it.
