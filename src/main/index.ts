import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  screen,
  clipboard,
  safeStorage
} from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { Bounds, MainCommand, WinState } from '../shared/api'
import { DiskStore, MAX_FILE_BYTES, saveError } from './storage'
import { randomUUID } from 'node:crypto'
import { AgentBridge } from './agent-bridge'
import { Assistant } from './assistant'
import type { AgentCall, AgentResult } from '../shared/agent'

const MIN_W = 420
const MIN_H = 320

let win: BrowserWindow | null = null
let quitting = false
let closing = false
let storage: DiskStore
let fullscreen = false
let zoomed = false
let onTop = true
let passthrough = false
let controlWin: BrowserWindow | null = null
let restoreBounds: Bounds | null = null
let flushTimer: NodeJS.Timeout | null = null
let agentBridge: AgentBridge
let assistant: Assistant
const agentRequests = new Map<string, { resolve: (result: AgentResult) => void; timer: NodeJS.Timeout }>()
function callBoard(call: AgentCall): Promise<AgentResult> {
  if (!win || win.isDestroyed() || closing || agentRequests.size > 8) return Promise.resolve({ ok: false, error: 'Board is unavailable or busy' })
  return new Promise(resolve => {
    const id = randomUUID()
    const timer = setTimeout(() => { agentRequests.delete(id); resolve({ ok: false, error: 'Board did not respond. Retry with the same requestId.', code: 'TIMEOUT' }) }, 10000)
    agentRequests.set(id, { resolve, timer }); win!.webContents.send('agent:call', { id, call })
  })
}

// ── persistence helpers ───────────────────────────────────────────────────────
const dataFile = (name: string): string => join(app.getPath('userData'), name)

async function readText(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8')
  } catch {
    return null
  }
}

interface SavedWindow extends Bounds {
  onTop: boolean
}

async function loadWindowState(): Promise<SavedWindow> {
  const fallback = (): SavedWindow => {
    const wa = screen.getPrimaryDisplay().workArea
    const width = Math.min(1100, wa.width - 60)
    const height = Math.min(720, wa.height - 60)
    return {
      x: Math.round(wa.x + (wa.width - width) / 2),
      y: Math.round(wa.y + (wa.height - height) / 2),
      width,
      height,
      onTop: true
    }
  }
  const raw = await readText(dataFile('window.json'))
  if (!raw) return fallback()
  try {
    const s = JSON.parse(raw) as SavedWindow
    if (![s.x, s.y, s.width, s.height].every(Number.isFinite) || s.width <= 0 || s.height <= 0) return fallback()
    const rect = { x: s.x, y: s.y, width: s.width, height: s.height }
    // must overlap a real display by a usable amount, otherwise recentre
    const ok = screen.getAllDisplays().some((d) => {
      const w = Math.min(d.bounds.x + d.bounds.width, rect.x + rect.width) - Math.max(d.bounds.x, rect.x)
      const h = Math.min(d.bounds.y + d.bounds.height, rect.y + rect.height) - Math.max(d.bounds.y, rect.y)
      return w > 200 && h > 120
    })
    if (!ok) return { ...fallback(), onTop: s.onTop !== false }
    return {
      ...rect,
      width: Math.max(MIN_W, rect.width),
      height: Math.max(MIN_H, rect.height),
      onTop: s.onTop !== false
    }
  } catch {
    return fallback()
  }
}

let saveWinTimer: NodeJS.Timeout | null = null
function scheduleSaveWindowState(): void {
  if (saveWinTimer) clearTimeout(saveWinTimer)
  saveWinTimer = setTimeout(() => {
    if (!win || win.isDestroyed() || fullscreen || zoomed) return
    const b = win.getBounds()
    void storage.saveText('window.json', JSON.stringify({ ...b, onTop }))
  }, 400)
}

