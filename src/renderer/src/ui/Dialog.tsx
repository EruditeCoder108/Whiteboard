import type { JSX } from 'preact'
import { dialog } from '@/state/dialog'

/** The question from `ask()`: a title, a line of explanation and large buttons. */
export function Dialog(): JSX.Element | null {
  const d = dialog.value
  if (!d) return null
  return (
    <div class="chooser dialog ui" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-body">
      <div class="chooser-card dialog-card panel">
        <h1 id="dialog-title">{d.title}</h1>
        <p id="dialog-body">{d.body}</p>
        <div class="dialog-choices">
          {d.choices.map(c => (
            <button type="button" key={c.value} class={`dialog-btn nodrag ${c.kind ?? ''}`} onClick={() => d.resolve(c.value)}>{c.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
