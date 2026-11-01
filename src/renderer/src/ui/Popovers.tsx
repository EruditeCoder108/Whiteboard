import { ArrowUpRight, Circle, FilePlus2, FolderOpen, Keyboard, Plus, Save, SaveAll, Share2, Slash, Square, Trash2, History, Diamond, Triangle, UnlockKeyhole, Clapperboard } from 'lucide-preact'
import type { JSX } from 'preact'
import { useEffect, useLayoutEffect, useState } from 'preact/hooks'
import type { BackupInfo } from '@shared/api'
import { board } from '@/engine/instance'
import { actions } from '@/state/actions'
import {
  PALETTE, S, SIZE_RANGE, SHAPE_TOOLS, activeTool, boardMode, currentColor, currentSize, styleKey
} from '@/state/store'
import type { ShapeKind } from '@/engine/types'
import { InsertPopover, EquationEditor, GraphEditor } from './Insert'
import { PresentPopover } from './Present'
import { equationTarget, graphTarget } from '@/state/insert'
import { ExportSheet } from './Lessons'
import { Btn, MenuItem, Row, Segmented, Sep, Slider, Swatch, Switch } from './kit'
import { calibrating } from './Calibrate'
import { PaperPicker } from './Paper'
import { InkPreview, PenStylePicker, SlideToClear, penLabel } from './PenStyles'

const TOOL_TITLE: Record<string, string> = {
  pen: 'Pen', marker: 'Highlighter', eraser: 'Eraser', line: 'Line', arrow: 'Arrow', rect: 'Rectangle', ellipse: 'Ellipse', diamond: 'Diamond', triangle: 'Triangle', text: 'Text', sticky: 'Sticky note'
}

function ColorPicker({ onPick, color = currentColor.value }: { onPick: (hex: string) => void; color?: string }): JSX.Element {
  const inputColor = color.length === 4 ? '#' + color.slice(1).split('').map((c) => c + c).join('') : color.length >= 7 ? color.slice(0, 7) : '#2f6bff'
  return (
    <label class="swatch custom nodrag" title="Custom colour…">
      <Plus size={14} strokeWidth={2} />
      <input type="color" aria-label="Custom colour" value={inputColor} onInput={(e) => onPick((e.target as HTMLInputElement).value)} />
    </label>
  )
}

export function PropsPopover(): JSX.Element {
  if (['select', 'lasso'].includes(S.tool.value) && S.selectionCount.value) return <SelectionPopover />
  const key = styleKey.value
  const [lo, hi] = SIZE_RANGE[key]
  const eraser = key === 'eraser'
  return (
    <div class="popover panel ui props" data-popover-keep="">
      <div class="pop-title">{activeTool.value === 'pen' ? penLabel(S.penStyle.value) : TOOL_TITLE[activeTool.value] ?? 'Brush'}</div>
      {activeTool.value === 'pen' && <PenStylePicker />}
      {!eraser && (
        <>
          <div class="swatches">
            {PALETTE.map((c) => (
              <Swatch key={c} color={c} selected={currentColor.value.toLowerCase() === c} onClick={() => actions.setColor(c)} />
            ))}
            <ColorPicker onPick={actions.setColor} />
          </div>
          <InkPreview />
        </>
      )}
      <Row label="Size">
        <Slider min={lo} max={hi} value={currentSize.value} onChange={actions.setSize} />
        <span class="val">{currentSize.value}</span>
      </Row>
      {eraser && (
        <>
          <div class="pop-sub">Eraser type  <i>(press E again to switch)</i></div>
          <Segmented
            options={[{ value: 'stroke', label: 'Stroke' }, { value: 'pixel', label: 'Pixel' }]}
            value={S.eraserMode.value}
            onChange={(v) => (S.eraserMode.value = v)}
          />
          <div class="pop-hint">
            {S.eraserMode.value === 'stroke'
              ? 'Touch a line to remove the whole stroke.'
              : 'Erase only the part you rub over — like a real eraser.'}
          </div>
          <SlideToClear />
        </>
      )}
    </div>
  )
}

