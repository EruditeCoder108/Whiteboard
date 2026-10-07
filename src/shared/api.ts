/** The contract between the Electron main process and the renderer (via preload). */

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface WinState {
  onTop: boolean
  fullscreen: boolean
  zoomed: boolean
  focused: boolean
  /** the board ignores the mouse so the apps underneath can be used */
  passthrough: boolean
}

/** Commands the main process can push to the renderer (global hotkeys, tray, …). */
export type MainCommand = 'show-ui' | 'save-failed'

export type SaveResult = { ok: true } | { ok: false; error: string }
export interface BoardLoad {
  json: string | null
  recovered: boolean
  message?: string
}
export interface BackupInfo {
  id: string
  savedAt: string
  itemCount: number
}

export interface Api {
  agent: {
    status(): Promise<import('./agent').BridgeStatus>
    enable(): Promise<import('./agent').BridgeStatus>
    disable(): Promise<import('./agent').BridgeStatus>
    copyConfig(): Promise<boolean>
    onCall(cb: (request: { id: string; call: import('./agent').AgentCall }) => void): () => void
    reply(id: string, result: import('./agent').AgentResult): void
    config(): Promise<import('./agent').AssistantConfig>
    saveConfig(config: import('./agent').AssistantSettings): Promise<import('./agent').AssistantConfig>
    models(): Promise<string[]>
    generate(prompt: string, selection: string[]): Promise<import('./agent').AssistantResult>
    cancel(): void
  }
  platform: string
  win: {
    minimize(): void
    close(): void
    toggleZoom(): void
    toggleFullscreen(): void
    setOnTop(on: boolean): void
    setBounds(b: Partial<Bounds>): void
    getBounds(): Promise<Bounds>
    /** Click-through: the board ignores every pointer so the apps underneath can be used.
     *  A tiny always-clickable "back to drawing" pill stays on screen (works for touch too). */
    setPassthrough(on: boolean): void
    onState(cb: (s: WinState) => void): () => void
    onCommand(cb: (c: MainCommand) => void): () => void
    /** Main asks the renderer to flush pending saves before the window closes. */
    onFlush(cb: () => void): () => void
    flushed(ok: boolean): void
  }
  store: {
    loadRecordings(): Promise<{ json: string | null; error?: string }>
    saveRecordings(json: string): Promise<SaveResult>
    loadSettings(): Promise<unknown | null>
    saveSettings(data: unknown): Promise<SaveResult>
    loadBoard(): Promise<BoardLoad>
    saveBoard(json: string): Promise<SaveResult>
    listBackups(): Promise<BackupInfo[]>
    loadBackup(id: string): Promise<string | null>
  }
  files: {
    openRecording(): Promise<{ path: string; json: string } | null>
    saveRecording(json: string, suggestedName: string): Promise<string | null>
    saveVideo(video: ArrayBuffer, suggestedName: string): Promise<string | null>
    savePng(png: ArrayBuffer, suggestedName: string): Promise<string | null>
    openBoard(): Promise<{ path: string; json: string } | null>
    saveBoardAs(json: string, suggestedName: string): Promise<string | null>
  }
}

declare global {
  interface Window {
    api: Api
  }
}
