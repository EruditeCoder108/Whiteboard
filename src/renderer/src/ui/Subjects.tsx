import { signal } from '@preact/signals'
import { Atom } from './icons'
import { SubjectMaths, SubjectEnglish, PeriodicTable, PaperSquared, PaperGraph, PaperFourline, PaperRuled, PaperHindi } from './icons'
import { Axis3d, Calculator, Dna, DraftingCompass, FlaskConical, Gauge, Image as ImageIcon, LineChart, NotebookPen, MoveHorizontal, Ruler, Sigma, TestTubes, TriangleRight, Type } from './icons'
import type { JSX } from 'preact'
import { board } from '@/engine/instance'
import type { Paper } from '@/engine/grid'
import { instrumentsShown, type InstrumentKind } from '@/engine/instruments'
import { S } from '@/state/store'
import { actions } from '@/state/actions'
import { editEquation, editGraph, editScale, insertFiles, pickFiles } from '@/state/insert'
import { placeInView } from '@/engine/shelf'
import { writingStrip } from '@/engine/strips'
import { isDarkBg, showToast } from '@/state/store'
import { calculatorOn } from './Tools'

type Icon = typeof Ruler
type Subject = 'maths' | 'physics' | 'chemistry' | 'biology' | 'english' | 'hindi'
const subject = signal<Subject>('maths')

const SUBJECTS: [Subject, string, Icon][] = [
  ['maths', 'Maths', SubjectMaths], ['physics', 'Physics', Atom], ['chemistry', 'Chemistry', TestTubes],
  ['biology', 'Biology', Dna], ['english', 'English', SubjectEnglish], ['hindi', 'Hindi', NotebookPen]
]

interface Entry { icon: Icon; label: string; on?: () => boolean; run: () => void; stay?: boolean }

const close = (): void => { S.popover.value = null }
const instrument = (kind: InstrumentKind, icon: Icon, label: string): Entry =>
  ({ icon, label, on: () => instrumentsShown.value.includes(kind), run: () => board.instruments.toggle(kind), stay: true })
const paper = (p: Paper, icon: Icon, label: string): Entry =>
  ({ icon, label, on: () => S.grid.value === p, run: () => actions.setPaper(S.grid.value === p ? 'none' : p), stay: true })
const equation: Entry = { icon: Sigma, label: 'Equation', run: () => editEquation(null), stay: true }
const graph: Entry = { icon: LineChart, label: 'Graph of a function', run: () => editGraph(null), stay: true }
const numberLine: Entry = { icon: MoveHorizontal, label: 'Number line', run: () => editScale(null, 'line'), stay: true }
const axes: Entry = { icon: Axis3d, label: 'Coordinate axes', run: () => editScale(null, 'axes'), stay: true }
const calculator: Entry = { icon: Calculator, label: 'Calculator', on: () => calculatorOn.value, run: () => { calculatorOn.value = !calculatorOn.value } }
const periodic: Entry = { icon: PeriodicTable, label: 'Periodic table', run: () => (S.popover.value = 'periodic'), stay: true }
const strip = (kind: 'fourline' | 'hindi', label: string): Entry => ({
  icon: kind === 'hindi' ? PaperHindi : PaperFourline, label,
  run: () => {
    close()
    board.insertSaved(placeInView(writingStrip(kind, isDarkBg.value), board.visibleRect()))
    showToast('Move it into place, then lock it so the eraser leaves it alone', 4000)
  }
})
const labs: Entry = { icon: FlaskConical, label: 'Science labs', run: () => (S.popover.value = 'science'), stay: true }
const picture: Entry = { icon: ImageIcon, label: 'Picture / diagram', run: () => { close(); void pickFiles('image/*').then(files => insertFiles(files)) } }
const text: Entry = { icon: Type, label: 'Typed text', run: () => { close(); board.setTool('text') } }

const TOOLS: Record<Subject, Entry[]> = {
  maths: [calculator, instrument('ruler', Ruler, 'Ruler'), instrument('setsquare', TriangleRight, 'Set square'), instrument('protractor', Gauge, 'Protractor'),
    instrument('compass', DraftingCompass, 'Compass'), numberLine, axes, equation, graph, paper('lines', PaperSquared, 'Squared paper'), paper('graph', PaperGraph, 'Graph paper')],
  physics: [calculator, axes, equation, graph, paper('graph', PaperGraph, 'Graph paper'), instrument('ruler', Ruler, 'Ruler'), instrument('protractor', Gauge, 'Protractor'), labs],
  chemistry: [periodic, { ...equation, label: 'Chemical equation' }, calculator, labs, picture, paper('lines', PaperSquared, 'Squared paper')],
  biology: [labs, picture, text],
  english: [strip('fourline', 'Four-line strip'), paper('fourline', PaperFourline, 'Four-line paper'), paper('ruled', PaperRuled, 'Ruled paper'), text, picture],
  hindi: [strip('hindi', 'Hindi strip'), paper('hindi', PaperHindi, 'Hindi lines'), paper('ruled', PaperRuled, 'Ruled paper'), text, picture]
}

/** Tools by subject, the way teachers think about a lesson. */
export function SubjectsPopover(): JSX.Element {
  const current = subject.value
  return (
    <div class="popover panel ui subjects-sheet" data-popover-keep="">
      <div class="subject-tabs" role="tablist">
        {SUBJECTS.map(([key, name, I]) => (
          <button type="button" role="tab" key={key} aria-selected={current === key} class={`subject-tab nodrag ${current === key ? 'on' : ''}`} onClick={() => (subject.value = key)}>
            <I size={20} strokeWidth={1.8} /><span>{name}</span>
          </button>
        ))}
      </div>
      <div class="tiles">
        {TOOLS[current].map(({ icon: I, label, on, run, stay }) => {
          const active = on?.() ?? false
          return (
            <button type="button" key={label} class={`tile nodrag ${active ? 'on' : ''}`} aria-pressed={on ? active : undefined}
              onClick={() => { run(); if (!stay) close() }}>
              <I size={24} strokeWidth={1.8} /><span>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
