import { afterEach, describe, expect, it } from 'vitest'
import { hitCircle, setHiddenMode } from '../src/renderer/src/engine/items'
import { assignStep, clearStep, hideAgain, showStep, stepLabel, stepsOf, validStep } from '../src/renderer/src/engine/reveals'
import { itemFromJson, itemToJson } from '../src/renderer/src/engine/serialize'
import { freshCopies } from '../src/renderer/src/engine/shelf'
import type { Item, RevealStep, ShapeItem } from '../src/renderer/src/engine/types'

const box = (id: string, step?: RevealStep): ShapeItem => ({ t: 'h', id, c: '#111827', w: 2, k: 'rect', p: [0, 0, 100, 60], ...(step ? { step } : {}) })
afterEach(() => setHiddenMode('hide'))

describe('steps', () => {
  it('are listed in order, with a name from any of their objects', () => {
    const items = [box('c', { n: 2 }), box('a', { n: 1 }), box('b', { n: 2, name: 'Answer', shown: true }), box('plain')]
    expect(stepsOf(items)).toEqual([{ n: 1, hidden: true }, { n: 2, name: 'Answer', hidden: true }])
    expect(stepLabel({ n: 1 })).toBe('Step 1')
    expect(stepLabel({ n: 2, name: 'Answer' })).toBe('Answer')
  })

  it('showing one leaves everything else the very same object; hiding again brings them all back', () => {
    const a = box('a', { n: 1 }), b = box('b', { n: 2 }), plain = box('plain')
    const out = showStep([a, b, plain], 1)
    expect(out[0].step?.shown).toBe(true)
    expect(out[1]).toBe(b)
    expect(out[2]).toBe(plain)
    expect(stepsOf(out).map(s => s.hidden)).toEqual([false, true])
    const back = hideAgain(out)
    expect(back[0].step).toEqual({ n: 1 })
    expect(back[1]).toBe(b)
  })

  it('a name given to a step goes to all its objects; clearing takes an object out', () => {
    const a = box('a', { n: 1 }), b = box('b')
    const out = assignStep([a, b], new Set<Item>([b]), 1, 'Hint', true)
    expect(out[0].step).toEqual({ n: 1, name: 'Hint' })
    expect(out[1].step).toEqual({ n: 1, name: 'Hint', cover: true })
    expect(clearStep(out, new Set([out[1]]))[1]).not.toHaveProperty('step')
    const kept = assignStep(out, new Set([out[0]]), 1, undefined, false)
    expect(kept[0].step?.name).toBe('Hint')
  })
})

describe('hidden objects', () => {
  it('cannot be touched in class, but can while preparing', () => {
    const hidden = box('a', { n: 1 })
    expect(hitCircle(hidden, 50, 30, 60)).toBe(false)
    expect(hitCircle({ ...hidden, step: { n: 1, shown: true } }, 50, 30, 60)).toBe(true)
    setHiddenMode('ghost')
    expect(hitCircle(hidden, 50, 30, 60)).toBe(true)
  })
})

describe('in the lesson file', () => {
  it('step, name, shown and cover all survive; a bad step only loses the step', () => {
    const it0 = box('a', { n: 3, name: 'Answer', shown: true, cover: true })
    expect(itemFromJson(JSON.parse(JSON.stringify(itemToJson(it0))))).toMatchObject({ step: { n: 3, name: 'Answer', shown: true, cover: true } })
    const json = JSON.parse(JSON.stringify(itemToJson(box('b'))))
    const bad = itemFromJson({ ...json, step: { n: -1 } })
    expect(bad).not.toBeNull()
    expect(bad).not.toHaveProperty('step')
    expect(validStep({ n: 1.5 })).toBeNull()
    expect(validStep({ n: 1, name: '  ', shown: 'yes' })).toEqual({ n: 1 })
  })

  it('a copy from My shelf waits for its step too', () => {
    expect(freshCopies([box('a', { n: 2, name: 'Hint' })])[0].step).toEqual({ n: 2, name: 'Hint' })
  })
})
