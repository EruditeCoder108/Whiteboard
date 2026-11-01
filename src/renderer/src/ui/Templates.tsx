import type { JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { board } from '@/engine/instance'
import { placeInView } from '@/engine/shelf'
import { TEMPLATES, templateItems } from '@/engine/templates'
import type { TemplateId } from '@/engine/templates'
import { S, isDarkBg } from '@/state/store'

/** A template as it will look on this board, painted by the same code. */
function Sample({ id }: { id: TemplateId }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const dark = isDarkBg.value
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.round((cv.clientWidth || 200) * dpr); cv.height = Math.round((cv.clientHeight || 120) * dpr)
    board.paintItemsThumb(templateItems(id, dark), cv)
  }, [id, dark])
  return <canvas ref={ref} class="template-sample" aria-hidden="true" />
}

export function TemplatesSheet(): JSX.Element {
  const close = (): void => { S.popover.value = null }
  const place = (id: TemplateId): void => {
    close()
    board.insertSaved(placeInView(templateItems(id, isDarkBg.value), board.visibleRect(), .86))
  }
  return (
    <div class="chooser new-lesson ui" role="dialog" aria-modal="true" aria-labelledby="templates-title" data-popover-keep="" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="chooser-card panel new-lesson-card templates-card">
        <h1 id="templates-title">Templates</h1>
        <div class="template-grid">
          {TEMPLATES.map(t => (
            <button type="button" key={t.id} class="template-tile nodrag" onClick={() => place(t.id)}>
              <Sample id={t.id} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
        <div class="dialog-choices"><button type="button" class="dialog-btn nodrag" onClick={close}>Cancel</button></div>
      </div>
    </div>
  )
}
