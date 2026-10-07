import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { board } from '@/engine/instance'
import { InputRouter } from '@/engine/input'
import { actions } from '@/state/actions'
import { installShortcuts } from '@/state/shortcuts'
import { S, applySettings, isDarkBg, showToast, startPersisting } from '@/state/store'
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

  useEffect(() => {
    const stage = stageRef.current!
    const unmount = board.mount(stage, boardRef.current!, liveRef.current!)
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
    const autosave = new Autosave(
      () => board.serialize(),
      (json) => window.api.store.saveBoard(json),
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
    board.onViewChange = () => { board.onChange?.(); replay.capture() }

    const load = async (): Promise<void> => {
      try {
        const rawSettings = await window.api.store.loadSettings()
        const saved = await window.api.store.loadBoard()
        if (!active) return
        applySettings(rawSettings)
        if (saved.json) board.load(saved.json, { undoable: false })
        saveBoardOnClose = saved.json !== null || !saved.message
        settings = startPersisting((d) => window.api.store.saveSettings(d))
        S.ready.value = true
        await replay.load()
        S.documentRevision.value = board.doc.version
        S.saveStatus.value = 'saved'
        S.saveError.value = ''
        window.api.win.setOnTop(S.onTop.value)
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
          const settingsOk = await settings?.flush()
          window.api.win.flushed(ok && settingsOk === true && recordingOk)
        })().catch(() => { S.closing.value = false; window.api.win.flushed(false) })
      })
    ]

    return () => {
      active = false
      autosave.dispose()
      settings?.dispose()
      board.onChange = board.onViewChange = board.onEdit = null
      replay.dispose()
      S.retrySave.value = null
      unmount()
      router.detach()
      offKeys()
      offAgent()
      offs.forEach((f) => f())
      document.removeEventListener('pointerdown', onDocDown, true)
    }
  }, [])

  const [r, g, b] = hexToRgb(S.bgColor.value)
  const alpha = Math.max(0.004, S.bgAlpha.value / 100) // never fully 0 → stays hit-testable
  // pass-through hides the chrome too: nothing on the board is clickable in that mode
  const hidden = S.uiHidden.value || S.passthrough.value
  const cls = ['window', S.fullscreen.value || S.zoomed.value ? 'flat' : '', isDarkBg.value ? 'dark' : '', hidden ? 'ui-hidden' : '', !S.ready.value ? 'loading' : '', S.replaying.value ? 'replaying' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div class={cls} style={{ '--bg': `rgba(${r},${g},${b},${alpha})` } as never}>
      <div class="stage" ref={stageRef}>
        <canvas ref={boardRef} class="cv" />
        <canvas ref={liveRef} class="cv" />
      </div>
      <ReplayCanvas />

      {!hidden && (
        <>
          <TopBar />
          <Dock />
          <HistoryBar />
          <ZoomBar />
          <Popovers />
          <AgentPanel agent={agentForPanel} />
          <ReplayPanel />
          <SelectionToolbar />
        </>
      )}
      {hidden && !S.passthrough.value && <MiniBar />}
      {!S.passthrough.value && <><ReplayControls /><RecordingControls /></>}
      {!S.passthrough.value && <Editor />}
      <Radial />
      <Toast />
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
