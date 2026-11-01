import { signal } from '@preact/signals'
import { Delete, GripHorizontal, X } from './icons'
import type { JSX } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { calculate, showNumber } from '@/engine/calculator'
import { ELEMENTS, FAMILY_COLORS, FAMILY_NAMES, TABLE_H, TABLE_W, paintElement, paintTable } from '@/engine/elements'
import type { Element, Family } from '@/engine/elements'
import { board } from '@/engine/instance'
import { imageFromBlob } from '@/engine/media'
import { S } from '@/state/store'

export const calculatorOn = signal(false)

const KEYS: (string | { key: string; label: string; wide?: boolean })[] = [
  'sin(', 'cos(', 'tan(', '√(',
  '(', ')', '%', '÷',
  '7', '8', '9', '×',
  '4', '5', '6', '−',
  '1', '2', '3', '+',
  '0', '.', 'π', '^'
]
const label = (k: string): string => k.endsWith('(') && k.length > 1 ? (k === '√(' ? '√' : k.slice(0, -1)) : k

/** A large calculator that floats over the board: everyone can see the sum and its answer. */
export function CalculatorWidget(): JSX.Element | null {
  const [sum, setSum] = useState('')
  const [last, setLast] = useState<{ sum: string; answer: string } | null>(null)
  const [wrong, setWrong] = useState(false)
  const [at, setAt] = useState<[number, number] | null>(null)
  const grip = useRef<[number, number] | null>(null)
  if (!calculatorOn.value) return null
  const press = (k: string): void => { setWrong(false); setSum(sum + (k === 'π' ? 'pi' : k)) }
  const equals = (): void => {
    if (!sum.trim()) return
    const v = calculate(sum)
    if (v === null) return setWrong(true)
    setLast({ sum, answer: showNumber(v) })
    setSum(String(v))
  }
  const live = sum ? calculate(sum) : null
  const onGrip = (e: PointerEvent): void => {
    const box = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect()
    grip.current = [e.clientX - box.left, e.clientY - box.top]
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent): void => { if (grip.current) setAt([e.clientX - grip.current[0], e.clientY - grip.current[1]]) }
  return (
    <div class="calculator panel ui" data-popover-keep="" style={at ? { left: `${at[0]}px`, top: `${at[1]}px`, right: 'auto' } : undefined} role="group" aria-label="Calculator">
      <button type="button" class="calc-grip nodrag" aria-label="Move the calculator" onPointerDown={onGrip as never} onPointerMove={onMove as never} onPointerUp={() => (grip.current = null)} onPointerCancel={() => (grip.current = null)}><GripHorizontal size={20} /></button>
      <button type="button" class="calc-close nodrag" aria-label="Close the calculator" onClick={() => (calculatorOn.value = false)}><X size={20} /></button>
      <div class="calc-screen" aria-live="polite">
        <small>{last ? `${last.sum} =` : ' '}</small>
        <output class={wrong ? 'wrong' : ''}>{wrong ? 'Check the sum' : sum.replace(/pi/g, 'π') || (last?.answer ?? '0')}</output>
        <small class="calc-live">{live !== null && sum !== String(live) ? `= ${showNumber(live)}` : 'Angles in degrees'}</small>
      </div>
      <div class="calc-keys">
        {KEYS.map(k => { const key = typeof k === 'string' ? k : k.key; return <button type="button" key={key} class={`nodrag ${/^[\d.]$/.test(key) ? 'num' : 'op'}`} onClick={() => press(key)}>{label(key)}</button> })}
        <button type="button" class="nodrag op" onClick={() => { setSum(''); setLast(null); setWrong(false) }}>Clear</button>
        <button type="button" class="nodrag op" aria-label="Delete the last key" onClick={() => { setWrong(false); setSum(sum.replace(/(sin\(|cos\(|tan\(|√\(|pi|.)$/, '')) }}><Delete size={22} /></button>
        <button type="button" class="nodrag eq" onClick={equals}>=</button>
        <button type="button" class="nodrag op calc-board" disabled={!last} onClick={() => { if (last) board.insertWriting(`${last.sum.replace(/pi/g, 'π')} = ${last.answer}`) }}>Write it on the board</button>
      </div>
    </div>
  )
}

const FAMILIES = Object.keys(FAMILY_NAMES) as Family[]

async function putPicture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void, largest = Infinity): Promise<void> {
  const cv = document.createElement('canvas')
  const k = 2
  cv.width = width * k; cv.height = height * k
  const ctx = cv.getContext('2d')!
  ctx.scale(k, k)
  paint(ctx)
  const blob = await new Promise<Blob | null>(res => cv.toBlob(res, 'image/png'))
  if (!blob) return
  const { src, width: w, height: h } = await imageFromBlob(blob)
  const r = board.visibleRect()
  S.popover.value = null
  board.insertImage(src, w, h, { at: [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2 - (r[3] - r[1]) * .04], scale: Math.min(largest / w, (r[2] - r[0]) * .92 / w, (r[3] - r[1]) * .82 / h) })
}

/** The periodic table: tap an element for it large; put one, or the whole table, on the board. */
export function PeriodicSheet(): JSX.Element {
  const [chosen, setChosen] = useState<Element | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  const close = (): void => { S.popover.value = null }
  return (
    <div class="library ui periodic-sheet" role="dialog" aria-modal="true" aria-labelledby="periodic-title" data-popover-keep="" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="library-card panel periodic-card">
        <header class="library-head">
          <h1 id="periodic-title">Periodic table</h1>
          <span class="grow" />
          <button type="button" class="dialog-btn primary nodrag" onClick={() => { void putPicture(TABLE_W, TABLE_H, paintTable) }}>Put the whole table on the board</button>
          <button type="button" class="library-close nodrag" aria-label="Close" onClick={close}><X size={24} /></button>
        </header>
        <div class="periodic-body">
          <div class="periodic-grid">
            {chosen && (
              <div class="periodic-detail" style={{ background: FAMILY_COLORS[chosen.family] }}>
                <div class="periodic-big"><small>{chosen.z}</small><b>{chosen.symbol}</b></div>
                <div class="periodic-facts">
                  <h2>{chosen.name}</h2>
                  <p>{FAMILY_NAMES[chosen.family]}</p>
                  <p>Atomic mass {chosen.mass} · Period {chosen.period}{chosen.group ? ` · Group ${chosen.group}` : ''}</p>
                  <button type="button" class="nodrag" onClick={() => { void putPicture(360, 360, ctx => paintElement(ctx, chosen, 360), 300) }}>Put this element on the board</button>
                </div>
              </div>
            )}
            {!chosen && <p class="periodic-tip">Tap an element to see it large.</p>}
            {ELEMENTS.map(el => (
              <button type="button" key={el.z} class={`periodic-el nodrag ${family && family !== el.family ? 'faded' : ''} ${chosen === el ? 'on' : ''}`} aria-label={el.name} aria-pressed={chosen === el}
                style={{ gridColumn: el.col, gridRow: el.row >= 8 ? el.row + 1 : el.row, background: FAMILY_COLORS[el.family] }} onClick={() => setChosen(el)}>
                <small>{el.z}</small><b>{el.symbol}</b><span>{el.name}</span>
              </button>
            ))}
          </div>
          <div class="periodic-key">
            {FAMILIES.map(f => <button type="button" key={f} class={`chip nodrag ${family === f ? 'on' : ''}`} onClick={() => setFamily(family === f ? null : f)}><i style={{ background: FAMILY_COLORS[f] }} />{FAMILY_NAMES[f]}</button>)}
          </div>
        </div>
      </div>
    </div>
  )
}
