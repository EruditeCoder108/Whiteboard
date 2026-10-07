import { board } from '@/engine/instance'
import { radial } from '@/engine/radial'
import type { RadialPick } from '@/engine/radial'
import { S, luminance, isDarkBg, showToast, styleKey, SIZE_RANGE } from './store'
import type { ToolName } from './store'
import { clamp } from '@/engine/geometry'

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
    S.grid.value = order[(order.indexOf(S.grid.value) + 1) % 3]
    showToast('Grid: ' + { none: 'off', dots: 'dots', lines: 'lines' }[S.grid.value])
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

  setBackground(color: string): void {
    const wasDark = isDarkBg.value
    S.bgColor.value = color
    const dark = isDarkBg.value
    if (dark !== wasDark) {
      // keep new ink readable on the new board colour
      const L = luminance(S.penColor.value)
      if (dark && L < 0.2) S.penColor.value = '#ffffff'
      else if (!dark && L > 0.85) S.penColor.value = '#111827'
    }
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
  async savePng(): Promise<void> {
    try {
      const png = await board.exportPng(S.bgColor.value, S.bgAlpha.value > 0)
      if (!png) return showToast('Nothing to export yet — the board is empty')
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
      const path = await window.api.files.savePng(png, `whiteboard_${stamp}.png`)
      if (path) showToast('Saved  ' + path.split(/[\\/]/).pop())
    } catch {
      showToast('Could not export the image. Please try another location.', 5000)
    }
  },

  async copyImage(): Promise<void> {
    try {
      const png = await board.exportPng(S.bgColor.value, S.bgAlpha.value > 0)
      if (!png) return showToast('Nothing to copy yet — the board is empty')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })])
      showToast('Image copied to the clipboard')
    } catch {
      showToast('Could not copy the image')
    }
  },

  async openBoard(): Promise<void> {
    try {
      const r = await window.api.files.openBoard()
      if (!r) return
      const parsed = board.load(r.json, { undoable: true })
      if (parsed) {
        board.fitContent()
        const detail = parsed.skipped ? ` · ${parsed.skipped} invalid object(s) skipped` : ''
        showToast((parsed.legacy ? 'Python board imported' : 'Board opened') + detail + ' · Ctrl+Z to go back', parsed.skipped ? 6000 : 3000)
      } else showToast('Unsupported or damaged board file. Your current board is unchanged.', 5000)
    } catch {
      showToast('Could not read that file. Your current board is unchanged.', 5000)
    }
  },

  async restoreBackup(id: string): Promise<void> {
    try {
      const json = await window.api.store.loadBackup(id)
      if (!json || !board.load(json, { undoable: true })) return showToast('That backup is unavailable. Please refresh the list.')
      S.popover.value = null
      board.fitContent()
      showToast('Backup restored · Ctrl+Z to return to your current board', 5000)
    } catch {
      showToast('Could not restore that backup. Please try again.', 5000)
    }
  },

  async saveBoardFile(): Promise<void> {
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      const path = await window.api.files.saveBoardAs(board.serialize(), `board_${stamp}.wbd`)
      if (path) showToast('Board saved  ' + path.split(/[\\/]/).pop())
    } catch {
      showToast('Could not save the board file. Please try another location.', 5000)
    }
  }
}
