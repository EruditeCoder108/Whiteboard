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

/** Objects to place on a page, or a whole page with its paper, colour and background picture. */
export type ShelfKind = 'selection' | 'page'
export interface ShelfItem {
  id: string
  title: string
  subject: string
  kind: ShelfKind
  created: string
  /** when it was last put into a lesson */
  used?: string
  /** how many objects it holds */
  count: number
  /** the lesson it was saved from */
  from?: string
  thumb?: string
  /** of its contents, so a shelf file added twice does not double everything */
  hash: string
}
export type ShelfNew = Pick<ShelfItem, 'title' | 'subject' | 'kind' | 'count' | 'from' | 'thumb'>
export type ShelfImport = { ok: true; added: number; same: number; bad: number } | { ok: false; error: string }

/** Commands the main process can push to the renderer (global hotkeys, tray, …). */
export type MainCommand = 'show-ui' | 'save-failed'

export type SaveResult = { ok: true } | { ok: false; error: string }
export interface BoardLoad {
  json: string | null
  recovered: boolean
  message?: string
}
/** A lesson file the teacher opened or saved lately. */
export interface RecentLesson {
  path: string
  /** the file name without its extension */
  name: string
  savedAt: string
}
/** What the lesson library shows about a lesson file. */
export interface LibraryLesson {
  path: string
  name: string
  /** the teacher's grouping: a subject, class or course ('' when none) */
  subject: string
  pages: number
  kind: 'notebook' | 'canvas'
  modified: string
  created: string
  /** a small picture of the first page (data URL) */
  thumb?: string
  /** kept in the library folder (rather than elsewhere on the PC) */
  inLibrary: boolean
}
/** Sent along with a save so the library can show the lesson without opening it. */
export interface LessonInfo { subject?: string; pages: number; kind: 'notebook' | 'canvas'; thumb?: string }
/** Which file the lesson on the board belongs to, and whether it has changes that file does not. */
export interface LessonLink {
  path: string | null
  dirty: boolean
}
export interface BackupInfo {
  id: string
  savedAt: string
  itemCount: number
}

export interface ShareAddress { name: string; address: string }
export interface ShareStatus { active: boolean; url: string; downloads: number; expiresAt: number }
export type ShareStart = { ok: true; url: string; expiresAt: number } | { ok: false; error: string }

export interface CaptureSource { id: string; kind: 'screen' | 'window'; name: string; thumbnail: string; icon?: string }
export interface CapturedImage { src: string; width: number; height: number }
export type CaptureResult = ({ ok: true } & CapturedImage) | { ok: false; error: string }

export interface PollStatus { active: boolean; url: string; question: string; options: string[]; counts: number[]; total: number; expiresAt: number }

export interface Api {
  openLink(link: string): Promise<boolean>
  slides: { toPdf(bytes: ArrayBuffer, name: string): Promise<ArrayBuffer | null> }
  poll: {
    start(question: string, options: string[], address: string): Promise<{ ok: true; url: string; expiresAt: number } | { ok: false; error: string }>
    stop(): Promise<void>
    status(): Promise<PollStatus>
  }
  capture: {
    sources(): Promise<CaptureSource[]>
    grab(sourceId: string): Promise<CaptureResult>
  }
  share: {
    addresses(): Promise<ShareAddress[]>
    start(pages: ArrayBuffer[], name: string, address: string): Promise<ShareStart>
    stop(): Promise<void>
    status(): Promise<ShareStatus>
  }
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
    recognize(image: string, kind: 'text' | 'maths'): Promise<{ ok: true; text: string } | { ok: false; error: string }>
    cancel(): void
  }
  platform: string
  win: {
    minimize(): void
    close(): void
    toggleZoom(): void
    toggleFullscreen(): void
    setFullscreen(on: boolean): void
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
    /** `assets`: pictures not yet sent this session, keyed by content */
    saveBoard(json: string, assets?: Record<string, string>): Promise<SaveResult>
    listBackups(): Promise<BackupInfo[]>
    loadBackup(id: string): Promise<string | null>
    /** Keep the board as it is now as a backup, even if one was made a moment ago (before it is replaced). */
    archiveBoard(): Promise<void>
  }
  lessons: {
    recent(): Promise<RecentLesson[]>
    /** The file dialog; the chosen path may then be saved to. */
    pickSavePath(suggestedName: string): Promise<string | null>
    /** The file dialog, then the lesson read back. */
    pickOpen(): Promise<{ path: string; json: string } | null>
    /** A lesson from the recent list. */
    open(path: string): Promise<{ path: string; json: string } | null>
    /** Write the lesson file in one piece (the previous file stays until the new one is complete). */
    save(path: string, json: string, info?: LessonInfo): Promise<SaveResult>
    forget(path: string): Promise<void>
    /** Every lesson: the library folder plus lessons kept elsewhere that were used here. */
    library(): Promise<LibraryLesson[]>
    /** A free path for a new lesson in the library folder. */
    create(name: string, subject: string): Promise<string | null>
    rename(path: string, name: string): Promise<{ ok: true; path: string } | { ok: false; error: string }>
    duplicate(path: string): Promise<string | null>
    /** To the Recycle Bin. */
    remove(path: string): Promise<SaveResult>
    setSubject(path: string, subject: string): Promise<SaveResult>
    /** Show the file in File Explorer. */
    reveal(path: string): Promise<void>
    getLink(): Promise<LessonLink>
    setLink(link: LessonLink): Promise<SaveResult>
  }
  /** The teacher's own saved diagrams and pages. */
  shelf: {
    list(): Promise<ShelfItem[]>
    /** `json`: one page in the lesson file format, with its pictures inside. */
    save(info: ShelfNew, json: string): Promise<{ ok: true; item: ShelfItem } | { ok: false; error: string }>
    read(id: string): Promise<string | null>
    update(id: string, change: { title?: string; subject?: string }): Promise<SaveResult>
    /** To the Recycle Bin. */
    remove(id: string): Promise<SaveResult>
    /** The file dialog, then the whole shelf as one file; null if cancelled. */
    exportFile(): Promise<{ ok: true; count: number } | { ok: false; error: string } | null>
    /** The file dialog, then what that file holds added to the shelf; null if cancelled. */
    importFile(): Promise<ShelfImport | null>
  }
  files: {
    openRecording(): Promise<{ path: string; json: string } | null>
    saveRecording(json: string, suggestedName: string): Promise<string | null>
    saveVideo(video: ArrayBuffer, suggestedName: string): Promise<string | null>
    savePng(png: ArrayBuffer, suggestedName: string): Promise<string | null>
    savePdf(pages: ArrayBuffer[], suggestedName: string): Promise<string | null>
  }
}

declare global {
  interface Window {
    api: Api
  }
}
