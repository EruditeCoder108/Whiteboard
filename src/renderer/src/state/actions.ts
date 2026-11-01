import { board } from '@/engine/instance'
import { radial } from '@/engine/radial'
import type { RadialPick } from '@/engine/radial'
import { clipboardImage } from './insert'
import { S, showToast, styleKey, SIZE_RANGE } from './store'
import type { BoardKind, GridMode, Layout, ToolName } from './store'
import type { PictureScope } from '@/engine/board'
import { clamp } from '@/engine/geometry'
import { exportName, lesson } from './lesson'

/** Below this board opacity (percent) the board counts as "writing over the screen". */
export const OVERLAY_ALPHA = 20

/** Everything a user can *do*.  Buttons, shortcuts and the radial menu all call these. */
export const actions = {
  retrySave(): void {
    void S.retrySave.value?.()
  },

  setSelectionWidth(width: number): void {
    if (Number.isFinite(width)) board.resizeSelection(clamp(Math.round(width), 1, 60))
  },
  setTool(t: ToolName): void {
    board.setTool(t)
  },

  toggleEraserMode(): void {
    S.eraserMode.value = S.eraserMode.value === 'stroke' ? 'pixel' : 'stroke'
    showToast(
      S.eraserMode.value === 'pixel' ? 'Eraser: Pixel  ·  erases only what you touch' : 'Eraser: Stroke  ·  removes whole strokes'
    )
  },

  /** E: pick the eraser; pressing it again switches Stroke ⇄ Pixel */
  eraserKey(): void {
    if (S.tool.value === 'eraser') actions.toggleEraserMode()
    else board.setTool('eraser')
  },

  cycleGrid(): void {
    const order = ['none', 'dots', 'lines'] as const
    const next = order[(Math.max(0, order.indexOf(S.grid.value as typeof order[number])) + 1) % 3]
    actions.setPaper(next)
    showToast('Grid: ' + { none: 'off', dots: 'dots', lines: 'squares' }[next])
  },

  /** Paper for this page (or canvas frame), or for every page; it is also what new lessons start with. */
  setPaper(paper: GridMode, everywhere = false): void {
    board.setPaper(paper, everywhere)
    S.defaultPaper.value = paper
  },

  setColor(c: string): void {
    // with something selected, a colour pick recolours the selection
    if (['select', 'lasso'].includes(S.tool.value) && board.recolorSelection(c)) return
    const t = S.tool.value
    if (t === 'eraser' || t === 'select' || t === 'hand' || t === 'laser') board.setTool('pen')
    if (styleKey.value === 'marker') S.markerColor.value = c
    else S.penColor.value = c
  },

  setSize(v: number): void {
    const key = styleKey.value
    const [lo, hi] = SIZE_RANGE[key]
    const n = clamp(Math.round(v), lo, hi)
    if (key === 'marker') S.markerSize.value = n
    else if (key === 'eraser') S.eraserSize.value = n
    else S.penSize.value = n
  },

  nudgeSize(dir: 1 | -1): void {
    const key = styleKey.value
    const cur = key === 'marker' ? S.markerSize.value : key === 'eraser' ? S.eraserSize.value : S.penSize.value
    actions.setSize(cur + dir * (key === 'pen' ? 1 : key === 'marker' ? 2 : 4))
  },

  /** Board colour for the whole lesson, or (`onlyHere`) for this page or frame alone. */
  setBackground(color: string, onlyHere = false): void {
    board.setColor(color, onlyHere)
    if (!onlyHere) S.defaultColor.value = color
  },

  toggleUi(): void {
    S.popover.value = null
    S.uiHidden.value = !S.uiHidden.value
    if (S.uiHidden.value) showToast('Interface hidden  ·  use the small button (top-right) or Tab', 2800)
  },

  /** The main process owns the state and pushes it back (see app.tsx). */
  setPassthrough(on: boolean): void {
    S.popover.value = null
    radial.cancel()
    window.api.win.setPassthrough(on)
  },

  togglePin(): void {
    window.api.win.setOnTop(!S.onTop.value)
  },

  toggleFullscreen(): void {
    window.api.win.toggleFullscreen()
  },

  /** Smart board: full screen, solid board. Laptop: the compact floating window. */
  chooseLayout(layout: Layout): void {
    S.popover.value = null
    S.layout.value = layout
    S.layoutChosen.value = true
    // An empty board takes the kind that suits the screen; a board with work on it keeps its kind.
    if (board.isEmpty) board.convertTo(layout === 'board' ? 'notebook' : 'canvas')
    if (layout === 'board') {
      if (S.bgAlpha.value < 100) S.bgAlpha.value = 100
      window.api.win.setFullscreen(true)
    } else window.api.win.setFullscreen(false)
  },

  /** Turn this board into a notebook (fixed pages) or a canvas (endless, with frames). Nothing is lost. */
  convertBoard(kind: BoardKind): void {
    S.popover.value = null
    if (!board.convertTo(kind)) return
    showToast(kind === 'notebook'
      ? `Now a notebook · ${board.pageCount} page${board.pageCount === 1 ? '' : 's'} · swipe with two fingers to turn`
      : `Now a canvas${board.frameList.length ? ` · your pages are frames 1–${board.frameList.length}` : ''} · drag with two fingers to move around`, 4200)
  },

  /** Write over the screen: the board turns see-through (and back to solid). */
  toggleOverlay(): void {
    S.popover.value = null
    const on = S.bgAlpha.value >= OVERLAY_ALPHA
    S.bgAlpha.value = on ? 1 : 100
    showToast(on ? 'Writing over the screen · to click the apps underneath, use More → Use apps below' : 'Back to the board', 3600)
  },

  runRadial(pick: RadialPick): void {
    if (pick.kind === 'color') return actions.setColor(pick.color)
    switch (pick.key) {
      case 'pen':
      case 'marker':
      case 'eraser':
      case 'select':
        return board.setTool(pick.key)
      case 'undo':
        return board.undo()
      case 'redo':
        return board.redo()
      case 'clear':
        return board.clearBoard()
      case 'grid':
        return actions.cycleGrid()
    }
  },

  // ── files ───────────────────────────────────────────────────────────────────
  /** A picture of the page (notebook) or of everything drawn (canvas) as a PNG file. */
  async savePng(opts: { scope?: PictureScope; paper?: boolean } = {}): Promise<void> {
    try {
      const png = await board.exportPng(opts)
      if (!png) return showToast('Nothing to save yet — nothing is drawn there')
      const path = await window.api.files.savePng(png, exportName('png'))
      if (path) showToast('Saved  ' + path.split(/[\\/]/).pop())
    } catch {
      showToast('Could not export the image. Please try another location.', 5000)
    }
  },

  async copyImage(opts: { scope?: PictureScope; paper?: boolean } = {}): Promise<void> {
    try {
      const png = await board.exportPng(opts)
      if (!png) return showToast('Nothing to copy yet — nothing is drawn there')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })])
      clipboardImage.value = true
      showToast('Image copied to the clipboard')
    } catch {
      showToast('Could not copy the image')
    }
  },

  async restoreBackup(id: string): Promise<void> {
    try {
      const json = await window.api.store.loadBackup(id)
      if (!json || !board.load(json, { undoable: true })) return showToast('That backup is unavailable. Please refresh the list.')
      S.popover.value = null
      board.fitContent()
      showToast('Backup restored', 8000, { label: 'Undo', run: () => board.undoStructure() })
    } catch {
      showToast('Could not restore that backup. Please try again.', 5000)
    }
  },

  // ── lessons (see lesson.ts) ─────────────────────────────────────────────────
  newLesson: () => lesson.newLesson(),
  openLesson: () => lesson.open(),
  saveLesson: () => lesson.save(),
  saveLessonAs: () => lesson.saveAs()
}
