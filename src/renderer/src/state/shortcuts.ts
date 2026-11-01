import { board } from '@/engine/instance'
import { isTyping } from '@/engine/input'
import { radial } from '@/engine/radial'
import { actions } from './actions'
import { S } from './store'
import { dialog } from './dialog'
import { replay } from './replay'
import { clipboardImage, pasteClipboardImage, refreshClipboardImage } from './insert'
import { capture } from './capture'

/** Registers all keyboard shortcuts; returns an unsubscribe function. */
export function installShortcuts(cancelRadial: () => void): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (!S.ready.value || S.closing.value) return
    if (isTyping(e)) return
    // A question on screen is answered with the buttons; Esc is "cancel".
    if (dialog.value) { if (e.key === 'Escape') { e.preventDefault(); dialog.value.resolve('cancel') } return }
    if (S.replaying.value) {
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) replay.playing.value ? replay.pause() : replay.play(); return }
      if (e.key === 'Escape') { e.preventDefault(); replay.close(); S.popover.value = 'replay'; return }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); replay.step(e.key === 'ArrowLeft' ? -1 : 1); return }
      if (e.key !== 'F11') { e.preventDefault(); return }
    }
    const ctrl = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()

    if (e.key === 'Escape') {
      if (radial.isOpen) cancelRadial()
      else if (board.currentTool().underway()) cancelRadial()
      else if (S.popover.value) S.popover.value = null
      else if (board.selection.length) board.setSelection([])
      else if (S.fullscreen.value) actions.toggleFullscreen()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      return actions.toggleUi()
    }
    if (e.key === 'F11') {
      e.preventDefault()
      return actions.toggleFullscreen()
    }
    if (e.key === 'F1' || (e.key === '?' && !ctrl)) {
      e.preventDefault()
      S.popover.value = S.popover.value === 'help' ? null : 'help'
      return
    }

    if (ctrl) {
      const shift = e.shiftKey
      if (e.altKey && k === 'c') { e.preventDefault(); return board.copyStyle() }
      if (e.altKey && k === 'v') { e.preventDefault(); return board.pasteStyle() }
      switch (k) {
        case 'g':
          e.preventDefault()
          return shift ? board.ungroupSelection() : board.groupSelection()
        case 'l':
          e.preventDefault()
          return board.toggleLockSelection()
        case 'z':
          e.preventDefault()
          return shift ? board.redo() : board.undo()
        case 'y':
          e.preventDefault()
          return board.redo()
        case 'a':
          e.preventDefault()
          return board.selectAll()
        case 'd':
          e.preventDefault()
          return board.duplicateSelection()
        // The lesson is the file: Ctrl+S saves it (and asks where the first time); pictures and PDFs are under Export (Ctrl+E).
        case 's':
          e.preventDefault()
          return void (shift ? actions.saveLessonAs() : actions.saveLesson())
        case 'n':
          e.preventDefault()
          return void actions.newLesson()
        case 'e':
          e.preventDefault()
          S.popover.value = S.popover.value === 'export' ? null : 'export'
          return
        case 'c':
          if (shift) {
            e.preventDefault()
            return void capture.open()
          }
          e.preventDefault()
          if (board.selection.length) { clipboardImage.value = false; void navigator.clipboard.writeText('').catch(() => {}) }
          return board.copySelection()
        case 'v':
          // A picture on the system clipboard wins; copying board objects clears it (see 'c').
          e.preventDefault()
          if (!clipboardImage.value && board.hasCopy) return board.pasteSelection()
          return void pasteClipboardImage().then(ok => { if (ok) clipboardImage.value = false; else board.pasteSelection() })
        case 'x':
          e.preventDefault()
          board.copySelection()
          return board.deleteSelection()
        case '2':
          e.preventDefault()
          return board.fitSelection()
        case 'o':
          e.preventDefault()
          return void actions.openLesson()
        case '0':
          e.preventDefault()
          return board.resetZoom()
        case '1':
          e.preventDefault()
          return board.fitContent()
        case '=':
        case '+':
          e.preventDefault()
          return board.zoomStep(1.25)
        case '-':
          e.preventDefault()
          return board.zoomStep(1 / 1.25)
        case 't':
          e.preventDefault()
          return actions.togglePin()
        case 'delete':
          if (shift) {
            e.preventDefault()
            return board.clearBoard()
          }
          return
      }
      return
    }

    if (e.altKey) return
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && board.selection.length) {
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      return board.nudgeSelection(e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0)
    }
    switch (e.key) {
      case 'Enter': {
        const selected = board.selection[0]
        if (board.selection.length === 1 && (selected.t === 't' || selected.t === 'h')) { e.preventDefault(); return board.editText(selected) }
        break
      }
      // With a selection these reorder objects; otherwise they turn pages (presentation clickers send them).
      case 'PageUp': e.preventDefault(); return board.selection.length ? board.arrangeSelection('front') : void board.turnPage(-1)
      case 'PageDown': e.preventDefault(); return board.selection.length ? board.arrangeSelection('back') : board.nextReveal() ? undefined : void board.turnPage(1) // a clicker goes through a page's steps first
      case 'Delete':
      case 'Backspace':
        return board.deleteSelection()
      case '[':
        return actions.nudgeSize(-1)
      case ']':
        return actions.nudgeSize(1)
    }
    switch (k) {
      case 'v': return actions.setTool('select')
      case 'q': return actions.setTool('lasso')
      case 't': return actions.setTool('text')
      case 'n': return actions.setTool('sticky')
      case 'h': return actions.setTool('hand')
      case 'p': return actions.setTool('pen')
      case 'm': return actions.setTool('marker')
      case 'e': return actions.eraserKey()
      case 'l': return actions.setTool('line')
      case 'a': return actions.setTool('arrow')
      case 'r': return actions.setTool('rect')
      case 'o': return actions.setTool('ellipse')
      case 'k': return actions.setTool('laser')
      case 'g': return actions.cycleGrid()
    }
  }
  const onFocus = (): void => { void refreshClipboardImage() }
  window.addEventListener('keydown', onKey)
  window.addEventListener('focus', onFocus)
  void refreshClipboardImage()
  return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('focus', onFocus) }
}
