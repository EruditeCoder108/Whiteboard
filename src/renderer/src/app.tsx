import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { board } from '@/engine/instance'
import { InputRouter } from '@/engine/input'
import { actions } from '@/state/actions'
import { installShortcuts } from '@/state/shortcuts'
import { S, applySettings, boardMode, darkUi, showToast, startPersisting } from '@/state/store'
import { BoardBar, BoardSaveChip, EdgeTabs, LayoutChooser } from '@/ui/Board'
import { PalmCalibration } from '@/ui/Calibrate'
import { InputsSheet } from '@/ui/Inputs'
import { Autosave } from '@/state/autosave'
import { Radial } from '@/ui/Radial'
import { ResizeHandles, Toast } from '@/ui/Chrome'
import { Dock, HistoryBar, MiniBar, TopBar, ZoomBar } from '@/ui/Panels'
import { Popovers, PropsPopover, ShapesPopover } from '@/ui/Popovers'
import { Editor, SelectionToolbar } from '@/ui/Editor'
import { BoardAgent } from '@/engine/agent'
import { AgentPanel } from '@/ui/AgentPanel'
import { replay } from '@/state/replay'
import { ReplayPanel, ReplayCanvas, ReplayControls, RecordingControls } from '@/ui/Replay'
import { Dialog } from '@/ui/Dialog'
import { SharePanel } from '@/ui/Share'
import { LessonLibrary, NewLessonSheet } from '@/ui/Lessons'
import { ShelfSaveSheet, ShelfSheet } from '@/ui/Shelf'
import { CapturePanel } from '@/ui/Capture'
import { lesson } from '@/state/lesson'
import { ScienceUI } from '@/ui/science/Science'
import { PageBar, ImportStatus } from '@/ui/Insert'
import { CurtainLayer, SpotlightLayer, TimerWidget } from '@/ui/Present'
import { editEquation, editGraph, editScale, insertFiles, scaleTarget } from '@/state/insert'
import { ScaleEditor } from '@/ui/Scale'
import { RevealBar } from '@/ui/Reveal'
import { TableCellEditor, TableChooser, editingCell } from '@/ui/Table'
import { CalculatorWidget, PeriodicSheet } from '@/ui/Tools'
import { ExportPreview } from '@/ui/ExportPreview'

const agentForPanel = new BoardAgent(board, replay)

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}

