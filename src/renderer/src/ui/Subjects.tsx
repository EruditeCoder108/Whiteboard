import { signal } from '@preact/signals'
import {
  Atom, BookOpen, Calculator, Dna, DraftingCompass, FlaskConical, Gauge, Image as ImageIcon, LineChart, NotebookPen,
  Ruler, Sigma, TestTubes, TriangleRight, Type
} from 'lucide-preact'
import type { JSX } from 'preact'
import { board } from '@/engine/instance'
import type { Paper } from '@/engine/grid'
import { instrumentsShown, type InstrumentKind } from '@/engine/instruments'
import { S } from '@/state/store'
import { editEquation, editGraph, insertFiles, pickFiles } from '@/state/insert'

type Icon = typeof Ruler
type Subject = 'maths' | 'physics' | 'chemistry' | 'biology' | 'english' | 'hindi'
const subject = signal<Subject>('maths')

const SUBJECTS: [Subject, string, Icon][] = [
  ['maths', 'Maths', Calculator], ['physics', 'Physics', Atom], ['chemistry', 'Chemistry', TestTubes],
  ['biology', 'Biology', Dna], ['english', 'English', BookOpen], ['hindi', 'Hindi', NotebookPen]
]

interface Entry { icon: Icon; label: string; on?: () => boolean; run: () => void; stay?: boolean }

const close = (): void => { S.popover.value = null }
const instrument = (kind: InstrumentKind, icon: Icon, label: string): Entry =>
  ({ icon, label, on: () => instrumentsShown.value.includes(kind), run: () => board.instruments.toggle(kind), stay: true })
const paper = (p: Paper, icon: Icon, label: string): Entry =>
  ({ icon, label, on: () => S.grid.value === p, run: () => { S.grid.value = S.grid.value === p ? 'none' : p }, stay: true })
const equation: Entry = { icon: Sigma, label: 'Equation', run: () => editEquation(null), stay: true }
const graph: Entry = { icon: LineChart, label: 'Graph of a function', run: () => editGraph(null), stay: true }
const labs: Entry = { icon: FlaskConical, label: 'Science labs', run: () => (S.popover.value = 'science'), stay: true }
const picture: Entry = { icon: ImageIcon, label: 'Picture / diagram', run: () => { close(); void pickFiles('image/*').then(files => insertFiles(files)) } }
const text: Entry = { icon: Type, label: 'Typed text', run: () => { close(); board.setTool('text') } }

const TOOLS: Record<Subject, Entry[]> = {
  maths: [instrument('ruler', Ruler, 'Ruler'), instrument('setsquare', TriangleRight, 'Set square'), instrument('protractor', Gauge, 'Protractor'),
    instrument('compass', DraftingCompass, 'Compass'), equation, graph, paper('lines', Calculator, 'Squared paper'), paper('graph', LineChart, 'Graph paper')],
  physics: [equation, graph, paper('graph', LineChart, 'Graph paper'), instrument('ruler', Ruler, 'Ruler'), instrument('protractor', Gauge, 'Protractor'), labs],
  chemistry: [{ ...equation, label: 'Chemical equation' }, labs, picture, paper('lines', Calculator, 'Squared paper')],
  biology: [labs, picture, text],
  english: [paper('fourline', BookOpen, 'Four-line paper'), paper('ruled', NotebookPen, 'Ruled paper'), text, picture],
  hindi: [paper('hindi', NotebookPen, 'Hindi lines'), paper('ruled', BookOpen, 'Ruled paper'), text, picture]
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
