import { AGENT_TOOLS, type AgentResult, type JsonObject } from '@shared/agent'
import type { Board } from './board'
import type { Item } from './types'
import { itemFromJson } from './serialize'
import { itemBounds, translateItem } from './items'
import { expandGroups } from './transforms'
import { S, showToast } from '@/state/store'
import type { replay } from '@/state/replay'

const styleKeys = ['color', 'fill', 'strokeWidth', 'opacity', 'fontSize', 'bold', 'italic', 'textColor', 'align', 'list', 'dash', 'radius', 'angle', 'text']
const aliases: Record<string, string> = { color: 'c', strokeWidth: 'w' }
const fail = (error: string, code = 'INVALID_ARGUMENT'): never => { throw Object.assign(new Error(error), { code }) }
const obj = (v: unknown): JsonObject => v && typeof v === 'object' && !Array.isArray(v) ? v as JsonObject : fail('Expected an object')
const str = (v: unknown, max = 128): string => typeof v === 'string' && v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v) ? v : fail('Invalid identifier or label')
const num = (v: unknown, fallback?: number): number => v === undefined && fallback !== undefined ? fallback : typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e8 ? v : fail('Expected a finite coordinate')
function only(o: JsonObject, keys: string[]): void { for (const k of Object.keys(o)) if (!keys.includes(k)) fail(`Unknown field: ${k}`) }
function summary(it: Item, textLimit = 2000): JsonObject {
  const bounds = itemBounds(it)
  const common = { id: it.id, kind: it.t === 's' ? 'ink' : it.t === 't' ? it.note ? 'note' : 'text' : it.k,
    bounds, color: it.c, strokeWidth: it.w, group: it.group ?? null, locked: !!it.locked, opacity: it.opacity ?? 1 }
  if (it.t === 's') return { ...common, points: it.p.length / 3 }
  return { ...common, x: it.p[0], y: it.p[1], width: it.p[2] - it.p[0], height: it.p[3] - it.p[1],
    text: (it.text ?? '').slice(0, textLimit), textTruncated: (it.text?.length ?? 0) > textLimit, fontSize: it.fontSize ?? 24,
    fill: it.fill ?? 'none', angle: it.angle ?? 0, bold: !!it.bold, italic: !!it.italic, align: it.align ?? 'left',
    textColor: it.textColor ?? it.c, list: it.list ?? 'none', ...(it.t === 'h' ? { dash: it.dash ?? 'solid', radius: it.radius ?? 0 } : {}) }
}