export function App(): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const gridRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const stage = stageRef.current!
    const unmount = board.mount(stage, boardRef.current!, liveRef.current!, gridRef.current!)
    const router = new InputRouter(stage, board, actions.runRadial)
    router.attach()
    const offKeys = installShortcuts(() => router.abortAll())
    const agent = agentForPanel
    const offAgent = window.api.agent.onCall(({ id, call }) => window.api.agent.reply(id, agent.call(call.name, call.arguments)))

    // close popovers when clicking anywhere that isn't a popover or its trigger
    const onDocDown = (e: PointerEvent): void => {
      const t = e.target as Element | null
      if (S.popover.value && !(t && t.closest('[data-popover-keep]'))) S.popover.value = null
    }
    document.addEventListener('pointerdown', onDocDown, true)

    // ── autosave ──────────────────────────────────────────────────────────────
    let active = true
    let saveBoardOnClose = false
    let settings: ReturnType<typeof startPersisting> | undefined
    // Pictures are sent once per session; the main process writes each one to disk once.
    const savedAssets = new Set<string>()
    let pendingAssets: Record<string, string> = {}
    const autosave = new Autosave(
      () => {
        const { json, assets } = board.serializeForStore()
        pendingAssets = Object.fromEntries(Object.entries(assets).filter(([key]) => !savedAssets.has(key)))
        return json
      },
      async (json) => {
        const sent = pendingAssets
        const result = await window.api.store.saveBoard(json, sent)
        if (result.ok) for (const key of Object.keys(sent)) savedAssets.add(key)
        return result
      },
      (status, error) => {
        if (!active) return
        S.saveStatus.value = status
        S.saveError.value = error ?? ''
      }
    )
    board.onChange = () => {
      S.documentRevision.value = board.doc.version
      if (!S.ready.value) return
      saveBoardOnClose = true
      autosave.markDirty()
    }
    board.onEdit = (label, timing) => replay.capture(label, timing)
    board.onEditCell = cell => { editingCell.value = cell }
    board.onEditMedia = it => it.t === 'g' ? editGraph(it) : it.t === 'n' ? editScale(it) : editEquation(it)
    const onDragOver = (e: DragEvent): void => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }
    const onDrop = (e: DragEvent): void => {
      const files = [...e.dataTransfer?.files ?? []]
      if (!files.length) return
      e.preventDefault()
      const r = stage.getBoundingClientRect()
      void insertFiles(files, board.toWorld(e.clientX - r.left, e.clientY - r.top))
    }
    stage.addEventListener('dragover', onDragOver)
    stage.addEventListener('drop', onDrop)
    board.onViewChange = () => { board.onChange?.(); replay.capture() }
    board.onPageChange = () => { if (replay.recording.value) { replay.stop(); showToast('Recording saved · a recording covers one page') } }

    const load = async (): Promise<void> => {
      try {
        const rawSettings = await window.api.store.loadSettings()
        const saved = await window.api.store.loadBoard()
        if (!active) return
        applySettings(rawSettings)
        if (saved.json) board.load(saved.json, { undoable: false })
        else if (S.layoutChosen.value && boardMode.value) board.convertTo('notebook')
        saveBoardOnClose = saved.json !== null || !saved.message
        settings = startPersisting((d) => window.api.store.saveSettings(d))
        S.ready.value = true
        await lesson.init()
        await replay.load()
        S.documentRevision.value = board.doc.version
        S.saveStatus.value = 'saved'
        S.saveError.value = ''
        window.api.win.setOnTop(S.onTop.value)
        if (S.layoutChosen.value && boardMode.value) window.api.win.setFullscreen(true)
        if (saved.message) showToast(saved.message, 7000)
      } catch (error) {
        S.saveStatus.value = 'error'
        S.saveError.value = error instanceof Error ? error.message : 'Could not load your saved board'
      }
    }
    let startup = load()
    S.retrySave.value = async () => {
      if (!S.ready.value) {
        startup = load()
        await startup
        return
      }
      const ok = await autosave.flush()
      const settingsOk = await settings?.flush()
      const recordingOk = await replay.persist()
      if (ok && settingsOk && recordingOk) showToast('Board, settings and recordings saved')
    }

    const offs = [
      window.api.win.onState((s) => {
        S.onTop.value = s.onTop
        S.fullscreen.value = s.fullscreen
        S.zoomed.value = s.zoomed
        if (s.passthrough !== S.passthrough.value) {
          S.passthrough.value = s.passthrough
          if (s.passthrough) router.abortAll()
          showToast(
            s.passthrough
              ? 'Pass-through ON  ·  the apps underneath are usable  ·  press Ctrl+Shift+Space or use the blue button to draw again'
              : 'Pass-through off  ·  you can draw again',
            3600
          )
        }
      }),
      window.api.win.onCommand((c) => {
        if (c === 'show-ui') S.uiHidden.value = false
        if (c === 'save-failed') {
          S.closing.value = false
          S.saveStatus.value = 'error'
          S.saveError.value ||= 'Saving did not finish. Your window is staying open.'
          showToast('Could not finish saving. Your window stays open; retry saving or export your board.', 7000)
        }
      }),
      window.api.win.onFlush(() => {
        void (async () => {
          await startup
          if (!S.ready.value) return window.api.win.flushed(false)
          S.closing.value = true
          router.abortAll()
          board.commitText()
          const recordingOk = await replay.flush()
          if (saveBoardOnClose) autosave.markDirty()
          const ok = await autosave.flush()
          // The lesson's own file gets its last changes too (the app's store above already has them).
          await lesson.flush().catch(() => false)
          const settingsOk = await settings?.flush()
          window.api.win.flushed(ok && settingsOk === true && recordingOk)
        })().catch(() => { S.closing.value = false; window.api.win.flushed(false) })
      })
    ]

    return () => {
      active = false
      autosave.dispose()
      settings?.dispose()
      board.onChange = board.onViewChange = board.onEdit = board.onPageChange = null
      replay.dispose()
      S.retrySave.value = null
      unmount()
      router.detach()
      offKeys()
      offAgent()
      offs.forEach((f) => f())
      document.removeEventListener('pointerdown', onDocDown, true)
      stage.removeEventListener('dragover', onDragOver)
      stage.removeEventListener('drop', onDrop)
    }
  }, [])

  const [r, g, b] = hexToRgb(S.bgColor.value)
  const alpha = Math.max(0.004, S.bgAlpha.value / 100) // never fully 0 → stays hit-testable
  // pass-through hides the chrome too: nothing on the board is clickable in that mode
  const hidden = S.uiHidden.value || S.passthrough.value
  const onBoard = boardMode.value && S.layoutChosen.value
  const cls = ['window', onBoard ? `board bar-${S.barSide.value}` : '', S.fullscreen.value || S.zoomed.value ? 'flat' : '', darkUi.value ? 'dark' : '', hidden ? 'ui-hidden' : '', !S.ready.value ? 'loading' : '', S.replaying.value ? 'replaying' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div class={cls} style={{ '--bg': `rgba(${r},${g},${b},${alpha})` } as never}>
      <div class="stage" ref={stageRef}>
        <canvas ref={gridRef} class="cv grid-cv" aria-hidden="true" />
        <canvas ref={boardRef} class="cv" />
        <canvas ref={liveRef} class="cv" />
      </div>
      <ReplayCanvas />
      <SpotlightLayer />
      <CurtainLayer />

      {!hidden && (
        <>
          {onBoard ? <><BoardBar /><EdgeTabs /><BoardSaveChip /></> : <><TopBar /><Dock /><HistoryBar />{S.kind.value === 'canvas' && <ZoomBar />}<PageBar /></>}
          <Popovers />
          <AgentPanel agent={agentForPanel} />
          <ReplayPanel />
          <SelectionToolbar />
          <RevealBar />
          <ScienceUI />
        </>
      )}
      {hidden && !S.passthrough.value && <MiniBar />}
      {!S.passthrough.value && <><ReplayControls /><RecordingControls /></>}
      {!S.passthrough.value && <Editor />}
      {!S.passthrough.value && <TableCellEditor />}
      <Radial />
      <TimerWidget />
      <CalculatorWidget />
      <ImportStatus />
      <Toast />
      <PalmCalibration />
      {S.popover.value === 'lessons' && <LessonLibrary />}
      {S.popover.value === 'new-lesson' && <NewLessonSheet />}
      {S.popover.value === 'scale' && <ScaleEditor key={scaleTarget.value?.id ?? 'new'} />}
      {S.popover.value === 'export-preview' && <ExportPreview />}
      {S.popover.value === 'periodic' && <PeriodicSheet />}
      {S.popover.value === 'table' && <TableChooser />}
      {S.popover.value === 'inputs' && <InputsSheet />}
      {S.popover.value === 'shelf' && <ShelfSheet />}
      {S.popover.value === 'shelf-save' && <ShelfSaveSheet />}
      <Dialog />
      <SharePanel />
      <CapturePanel />
      {S.ready.value && !S.layoutChosen.value && <LayoutChooser />}
      {(!S.ready.value || S.closing.value) && <div class="loading-cover" role="status">
        <span>{S.closing.value ? 'Saving before closing…' : S.saveError.value ? 'Could not load your board' : 'Loading your board…'}</span>
        {!S.closing.value && S.saveError.value && <button type="button" onClick={() => { void S.retrySave.value?.() }}>Retry loading</button>}
      </div>}
      {!S.fullscreen.value && !S.zoomed.value && <ResizeHandles />}
    </div>
  )
}

// popovers anchored inside the dock live next to their buttons (see Panels.tsx)
export { PropsPopover, ShapesPopover }
