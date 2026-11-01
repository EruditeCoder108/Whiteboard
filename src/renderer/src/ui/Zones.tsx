import { Eraser, Pen, Undo2 } from './icons'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { ZONE_CHOICES } from '@/engine/classroom'
import { board } from '@/engine/instance'
import { S } from '@/state/store'

/** How the board is shared. "Together" keeps one board for everyone; each hand still writes on its own. */
export function ZonesSheet(): JSX.Element {
  const close = (): void => { S.popover.value = null }
  const start = (n: number): void => { close(); board.startZones(n) }
  return (
    <div class="chooser new-lesson ui" role="dialog" aria-modal="true" aria-labelledby="zones-title" data-popover-keep="" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="chooser-card panel new-lesson-card">
        <h1 id="zones-title">Students at the board</h1>
        <p class="inputs-hint">Each student gets a side of the board and their own colour. Several can write at the same time.</p>
        <div class="zone-choices">
          <button type="button" class="dialog-btn nodrag" onClick={() => start(1)}>Together</button>
          {ZONE_CHOICES.map(n => <button type="button" key={n} class="dialog-btn nodrag" onClick={() => start(n)}>{n} sides</button>)}
        </div>
        <div class="dialog-choices"><button type="button" class="dialog-btn nodrag" onClick={close}>Cancel</button></div>
      </div>
    </div>
  )
}

/** Each side's own tools at its own foot, so nobody reaches across a classmate. */
export function ZonesLayer(): JSX.Element | null {
  const count = S.zones.value
  const [confirm, setConfirm] = useState(false)
  if (!count) return null
  const inks = S.zoneInks.value, tools = S.zoneTools.value
  return (
    <div class="zones ui">
      {Array.from({ length: count }, (_, i) => (
        <div class={`zone ${i ? 'edge' : ''}`} key={i} style={{ '--zone': inks[i] } as never}>
          <div class="zone-bar panel" data-popover-keep="" role="toolbar" aria-label={`Side ${i + 1} tools`}>
            <button type="button" class={`zone-btn nodrag ${tools[i] === 'pen' ? 'on' : ''}`} aria-label={`Side ${i + 1} pen`} aria-pressed={tools[i] === 'pen'} onClick={() => board.setZoneTool(i, 'pen')}><Pen size={22} /></button>
            <button type="button" class={`zone-btn nodrag ${tools[i] === 'eraser' ? 'on' : ''}`} aria-label={`Side ${i + 1} eraser`} aria-pressed={tools[i] === 'eraser'} onClick={() => board.setZoneTool(i, 'eraser')}><Eraser size={22} /></button>
            <button type="button" class="zone-btn nodrag" aria-label={`Side ${i + 1} undo`} onClick={() => board.undoZone(i)}><Undo2 size={22} /></button>
            {count < 6 && <div class="zone-inks">
              {S.zoneChoices.value.slice(0, 4).map(c => <button type="button" key={c} class={`zone-ink nodrag ${inks[i] === c ? 'on' : ''}`} style={{ '--c': c } as never} aria-label={`Side ${i + 1} ink ${c}`} aria-pressed={inks[i] === c} onClick={() => board.setZoneInk(i, c)} />)}
            </div>}
          </div>
        </div>
      ))}
      <div class="zones-end panel" data-popover-keep="">
        {confirm
          ? <><span>Back to the teacher's tools?</span><button type="button" class="chip nodrag on" onClick={() => { setConfirm(false); board.endZones() }}>Yes</button><button type="button" class="chip nodrag" onClick={() => setConfirm(false)}>No</button></>
          : <button type="button" class="chip nodrag" onClick={() => setConfirm(true)}>Finish</button>}
      </div>
    </div>
  )
}