function SelectionPopover(): JSX.Element {
  const width = S.selectionWidth.value
  const [draft, setDraft] = useState(width ?? 3)
  useLayoutEffect(() => setDraft(width ?? 3), [width])
  return (
    <div class="popover panel ui props selection-props" data-popover-keep="">
      <div class="pop-title">{S.selectionCount.value} selected</div>
      <div class="swatches">
        {PALETTE.map((c) => <Swatch key={c} color={c} selected={S.selectionColor.value?.toLowerCase() === c} onClick={() => actions.setColor(c)} />)}
        <ColorPicker color={S.selectionColor.value ?? '#2f6bff'} onPick={actions.setColor} />
      </div>
      <Row label="Thickness">
        <Slider label="Selection thickness" min={1} max={60} value={draft} onChange={setDraft} onCommit={actions.setSelectionWidth} />
        <span class="val">{width === null && draft === 3 ? 'Mixed' : draft}</span>
      </Row>
      <div class="pop-hint">Changes apply to selected objects. Undo with Ctrl+Z.</div>
    </div>
  )
}

const SHAPES: { k: ShapeKind; icon: typeof Slash; title: string }[] = [
  { k: 'line', icon: Slash, title: 'Line  (L)' },
  { k: 'arrow', icon: ArrowUpRight, title: 'Arrow  (A)' },
  { k: 'rect', icon: Square, title: 'Rectangle  (R)' },
  { k: 'ellipse', icon: Circle, title: 'Ellipse  (O)' },
  { k: 'diamond', icon: Diamond, title: 'Diamond' },
  { k: 'triangle', icon: Triangle, title: 'Triangle' }
]

export function ShapesPopover(): JSX.Element {
  return (
    <div class="popover panel ui shapes" data-popover-keep="">
      {SHAPES.map(({ k, icon, title }) => (
        <Btn
          key={k}
          icon={icon}
          title={title}
          active={activeTool.value === k}
          keep
          onClick={() => {
            board.setTool(k)
            S.popover.value = null
          }}
        />
      ))}
    </div>
  )
}

export function MenuPopover(): JSX.Element {
  const close = (fn: () => unknown) => () => {
    S.popover.value = null
    void fn()
  }
  return (
    <div class="popover panel ui menu" data-popover-keep="">
      <MenuItem icon={FilePlus2} label="New lesson" hint="Ctrl+N" onClick={close(actions.newLesson)} />
      <MenuItem icon={FolderOpen} label="My lessons…" hint="Ctrl+O" onClick={() => (S.popover.value = 'lessons')} />
      <MenuItem icon={Save} label="Save now" hint="Ctrl+S · it also saves itself" onClick={close(actions.saveLesson)} />
      <MenuItem icon={SaveAll} label="Save a copy…" hint="Ctrl+Shift+S" onClick={close(actions.saveLessonAs)} />
      <Sep />
      <MenuItem icon={Share2} label="Export picture or PDF…" hint="Ctrl+E" onClick={() => (S.popover.value = 'export')} />
      <MenuItem icon={History} label="Recovery backups…" onClick={() => (S.popover.value = 'recovery')} />
      <MenuItem icon={Clapperboard} label="Record and replay…" onClick={() => (S.popover.value = 'replay')} />
      <MenuItem icon={UnlockKeyhole} label="Unlock all objects" onClick={close(() => board.unlockAll())} />
      <Sep />
      <MenuItem icon={Trash2} label="Clear board" hint="undoable" danger onClick={close(() => board.clearBoard())} />
      <Sep />
      <MenuItem icon={Keyboard} label="Keyboard shortcuts" hint="F1" onClick={() => (S.popover.value = 'help')} />
    </div>
  )
}