/** Pure staged edit: validates the complete batch before the live document is touched. */
export function stageBatch(before: Item[], raw: unknown, revision: number, fit: (it: Item) => Item = it => it): { items: Item[]; changed: string[]; batch: JsonObject } {
  const batch = obj(raw)
  only(batch, ['expectedRevision', 'requestId', 'label', 'operations', 'dryRun'])
  if (!Number.isSafeInteger(batch.expectedRevision) || batch.expectedRevision !== revision) fail('Board changed. Read the board and regenerate this edit.', 'REVISION_CONFLICT')
  str(batch.requestId); str(batch.label, 160)
  if (batch.dryRun !== undefined && typeof batch.dryRun !== 'boolean') fail('dryRun must be boolean')
  if (!Array.isArray(batch.operations) || batch.operations.length < 1 || batch.operations.length > 200) fail('Use 1–200 operations')
  let items = before.slice()
  const changed = new Set<string>()
  const validate = (rawItem: unknown): Item => itemFromJson(rawItem) ?? fail('Invalid object geometry or style')
  const selected = (rawIds: unknown, expand = false): Item[] => {
    if (!Array.isArray(rawIds) || !rawIds.length || rawIds.length > 500) return fail('Use 1–500 object IDs')
    const ids = rawIds.map(v => str(v))
    if (new Set(ids).size !== ids.length) fail('Duplicate object IDs')
    const found = ids.map(id => items.find(it => it.id === id) ?? fail(`Object not found: ${id}`, 'NOT_FOUND'))
    const result = expand ? expandGroups(items, found) : found
    if (result.some(it => it.locked)) fail('Unlock these objects in the board before editing them.', 'LOCKED')
    return result
  }
  const replace = (entries: Item[]): void => {
    const map = new Map(entries.map(it => [it.id, it]))
    items = items.map(it => map.get(it.id) ?? it)
    entries.forEach(it => changed.add(it.id))
  }
  const styled = (it: Item, op: JsonObject): Item => {
    const patch: JsonObject = {}
    for (const key of styleKeys) if (key in op) {
      if (it.t === 's' && !['color', 'strokeWidth', 'opacity'].includes(key)) fail(`Ink does not support ${key}`)
      if (it.t === 't' && ['dash', 'radius'].includes(key)) fail(`Text does not support ${key}`)
      patch[aliases[key] ?? key] = op[key]
    }
    return validate(fit(validate({ ...it, ...patch })))
  }
  for (const rawOp of batch.operations as unknown[]) {
    const op = obj(rawOp)
    if (op.op === 'create') {
      only(op, ['op', 'id', 'kind', 'x', 'y', 'width', 'height', ...styleKeys])
      const id = str(op.id)
      if (items.some(it => it.id === id)) fail(`ID already exists: ${id}`)
      const kinds = ['note', 'text', 'rect', 'ellipse', 'diamond', 'triangle', 'line', 'arrow']
      if (!kinds.includes(op.kind as string)) fail('Unsupported object kind')
      const x = num(op.x), y = num(op.y), width = num(op.width, op.kind === 'note' ? 220 : 240), height = num(op.height, op.kind === 'text' ? 60 : 160)
      const line = op.kind === 'line' || op.kind === 'arrow'
      if ((!line && (width < 1 || height < 1)) || Math.abs(width) > 100000 || Math.abs(height) > 100000) fail('Invalid object size')
      const text = op.kind === 'note' || op.kind === 'text'
      const base = { id, t: text ? 't' : 'h', k: op.kind, c: '#111827', w: 2, p: [x, y, x + width, y + height],
        ...(text ? { text: '', note: op.kind === 'note', fontSize: 24, fill: op.kind === 'note' ? '#fff1a8' : 'none' } : {}) }
      items.push(styled(validate(base), op)); changed.add(id)
    } else if (op.op === 'update') {
      only(op, ['op', 'ids', 'x', 'y', 'width', 'height', ...styleKeys])
      replace(selected(op.ids).map(it => {
        if (!['x', 'y', 'width', 'height'].some(key => key in op)) return styled(it, op)
        if (it.t === 's') return fail('Use move for ink; resizing ink is not supported by this command')
        const x = num(op.x, it.p[0]), y = num(op.y, it.p[1]), width = num(op.width, it.p[2] - it.p[0]), height = num(op.height, it.p[3] - it.p[1])
        const line = it.t === 'h' && (it.k === 'line' || it.k === 'arrow')
        if ((!line && (width < 1 || height < 1)) || Math.abs(width) > 100000 || Math.abs(height) > 100000) fail('Invalid object size')
        return styled({ ...it, p: [x, y, x + width, y + height] }, op)
      }))
    } else if (op.op === 'move') {
      only(op, ['op', 'ids', 'dx', 'dy']); const dx = num(op.dx), dy = num(op.dy)
      replace(selected(op.ids, true).map(it => validate(translateItem(it, dx, dy))))
    } else if (op.op === 'remove') {
      only(op, ['op', 'ids']); const ids = new Set(selected(op.ids, true).map(it => it.id))
      items = items.filter(it => !ids.has(it.id)); ids.forEach(id => changed.add(id))
    } else if (op.op === 'group' || op.op === 'ungroup') {
      only(op, ['op', 'ids']); const found = selected(op.ids, true)
      const group = op.op === 'group' ? `agent-${str(batch.requestId)}`.slice(0, 128) : undefined
      replace(found.map(it => ({ ...it, group })))
    } else if (op.op === 'arrange') {
      only(op, ['op', 'ids', 'layout', 'x', 'y', 'gap', 'columns'])
      if (!['row', 'column', 'grid'].includes(op.layout as string)) fail('Invalid layout')
      const found = selected(op.ids, true), order = (op.ids as string[]).map(id => items.find(it => it.id === id)!)
      const units: Item[][] = [], seen = new Set<string>()
      for (const it of order) {
        const key = it.group ? `group:${it.group}` : `item:${it.id}`
        if (seen.has(key)) continue
        seen.add(key); units.push(found.filter(other => it.group ? other.group === it.group : other.id === it.id))
      }
      const boxes = units.map(unit => unit.map(itemBounds).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]))
      const x = num(op.x, Math.min(...boxes.map(b => b[0]))), y = num(op.y, Math.min(...boxes.map(b => b[1]))), gap = num(op.gap, 32)
      const columns = num(op.columns, Math.ceil(Math.sqrt(units.length)))
      if (gap < 0 || gap > 10000 || !Number.isInteger(columns) || columns < 1 || columns > 100) fail('Invalid layout spacing')
      const cellW = Math.max(...boxes.map(b => b[2] - b[0])), cellH = Math.max(...boxes.map(b => b[3] - b[1]))
      let cx = x, cy = y
      const moved: Item[] = []
      units.forEach((unit, i) => {
        const b = boxes[i]
        if (op.layout === 'grid') { cx = x + (i % columns) * (cellW + gap); cy = y + Math.floor(i / columns) * (cellH + gap) }
        unit.forEach(it => moved.push(validate(translateItem(it, cx - b[0], cy - b[1]))))
        if (op.layout === 'row') cx += b[2] - b[0] + gap
        if (op.layout === 'column') cy += b[3] - b[1] + gap
      })
      replace(moved)
    } else fail('Unknown operation')
  }
  if (items.length > 100000) fail('Board object limit exceeded')
  return { items, changed: [...changed], batch }
}

