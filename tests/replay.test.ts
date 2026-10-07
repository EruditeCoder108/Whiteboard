import { describe, expect, it } from 'vitest'
import { ReplayRecorder, ReplayTimeline, parseRecording, serializeRecording } from '@/engine/replay'
import type { Item, View } from '@/engine/types'
const view: View = { x: -80, y: -80, zoom: 1 }
const note = (id: string, text = id): Item => ({ t: 't', id, c: '#111827', w: 1, p: [0, 0, 200, 100], text, fontSize: 24, note: true, fill: '#fff1a8' })
function setup(initial: Item[] = [], selection: string[] | null = null) {
  let time = 0
  const recorder = new ReplayRecorder(initial, view, { w: 1000, h: 700 }, '#ffffff', 'Lesson', selection, () => time)
  return { recorder, time: (t: number) => { time = t } }
}
describe('editable lesson recordings', () => {
  it('replays creation, edits, deletion, undo and redo with exact layer order', () => {
    const { recorder, time } = setup(), a = note('a'), b = note('b'), edit = note('a', 'Changed')
    time(100); recorder.capture([a], view, 'Create')
    time(200); recorder.capture([a, b], view, 'Create second')
    time(300); recorder.capture([b, edit], view, 'Move layer and edit')
    time(400); recorder.capture([b], view, 'Delete')
    time(500); recorder.capture([b, edit], view, 'Undo')
    time(600); recorder.capture([b], view, 'Redo')
    const parsed = parseRecording(serializeRecording(recorder.snapshot()))!
    expect(parsed).not.toBeNull()
    const timeline = new ReplayTimeline(parsed)
    expect(timeline.frame(0).items).toHaveLength(0)
    expect(timeline.frame(350).items).toMatchObject([{ id: 'b' }, { id: 'a', text: 'Changed' }])
    expect(timeline.frame(550).items).toMatchObject([{ id: 'b' }, { id: 'a', text: 'Changed' }])
    expect(timeline.frame(600).items.map(it => it.id)).toEqual(['b'])
    expect(timeline.frame(150).items.map(it => it.id)).toEqual(['a'])
  })
  it('preserves pure layer changes even if object references are retained', () => {
    const a = note('a'), b = note('b'), { recorder, time } = setup([a, b])
    time(100); recorder.capture([b, a], view)
    expect(new ReplayTimeline(recorder.snapshot()).frame(100).items.map(it => it.id)).toEqual(['b', 'a'])
    expect(recorder.recording.initial).toEqual([a, b])
  })
  it('animates pen points at their captured times and supports seeking backwards', () => {
    const { recorder, time } = setup()
    const ink: Item = { t: 's', id: 'ink', c: '#4262ff', w: 3, m: false, v: true, p: [0, 0, .2, 10, 20, .5, 30, 40, .9] }
    time(1000); recorder.capture([ink], view, 'Draw', { duration: 800, times: [0, 400, 800] })
    const timeline = new ReplayTimeline(parseRecording(serializeRecording(recorder.snapshot()))!)
    expect(timeline.frame(100).items).toHaveLength(0)
    expect(timeline.frame(250).items[0].p).toEqual([0, 0, .2])
    expect(timeline.frame(700).items[0].p).toHaveLength(6)
    expect(timeline.frame(1000).items[0].p).toEqual(ink.p)
    expect(timeline.frame(250).items[0].p).toHaveLength(3)
    expect(ink.p).toHaveLength(9)
  })
  it('removes paused time and captures any unrecorded edits at the resume boundary', () => {
    const { recorder, time } = setup(), a = note('a')
    time(100); recorder.capture([a], view)
    time(200); recorder.pause()
    time(5000); recorder.capture([note('a', 'During pause')], view)
    expect(recorder.recording.steps).toHaveLength(1)
    recorder.resume([note('a', 'During pause')], view)
    expect(recorder.recording.steps[1].at).toBe(200)
    time(5300)
    expect(recorder.snapshot().duration).toBe(500)
  })
  it('selection recording ignores unrelated existing objects and includes new drawing', () => {
    const a = note('a'), b = note('b'), { recorder, time } = setup([a, b], ['a'])
    time(100); recorder.capture([a, note('b', 'Unrelated edit')], view)
    expect(recorder.recording.steps).toHaveLength(0)
    time(200); recorder.capture([note('a', 'Selected edit'), b, note('new')], view)
    const frame = new ReplayTimeline(recorder.snapshot()).frame(200)
    expect(frame.items.map(it => it.id)).toEqual(['a', 'new'])
  })
  it('records view changes without flooding the timeline with every animation frame', () => {
    const { recorder, time } = setup()
    for (let i = 1; i <= 20; i++) { time(i * 10); recorder.capture([], { ...view, x: i }) }
    expect(recorder.recording.steps).toHaveLength(1)
    expect(new ReplayTimeline(recorder.snapshot()).frame(200).view.x).toBe(20)
  })
  it('rejects damaged timelines, missing IDs, duplicate IDs and out-of-order operations atomically', () => {
    const { recorder, time } = setup([note('a')]); time(100); recorder.capture([note('a', 'Updated'), note('b')], view)
    const json = serializeRecording(recorder.snapshot())
    for (const damage of [
      (r: any) => { r.steps[0].at = -1 },
      (r: any) => { r.steps[0].removed = ['missing'] },
      (r: any) => { r.steps[0].added[1].it.id = 'a' },
      (r: any) => { r.steps[0].added[0].i = 40 },
      (r: any) => { delete r.initial[0].id },
      (r: any) => { r.steps[0].added[1].it.fontSize = -1 },
      (r: any) => { r.duration = 0 }
    ]) { const raw = JSON.parse(json); damage(raw); expect(parseRecording(JSON.stringify(raw))).toBeNull() }
  })
  it('retains groups, locks, text styles, rotation and pressure through file round trips', () => {
    const it = { ...note('a'), group: 'lesson', locked: true, bold: true, italic: true, angle: .4, opacity: .7 }
    const { recorder } = setup([it])
    expect(parseRecording(serializeRecording(recorder.snapshot()))!.initial[0]).toMatchObject(it)
  })
  it('clips timing safely when a preceding edit overlaps the stroke start', () => {
    const { recorder, time } = setup(), a = note('a')
    time(700); recorder.capture([a], view)
    time(1000); recorder.capture([a, { t: 's', id: 'ink', c: '#111827', w: 3, m: false, v: false, p: [0, 0, .5, 10, 10, .5] }], view, 'Stroke', { duration: 1000, times: [0, 1000] })
    expect(recorder.recording.steps[1].ink).toMatchObject({ start: 700, times: [0, 300] })
    expect(parseRecording(serializeRecording(recorder.snapshot()))).not.toBeNull()
  })
})
