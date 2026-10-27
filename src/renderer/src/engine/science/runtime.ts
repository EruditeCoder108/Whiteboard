import { signal } from '@preact/signals'
import type { LabItem } from '../types'
import { getModel, labDuration } from './models'

export const supportedLab = (it: LabItem): boolean => it.labVersion === 1 && !!getModel(it.model) && it.modelVersion === 1
/** Transient clocks are tied to immutable object identity. Undo restores saved time.
 * Each seek is analytic; elapsed wall time is never integrated into a solver.
 */
export class LabRuntime {
  readonly revision = signal(0)
  private clocks = new Map<string, { item: LabItem; time: number; playing: boolean; speed: number; wall: number; origin: number }>()
  private clock(it: LabItem, now = performance.now()) {
    let c = this.clocks.get(it.id)
    if (c && c.item !== it && c.item.model === it.model && c.item.modelVersion === it.modelVersion && c.item.labVersion === it.labVersion && c.item.frozenTime === it.frozenTime && JSON.stringify(c.item.params) === JSON.stringify(it.params) && JSON.stringify(c.item.gesture) === JSON.stringify(it.gesture)) c.item = it
    if (!c || c.item !== it) {
      c = { item: it, time: it.frozenTime, playing: false, speed: 1, wall: now, origin: it.frozenTime }
      this.clocks.set(it.id, c)
    }
    return c
  }
  time(it: LabItem): number { return this.clock(it).time }
  playing(it: LabItem): boolean { return this.clock(it).playing }
  speed(it: LabItem): number { return this.clock(it).speed }
  seek(it: LabItem, t: number): void {
    if (!supportedLab(it)) return
    const c = this.clock(it)
    c.time = Math.max(0, Math.min(labDuration(it), Number.isFinite(t) ? t : 0)); c.playing = false
    this.revision.value++
  }
  play(it: LabItem, now = performance.now()): void {
    if (!supportedLab(it) || it.locked) return
    const c = this.clock(it, now), duration = labDuration(it)
    if (duration === 0) return
    if (c.time >= duration) c.time = 0
    c.wall = now; c.origin = c.time; c.playing = true; this.revision.value++
  }
  pause(it: LabItem, now = performance.now()): void {
    this.tick([it], now, false); this.clock(it).playing = false; this.revision.value++
  }
  setSpeed(it: LabItem, speed: number): void {
    const wasPlaying = this.playing(it); this.pause(it)
    this.clock(it).speed = [0.25, 0.5, 1, 2].includes(speed) ? speed : 1
    if (wasPlaying) this.play(it)
    this.revision.value++
  }
  tick(items: LabItem[], now = performance.now(), prune = true): LabItem[] {
    if (prune) {
      const ids = new Set(items.map(it => it.id))
      for (const id of this.clocks.keys()) if (!ids.has(id)) this.clocks.delete(id)
    }
    const changed: LabItem[] = []
    for (const it of items) {
      const c = this.clock(it, now)
      if (!c.playing) continue
      if (it.locked || !supportedLab(it)) { c.playing = false; continue }
      c.time = Math.min(labDuration(it), c.origin + Math.max(0, now - c.wall) / 1000 * c.speed)
      if (c.time >= labDuration(it)) c.playing = false
      changed.push(it)
    }
    if (changed.length) this.revision.value++
    return changed
  }
  clear(): void { this.clocks.clear(); this.revision.value++ }
}
