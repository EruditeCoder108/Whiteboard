import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { compile, GRAPH_COLORS, paintGraph } from '@/engine/graph'
import { S, currentColor } from '@/state/store'
import { equationTarget, graphTarget, importing, loadTypesetter, svgDataUrl } from '@/state/insert'

export function ImportStatus(): JSX.Element | null {
  return importing.value ? <div class="import-status panel ui" role="status">{importing.value}</div> : null
}

const SYMBOLS: [string, string][] = [
  ['a/b', '\\frac{a}{b}'], ['√', '\\sqrt{x}'], ['xⁿ', 'x^{2}'], ['xₙ', 'x_{1}'], ['±', '\\pm'], ['×', '\\times'], ['÷', '\\div'],
  ['≤', '\\le'], ['≥', '\\ge'], ['≠', '\\ne'], ['≈', '\\approx'], ['∞', '\\infty'], ['π', '\\pi'], ['θ', '\\theta'], ['α', '\\alpha'],
  ['β', '\\beta'], ['Δ', '\\Delta'], ['λ', '\\lambda'], ['μ', '\\mu'], ['Ω', '\\Omega'], ['°', '^{\\circ}'], ['∑', '\\sum_{i=1}^{n}'],
  ['∫', '\\int_{a}^{b}'], ['lim', '\\lim_{x\\to 0}'], ['vec', '\\vec{F}'], ['sin', '\\sin'], ['log', '\\log'], ['→', '\\rightarrow'],
  ['⇌', '\\rightleftharpoons'], ['H₂O', '\\ce{H2O}'], ['reaction', '\\ce{2H2 + O2 -> 2H2O}'], ['matrix', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}']
]

export function EquationEditor(): JSX.Element {
  const target = equationTarget.value
  const [latex, setLatex] = useState(target?.latex ?? '')
  const [preview, setPreview] = useState<{ src: string; width: number; height: number } | null>(null)
  const [error, setError] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { area.current?.focus() }, [])
  useEffect(() => {
    let live = true
    if (!latex.trim()) { setPreview(null); setError(''); return }
    void loadTypesetter().then(render => {
      if (!live) return
      try { const r = render(latex); setPreview({ src: svgDataUrl(r.svg), width: r.width, height: r.height }); setError('') }
      catch (e) { setPreview(null); setError(e instanceof Error ? e.message : 'Check the equation') }
    })
    return () => { live = false }
  }, [latex])
  const add = (snippet: string): void => {
    const el = area.current
    if (!el) return setLatex(latex + snippet)
    const a = el.selectionStart, b = el.selectionEnd
    setLatex(latex.slice(0, a) + snippet + latex.slice(b))
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + snippet.length })
  }
  const apply = (): void => {
    if (!preview) return
    if (target) board.replaceEquation(target, preview.src, latex, preview.width, preview.height)
    else board.insertImage(preview.src, preview.width, preview.height, { latex, color: currentColor.value })
    S.popover.value = null
  }
  return (
    <div class="popover panel ui equation-editor" data-popover-keep="">
      <div class="pop-title">{target ? 'Edit equation' : 'Insert equation'}</div>
      <div class="symbols">{SYMBOLS.map(([label, tex]) => <button type="button" key={label} title={tex} onClick={() => add(tex)}>{label}</button>)}</div>
      <textarea ref={area} value={latex} spellcheck={false} placeholder="e.g. v = u + at   ·   x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}   ·   \ce{CaCO3 -> CaO + CO2}"
        onInput={e => setLatex((e.target as HTMLTextAreaElement).value)}
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) apply(); if (e.key === 'Escape') S.popover.value = null }} />
      <div class="equation-preview">{preview ? <img src={preview.src} alt="Equation preview" /> : <span>{error || 'Type LaTeX above; the preview appears here.'}</span>}</div>
      <div class="row-end">
        <span class="pop-hint">Ctrl+Enter to {target ? 'update' : 'insert'} · \ce&#123;…&#125; for chemistry</span>
        <button type="button" class="primary-btn" disabled={!preview} onClick={apply}>{target ? 'Update' : 'Insert'}</button>
      </div>
    </div>
  )
}

const CURVES: [string, string][] = [['Line', '2x + 1'], ['Parabola', 'x^2 - 2'], ['Cubic', 'x^3 - 3x'], ['Sine', 'sin(x)'], ['Cosine', 'cos(x)'], ['1/x', '1/x'], ['Root', 'sqrt(x)'], ['Mod', 'abs(x)']]
/** What each key shows, and what it types. */
const GRAPH_KEYS: [string, string][] = [
  ['7', '7'], ['8', '8'], ['9', '9'], ['(', '('], [')', ')'], ['x', 'x'], ['sin', 'sin('],
  ['4', '4'], ['5', '5'], ['6', '6'], ['+', '+'], ['−', '-'], ['x²', '^2'], ['cos', 'cos('],
  ['1', '1'], ['2', '2'], ['3', '3'], ['×', '*'], ['÷', '/'], ['xⁿ', '^'], ['tan', 'tan('],
  ['0', '0'], ['.', '.'], ['π', 'pi'], ['√', 'sqrt('], ['|x|', 'abs('], ['log', 'log('], ['ln', 'ln(']
]

/** The curve as it will be on the board, before it is there. */
function GraphPreview({ fns, xr, yr }: { fns: string[]; xr: [number, number]; yr: [number, number] }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const key = `${fns.join('|')}/${xr.join()}/${yr.join()}`
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 320, h = cv.clientHeight || 220
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (xr[0] < xr[1] && yr[0] < yr[1]) paintGraph(ctx, { t: 'g', id: 'preview', c: '#000000', w: 1, p: [0, 0, w, h], fns, xr, yr })
  }, [key])
  return <canvas ref={ref} class="graph-preview" aria-label="Preview of the graph" role="img" />
}

