import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { Plus } from 'lucide-preact'
import { sameColor } from '@/engine/colour'
import type { Paper } from '@/engine/grid'
import { actions } from '@/state/actions'
import { BACKGROUNDS, S } from '@/state/store'
import { Swatch } from './kit'

const PAPER_NAMES: [Paper, string][] = [
  ['none', 'Plain'], ['ruled', 'Ruled'], ['fourline', 'Four-line'], ['hindi', 'Hindi lines'],
  ['lines', 'Squares'], ['graph', 'Graph paper'], ['dots', 'Dots'], ['music', 'Music']
]

/**
 * Board colour and page paper. The colour is the whole lesson's unless "Only this page" is on; the
 * paper is this page's (this frame's, on a canvas) unless "All pages" is on. The choice also becomes
 * what new lessons start with.
 */
export function PaperPicker(): JSX.Element {
  const [onlyHere, setOnlyHere] = useState(false)
  const [everywhere, setEverywhere] = useState(false)
  const here = S.here.value
  const noun = here.unit === 'frame' ? 'frame' : 'page'
  const colour = (c: string): void => actions.setBackground(c, onlyHere && here.unit !== null)
  return (
    <>
      <div class="pop-sub">Board colour</div>
      <div class="swatches">
        {BACKGROUNDS.map((b) => (
          <Swatch key={b.color} color={b.color} title={b.name} selected={sameColor(here.color, b.color)} onClick={() => colour(b.color)} />
        ))}
        <label class="swatch custom nodrag" title="Custom background…">
          <Plus size={14} strokeWidth={2} />
          <input type="color" value={here.color} onChange={(e) => colour((e.target as HTMLInputElement).value)} />
        </label>
      </div>
      {here.unit && <button type="button" class={`chip nodrag ${onlyHere ? 'on' : ''}`} aria-pressed={onlyHere} onClick={() => setOnlyHere(!onlyHere)}>Only this {noun}</button>}
      <div class="pop-sub">Paper <i>({everywhere ? `every ${noun}` : here.unit ? `this ${noun}` : 'the canvas'}, and new lessons)</i></div>
      <div class="papers">
        {PAPER_NAMES.map(([paper, name]) => (
          <button type="button" key={paper} class={`paper-tile nodrag ${here.paper === paper ? 'on' : ''}`} aria-pressed={here.paper === paper} onClick={() => actions.setPaper(paper, everywhere)}>
            <span class={`paper-prev p-${paper}`} style={{ background: here.color }} />
            <span>{name}</span>
          </button>
        ))}
      </div>
      {here.unit && <button type="button" class={`chip nodrag ${everywhere ? 'on' : ''}`} aria-pressed={everywhere} onClick={() => setEverywhere(!everywhere)}>All {noun}s</button>}
    </>
  )
}

/** Board-mode sheet. */
export function PaperPopover(): JSX.Element {
  return <div class="popover panel ui paper-sheet" data-popover-keep=""><PaperPicker /></div>
}
