import { Archive, Atom, Axis3d, MoveHorizontal, Table2, ArrowDownToLine, ChevronLeft, ChevronRight, Focus, FilePlus2, FileText, Image as ImageIcon, LineChart, Plus, Sigma, Trash2, FileDown } from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { compile, GRAPH_COLORS } from '@/engine/graph'
import { S, currentColor } from '@/state/store'
import { editEquation, editGraph, editScale, equationTarget, graphTarget, importing, insertFiles, loadTypesetter, pickFiles, svgDataUrl } from '@/state/insert'
import { Btn, MenuItem, Sep } from './kit'
import { capture } from '@/state/capture'

export function InsertPopover(): JSX.Element {
  const close = (fn: () => void) => () => { S.popover.value = null; fn() }
  return (
    <div class="popover panel ui menu insert-menu" data-popover-keep="">
      <MenuItem icon={ImageIcon} label="Picture…" hint="or paste / drop" onClick={close(() => void pickFiles('image/*').then(files => insertFiles(files)))} />
      <MenuItem icon={ImageIcon} label="Capture screen…" hint="Ctrl+Shift+C" onClick={() => { void capture.open() }} />
      <MenuItem icon={Archive} label="My shelf…" hint="your saved diagrams" onClick={() => { S.popover.value = 'shelf' }} />
      <MenuItem icon={FileText} label="PDF worksheet…" hint="one page each" onClick={close(() => void pickFiles('application/pdf,.pdf', false).then(files => insertFiles(files)))} />
      <MenuItem icon={Table2} label="Table" onClick={() => { S.popover.value = 'table' }} />
      <MenuItem icon={Sigma} label="Equation" hint="maths & chemistry" onClick={() => editEquation(null)} />
      <MenuItem icon={LineChart} label="Graph of a function" onClick={() => editGraph(null)} />
      <MenuItem icon={MoveHorizontal} label="Number line" onClick={() => editScale(null, 'line')} />
      <MenuItem icon={Axis3d} label="Coordinate axes" onClick={() => editScale(null, 'axes')} />
      <MenuItem icon={Atom} label="Periodic table" onClick={() => { S.popover.value = 'periodic' }} />
      <Sep />
      <MenuItem icon={FilePlus2} label="New page" hint="PgDn to move" onClick={close(() => board.addPage())} />
      <MenuItem icon={FileDown} label="Export picture or PDF…" onClick={() => { S.popover.value = 'export' }} />
    </div>
  )
}

export function PageBar(): JSX.Element | null {
  const page = S.page.value, count = S.pageCount.value
  if (S.kind.value === 'canvas') {
    const frame = S.frameIndex.value, frames = S.frameCount.value
    return (
      <div class="pagebar panel ui">
        {frames > 0 && <>
          <Btn icon={ChevronLeft} title="Previous frame  (PgUp)" disabled={frame === 0} onClick={() => board.turnFrame(-1)} />
          <span class="pageval" title="Frame">{frame < 0 ? '–' : frame + 1} / {frames}</span>
          <Btn icon={ChevronRight} title="Next frame  (PgDn)" disabled={frame >= frames - 1} onClick={() => board.turnFrame(1)} />
        </>}
        {frame >= 0
          ? <Btn icon={Trash2} title="Remove this frame (your drawing stays)" onClick={() => board.removeFramesHere()} />
          : <Btn icon={Focus} title="Add a frame around what's on screen (step through frames like slides)" onClick={() => board.addFrame('here')} />}
      </div>
    )
  }
  return (
    <div class="pagebar panel ui">
      <Btn icon={ChevronLeft} title="Previous page  (PgUp)" disabled={page === 0} onClick={() => board.turnPage(-1)} />
      <span class="pageval" title="Page">{page + 1} / {count}</span>
      <Btn icon={ChevronRight} title="Next page  (PgDn)" disabled={page >= count - 1} onClick={() => board.turnPage(1)} />
      <Btn icon={Plus} title="New page after this one" onClick={() => board.addPage()} />
      <Btn icon={ArrowDownToLine} title="More space below on this page" onClick={() => board.extendPage()} />
      {count > 1 && <Btn icon={Trash2} title="Delete this page (Undo brings it back)" onClick={() => board.deletePage()} />}
    </div>
  )
}

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
  const num = (key: keyof typeof range, label: string): JSX.Element =>
    <label class="range-field">{label}<input value={range[key]} inputMode="decimal" onInput={e => setRange({ ...range, [key]: (e.target as HTMLInputElement).value })} onKeyDown={e => e.stopPropagation()} /></label>
  return (
    <div class="popover panel ui graph-editor" data-popover-keep="">
      <div class="pop-title">{target ? 'Edit graph' : 'Graph of a function'}</div>
      {fns.map((f, i) => (
        <label class={`fn-row ${valid[i] ? '' : 'invalid'}`} key={i}>
          <span class="fn-dot" style={{ background: GRAPH_COLORS[i] }} />y =
          <input value={f} spellcheck={false} placeholder={i === 0 ? 'x^2 - 2x + 1' : 'another function (optional)'}
            onInput={e => { const next = [...fns]; next[i] = (e.target as HTMLInputElement).value; if (i === next.length - 1 && next[i].trim() && next.length < 5) next.push(''); setFns(next) }}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') apply(); if (e.key === 'Escape') S.popover.value = null }} />
        </label>
      ))}
      <div class="ranges">{num('x0', 'x from')}{num('x1', 'to')}{num('y0', 'y from')}{num('y1', 'to')}</div>
      <div class="pop-hint">Use x, + − × /, ^, sin cos tan sqrt log ln abs, pi and e. 2x and sinx work too.</div>
      <div class="row-end"><button type="button" class="primary-btn" disabled={!ok} onClick={apply}>{target ? 'Update' : 'Insert'}</button></div>
    </div>
  )
}