export function GraphEditor(): JSX.Element {
  const target = graphTarget.value
  const [fns, setFns] = useState<string[]>(target ? [...target.fns] : ['sin(x)', ''])
  const [range, setRange] = useState({ x0: String(target?.xr[0] ?? -10), x1: String(target?.xr[1] ?? 10), y0: String(target?.yr[0] ?? -6), y1: String(target?.yr[1] ?? 6) })
  const valid = fns.map(f => !f.trim() || compile(f) !== null)
  const used = fns.map(f => f.trim()).filter(Boolean)
  const xr: [number, number] = [Number(range.x0), Number(range.x1)], yr: [number, number] = [Number(range.y0), Number(range.y1)]
  const rangesOk = [...xr, ...yr].every(Number.isFinite) && xr[0] < xr[1] && yr[0] < yr[1]
  const ok = used.length > 0 && valid.every(Boolean) && rangesOk
  const apply = (): void => {
    if (!ok) return
    if (target) board.updateGraph(target, { fns: used, xr, yr })
    else board.insertGraph(used, xr, yr)
    S.popover.value = null
  }
  const fields = useRef<(HTMLInputElement | null)[]>([])
  const [active, setActive] = useState(0)
  const edit = (i: number, text: string): void => {
    const next = [...fns]
    next[i] = text
    if (i === next.length - 1 && text.trim() && next.length < 5) next.push('')
    setFns(next)
  }
  /** Types where the caret is, so a board with no keyboard can write any function. */
  const press = (text: string | null): void => {
    const field = fields.current[active], now = fns[active] ?? ''
    const at = field?.selectionStart ?? now.length, end = field?.selectionEnd ?? at
    const from = text === null && at === end ? Math.max(0, at - 1) : at
    edit(active, now.slice(0, from) + (text ?? '') + now.slice(end))
    const caret = from + (text ?? '').length
    requestAnimationFrame(() => { const f = fields.current[active]; f?.focus(); f?.setSelectionRange(caret, caret) })
  }
  const zoom = (k: number): void => {
    const span = (a: string, b: string): [number, number] => {
      const lo = Number(a), hi = Number(b), mid = (lo + hi) / 2, half = (hi - lo) / 2 * k
      return [Number((mid - half).toFixed(4)), Number((mid + half).toFixed(4))]
    }
    const [x0, x1] = span(range.x0, range.x1), [y0, y1] = span(range.y0, range.y1)
    setRange({ x0: String(x0), x1: String(x1), y0: String(y0), y1: String(y1) })
  }
  const num = (key: keyof typeof range, label: string): JSX.Element =>
    <label class="range-field">{label}<input value={range[key]} inputMode="decimal" onInput={e => setRange({ ...range, [key]: (e.target as HTMLInputElement).value })} onKeyDown={e => e.stopPropagation()} /></label>
  return (
    <div class="popover panel ui graph-editor" data-popover-keep="">
      <div class="pop-title">{target ? 'Edit graph' : 'Graph of a function'}</div>
      <div class="graph-curves" role="group" aria-label="Common curves">
        {CURVES.map(([name, fn]) => <button type="button" class="chip nodrag" key={name} onClick={() => { edit(active, fn); setActive(active) }}>{name}</button>)}
      </div>
      <div class="graph-body">
      <div class="graph-entry">
      {fns.map((f, i) => (
        <label class={`fn-row ${valid[i] ? '' : 'invalid'} ${active === i ? 'on' : ''}`} key={i}>
          <span class="fn-dot" style={{ background: GRAPH_COLORS[i] }} />y =
          <input ref={el => { fields.current[i] = el }} onFocus={() => setActive(i)} value={f} spellcheck={false} placeholder={i === 0 ? 'x^2 - 2x + 1' : 'another function (optional)'}
            onInput={e => { const next = [...fns]; next[i] = (e.target as HTMLInputElement).value; if (i === next.length - 1 && next[i].trim() && next.length < 5) next.push(''); setFns(next) }}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') apply(); if (e.key === 'Escape') S.popover.value = null }} />
        </label>
      ))}
      <div class="graph-keys" role="group" aria-label="Function keys" onPointerDown={e => e.preventDefault()}>
        {GRAPH_KEYS.map(([show, types]) => <button type="button" class="graph-key nodrag" key={show} aria-label={`Type ${show}`} onClick={() => press(types)}>{show}</button>)}
        <button type="button" class="graph-key wide nodrag" aria-label="Delete a character" onClick={() => press(null)}>Delete</button>
      </div>
      </div>
      <div class="graph-side">
        <GraphPreview fns={used.filter(f => compile(f) !== null)} xr={xr} yr={yr} />
        <div class="graph-zoom">
          <button type="button" class="chip nodrag" onClick={() => zoom(.5)}>Zoom in</button>
          <button type="button" class="chip nodrag" onClick={() => zoom(2)}>Zoom out</button>
          <button type="button" class="chip nodrag" onClick={() => setRange({ x0: '-10', x1: '10', y0: '-6', y1: '6' })}>Reset</button>
        </div>
        <div class="ranges">{num('x0', 'x from')}{num('x1', 'to')}{num('y0', 'y from')}{num('y1', 'to')}</div>
      </div>
      </div>
      <div class="row-end"><span class="pop-hint">2x and sinx work too.</span><button type="button" class="primary-btn" disabled={!ok} onClick={apply}>{target ? 'Update' : 'Put on the board'}</button></div>
    </div>
  )
}
