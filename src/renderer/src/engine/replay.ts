import { itemFromJson, itemToJson } from './serialize'
import type { Item, View } from './types'

export const REPLAY_FORMAT = 'floating-whiteboard-replay'
export const MAX_REPLAY_CHARS = 50 * 1024 * 1024
export const MAX_REPLAY_STEPS = 10000
const MAX_ENTRIES = 100000
const MAX_DURATION = 8 * 60 * 60 * 1000
export interface InkTiming { duration: number; times: number[] }
export interface ReplayStep {
  at: number
  label: string
  removed: string[]
  added: { i: number; it: Item }[]
  view: View
  ink?: { id: string; start: number; times: number[] }
}
export interface Recording {
  format: typeof REPLAY_FORMAT
  version: 1
  id: string
  title: string
  createdAt: string
  duration: number
  background: string
  viewport: { w: number; h: number }
  initial: Item[]
  view: View
  steps: ReplayStep[]
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const identifier = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && !/[\u0000-\u001f\u007f]/.test(v)
const validView = (v: View): boolean => !!v && finite(v.x) && finite(v.y) && Math.abs(v.x) <= 1e9 && Math.abs(v.y) <= 1e9 && finite(v.zoom) && v.zoom >= 0.05 && v.zoom <= 100

export function applyReplayStep(items: Item[], step: ReplayStep): Item[] {
  const removed = new Set(step.removed)
  const next = items.filter(it => !removed.has(it.id))
  for (const entry of step.added) next.splice(entry.i, 0, entry.it)
  return next
}

export function serializeRecording(recording: Recording): string {
  return JSON.stringify({ ...recording, initial: recording.initial.map(itemToJson),
    steps: recording.steps.map(step => ({ ...step, added: step.added.map(e => ({ i: e.i, it: itemToJson(e.it) })) })) })
}

/** A replay is all-or-nothing: damaged steps must never silently change its meaning. */
export function parseRecording(json: string): Recording | null {
  try {
    if (typeof json !== 'string' || json.length > MAX_REPLAY_CHARS) return null
    const raw = JSON.parse(json) as Recording
    if (!raw || raw.format !== REPLAY_FORMAT || raw.version !== 1 || !identifier(raw.id) || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 160 ||
        typeof raw.createdAt !== 'string' || !Number.isFinite(Date.parse(raw.createdAt)) || !finite(raw.duration) || raw.duration < 0 || raw.duration > MAX_DURATION ||
        !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(raw.background) || !validView(raw.view) || !raw.viewport || !finite(raw.viewport.w) || !finite(raw.viewport.h) ||
        raw.viewport.w < 1 || raw.viewport.h < 1 || raw.viewport.w > 32000 || raw.viewport.h > 32000 || !Array.isArray(raw.initial) || raw.initial.length > MAX_ENTRIES ||
        !Array.isArray(raw.steps) || raw.steps.length > MAX_REPLAY_STEPS) return null
    const parseItem = (it: Item): Item => {
      if (!identifier(it?.id)) throw new Error('Missing item ID')
      const parsed = itemFromJson(it)
      if (!parsed) throw new Error('Invalid item')
      return parsed
    }
    const initial = raw.initial.map(parseItem)
    let ids = new Set(initial.map(it => it.id)), entries = initial.length, previousAt = 0
    if (ids.size !== initial.length) return null
    const steps = raw.steps.map(step => {
      if (!step || !finite(step.at) || step.at < previousAt || step.at > raw.duration || typeof step.label !== 'string' || step.label.length > 160 ||
          !validView(step.view) || !Array.isArray(step.removed) || !Array.isArray(step.added) || step.removed.length > MAX_ENTRIES || step.added.length > MAX_ENTRIES) throw new Error('Invalid step')
      if (new Set(step.removed).size !== step.removed.length || step.removed.some(id => !identifier(id) || !ids.has(id))) throw new Error('Invalid removal')
      step.removed.forEach(id => ids.delete(id))
      let lastIndex = -1
      const added = step.added.map(e => {
        if (!e || !Number.isInteger(e.i) || e.i < 0 || e.i <= lastIndex || e.i > ids.size) throw new Error('Invalid insertion order')
        const it = parseItem(e.it)
        if (ids.has(it.id)) throw new Error('Duplicate item')
        ids.add(it.id); lastIndex = e.i
        return { i: e.i, it }
      })
      entries += added.length
      if (entries > MAX_ENTRIES || ids.size > MAX_ENTRIES) throw new Error('Recording object limit exceeded')
      let ink: ReplayStep['ink']
      if (step.ink) {
        const stroke = added.find(e => e.it.id === step.ink!.id)?.it
        const { start, times } = step.ink
        if (!stroke || stroke.t !== 's' || !finite(start) || start < previousAt || start > step.at || !Array.isArray(times) || times.length !== stroke.p.length / 3 ||
            times.some((t, i) => !finite(t) || t < 0 || t > step.at - start + 1 || (i > 0 && t < times[i - 1]))) throw new Error('Invalid stroke timing')
        ink = { id: stroke.id, start, times: [...times] }
      }
      previousAt = step.at
      return { at: step.at, label: step.label, removed: [...step.removed], added, view: { ...step.view }, ...(ink ? { ink } : {}) }
    })
    return { ...raw, initial, steps }
  } catch { return null }
}

/** Records immutable object differences, including undo/redo, without retaining full frames. */
export class ReplayRecorder {
  readonly recording: Recording
  private baseline: Set<string>
  private watched: Set<string> | null
  private previous: Item[]
  private started: number
  private pausedAt: number | null = null
  private pausedMs = 0
  private entries: number
  constructor(initial: Item[], view: View, viewport: { w: number; h: number }, background: string, title: string,
    selection: string[] | null = null, private clock: () => number = () => performance.now()) {
    this.baseline = new Set(initial.map(it => it.id))
    this.watched = selection ? new Set(selection) : null
    this.previous = this.filter(initial)
    this.entries = this.previous.length
    this.started = clock()
    this.recording = { format: REPLAY_FORMAT, version: 1, id: `replay-${globalThis.crypto.randomUUID()}`, title: title.trim().slice(0, 160) || 'Untitled recording',
      createdAt: new Date().toISOString(), duration: 0, background, viewport: { ...viewport }, initial: this.previous.slice(), view: { ...view }, steps: [] }
  }
  private filter(items: Item[]): Item[] { return this.watched ? items.filter(it => this.watched!.has(it.id) || !this.baseline.has(it.id)) : items.slice() }
  get paused(): boolean { return this.pausedAt !== null }
  get elapsed(): number { return Math.max(0, (this.pausedAt ?? this.clock()) - this.started - this.pausedMs) }
  pause(): void { if (!this.paused) this.pausedAt = this.clock() }
  resume(items: Item[], view: View): void {
    if (!this.paused) return
    this.pausedMs += this.clock() - this.pausedAt!; this.pausedAt = null
    // Catch up edits made while paused at one boundary; do not invent their timing.
    this.capture(items, view, 'Changes while recording was paused')
  }
  capture(items: Item[], view: View, label = 'Edit objects', timing?: InkTiming): void {
    if (this.paused) return
    const next = this.filter(items), after = new Set(next), before = new Set(this.previous)
    let removed = this.previous.filter(it => !after.has(it)).map(it => it.id)
    let added = next.flatMap((it, i) => before.has(it) ? [] : [{ i, it }])
    // Pure layer reordering can retain every object identity. Compare the
    // reconstructed order too, so playback cannot silently lose that change.
    const order = applyReplayStep(this.previous, { removed, added } as ReplayStep)
    if (order.some((it, i) => it !== next[i])) { removed = this.previous.map(it => it.id); added = next.map((it, i) => ({ i, it })) }
    const steps = this.recording.steps, prev = steps.at(-1), at = Math.round(this.elapsed)
    const oldView = prev?.view ?? this.recording.view
    const cameraChanged = view.x !== oldView.x || view.y !== oldView.y || view.zoom !== oldView.zoom
    if (!removed.length && !added.length && !cameraChanged) return
    if (steps.length >= MAX_REPLAY_STEPS || this.entries + added.length > MAX_ENTRIES || at > MAX_DURATION) throw new Error('Recording reached its limit. It has been stopped and saved.')
    const step: ReplayStep = { at, label: label.slice(0, 160), removed, added, view: { ...view } }
    if (timing && added.length === 1 && added[0].it.t === 's' && !removed.length) {
      const start = Math.max(prev?.at ?? 0, at - timing.duration)
      const scale = timing.duration > 0 ? (at - start) / timing.duration : 0
      step.ink = { id: added[0].it.id, start, times: timing.times.map(t => Math.round(t * scale)) }
    }
    if (!removed.length && !added.length && prev && !prev.removed.length && !prev.added.length && at - prev.at < 200) steps[steps.length - 1] = step
    else steps.push(step)
    this.entries += added.length; this.previous = next
  }
  snapshot(): Recording { return { ...this.recording, duration: Math.min(MAX_DURATION, Math.max(this.elapsed, this.recording.steps.at(-1)?.at ?? 0)), steps: this.recording.steps.slice() } }
}

/** Bounded checkpoints make scrubbing independent of how far back the user seeks. */
export class ReplayTimeline {
  private checkpoints: { index: number; items: Item[]; view: View }[] = []
  constructor(readonly recording: Recording) {
    let items = recording.initial.slice(), view = recording.view
    this.checkpoints.push({ index: 0, items, view })
    const interval = Math.max(1, Math.ceil(recording.steps.length / 32))
    recording.steps.forEach((step, i) => {
      items = applyReplayStep(items, step); view = step.view
      if ((i + 1) % interval === 0) this.checkpoints.push({ index: i + 1, items, view })
    })
  }
  frame(time: number): { items: Item[]; view: View; index: number } {
    const { steps } = this.recording
    const t = Math.max(0, Math.min(time, this.recording.duration))
    let lo = 0, hi = steps.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (steps[mid].at <= t) lo = mid + 1; else hi = mid }
    const index = lo
    const cached = this.checkpoints.findLast(c => c.index <= index)!
    let items = cached.items, view = cached.view
    for (let i = cached.index; i < index; i++) { items = applyReplayStep(items, steps[i]); view = steps[i].view }
    const next = steps[index]
    if (next?.ink && next.ink.start <= t) {
      const entry = next.added.find(e => e.it.id === next.ink!.id)!
      const stroke = entry.it
      if (stroke.t === 's') {
        const elapsed = t - next.ink.start
        let count = 0, end = next.ink.times.length
        while (count < end) { const mid = (count + end) >>> 1; if (next.ink.times[mid] <= elapsed) count = mid + 1; else end = mid }
        if (count) { items = items.slice(); items.splice(entry.i, 0, { ...stroke, p: stroke.p.slice(0, count * 3) }) }
        view = next.view
      }
    }
    return { items, view, index }
  }
}
