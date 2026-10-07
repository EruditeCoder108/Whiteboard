import { contextBridge, ipcRenderer } from 'electron'
import type { Api, MainCommand, WinState } from '../shared/api'

function subscribe<T>(channel: string, cb: (v: T) => void): () => void {
  const handler = (_: unknown, v: T): void => cb(v)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: Api = {
  agent: {
    status: () => ipcRenderer.invoke('agent:status'),
    enable: () => ipcRenderer.invoke('agent:enable'),
    disable: () => ipcRenderer.invoke('agent:disable'),
    copyConfig: () => ipcRenderer.invoke('agent:copy-config'),
    onCall: (cb) => subscribe('agent:call', cb),
    reply: (id, result) => ipcRenderer.send('agent:reply', { id, result }),
    config: () => ipcRenderer.invoke('assistant:config'),
    saveConfig: (config) => ipcRenderer.invoke('assistant:save-config', config),
    models: () => ipcRenderer.invoke('assistant:models'),
    generate: (prompt, selection) => ipcRenderer.invoke('assistant:generate', prompt, selection),
    cancel: () => ipcRenderer.send('assistant:cancel')
  },
  platform: process.platform,
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    close: () => ipcRenderer.send('win:close'),
    toggleZoom: () => ipcRenderer.send('win:toggle-zoom'),
    toggleFullscreen: () => ipcRenderer.send('win:toggle-fullscreen'),
    setOnTop: (on) => ipcRenderer.send('win:set-on-top', on),
    setBounds: (b) => ipcRenderer.send('win:set-bounds', b),
    getBounds: () => ipcRenderer.invoke('win:get-bounds'),
    setPassthrough: (on) => ipcRenderer.send('win:set-passthrough', on),
    onState: (cb) => subscribe<WinState>('win:state', cb),
    onCommand: (cb) => subscribe<MainCommand>('main:command', cb),
    onFlush: (cb) => subscribe<void>('main:flush', cb),
    flushed: (ok) => ipcRenderer.send('main:flushed', ok)
  },
  store: {
    loadRecordings: () => ipcRenderer.invoke('store:load-recordings'),
    saveRecordings: (json) => ipcRenderer.invoke('store:save-recordings', json),
    loadSettings: () => ipcRenderer.invoke('store:load-settings'),
    saveSettings: (data) => ipcRenderer.invoke('store:save-settings', data),
    loadBoard: () => ipcRenderer.invoke('store:load-board'),
    saveBoard: (json) => ipcRenderer.invoke('store:save-board', json),
    listBackups: () => ipcRenderer.invoke('store:list-backups'),
    loadBackup: (id) => ipcRenderer.invoke('store:load-backup', id)
  },
  files: {
    openRecording: () => ipcRenderer.invoke('files:open-recording'),
    saveRecording: (json, name) => ipcRenderer.invoke('files:save-recording', json, name),
    saveVideo: (video, name) => ipcRenderer.invoke('files:save-video', video, name),
    savePng: (png, name) => ipcRenderer.invoke('files:save-png', png, name),
    openBoard: () => ipcRenderer.invoke('files:open-board'),
    saveBoardAs: (json, name) => ipcRenderer.invoke('files:save-board-as', json, name)
  }
}

contextBridge.exposeInMainWorld('api', api)
