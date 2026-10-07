import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('ctl', {
  exit: (): void => ipcRenderer.send('ctl:exit')
})
