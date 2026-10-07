import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { effect } from '@preact/signals'
import { Play, Pause, SkipBack, SkipForward, X, Circle, Square, Download, FolderOpen, RotateCcw } from 'lucide-preact'
import { replay, message, formatTime } from '@/state/replay'
import { S, showToast } from '@/state/store'
import { paintReplay, replayBounds } from '@/engine/replay-render'
import { Btn } from './kit'

const run = (action: () => unknown): void => {
  try { const result = action(); if (result instanceof Promise) void result.catch(error => showToast(message(error), 6000)) }
  catch (error) { showToast(message(error), 6000) }
}
function Speed(): JSX.Element {
  return <select aria-label="Playback speed" value={replay.speed.value} onChange={e => { replay.speed.value = Number(e.currentTarget.value) }}>
    {[0.25, 0.5, 1, 1.5, 2, 4].map(rate => <option key={rate} value={rate}>{rate}×</option>)}
  </select>
}
export function ReplayPanel(): JSX.Element | null {
  const [title, setTitle] = useState('My whiteboard lesson')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null)
  if (S.popover.value !== 'replay') return null
  const rows = replay.library.value, recording = rows.find(row => row.id === replay.selected.value)
  const busy = replay.recording.value || replay.videoProgress.value !== null
  return <section class="replay-panel panel ui" data-popover-keep="" aria-label="Record and replay" data-testid="replay-panel">
    <div class="replay-heading"><strong>Record & replay</strong><Btn icon={X} title="Close recording panel" onClick={() => { S.popover.value = null }} /></div>
    <p class="replay-hint">Capture how your diagram develops. Save its steps, play it again, or add it to any board.</p>
    {!replay.recording.value ? <div class="replay-section">
      <label>New recording name<input aria-label="New recording name" maxLength={160} value={title} onInput={e => setTitle(e.currentTarget.value)} /></label>
      <label class="replay-check"><input type="checkbox" checked={selectedOnly} disabled={!S.selectionCount.value} onChange={e => setSelectedOnly(e.currentTarget.checked)} />Selected diagram + new objects</label>
      <button type="button" class="replay-primary" disabled={busy} onClick={() => run(() => replay.start(title, selectedOnly))}><Circle size={14} /> Start recording</button>
    </div> : <p class="replay-hint">Recording is active. Use the pause and finish buttons at the bottom of the board.</p>}
    <div class="replay-section">
      <div class="replay-heading"><strong>Saved recordings</strong><button type="button" disabled={busy} onClick={() => run(() => replay.importFile())}><FolderOpen size={14} /> Open file</button></div>
      {!rows.length && <p class="replay-hint">Your recordings appear here automatically. Record before you start drawing to preserve the original timing.</p>}
      {!!rows.length && <label><span class="sr-only">Saved recording</span><select aria-label="Saved recording" disabled={busy} value={replay.selected.value ?? ''} onChange={e => { replay.selected.value = e.currentTarget.value; setDeleteArmed(null) }}>
        {rows.map(row => <option key={row.id} value={row.id}>{row.title} · {formatTime(row.duration)}</option>)}
      </select></label>}
      {recording && <>
        <label>Lesson name<input key={recording.id} aria-label="Lesson name" maxLength={160} defaultValue={recording.title} disabled={busy} onBlur={e => replay.rename(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} /></label>
        <p class="replay-hint">{recording.steps.length} steps · {formatTime(recording.duration)} · {replay.saving.value ? 'Saving…' : replay.error.value ? 'Save needs attention' : 'Saved locally'}</p>
        <div class="replay-options"><Speed /><label class="replay-check"><input type="checkbox" checked={replay.followCamera.value} onChange={e => { replay.followCamera.value = e.currentTarget.checked }} />Follow recorded view</label></div>
        <div class="replay-buttons">
          <button type="button" class="replay-primary" disabled={busy} onClick={() => run(() => replay.play())}><Play size={14} />Play lesson</button>
          <button type="button" disabled={busy} onClick={() => run(() => replay.insert())}>Add finished diagram</button>
          <button type="button" disabled={busy} onClick={() => run(() => replay.exportSteps())}><Download size={14} />Save steps</button>
          <button type="button" disabled={busy} onClick={() => run(() => replay.exportVideo())}>Export video</button>
        </div>
        <p class="replay-hint">Steps stay editable in a .wbrp file. Video is a silent WebM, exported at the selected speed.</p>
        <button type="button" class="replay-delete" disabled={busy} onClick={() => {
          if (deleteArmed === recording.id) { replay.remove(); setDeleteArmed(null) }
          else setDeleteArmed(recording.id)
        }}>{deleteArmed === recording.id ? 'Click again to remove from library' : 'Remove from library'}</button>
      </>}
    </div>
    {replay.error.value && <div class="replay-error" role="alert">{replay.error.value}<button type="button" onClick={() => run(() => replay.persist())}>Retry saving</button></div>}
    {replay.videoProgress.value !== null && <div class="replay-section" role="status"><progress max={1} value={replay.videoProgress.value} /> Exporting video {Math.round(replay.videoProgress.value * 100)}%<button type="button" onClick={() => replay.videoAbort?.abort()}>Cancel export</button></div>}
  </section>
}

