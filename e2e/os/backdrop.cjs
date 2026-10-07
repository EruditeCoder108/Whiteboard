// A plain full-screen window used as the "app underneath" in OS-level tests.
// It paints a coloured grid and reports every mouse press through its title: "CLICK <x> <y> #<n>"
const { app, BrowserWindow, screen } = require('electron')

app.whenReady().then(() => {
  const d = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
    frame: false, show: false, skipTaskbar: true, alwaysOnTop: false, resizable: false,
    webPreferences: { contextIsolation: true }
  })
  win.loadURL(
    'data:text/html,' +
      encodeURIComponent(`<title>idle</title><body style="margin:0;background:
        repeating-linear-gradient(90deg,#ff7a00 0 60px,#00b3a4 60px 120px),#222;height:100vh;cursor:crosshair">
        <script>
          let n = 0
          document.addEventListener('mousedown', e => { document.title = 'CLICK ' + Math.round(e.clientX) + ' ' + Math.round(e.clientY) + ' #' + (++n) })
        </script></body>`)
  )
  win.on('page-title-updated', (e, title) => process.stdout.write(title + '\n'))
  win.once('ready-to-show', () => {
    win.show()
    process.stdout.write('READY\n')
  })
})
app.on('window-all-closed', () => app.quit())
