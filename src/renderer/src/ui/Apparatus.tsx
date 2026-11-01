import { signal } from '@preact/signals'
import { X } from './icons'
import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { EXAMPLES } from '@/engine/apparatus/examples'
import { PARTS, partOf } from '@/engine/apparatus/parts'
import type { Live, Part, Setting, Subject } from '@/engine/apparatus/parts'
import { newPart, paintPart, world } from '@/engine/apparatus/world'
import { board } from '@/engine/instance'
import { placeInView } from '@/engine/shelf'
import type { ApparatusItem } from '@/engine/types'
import { S, isDarkBg } from '@/state/store'
import { Slider, Switch } from './kit'

export const trayOn = signal(false)
export const traySubject = signal<Subject>('physics')
export const openTray = (subject?: Subject): void => {
  if (subject) traySubject.value = subject
  trayOn.value = true
  S.popover.value = null
}

const TABS: [Subject, string][] = [['physics', 'Physics'], ['chemistry', 'Chemistry'], ['biology', 'Biology']]

/** A part as it will look, painted by the same code that paints it on the board. */
function PartPicture({ part }: { part: Part }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const dark = isDarkBg.value
  useEffect(() => {
    const cv = ref.current
    const c = cv?.getContext('2d')
    if (!cv || !c) return
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 96, h = cv.clientHeight || 72
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.clearRect(0, 0, w, h)
    const k = Math.min((w - 6) / part.w, (h - 6) / part.h)
    c.translate((w - part.w * k) / 2, (h - part.h * k) / 2)
    const it: ApparatusItem = { t: 'a', id: `sample-${part.kind}`, c: '#111827', w: 1, p: [0, 0, part.w * k, part.h * k], kind: part.kind, params: { ...part.params } }
    paintPart(c, it)
  }, [part, dark])
  return <canvas ref={ref} class="part-picture" aria-hidden="true" />
}

/** The cupboard: stays open beside the board while a circuit is built, so parts can be taken out one after another. */
export function ApparatusTray(): JSX.Element | null {
  const [placed, setPlaced] = useState(0)
  if (!trayOn.value) return null
  const subject = traySubject.value
  const parts = PARTS.filter(p => p.subject === subject)
  const groups = [...new Set(parts.map(p => p.group))]
  const take = (part: Part): void => {
    const r = board.visibleRect()
    // Each new part lands a little further along, so they do not hide one another.
    const step = placed % 8
    const k = Math.min(1, (r[3] - r[1]) * .62 / part.h)
    const x = r[0] + (r[2] - r[0]) * .3 + step * 48, y = r[1] + (r[3] - r[1]) * .36 + (step % 4) * 44
    board.insertSaved([newPart(part, x, y, k)])
    setPlaced(placed + 1)
  }
  const example = (build: () => import('@/engine/types').Item[]): void => {
    board.insertSaved(placeInView(build(), board.visibleRect(), .86))
    board.setSelection([])
    trayOn.value = false
  }
  const ready = EXAMPLES.filter(e => e.subject === subject)
  return (
    <aside class="apparatus-tray panel ui" data-popover-keep="" aria-label="Apparatus">
      <div class="tray-head">
        <b>Apparatus</b>
        <button type="button" class="class-tool-close nodrag" aria-label="Close apparatus" onClick={() => (trayOn.value = false)}><X size={20} /></button>
      </div>
      <div class="tray-tabs" role="tablist">
        {TABS.map(([key, name]) => <button type="button" role="tab" key={key} aria-selected={subject === key} class={`chip nodrag ${subject === key ? 'on' : ''}`} onClick={() => (traySubject.value = key)}>{name}</button>)}
      </div>
      <div class="tray-scroll">
        {ready.length > 0 && <>
          <div class="sheet-head">Ready to use</div>
          <div class="tray-examples">
            {ready.map(e => <button type="button" key={e.id} class="chip nodrag" onClick={() => example(e.build)}>{e.name}</button>)}
          </div>
        </>}
        {groups.map(group => (
          <div key={group}>
            <div class="sheet-head">{group}</div>
            <div class="part-grid">
              {parts.filter(p => p.group === group).map(p => (
                <button type="button" key={p.kind} class="part-tile nodrag" aria-label={`Take out ${p.name}`} onClick={() => take(p)}>
                  <PartPicture part={p} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {subject === 'physics' && <p class="pop-hint tray-hint">Drag from one terminal to another to join them with a wire.</p>}
    </aside>
  )
}

function SettingRow({ it, setting }: { it: ApparatusItem; setting: Setting }): JSX.Element {
  const q = it.params
  const change = (value: number): void => board.setPartValue(it, setting, value)
  if (setting.toggle) return <label class="picker-row"><Switch on={!!q[setting.key]} onChange={v => change(v ? 1 : 0)} /><span>{setting.label}</span></label>
  if (setting.choices) {
    const chosen = (i: number): boolean => {
      if (!setting.apply) return q[setting.key] === i
      const test = { ...q }
      setting.apply(i, test)
      return test[setting.key] === q[setting.key]
    }
    return <div class="part-setting"><div class="pop-sub">{setting.label}</div><div class="poll-sets">
      {setting.choices.map((name, i) => <button type="button" key={name} class={`chip nodrag ${chosen(i) ? 'on' : ''}`} aria-pressed={chosen(i)} onClick={() => change(i)}>{name}</button>)}
    </div></div>
  }
  return <RangeRow setting={setting} value={Math.abs(q[setting.key] ?? 0)} onChange={change} />
}

function RangeRow({ setting, value, onChange }: { setting: Setting; value: number; onChange: (v: number) => void }): JSX.Element {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return <div class="part-setting">
    <div class="pop-sub">{setting.label}: <b>{Number(draft.toFixed(2))}{setting.unit ? ` ${setting.unit}` : ''}</b></div>
    <Slider label={setting.label} min={setting.min ?? 0} max={setting.max ?? 100} step={setting.step ?? 1} value={draft} onChange={setDraft} onCommit={onChange} />
  </div>
}

/** What can be changed about a part, in plain words. */
export function PartOptions({ it }: { it: ApparatusItem }): JSX.Element {
  const part = partOf(it.kind)
  return <div class="part-options">
    <div class="pop-title">{part?.name}</div>
    {part?.settings?.map(s => <SettingRow key={s.key} it={it} setting={s} />)}
  </div>
}

export const partLive = (it: ApparatusItem): Live => world.readingOf(it)
