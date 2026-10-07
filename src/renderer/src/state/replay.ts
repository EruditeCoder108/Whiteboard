import { signal } from '@preact/signals'
import { board } from '@/engine/instance'
import { ReplayRecorder, ReplayTimeline, parseRecording, serializeRecording } from '@/engine/replay'
import type { InkTiming, Recording } from '@/engine/replay'
import { replayVideo } from '@/engine/replay-render'
import { translateItem } from '@/engine/items'
import { newId } from '@/engine/types'
import { S, showToast } from './store'

export const replay = {
  library: signal<Recording[]>([]),
  selected: signal<string | null>(null),
  recorder: null as ReplayRecorder | null,
  recording: signal(false),
  pausedRecording: signal(false),
  elapsed: signal(0),
  stepCount: signal(0),
  active: signal<Recording | null>(null),
  timeline: null as ReplayTimeline | null,
  playing: signal(false),
  position: signal(0),
  speed: signal(1),
  followCamera: signal(false),
  saving: signal(false),
  error: signal(''),
  videoProgress: signal<number | null>(null),
  videoAbort: null as AbortController | null,
  timer: 0,
  raf: 0,
  libraryBlocked: false,
  dirty: false,
  writeVersion: 0,
  writeQueue: Promise.resolve(true),

  async load(): Promise<void> {
    try {
      const loaded = await window.api.store.loadRecordings()
      if (loaded.error) { this.libraryBlocked = true; this.error.value = loaded.error }
      else if (loaded.json) {
        const rows: unknown[] = JSON.parse(loaded.json)
        const parsed = rows.map(row => parseRecording(JSON.stringify(row)))
        if (parsed.some(row => !row)) throw new Error('Recording library could not be read')
        this.library.value = parsed as Recording[]
        this.selected.value = this.library.value.at(-1)?.id ?? null
      }
    } catch (error) { this.libraryBlocked = true; this.error.value = message(error) }
    this.timer = window.setInterval(() => {
      if (!this.recorder) return
      this.elapsed.value = this.recorder.elapsed; this.stepCount.value = this.recorder.recording.steps.length
      if (this.elapsed.value >= 8 * 60 * 60 * 1000) this.stop()
      else void this.persist()
    }, 2000)
  },
  snapshot(): void {
    if (!this.recorder) return
    const current = this.recorder.snapshot()
    this.library.value = [...this.library.value.filter(row => row.id !== current.id), current]
    this.selected.value = current.id
    this.dirty = true
  },
  persist(): Promise<boolean> {
    this.snapshot()
    if (!this.dirty) return this.writeQueue
    if (this.libraryBlocked) return Promise.resolve(false)
    const version = ++this.writeVersion
    const json = `[${this.library.value.map(serializeRecording).join(',')}]`
    this.saving.value = true
    this.writeQueue = this.writeQueue.catch(() => false).then(async () => {
      try {
        const result = await window.api.store.saveRecordings(json)
        if (version === this.writeVersion) {
          this.saving.value = false
          this.error.value = result.ok ? '' : result.error
          if (result.ok) this.dirty = false
        }
        return result.ok
      } catch (error) { if (version === this.writeVersion) { this.error.value = message(error); this.saving.value = false }; return false }
    })
    return this.writeQueue
  },
  start(title = 'Whiteboard recording', selectedOnly = false): string {
    if (this.recorder) return this.recorder.recording.id
    if (!S.ready.value || S.closing.value || S.gestureActive.value || board.currentTool().underway()) throw new Error('Finish the current gesture before recording')
    if (this.library.value.length >= 100) throw new Error('The library holds 100 recordings. Export and remove one before recording again.')
    if (selectedOnly && !board.selection.length) throw new Error('Select the diagram you want to record first')
    this.close(); board.commitText()
    this.recorder = new ReplayRecorder(board.doc.items, board.view, board.size, S.bgColor.value, title, selectedOnly ? board.selection.map(it => it.id) : null)
    this.recording.value = true; this.pausedRecording.value = false; this.elapsed.value = 0; this.stepCount.value = 0
    S.popover.value = null
    void this.persist(); showToast('Recording your board · pause or finish below')
    return this.recorder.recording.id
  },
  capture(label = 'Pan / zoom', timing?: InkTiming): void {
    if (!this.recorder) return
    try { this.recorder.capture(board.doc.items, board.view, label, timing); this.stepCount.value = this.recorder.recording.steps.length; this.elapsed.value = this.recorder.elapsed }
    catch (error) { this.stop(false); showToast(message(error), 6000) }
  },
  pauseRecording(): void {
    board.commitText(); this.capture('Finish text')
    this.recorder?.pause(); this.pausedRecording.value = !!this.recorder
    void this.persist()
  },
  resumeRecording(): void {
    this.recorder?.resume(board.doc.items, board.view); this.pausedRecording.value = false
  },
  stop(captureFinal = true): Recording | null {
    if (!this.recorder) return null
    board.commitText(); if (captureFinal) this.capture('Finish recording')
    const result = this.recorder?.snapshot()
    if (!result) return null
    this.snapshot(); this.recorder = null; this.recording.value = false; this.pausedRecording.value = false
    void this.persist(); S.popover.value = 'replay'
    return result
  },
  get(id?: string | null): Recording {
    id ??= this.selected.value
    const recording = this.library.value.find(row => row.id === id)
    if (!recording) throw new Error('Choose a recording first')
    return recording
  },
  play(id?: string | null): void {
    id ??= this.selected.value
    if (this.recorder) throw new Error('Finish the recording before playing it')
    if (S.gestureActive.value || S.editing.value || board.currentTool().underway()) throw new Error('Finish the current edit before playback')
    const recording = this.get(id)
    if (this.active.value?.id !== recording.id) {
      this.close(); this.timeline = new ReplayTimeline(recording); this.active.value = recording; this.position.value = 0
    }
    if (this.position.value >= recording.duration) this.position.value = 0
    this.selected.value = recording.id; S.replaying.value = true; S.popover.value = null
    this.playing.value = true
    cancelAnimationFrame(this.raf)
    let last = performance.now()
    const tick = (now: number): void => {
      if (!this.playing.value || !this.active.value) return
      this.position.value = Math.min(recording.duration, this.position.value + (now - last) * this.speed.value)
      last = now
      if (this.position.value >= recording.duration) { this.playing.value = false; return }
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  },
  pause(): void { this.playing.value = false; cancelAnimationFrame(this.raf) },
  seek(time: number): void {
    if (!this.active.value || !Number.isFinite(time)) return
    this.pause(); this.position.value = Math.max(0, Math.min(time, this.active.value.duration))
  },
  step(direction: -1 | 1): void {
    if (!this.active.value) return
    const times = [0, ...this.active.value.steps.map(step => step.at), this.active.value.duration]
    const target = direction > 0 ? times.find(t => t > this.position.value + 0.5) : times.findLast(t => t < this.position.value - 0.5)
    this.seek(target ?? (direction > 0 ? this.active.value.duration : 0))
  },
  close(): void { this.pause(); this.active.value = null; this.timeline = null; S.replaying.value = false },
  insert(id?: string | null, time?: number): number {
    id ??= this.selected.value
    if (this.recorder) throw new Error('Finish recording before adding a saved diagram')
    if (S.gestureActive.value || S.editing.value || board.currentTool().underway()) throw new Error('Finish the current edit first')
    const recording = this.get(id), items = new ReplayTimeline(recording).frame(time ?? recording.duration).items
    if (!items.length) throw new Error('This frame contains no objects')
    if (board.doc.items.length + items.length > 100000) throw new Error('Board object limit exceeded')
    const bounds = board.doc.bounds(items)!, center = board.toWorld(board.size.w / 2, board.size.h / 2)
    const dx = center[0] - (bounds[0] + bounds[2]) / 2, dy = center[1] - (bounds[1] + bounds[3]) / 2, groups = new Map<string, string>()
    const added = items.map(it => {
      let group: string | undefined
      if (it.group) { if (!groups.has(it.group)) groups.set(it.group, newId()); group = groups.get(it.group) }
      return { ...translateItem(it, dx, dy), id: newId(), group, locked: false }
    })
    this.close()
    const before = board.doc.snapshot(); board.doc.replaceAll([...before, ...added]); board.commit(board.doc.diff(before), `Add recording: ${recording.title}`)
    board.setTool('select'); board.setSelection(added); board.refresh(null); board.fitSelection(); S.popover.value = null
    showToast('Editable diagram added · Ctrl+Z to undo')
    return added.length
  },
  async importFile(): Promise<void> {
    const file = await window.api.files.openRecording()
    if (!file) return
    this.importJson(file.json); await this.persist(); S.popover.value = 'replay'; showToast('Recording opened · ready to play')
  },
  importJson(json: string): string {
    if (this.recorder) throw new Error('Finish recording before opening another recording')
    const recording = parseRecording(json)
    if (!recording) throw new Error('Unsupported or damaged recording. Your board and library are unchanged.')
    if (this.library.value.length >= 100) throw new Error('Recording library is full')
    // Imported files always get a fresh library identity; existing lessons are preserved.
    recording.id = `replay-${globalThis.crypto.randomUUID()}`
    this.library.value = [...this.library.value, recording]; this.selected.value = recording.id; this.dirty = true
    return recording.id
  },
  rename(title: string): void {
    const id = this.selected.value
    if (!title.trim() || this.recorder) return
    this.library.value = this.library.value.map(row => row.id === id ? { ...row, title: title.trim().slice(0, 160) } : row)
    this.dirty = true; void this.persist()
  },
  remove(): void {
    if (this.recorder) return
    const id = this.selected.value
    if (this.active.value?.id === id) this.close()
    this.library.value = this.library.value.filter(row => row.id !== id); this.selected.value = this.library.value.at(-1)?.id ?? null
    this.dirty = true; void this.persist()
  },
  async exportSteps(): Promise<void> {
    const recording = this.get()
    const path = await window.api.files.saveRecording(serializeRecording(recording), `${safeName(recording.title)}.wbrp`)
    if (path) showToast('Reusable recording saved')
  },
  async exportVideo(): Promise<void> {
    if (this.videoAbort) return
    const recording = this.get(), abort = new AbortController()
    this.videoAbort = abort; this.videoProgress.value = 0
    try {
      const video = await replayVideo(recording, this.speed.value, this.followCamera.value, abort.signal, fraction => { this.videoProgress.value = fraction })
      if (abort.signal.aborted) return
      const path = await window.api.files.saveVideo(video, `${safeName(recording.title)}.webm`)
      if (!this.libraryBlocked) this.error.value = ''
      if (path) showToast('Playback video saved')
    } catch (error) { if (!abort.signal.aborted) { this.error.value = message(error); showToast(this.error.value, 6000) } }
    finally { this.videoAbort = null; this.videoProgress.value = null }
  },
  async flush(): Promise<boolean> {
    this.videoAbort?.abort()
    if (this.recorder) this.stop()
    return this.dirty ? this.persist() : this.writeQueue
  },
  dispose(): void { window.clearInterval(this.timer); this.close(); this.videoAbort?.abort() }
}
export const message = (error: unknown): string => error instanceof Error ? error.message : 'Recording action failed'
const safeName = (title: string): string => title.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) || 'whiteboard-recording'
export const formatTime = (ms: number): string => `${Math.floor(ms / 60000)}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`
