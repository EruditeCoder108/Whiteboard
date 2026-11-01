import { Check, FileDown, X } from './icons'
import type { JSX } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import { exportPdf } from '@/state/insert'
import { S } from '@/state/store'
import { Row, Segmented, Switch } from './kit'

const asPicture = (png: ArrayBuffer): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(new Error('Could not read the picture'))
  reader.readAsDataURL(new Blob([png], { type: 'image/png' }))
})

/**
 * The PDF as it will come out, sheet by sheet, before anything is saved. The pictures come from the
 * real export at a small size, so what is shown is what is printed. Tap a sheet to leave it out.
 */
export function ExportPreview(): JSX.Element {
  const [whole, setWhole] = useState(false)
  const [print, setPrint] = useState(false)
  const [answers, setAnswers] = useState(false)
  const [sheets, setSheets] = useState<string[]>([])
  const [busy, setBusy] = useState(true)
  const [left, setLeft] = useState<Set<number>>(new Set())
  const { anyDark, anyHidden } = useMemo(() => ({ anyDark: board.hasDarkSheets(), anyHidden: board.pageData().some(pg => pg.items.some(it => it.step && !it.step.shown)) }), [])
  const options = { split: !whole, print, hidden: answers ? 'show' as const : 'keep' as const }

  useEffect(() => {
    let live = true
    setSheets([]); setLeft(new Set()); setBusy(true)
    const found: string[] = []
    void board.exportPages({
      ...options, scale: .34, cancelled: () => !live,
      onSheet: async png => {
        const url = await asPicture(png)
        if (!live) return
        found.push(url)
        setSheets([...found])
      }
    }).finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [whole, print, answers])

  const close = (): void => { S.popover.value = null }
  const toggle = (i: number): void => {
    const next = new Set(left)
    if (!next.delete(i)) next.add(i)
    setLeft(next)
  }
  const count = sheets.length - left.size
  return (
    <div class="library ui preview-sheet" role="dialog" aria-modal="true" aria-labelledby="preview-title" data-popover-keep="" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="library-card panel">
        <header class="library-head">
          <h1 id="preview-title">Save as PDF</h1>
          <span class="preview-count" role="status">{busy ? 'Preparing the sheets…' : `${count} ${count === 1 ? 'sheet' : 'sheets'}`}</span>
          <span class="grow" />
          <button type="button" class="dialog-btn primary nodrag" disabled={busy || !count} onClick={() => { close(); void exportPdf({ ...options, skip: left }) }}><FileDown size={18} /> Save PDF</button>
          <button type="button" class="library-close nodrag" aria-label="Close" onClick={close}><X size={24} /></button>
        </header>
        <div class="preview-options">
          <Segmented<'screens' | 'whole'> options={[{ value: 'screens', label: 'One screen per sheet' }, { value: 'whole', label: 'Long pages whole' }]} value={whole ? 'whole' : 'screens'} onChange={v => setWhole(v === 'whole')} />
          {anyDark && <Row label="Print-friendly: white paper, dark ink" hint="Saves toner; the lesson itself does not change"><span class="grow" /><Switch on={print} onChange={setPrint} /></Row>}
          {anyHidden && <Row label="Include hidden answers" hint="Off: only what the class has seen"><span class="grow" /><Switch on={answers} onChange={setAnswers} /></Row>}
        </div>
        <div class="library-body">
          {!busy && !sheets.length && <p class="library-empty">Nothing to save yet: the lesson is empty.</p>}
          <div class="preview-grid">
            {sheets.map((url, i) => (
              <button type="button" key={i} class={`preview-page nodrag ${left.has(i) ? 'out' : ''}`} aria-pressed={!left.has(i)} aria-label={`Sheet ${i + 1}: ${left.has(i) ? 'left out, tap to put back' : 'tap to leave out'}`} onClick={() => toggle(i)}>
                <img src={url} alt="" />
                <b>{i + 1}</b>
                {left.has(i) ? <em>Left out</em> : <i><Check size={15} /></i>}
              </button>
            ))}
          </div>
          <p class="pop-hint preview-hint">Tap a sheet to leave it out of the PDF.</p>
        </div>
      </div>
    </div>
  )
}