// ── pass-through ──────────────────────────────────────────────────────────────
const CONTROLS_HTML = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden;user-select:none;
    font:600 12px 'Segoe UI Variable Text','Segoe UI',system-ui,sans-serif}
  button{all:unset;box-sizing:border-box;width:100%;height:100%;display:flex;align-items:center;justify-content:center;
    gap:7px;color:#fff;background:#4262ff;border-radius:18px;cursor:pointer;
    box-shadow:0 4px 16px rgba(15,23,42,.35),0 0 0 1px rgba(255,255,255,.35) inset}
  button:hover{background:#3550e6} button:active{transform:scale(.97)}
  svg{width:15px;height:15px}
</style>
<button id="b" title="Back to drawing  (Ctrl+Shift+Space)">
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
  Back to drawing
</button>
<script>document.getElementById('b').addEventListener('click',()=>window.ctl.exit())</script>`

const CONTROL_W = 150
const CONTROL_H = 36

function placeControlWin(): void {
  if (!win || win.isDestroyed() || !controlWin || controlWin.isDestroyed()) return
  const b = win.getBounds()
  controlWin.setBounds({ x: b.x + b.width - CONTROL_W - 10, y: b.y + 8, width: CONTROL_W, height: CONTROL_H })
}

function setPassthrough(on: boolean): void {
  if (!win || win.isDestroyed()) return
  if (on === passthrough) return
  passthrough = on
  if (on) {
    win.setIgnoreMouseEvents(true)
    controlWin = new BrowserWindow({
      width: CONTROL_W,
      height: CONTROL_H,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      focusable: false, // never steals focus from the app you are using underneath
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/controls.js'),
        contextIsolation: true,
        sandbox: true
      }
    })
    controlWin.setAlwaysOnTop(true, 'screen-saver')
    placeControlWin()
    void controlWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(CONTROLS_HTML))
    controlWin.once('ready-to-show', () => controlWin?.showInactive())
  } else {
    win.setIgnoreMouseEvents(false)
    if (controlWin && !controlWin.isDestroyed()) controlWin.destroy()
    controlWin = null
  }
  pushState()
}

// ── window ────────────────────────────────────────────────────────────────────
function pushState(): void {
  if (!win || win.isDestroyed()) return
  const s: WinState = { onTop, fullscreen, zoomed, focused: win.isFocused(), passthrough }
  win.webContents.send('win:state', s)
}

function sendCommand(cmd: MainCommand): void {
  if (!win || win.isDestroyed()) return
  win.webContents.send('main:command', cmd)
}

async function createWindow(): Promise<void> {
  const st = await loadWindowState()
  onTop = st.onTop

  win = new BrowserWindow({
    x: st.x,
    y: st.y,
    width: st.width,
    height: st.height,
    minWidth: MIN_W,
    minHeight: MIN_H,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: 'Floating Whiteboard',
    icon: join(__dirname, '../../build/icon.png'),
    transparent: true,
    frame: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: onTop,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  })

  win.removeMenu()
  win.webContents.setVisualZoomLevelLimits(1, 1)
  win.once('ready-to-show', () => win?.show())
  win.webContents.on('did-finish-load', pushState)
  win.on('resize', () => {
    scheduleSaveWindowState()
    placeControlWin()
  })
  win.on('move', () => {
    scheduleSaveWindowState()
    placeControlWin()
  })
  win.on('focus', pushState)
  win.on('blur', pushState)

  // Give the renderer a chance to flush the board to disk before we go away.
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    if (closing) return
    closing = true
    win?.webContents.send('main:flush')
    // An unresponsive renderer must never cause an unconfirmed save to be discarded.
    flushTimer = setTimeout(() => {
      closing = false
      sendCommand('save-failed')
    }, 15_000)
  })
  win.on('closed', () => {
    if (controlWin && !controlWin.isDestroyed()) controlWin.destroy()
    controlWin = null
    win = null
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setFullscreen(on: boolean): void {
  if (!win) return
  if (on === fullscreen) return
  if (on) {
    if (!zoomed) restoreBounds = win.getBounds()
    const d = screen.getDisplayMatching(win.getBounds())
    win.setBounds(d.bounds)
    win.setAlwaysOnTop(true, 'screen-saver')
    fullscreen = true
  } else {
    fullscreen = false
    win.setAlwaysOnTop(onTop)
    if (restoreBounds) win.setBounds(restoreBounds)
    zoomed = false
  }
  pushState()
}

function toggleZoom(): void {
  if (!win || fullscreen) return
  if (zoomed) {
    zoomed = false
    if (restoreBounds) win.setBounds(restoreBounds)
  } else {
    restoreBounds = win.getBounds()
    win.setBounds(screen.getDisplayMatching(restoreBounds).workArea)
    zoomed = true
  }
  pushState()
}

function registerIpc(): void {
  const w = (): BrowserWindow | null => (win && !win.isDestroyed() ? win : null)

  ipcMain.on('agent:reply', (event, reply) => {
    if (event.sender !== w()?.webContents || !reply || typeof reply.id !== 'string') return
    const pending = agentRequests.get(reply.id)
    if (!pending) return
    clearTimeout(pending.timer); agentRequests.delete(reply.id); pending.resolve(reply.result)
  })
  ipcMain.handle('agent:status', () => agentBridge.status())
  ipcMain.handle('agent:enable', () => agentBridge.enable())
  ipcMain.handle('agent:disable', () => agentBridge.disable())
  ipcMain.handle('agent:copy-config', () => { const config = agentBridge.status().config; if (!config) return false; clipboard.writeText(config); return true })
  ipcMain.handle('assistant:config', () => assistant.status())
  ipcMain.handle('assistant:save-config', (_e, config) => assistant.save(config))
  ipcMain.handle('assistant:models', () => assistant.models())
  ipcMain.handle('assistant:generate', (_e, prompt, selection) => assistant.generate(prompt, selection))
  ipcMain.on('assistant:cancel', () => assistant.cancel())

  ipcMain.on('win:minimize', () => w()?.minimize())
  ipcMain.on('win:close', () => w()?.close())
  ipcMain.on('win:toggle-zoom', toggleZoom)
  ipcMain.on('win:toggle-fullscreen', () => setFullscreen(!fullscreen))
  ipcMain.on('win:set-on-top', (_e, on: boolean) => {
    onTop = !!on
    if (!fullscreen) w()?.setAlwaysOnTop(onTop)
    pushState()
    scheduleSaveWindowState()
  })
  ipcMain.on('win:set-bounds', (_e, b: Partial<Bounds>) => {
    const win_ = w()
    if (!win_ || fullscreen || zoomed) return
    if (!b || typeof b !== 'object' || Object.values(b).some((v) => !Number.isFinite(v))) return
    const cur = win_.getBounds()
    const next = {
      x: Math.round(b.x ?? cur.x),
      y: Math.round(b.y ?? cur.y),
      width: Math.max(MIN_W, Math.round(b.width ?? cur.width)),
      height: Math.max(MIN_H, Math.round(b.height ?? cur.height))
    }
    win_.setBounds(next)
  })
  ipcMain.on('win:set-passthrough', (_e, on: boolean) => setPassthrough(!!on))
  ipcMain.on('ctl:exit', () => setPassthrough(false))
  ipcMain.handle('win:get-bounds', () => w()?.getBounds() ?? { x: 0, y: 0, width: 800, height: 600 })

  ipcMain.handle('store:load-settings', async () => {
    const raw = await readText(dataFile('settings.json'))
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })
  ipcMain.handle('store:save-settings', (_e, data: unknown) => {
    try {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid settings')
      return storage.saveText('settings.json', JSON.stringify(data))
    } catch (error) {
      return { ok: false, error: saveError(error) }
    }
  })
  ipcMain.handle('store:load-board', () => storage.loadBoard())
  ipcMain.handle('store:load-recordings', () => storage.loadRecordings())
  ipcMain.handle('store:save-recordings', (_e, json: string) => storage.saveRecordings(json))
  ipcMain.handle('store:save-board', (_e, json: string) => storage.saveBoard(json))
  ipcMain.handle('store:list-backups', () => storage.listBackups())
  ipcMain.handle('store:load-backup', (_e, id: string) => storage.loadBackup(id))

  ipcMain.on('main:flushed', async (e, ok: boolean) => {
    if (!closing || e.sender !== w()?.webContents) return
    if (flushTimer) clearTimeout(flushTimer)
    if (!ok) {
      closing = false
      sendCommand('save-failed')
      return
    }
    try {
      if (saveWinTimer) clearTimeout(saveWinTimer)
      const bounds = fullscreen || zoomed ? restoreBounds : w()?.getBounds()
      if (bounds) {
        const result = await storage.saveText('window.json', JSON.stringify({ ...bounds, onTop }))
        if (!result.ok) throw new Error(result.error)
      }
      await storage.flush()
      quitting = true
      w()?.close()
    } catch {
      closing = false
      sendCommand('save-failed')
    }
  })

  ipcMain.handle('files:save-png', async (_e, png: ArrayBuffer, name: string) => {
    const win_ = w()
    if (!win_) return null
    const r = await dialog.showSaveDialog(win_, {
      title: 'Save image',
      defaultPath: join(app.getPath('pictures'), name),
      filters: [{ name: 'PNG image', extensions: ['png'] }]
    })
    if (r.canceled || !r.filePath) return null
    await fs.writeFile(r.filePath, Buffer.from(png))
    return r.filePath
  })
  ipcMain.handle('files:open-recording', async () => {
    const owner = w()
    if (!owner) return null
    const result = await dialog.showOpenDialog(owner, { title: 'Open whiteboard recording', properties: ['openFile'], filters: [{ name: 'Whiteboard recording', extensions: ['wbrp'] }] })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    if ((await fs.stat(path)).size > MAX_FILE_BYTES) throw new Error('Recording exceeds 50 MB')
    return { path, json: await fs.readFile(path, 'utf8') }
  })
  ipcMain.handle('files:save-recording', async (_e, json: string, name: string) => {
    const owner = w()
    if (!owner) return null
    if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_FILE_BYTES) throw new Error('Recording exceeds 50 MB')
    const result = await dialog.showSaveDialog(owner, { title: 'Save reusable recording', defaultPath: join(app.getPath('documents'), name), filters: [{ name: 'Whiteboard recording', extensions: ['wbrp'] }] })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, json, 'utf8')
    return result.filePath
  })
  ipcMain.handle('files:save-video', async (_e, video: ArrayBuffer, name: string) => {
    const owner = w()
    if (!owner) return null
    if (!(video instanceof ArrayBuffer) || video.byteLength > 512 * 1024 * 1024) throw new Error('Video exceeds 512 MB')
    const result = await dialog.showSaveDialog(owner, { title: 'Save playback video', defaultPath: join(app.getPath('videos'), name), filters: [{ name: 'WebM video', extensions: ['webm'] }] })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, Buffer.from(video))
    return result.filePath
  })
  ipcMain.handle('files:open-board', async () => {
    const win_ = w()
    if (!win_) return null
    const r = await dialog.showOpenDialog(win_, {
      title: 'Open board',
      properties: ['openFile'],
      filters: [{ name: 'Whiteboard', extensions: ['wbd', 'json'] }]
    })
    if (r.canceled || !r.filePaths[0]) return null
    if ((await fs.stat(r.filePaths[0])).size > MAX_FILE_BYTES) throw new Error('Board file exceeds 50 MB')
    return { path: r.filePaths[0], json: await fs.readFile(r.filePaths[0], 'utf8') }
  })
  ipcMain.handle('files:save-board-as', async (_e, json: string, name: string) => {
    const win_ = w()
    if (!win_) return null
    const r = await dialog.showSaveDialog(win_, {
      title: 'Save board',
      defaultPath: join(app.getPath('documents'), name),
      filters: [{ name: 'Whiteboard', extensions: ['wbd'] }]
    })
    if (r.canceled || !r.filePath) return null
    await fs.writeFile(r.filePath, json, 'utf8')
    return r.filePath
  })
}

function registerGlobalShortcuts(): void {
  // These work even when the board is click-through or another app has focus.
  const reg = (accel: string, fn: () => void): void => {
    try {
      globalShortcut.register(accel, fn)
    } catch {
      /* another app owns it – harmless */
    }
  }
  reg('CommandOrControl+Shift+Space', () => setPassthrough(!passthrough))
  reg('CommandOrControl+Shift+H', () => {
    if (!win) return
    if (win.isVisible() && !win.isMinimized()) {
      win.hide()
      controlWin?.hide()
    } else {
      win.show()
      if (!passthrough) win.focus()
      if (passthrough) controlWin?.showInactive()
      sendCommand('show-ui')
    }
  })
}

// ── app lifecycle ─────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.sambhav.floating-whiteboard')
    storage = new DiskStore(app.getPath('userData'))
    agentBridge = new AgentBridge(app.getPath('userData'), app.isPackaged ? join(process.resourcesPath, 'mcp/whiteboard-mcp.cjs') : join(app.getAppPath(), 'mcp/whiteboard-mcp.cjs'), callBoard)
    await agentBridge.disable()
    assistant = new Assistant(dataFile('assistant.json'), { available: () => safeStorage.isEncryptionAvailable(), encrypt: text => safeStorage.encryptString(text), decrypt: data => safeStorage.decryptString(data) }, callBoard)
    await assistant.load()
    registerIpc()
    await createWindow()
    registerGlobalShortcuts()
  })

  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', () => { globalShortcut.unregisterAll(); assistant?.cancel(); void agentBridge?.disable() })
}