export class BoardAgent {
  private applied = new Map<string, { fingerprint: string; result: AgentResult }>()
  constructor(private board: Board, private recordings?: typeof replay) {}
  call(name: string, raw: unknown): AgentResult {
    try {
      if (!S.ready.value || S.closing.value) return { ok: false, error: 'Board is not ready', code: 'NOT_READY' }
      if (name === 'whiteboard_replay') {
        const args = obj(raw), controls = this.recordings
        only(args, ['action', 'id', 'title', 'selectedOnly', 'speed', 'time'])
        if (!controls) fail('Recording controls are unavailable', 'NOT_READY')
        if (args.id !== undefined) str(args.id)
        if (args.title !== undefined) str(args.title, 160)
        if (args.selectedOnly !== undefined && typeof args.selectedOnly !== 'boolean') fail('selectedOnly must be boolean')
        if (args.speed !== undefined && ![0.25, 0.5, 1, 1.5, 2, 4].includes(num(args.speed))) fail('Unsupported playback speed')
        if (args.time !== undefined && (num(args.time) < 0 || num(args.time) > 28800000)) fail('Invalid playback time')
        switch (args.action) {
          case 'status': break
          case 'start': controls!.start(args.title as string | undefined, args.selectedOnly as boolean | undefined); break
          case 'pause_recording': controls!.pauseRecording(); break
          case 'resume_recording': controls!.resumeRecording(); break
          case 'stop': controls!.stop(); break
          case 'play':
            if (args.speed !== undefined) controls!.speed.value = args.speed as number
            controls!.play(args.id as string | undefined); break
          case 'pause': controls!.pause(); break
          case 'seek': if (args.time === undefined) fail('seek requires time in milliseconds'); controls!.seek(args.time as number); break
          case 'close': controls!.close(); break
          default: fail('Unknown recording action')
        }
        return { ok: true, recording: controls!.recording.value, pausedRecording: controls!.pausedRecording.value,
          activeRecordingId: controls!.recorder?.recording.id ?? null, playbackId: controls!.active.value?.id ?? null,
          playing: controls!.playing.value, position: controls!.position.value, speed: controls!.speed.value,
          saving: controls!.saving.value, saveError: controls!.error.value || null,
          recordings: controls!.library.value.map(row => ({ id: row.id, title: row.title, duration: row.duration, steps: row.steps.length })) }
      }
      if (S.replaying.value && name !== 'whiteboard_read') return { ok: false, error: 'Exit playback before editing the board.', code: 'BUSY' }
      if (S.gestureActive.value || S.editing.value || this.board.currentTool().underway()) return { ok: false, error: 'Finish the current edit before agent commands.', code: 'BUSY' }
      const args = obj(raw)
      if (name === 'whiteboard_read') {
        only(args, ['ids', 'query', 'offset', 'limit', 'textLimit'])
        if (args.query !== undefined && (typeof args.query !== 'string' || args.query.length > 1000)) fail('Invalid search query')
        if (args.ids !== undefined && (!Array.isArray(args.ids) || !args.ids.length || args.ids.length > 500)) fail('Invalid ID filter')
        const ids = args.ids ? new Set((args.ids as unknown[]).map(v => str(v))) : null
        const query = (args.query as string | undefined)?.toLocaleLowerCase()
        const all = this.board.doc.items.filter(it => (!ids || ids.has(it.id)) && (!query || (it.t !== 's' && it.text?.toLocaleLowerCase().includes(query))))
        const offset = num(args.offset, 0), limit = num(args.limit, 100)
        if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) fail('Invalid pagination')
        const requestedText = num(args.textLimit, 2000)
        if (!Number.isInteger(requestedText) || requestedText < 0 || requestedText > 100000) fail('Invalid textLimit')
        const textLimit = Math.min(requestedText, Math.floor(400000 / limit))
        return { ok: true, revision: this.board.doc.version, total: all.length, boardTotal: this.board.doc.items.length,
          view: { ...this.board.view }, viewport: { ...this.board.size }, selection: this.board.selection.map(it => it.id), playbackActive: S.replaying.value,
          objects: all.slice(offset, offset + limit).map(it => summary(it, textLimit)), nextOffset: offset + limit < all.length ? offset + limit : null }
      }
      if (name !== 'whiteboard_apply') fail('Unknown tool', 'NOT_FOUND')
      const requestId = str(args.requestId), fingerprint = JSON.stringify({ ...args, dryRun: undefined })
      const previous = this.applied.get(requestId)
      if (!args.dryRun && previous) {
        if (previous.fingerprint !== fingerprint) fail('Use a fresh requestId for different edits', 'REQUEST_CONFLICT')
        return previous.result.ok ? { ...previous.result, replayed: true } : previous.result
      }
      const staged = stageBatch(this.board.doc.items, args, this.board.doc.version, it => it.t === 's' ? it : this.board.fitItem(it))
      const preview = { ok: true as const, revision: this.board.doc.version, label: args.label, changed: staged.changed,
        objects: staged.items.filter(it => staged.changed.includes(it.id)).slice(0, 200).map(it => summary(it)),
        removed: staged.changed.filter(id => !staged.items.some(it => it.id === id)), dryRun: !!args.dryRun }
      if (args.dryRun) return preview
      const before = this.board.doc.snapshot()
      this.board.doc.replaceAll(staged.items)
      this.board.commit(this.board.doc.diff(before), args.label as string); this.board.refresh(null)
      this.board.setTool('select'); this.board.setSelection(staged.items.filter(it => staged.changed.includes(it.id)))
      const result: AgentResult = { ...preview, revision: this.board.doc.version }
      this.applied.set(requestId, { fingerprint, result })
      if (this.applied.size > 100) this.applied.delete(this.applied.keys().next().value!)
      showToast(`Agent: ${args.label}`)
      return result
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Command failed', code: (error as { code?: string }).code ?? 'INVALID_ARGUMENT' }
    }
  }
  get tools() { return AGENT_TOOLS }
}
