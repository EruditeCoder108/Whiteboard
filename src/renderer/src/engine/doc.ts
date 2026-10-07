import { itemBounds } from './items'
import { unionRect } from './geometry'
import type { Item, Rect } from './types'

/** One undoable step: items removed (with their old index) and items added (new index). */
export interface EditOp {
  removed: { i: number; it: Item }[]
  added: { i: number; it: Item }[]
}

export function opBounds(op: EditOp): Rect | null {
  let r: Rect | null = null
  for (const e of op.removed) r = unionRect(r, itemBounds(e.it))
  for (const e of op.added) r = unionRect(r, itemBounds(e.it))
  return r
}

/** Immutable style replacements preserve item IDs, order and unaffected objects. */
export function restyleItems(items: Item[], selection: Item[], style: { c?: string; w?: number }): { items: Item[]; selection: Item[]; changed: boolean } {
  const selected = new Set(selection)
  const replacements = new Map<Item, Item>()
  const next = items.map((it) => {
    if (!selected.has(it) || ((style.c === undefined || it.c === style.c) && (style.w === undefined || it.w === style.w))) return it
    const replacement = { ...it, ...style }
    replacements.set(it, replacement)
    return replacement
  })
  return { items: next, selection: selection.map((it) => replacements.get(it) ?? it), changed: replacements.size > 0 }
}

/**
 * The board contents.  Items are immutable, so *every* kind of edit (add,
 * erase, move, recolour…) is expressed as "remove these / add those", which
 * keeps undo/redo a single, simple mechanism.
 */
export class Doc {
  items: Item[] = []
  /** bumped on every change; lets observers cheaply detect "dirty" */
  version = 0

  snapshot(): Item[] {
    return this.items.slice()
  }

  replaceAll(items: Item[]): void {
    this.items = items
    this.version++
  }

  push(it: Item): EditOp {
    this.items.push(it)
    this.version++
    return { removed: [], added: [{ i: this.items.length - 1, it }] }
  }

  /** Compute the op that turns `before` into the current items (by identity). */
  diff(before: Item[]): EditOp | null {
    const after = new Set(this.items)
    const was = new Set(before)
    const removed: EditOp['removed'] = []
    const added: EditOp['added'] = []
    before.forEach((it, i) => {
      if (!after.has(it)) removed.push({ i, it })
    })
    this.items.forEach((it, i) => {
      if (!was.has(it)) added.push({ i, it })
    })
    return removed.length || added.length ? { removed, added } : null
  }

  undo(op: EditOp): void {
    const gone = new Set(op.added.map((e) => e.it))
    this.items = this.items.filter((it) => !gone.has(it))
    for (const e of op.removed) this.items.splice(Math.min(e.i, this.items.length), 0, e.it)
    this.version++
  }

  redo(op: EditOp): void {
    const gone = new Set(op.removed.map((e) => e.it))
    this.items = this.items.filter((it) => !gone.has(it))
    for (const e of op.added) this.items.splice(Math.min(e.i, this.items.length), 0, e.it)
    this.version++
  }

  bounds(items: Item[] = this.items): Rect | null {
    let r: Rect | null = null
    for (const it of items) r = unionRect(r, itemBounds(it))
    return r
  }
}

export class History {
  private undoStack: EditOp[] = []
  private redoStack: EditOp[] = []
  constructor(
    private doc: Doc,
    private limit = 500
  ) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  push(op: EditOp): void {
    this.undoStack.push(op)
    if (this.undoStack.length > this.limit) this.undoStack.shift()
    this.redoStack.length = 0
  }

  /** returns the op that was reverted (so callers can repaint just that region) */
  undo(): EditOp | null {
    const op = this.undoStack.pop()
    if (!op) return null
    this.doc.undo(op)
    this.redoStack.push(op)
    return op
  }

  redo(): EditOp | null {
    const op = this.redoStack.pop()
    if (!op) return null
    this.doc.redo(op)
    this.undoStack.push(op)
    return op
  }

  clear(): void {
    this.undoStack.length = 0
    this.redoStack.length = 0
  }
}
