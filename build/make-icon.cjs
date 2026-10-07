// Renders the app icon with Electron itself:  npx electron build/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5b7cff"/>
      <stop offset="1" stop-color="#3a2fd8"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0b1034" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#bg)"/>
  <rect x="24" y="24" width="464" height="232" rx="108" fill="url(#gloss)"/>
  <g filter="url(#sh)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M108 330 C 150 200, 205 190, 232 280 S 300 360, 332 230 S 392 150, 408 196"
          stroke="#fff" stroke-width="34"/>
    <path d="M356 118 l38 38" stroke="#ffd23f" stroke-width="30"/>
  </g>
</svg>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html,' + encodeURIComponent(`<body style="margin:0;background:transparent">${SVG}</body>`))
  await new Promise((r) => setTimeout(r, 400))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
  writeFileSync(join(__dirname, 'icon.png'), img.toPNG())
  console.log('icon.png written', img.getSize())
  app.quit()
})
