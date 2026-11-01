import type { Item, RevealStep } from './types'

/**
 * Prepared reveals: objects kept hidden during class until their step comes (question, hint, answer).
 * The step lives on each object, so copies, My shelf, saved files and notebook ⇄ canvas all carry it,
 * and showing a step is an ordinary edit that Undo takes back. Numbers order the steps; a name is what
 * the teacher reads on the Next button.
 */
export const MAX_STEP = 99
export const MAX_STEP_NAME = 40

export const validStep = (raw: unknown): RevealStep | null => {
  if (!raw || typeof raw !== 'object') return null
  const { n, name, shown, cover } = raw as Record<string, unknown>
  if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > MAX_STEP) return null
  return {
    n: n as number,
    ...(typeof name === 'string' && name.trim() ? { name: name.trim().slice(0, MAX_STEP_NAME) } : {}),
    ...(shown === true ? { shown: true } : {}),
    ...(cover === true ? { cover: true } : {})
  }
}

export interface StepInfo { n: number; name?: string; hidden: boolean }

/** Every step among these objects, in order; a step is hidden while any of its objects still is. */
export function stepsOf(items: Item[]): StepInfo[] {
  const steps = new Map<number, StepInfo>()
  for (const it of items) {
    if (!it.step) continue
    const known = steps.get(it.step.n)
    if (known) {
      known.hidden ||= !it.step.shown
      known.name ??= it.step.name
    } else steps.set(it.step.n, { n: it.step.n, ...(it.step.name ? { name: it.step.name } : {}), hidden: !it.step.shown })
  }
  return [...steps.values()].sort((a, b) => a.n - b.n)
}

export const stepLabel = (s: Pick<StepInfo, 'n' | 'name'>): string => s.name || `Step ${s.n}`

/** The objects with a step shown, or all of them hidden again; everything else stays the very same object. */
export function showStep(items: Item[], n: number): Item[] {
  return items.map(it => it.step?.n === n && !it.step.shown ? { ...it, step: { ...it.step, shown: true } } : it)
}

export function hideAgain(items: Item[]): Item[] {
  return items.map(it => {
    if (!it.step?.shown) return it
    const { shown: _shown, ...step } = it.step
    return { ...it, step }
  })
}

/** Which of these objects to hide, and in which step. A name given to a step is used by all its objects. */
export function assignStep(items: Item[], chosen: Set<Item>, n: number, name: string | undefined, cover: boolean): Item[] {
  const given = name?.trim().slice(0, MAX_STEP_NAME) || items.find(it => it.step?.n === n && it.step.name)?.step?.name
  return items.map(it => {
    if (chosen.has(it)) return { ...it, step: { n, ...(given ? { name: given } : {}), ...(cover ? { cover: true } : {}) } }
    if (it.step?.n === n && (it.step.name ?? undefined) !== given) {
      const { name: _old, ...step } = it.step
      return { ...it, step: { ...step, ...(given ? { name: given } : {}) } }
    }
    return it
  })
}

export function clearStep(items: Item[], chosen: Set<Item>): Item[] {
  return items.map(it => {
    if (!chosen.has(it) || !it.step) return it
    const { step: _step, ...rest } = it
    return rest as Item
  })
}