export function SettingsPopover(): JSX.Element {
  return (
    <div class="popover panel ui settings" data-popover-keep="">
      <div class="pop-sub">Layout</div>
      <Segmented
        options={[{ value: 'board', label: 'Smart board' }, { value: 'laptop', label: 'Laptop' }]}
        value={S.layout.value}
        onChange={(v) => actions.chooseLayout(v)}
      />
      <div class="pop-sub">Appearance <i>(Auto follows the board)</i></div>
      <Segmented
        options={[{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        value={S.uiTheme.value}
        onChange={(v) => { S.uiTheme.value = v as typeof S.uiTheme.value }}
      />
      <div class="pop-sub">This board <i>(converts, nothing is lost)</i></div>
      <Segmented
        options={[{ value: 'notebook', label: 'Notebook' }, { value: 'canvas', label: 'Canvas' }]}
        value={S.kind.value}
        onChange={(v) => actions.convertBoard(v)}
      />
      <PaperPicker />
      <Row label="Opacity" hint="Lower it to see the screen through the board">
        <Slider min={0} max={100} value={S.bgAlpha.value} onChange={(v) => (S.bgAlpha.value = v)} />
        <span class="val">{S.bgAlpha.value}%</span>
      </Row>
      <Sep />
      <Row label="Smoothing" hint="Steadies shaky handwriting. 0 = raw input">
        <Slider min={0} max={10} value={S.smoothing.value} onChange={(v) => (S.smoothing.value = v)} />
        <span class="val">{S.smoothing.value}</span>
      </Row>
      <Row label="Pen pressure" hint="Line width follows pen pressure">
        <span class="grow" />
        <Switch on={S.pressure.value} onChange={(v) => (S.pressure.value = v)} />
      </Row>
      <Row label="Draw with finger" hint="Touch screens. Off = one finger pans. Two fingers always pan & pinch-zoom">
        <span class="grow" />
        <Switch on={S.fingerDraw.value} onChange={(v) => (S.fingerDraw.value = v)} />
      </Row>
      <Row label="Palm erases" hint="Touch screens: wipe with your palm to erase, like a duster">
        <span class="grow" />
        <Switch on={S.palmErase.value} onChange={(v) => (S.palmErase.value = v)} />
      </Row>
      {S.palmErase.value && <button type="button" class="link-btn nodrag" onClick={() => { S.popover.value = null; calibrating.value = true }}>Calibrate palm size…</button>}
      <button type="button" class="link-btn nodrag" onClick={() => (S.popover.value = 'inputs')}>Pen and finger: a tool for each…</button>
      <Sep />
      <Row label="Hold for menu">
        <span class="grow" />
        <Switch on={S.radialEnabled.value} onChange={(v) => (S.radialEnabled.value = v)} />
      </Row>
      {S.radialEnabled.value && <Row label="Hold delay" hint="Increase this if the menu opens while you are writing">
        <Slider label="Radial menu hold delay" min={300} max={1500} step={50} value={S.radialDelay.value} onChange={(v) => (S.radialDelay.value = v)} />
        <span class="val">{(S.radialDelay.value / 1000).toFixed(2)}s</span>
      </Row>}
    </div>
  )
}

function RecoveryPopover(): JSX.Element {
  const [backups, setBackups] = useState<BackupInfo[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    void window.api.store.listBackups().then((rows) => { if (active) setBackups(rows) }).catch(() => { if (active) setError('Could not read backups. Close this panel and try again.') })
    return () => { active = false }
  }, [])
  return (
    <div class="popover panel ui recovery" data-popover-keep="">
      <div class="pop-title">Recovery backups</div>
      <div class="pop-hint">Five previous saves are kept, at most once per minute. Restoring is undoable.</div>
      {error && <div class="pop-hint">{error}</div>}
      {!backups && !error && <div class="pop-hint">Loading…</div>}
      {backups?.length === 0 && <div class="pop-hint">No backups yet. A snapshot appears when an existing save is replaced.</div>}
      {backups?.map((backup) => <button type="button" class="backup-row" key={backup.id} disabled={busy} onClick={() => {
        setBusy(true)
        void actions.restoreBackup(backup.id).finally(() => setBusy(false))
      }}>
        <span>{new Date(backup.savedAt).toLocaleString()}</span>
        <small>{backup.itemCount} objects · Restore</small>
      </button>)}
    </div>
  )
}

const SHORTCUTS: [string, [string, string][]][] = [
  ['Tools', [['V / Q / H', 'Select · Lasso · Hand'], ['P / M / E', 'Pen · Highlighter · Eraser'], ['T / N', 'Text / Sticky note'], ['E again', 'Eraser: Stroke ⇄ Pixel'], ['K', 'Laser pointer'], ['L A R O', 'Line · Arrow · Rect · Oval'], ['[  ]', 'Brush size']]],
  ['Pen, mouse & touch', [['Hold press', 'Radial menu'], ['Barrel button', 'Eraser while held'], ['2 fingers', 'Pan & pinch-zoom'], ['Shift', 'Straight / square shapes'], ['Alt + drag', 'Move window']]],
  ['Board', [['Ctrl+Z / Y', 'Undo / Redo'], ['Ctrl+A', 'Select all'], ['Ctrl+D', 'Duplicate'], ['Ctrl+C / V', 'Copy / Paste objects'], ['Ctrl+G', 'Group selection'], ['Ctrl+Shift+G', 'Ungroup selection'], ['Enter', 'Edit selected text'], ['Delete', 'Delete selection'], ['Ctrl+Shift+C', 'Copy image']]],
  ['Lesson', [['Ctrl+N', 'New lesson'], ['Ctrl+O', 'My lessons'], ['Ctrl+S', 'Save now (lessons also save themselves)'], ['Ctrl+Shift+S', 'Save a copy'], ['Ctrl+E', 'Export picture or PDF']]],
  ['Object editing', [['Ctrl+L', 'Lock / Unlock selection'], ['Ctrl+Alt+C / V', 'Copy / Paste style'], ['Arrow keys', 'Nudge · Shift for 10 px'], ['Page Up / Down', 'Bring front / Send back'], ['Shift + resize', 'Keep proportions'], ['Shift + rotate', 'Snap to 15°'], ['Ctrl+Enter', 'Finish typing'], ['Esc', 'Cancel typing or drag']]],
  ['View', [['Ctrl+Wheel', 'Zoom'], ['Space + drag', 'Pan'], ['Ctrl+0 / 1 / 2', '100% / Fit all / Fit selection'], ['G', 'Cycle grid'], ['Tab', 'Hide / show interface'], ['Ctrl+Shift+Space', 'Pass-through (global)'], ['Ctrl+Shift+H', 'Hide window (global)']]]
]

export function HelpPopover(): JSX.Element {
  return (
    <div class="popover panel ui help" data-popover-keep="">
      <div class="pop-title">Shortcuts</div>
      <div class="help-grid">
        {SHORTCUTS.map(([head, rows]) => (
          <div key={head}>
            <div class="pop-sub">{head}</div>
            {rows.map(([k, d]) => (
              <div class="help-row" key={k}>
                <b>{k}</b>
                <span>{d}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Popovers(): JSX.Element {
  const p = S.popover.value
  const onBoard = boardMode.value && S.layoutChosen.value
  return (
    <>
      {p === 'menu' && <MenuPopover />}
      {p === 'settings' && <SettingsPopover />}
      {p === 'help' && <HelpPopover />}
      {p === 'recovery' && <RecoveryPopover />}
      {p === 'insert' && <InsertPopover />}
      {/* on the smart board these sheets open above the toolbar (see BoardBar) */}
      {!onBoard && p === 'export' && <ExportSheet />}
      {p === 'present' && <PresentPopover />}
      {p === 'equation' && <EquationEditor key={equationTarget.value?.id ?? 'new'} />}
      {p === 'graph' && <GraphEditor key={graphTarget.value?.id ?? 'new'} />}
    </>
  )
}

export { SHAPE_TOOLS }
