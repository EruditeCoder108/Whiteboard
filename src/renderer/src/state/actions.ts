import { board } from '@/engine/instance'
import { radial } from '@/engine/radial'
import type { RadialPick } from '@/engine/radial'
import { clipboardImage } from './insert'
import { S, showToast, styleKey, SIZE_RANGE } from './store'
import type { BoardKind, GridMode, ToolName } from './store'
import type { PictureScope } from '@/engine/board'
import type { Texture } from '@/engine/texture'
import type { View } from '@/engine/types'
import { clamp } from '@/engine/geometry'
import { exportName, lesson } from './lesson'

/** Below this board opacity (percent) the board counts as "writing over the screen". */

/** How the paper in view is drawn becomes how new lessons start. */
function rememberPaperStyle(): void {
  const s = S.here.value.style
  S.defaultSpacing.value = s.spacing
  S.defaultStrength.value = s.strength
  S.defaultLines.value = s.lines ?? ''
}

/** Everything a user can *do*.  Buttons, shortcuts and the radial menu all call these. */
let screenReturn: { page: number; windowed: boolean; kind: string; view: View } | null = null

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
      S.eraserMode.value === 'pixel' ? 'Eraser: rub out  ·  erases only what you touch' : 'Eraser: whole stroke  ·  removes the line you touch'
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
    rememberPaperStyle()
  },

  /** Spacing, strength or line colour of the paper (`null`: back to the preset); new lessons follow. */
  setPaperStyle(patch: { spacing?: number | null; strength?: number | null; lines?: string | null }, everywhere = false): void {
    board.setPaperStyle(patch, everywhere)
    rememberPaperStyle()
  },

  resetPaper(everywhere = false): void {
    board.resetPaper(everywhere)
    rememberPaperStyle()
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
    actions.setSurface({ color }, onlyHere)
  },

  /** Board surface (colour and/or texture); a lesson-wide choice is also what new lessons start with. */
  setSurface(patch: { color?: string; texture?: Texture }, onlyHere = false): void {
    board.setSurface(patch, onlyHere)
    if (onlyHere) return
    if (patch.color !== undefined) S.defaultColor.value = patch.color
    if (patch.texture !== undefined) S.defaultTexture.value = patch.texture
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
    S.windowed.value = S.fullscreen.value
    window.api.win.toggleFullscreen()
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
  /**
   * Write over whatever is on the screen. The notes get a page of their own, so nothing lands on the lesson's
   * pages by accident, and it goes away again if nothing was written.
   */
  enterScreen(): void {
    S.popover.value = null
    screenReturn = { page: S.page.value, windowed: !S.fullscreen.value, kind: S.kind.value, view: board.view }
    board.commitText()
    board.setSelection([])
    if (S.kind.value === 'notebook') {
      board.addPage()
      board.setTitle(S.page.value, 'Written on the screen')
    } else board.setView(board.clearStretch())
    S.screenMode.value = true
    S.bgAlpha.value = 0
    board.setTool('pen')
    window.api.win.setFullscreen(true)
  },

  exitScreen(): void {
    const back = screenReturn
    actions.setPassthrough(false)
    S.screenMode.value = false
    S.bgAlpha.value = 100
    if (back?.kind === 'notebook') {
      if (board.removeEmptyPage()) board.goToPage(back.page)
      else {
        const notes = S.page.value + 1
        board.goToPage(back.page)
        showToast(`What you wrote is kept on page ${notes}`, 4000)
      }
    } else if (back) board.setView(back.view)
    if (back?.windowed) window.api.win.setFullscreen(false)
    screenReturn = null
  },

  runRadial(pick: RadialPick): void {
    if (pick.kind === 'color') return actions.setColor(pick.color)
    if (pick.kind === 'style') { S.penStyle.value = pick.style; return board.setTool('pen') }
    switch (pick.key) {
      case 'pen':
      case 'marker':
      case 'eraser':
      case 'select':
      case 'text':
        return board.setTool(pick.key)
      case 'shape':
        return board.setTool(S.lastShape.value)
      case 'undo':
        return board.undo()
      case 'redo':
        return board.redo()
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
  /** The New lesson sheet: a name, a subject and the kind of board. */
  newLesson: (): void => { S.popover.value = 'new-lesson' },
  /** My lessons: every lesson, grouped by subject. */
  openLesson: (): void => { S.popover.value = 'lessons' },
  saveLesson: () => lesson.save(),
  saveLessonAs: () => lesson.saveAs()
}
