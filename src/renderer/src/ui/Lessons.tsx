import { Copy, FileDown, FilePlus2, FolderOpen, Image as ImageIcon, QrCode, Save, SaveAll } from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { board } from '@/engine/instance'
import type { PictureScope } from '@/engine/board'
import { actions } from '@/state/actions'
import { exportPdf } from '@/state/insert'
import { lesson, lessonDirty, lessonName, lessonPath, recentLessons } from '@/state/lesson'
import { S } from '@/state/store'
import { sharing } from '@/state/share'
import { Row, Section, Segmented, Switch, Tile } from './kit'

const when = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** New, open, save and the lessons used lately, in large tiles. */
export function LessonSheet(): JSX.Element {
  useEffect(() => { void lesson.refreshRecent() }, [])
  const close = (fn: () => unknown) => (): void => { S.popover.value = null; void fn() }
  const saved = lessonPath.value !== null && !lessonDirty.value
  const status = saved ? 'All changes are saved in the file'
    : lessonPath.value ? 'Has changes that are not in the file yet'
    : board.isEmpty ? 'A new, empty lesson' : 'Not saved as a file yet'
  return (
    <div class="popover panel ui board-sheet lesson-sheet" data-popover-keep="">
      <div class="lesson-head"><b>{lessonName.value}</b><span class={saved || board.isEmpty ? '' : 'warn'}>{status}</span></div>
      <Section title="Lesson">
        <Tile icon={FilePlus2} label="New lesson" onClick={close(lesson.newLesson)} />
        <Tile icon={FolderOpen} label="Open…" onClick={close(lesson.open)} />
        <Tile icon={Save} label="Save" onClick={close(lesson.save)} />
        <Tile icon={SaveAll} label="Save as…" onClick={close(lesson.saveAs)} />
      </Section>
      <div class="sheet-head">Recent lessons</div>
      {recentLessons.value.length
        ? <div class="recent-list">{recentLessons.value.map(r => (
          <button type="button" key={r.path} class="recent-row nodrag" title={r.path} onClick={close(() => lesson.openRecent(r.path))}>
            <b>{r.name}</b><small>{when(r.savedAt)}</small>
          </button>))}</div>
        : <p class="pop-hint">Lessons you save or open will be listed here.</p>}
    </div>
  )
}

/** Pictures and PDF of the lesson, with the choices that matter in plain words. */
export function ExportSheet(): JSX.Element {
  const notebook = S.kind.value === 'notebook'
  const [scope, setScope] = useState<PictureScope>(board.defaultScope)
  const [paper, setPaper] = useState(true)
  const [whole, setWhole] = useState(false)
  const selection = S.selectionCount.value > 0
  const pageLabel = notebook ? 'This page' : S.frameIndex.value >= 0 ? 'This frame' : 'On screen'
  const picture = { scope: scope === 'selection' && !selection ? 'page' as const : scope, paper }
  const close = (fn: () => unknown) => (): void => { S.popover.value = null; void fn() }
  return (
    <div class="popover panel ui board-sheet lesson-sheet export-sheet" data-popover-keep="">
      <div class="sheet-head">Picture (PNG)</div>
      <Segmented<PictureScope>
        options={[{ value: 'page', label: pageLabel }, { value: 'content', label: 'Everything' }, ...(selection ? [{ value: 'selection' as const, label: 'Selection' }] : [])]}
        value={picture.scope} onChange={setScope} />
      <Row label="With board colour and paper" hint="Off: ink only, on a see-through background"><span class="grow" /><Switch on={paper} onChange={setPaper} /></Row>
      <div class="tiles two">
        <Tile icon={ImageIcon} label="Save picture" onClick={close(() => actions.savePng(picture))} />
        <Tile icon={Copy} label="Copy picture" onClick={close(() => actions.copyImage(picture))} />
      </div>
      <div class="sheet-head">PDF of the whole lesson</div>
      <Segmented<'screens' | 'whole'>
        options={[{ value: 'screens', label: 'One screen per sheet' }, { value: 'whole', label: 'Long pages whole' }]}
        value={whole ? 'whole' : 'screens'} onChange={v => setWhole(v === 'whole')} />
      <p class="pop-hint">A page you lengthened with “more space below” is split by screen, so each sheet stays readable.</p>
      <div class="tiles two">
        <Tile icon={FileDown} label="Save PDF" onClick={close(() => exportPdf({ split: !whole }))} />
        <Tile icon={QrCode} label="Share to phones" onClick={close(sharing.open)} />
      </div>
    </div>
  )
}