export function RecordingControls(): JSX.Element | null {
  if (!replay.recording.value) return null
  const paused = replay.pausedRecording.value
  return <div class="recording-controls panel ui" data-popover-keep="" role="region" aria-label="Recording controls">
    <span class={`recording-dot ${paused ? 'paused' : ''}`} /><strong>{paused ? 'Paused' : 'Recording'}</strong><span>{formatTime(replay.elapsed.value)}</span><small>{replay.stepCount.value} steps</small>
    <Btn icon={paused ? Play : Pause} title={paused ? 'Resume recording' : 'Pause recording'} onClick={() => run(() => paused ? replay.resumeRecording() : replay.pauseRecording())} />
    <button type="button" class="recording-finish" onClick={() => run(() => replay.stop())}><Square size={13} /> Finish</button>
    {replay.error.value && <span class="replay-error" title={replay.error.value}>Save error</span>}
  </div>
}

export function ReplayControls(): JSX.Element | null {
  const recording = replay.active.value
  if (!recording) return null
  return <div class="playback-controls panel ui" data-popover-keep="" aria-label="Playback controls" data-testid="playback-controls">
    <div class="playback-caption"><strong>{recording.title}</strong><span>{replay.timeline?.frame(replay.position.value).index ?? 0} / {recording.steps.length} steps</span><Btn icon={X} title="Exit playback (Esc)" onClick={() => { replay.close(); S.popover.value = 'replay' }} /></div>
    <input type="range" class="playback-scrubber" aria-label="Playback position" min={0} max={Math.max(1, recording.duration)} step={10} value={replay.position.value} onInput={e => replay.seek(Number(e.currentTarget.value))} />
    <div class="playback-buttons">
      <Btn icon={RotateCcw} title="Restart playback" onClick={() => { replay.seek(0); replay.play() }} />
      <Btn icon={SkipBack} title="Previous step (Left arrow)" onClick={() => replay.step(-1)} />
      <Btn icon={replay.playing.value ? Pause : Play} title={replay.playing.value ? 'Pause playback (Space)' : 'Play playback (Space)'} onClick={() => run(() => replay.playing.value ? replay.pause() : replay.play())} />
      <Btn icon={SkipForward} title="Next step (Right arrow)" onClick={() => replay.step(1)} />
      <span class="playback-time">{formatTime(replay.position.value)} / {formatTime(recording.duration)}</span><Speed />
      <button type="button" class="playback-keep" onClick={() => run(() => replay.insert(recording.id, replay.position.value))}>Keep this frame</button>
    </div>
  </div>
}

export function ReplayCanvas(): JSX.Element | null {
  const ref = useRef<HTMLCanvasElement>(null)
  const active = !!replay.active.value
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !active) return
    const bounds = replay.timeline ? replayBounds(replay.timeline.recording) : null
    const draw = (): void => {
      const timeline = replay.timeline
      if (!timeline) return
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr)), height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      paintReplay(canvas.getContext('2d')!, timeline, replay.position.value, canvas.width, canvas.height, bounds, replay.followCamera.value, 95 * dpr)
    }
    const stop = effect(() => { replay.position.value; replay.followCamera.value; draw() })
    const observer = new ResizeObserver(draw); observer.observe(canvas)
    return () => { stop(); observer.disconnect() }
  }, [replay.active.value?.id])
  return active ? <canvas class="replay-canvas" ref={ref} aria-label="Recorded whiteboard preview" /> : null
}
