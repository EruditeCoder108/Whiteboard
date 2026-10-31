import type { JSX } from 'preact'
import { Plus } from 'lucide-preact'
import type { Paper } from '@/engine/grid'
import { actions } from '@/state/actions'
import { BACKGROUNDS, S } from '@/state/store'
import { Swatch } from './kit'

const PAPER_NAMES: [Paper, string][] = [
  ['none', 'Plain'], ['ruled', 'Ruled'], ['fourline', 'Four-line'], ['hindi', 'Hindi lines'],
  ['lines', 'Squares'], ['graph', 'Graph paper'], ['dots', 'Dots'], ['music', 'Music']
]

/** Board colour and page paper. The paper belongs to the visible page; new pages take it too. */
export function PaperPicker(): JSX.Element {
  return (
    <>
      <div class="pop-sub">Board colour</div>
      <div class="swatches">
        {BACKGROUNDS.map((b) => (
          <Swatch key={b.color} color={b.color} title={b.name} selected={S.bgColor.value === b.color} onClick={() => actions.setBackground(b.color)} />
        ))}
        <label class="swatch custom nodrag" title="Custom background…">
          <Plus size={14} strokeWidth={2} />
          <input type="color" value={S.bgColor.value} onInput={(e) => actions.setBackground((e.target as HTMLInputElement).value)} />
        </label>
      </div>
      <div class="pop-sub">Page paper <i>(this page and new ones)</i></div>
      <div class="papers">
        {PAPER_NAMES.map(([paper, name]) => (
          <button type="button" key={paper} class={`paper-tile nodrag ${S.grid.value === paper ? 'on' : ''}`} aria-pressed={S.grid.value === paper} onClick={() => (S.grid.value = paper)}>
            <span class={`paper-prev p-${paper}`} style={{ background: S.bgColor.value }} />
            <span>{name}</span>
          </button>
        ))}
      </div>
    </>
  )
}

/** Board-mode sheet. */
export function PaperPopover(): JSX.Element {
  return <div class="popover panel ui paper-sheet" data-popover-keep=""><PaperPicker /></div>
}
