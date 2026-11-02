import * as Lucide from 'lucide-preact'
import type { JSX } from 'preact'
import { useState } from 'preact/hooks'
import { S } from '@/state/store'
export * from 'lucide-preact'

const files = import.meta.glob('../assets/art/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const artNames = ["assistant","audio","axes","background","calculator","canvas-board","capture","chalk","clock","compass","copy","dice","empty-lessons","empty-shelf","equation","eraser","exit","export","felt-marker","file-pdf","frame","geometry-box","graph","hand","hide-toolbar","hide","highlighter","keyboard","laptop","laser","lasso","link","lock","magnifier","menu","mind-map","minimise","more","my-lessons","my-shelf","name-picker","new-lesson","new-page","notebook-board","number-line","open-folder","page-back","page-next","paintbrush","paper-fourline","paper-graph","paper-hindi","paper-ruled","paper-squared","pdf-worksheet","pen","pencil","periodic-table","picture","pin","poll","protractor","record","recovery","redo","rename","reveal","ruler","save-copy","save","science-labs","scoreboard","screen-cover","search","select","set-square","settings","shapes","share-phones","show","slides","smart-board","split-board","spotlight","stamp","sticky","stopwatch","subject-biology","subject-chemistry","subject-english","subject-hindi","subject-maths","subject-physics","subjects","table","tag","text","timeline","timer","trash","undo","unlock","use-apps-below","video","welcome-board","welcome-laptop","write-over-screen"] as const
const modern = import.meta.glob('../assets/art-modern/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** Icon packs. A pack lists only what it has drawn; anything else in it falls back to the plain mark. */
export const ICON_PACKS: { value: string; label: string }[] = [
  { value: 'pictures', label: 'Pictures' },
  ...(Object.keys(modern).length ? [{ value: 'modern', label: 'Modern' }] : []),
  { value: 'plain', label: 'Simple lines' }
]
const chosenPack = (): string => { const pack = S.iconPack.value; return ICON_PACKS.some(p => p.value === pack) ? pack : 'pictures' }
export const artUrl = (name: string): string | undefined => {
  const pack = chosenPack()
  return pack === 'plain' ? undefined : pack === 'modern' ? modern['../assets/art-modern/' + name + '.webp'] : files['../assets/art/' + name + '.webp']
}

// Decoded ahead of time so pictures do not pop in, without ever making the app wait for them to start.
for (const src of [...Object.values(files), ...Object.values(modern)]) { const image = new window.Image(); image.src = src; void image.decode().catch(() => undefined) }

type Props = Parameters<typeof Lucide.Pen>[0]
export function art(name: string, Fallback: typeof Lucide.Pen = Lucide.Image): typeof Lucide.Pen {
  return ((props: Props): JSX.Element => {
    const [failed, setFailed] = useState(false)
    const src = artUrl(name)
    // Radial icons live inside SVG; preserve their exact SVG coordinate system.
    const requested = Number(props.size ?? 24)
    const { plain, pic, ...rest } = props as Props & { plain?: boolean; pic?: boolean }
    // Pictures are for what a teacher reaches for. Text rows, small buttons and window controls stay plain marks.
    if (failed || !src || rest.x !== undefined || rest.y !== undefined || plain || (requested < 18 && !pic)) return <Fallback {...rest} />
    const size = Math.min(38, Math.max(24, requested * 1.5))
    return <img class={('art ' + (props.class ?? '')).trim()} src={src} alt="" draggable={false} width={size} height={size} style={props.style as JSX.CSSProperties} onError={() => setFailed(true)} />
  }) as typeof Lucide.Pen
}

export function ArtPicture({ name, class: cls = '' }: { name: string; class?: string }): JSX.Element | null { const src = artUrl(name); return src ? <img class={'art-picture ' + cls} src={src} alt="" draggable={false} /> : null }

export const MousePointer2 = art('select', Lucide.MousePointer2)
export const Pen = art('pen', Lucide.Pen)
export const Highlighter = art('highlighter', Lucide.Highlighter)
export const Eraser = art('eraser', Lucide.Eraser)
export const Shapes = art('shapes', Lucide.Shapes)
export const Type = art('text', Lucide.Type)
export const Crosshair = art('laser', Lucide.Crosshair)
export const GraduationCap = art('subjects', Lucide.GraduationCap)
export const Hand = art('hand', Lucide.Hand)
export const Lasso = art('lasso', Lucide.Lasso)
export const StickyNote = art('sticky', Lucide.StickyNote)
export const Undo2 = art('undo', Lucide.Undo2)
export const Redo2 = art('redo', Lucide.Redo2)
export const PageBack = art('page-back', Lucide.ChevronLeft)
export const PageNext = art('page-next', Lucide.ChevronRight)
export const NewPage = art('new-page', Lucide.FilePlus2)
export const Frame = art('frame', Lucide.Frame)
export const LayoutGrid = art('more', Lucide.LayoutGrid)
export const Menu = art('menu', Lucide.Menu)
export const Pencil = art('pencil', Lucide.Pencil)
export const RenameArt = art('rename', Lucide.Pencil)
export const Paintbrush = art('paintbrush', Lucide.Paintbrush)
export const Chalk = art('chalk', Lucide.PenLine)
export const FeltMarker = art('felt-marker', Lucide.PenTool)
export const Stamp = art('stamp', Lucide.Stamp)
export const FilePlus2 = art('new-lesson', Lucide.FilePlus2)
export const Library = art('my-lessons', Lucide.Library)
export const FolderOpen = art('open-folder', Lucide.FolderOpen)
export const Save = art('save', Lucide.Save)
export const SaveAll = art('save-copy', Lucide.SaveAll)
export const Share2 = art('export', Lucide.Share2)
export const History = art('recovery', Lucide.History)
export const Trash2 = art('trash', Lucide.Trash2)
export const Tag = art('tag', Lucide.Tag)
export const Search = art('search', Lucide.Search)
export const Image = art('picture', Lucide.Image)
export const ImagePlus = art('picture', Lucide.ImagePlus)
export const Archive = art('my-shelf', Lucide.Archive)
export const MonitorUp = art('capture', Lucide.MonitorUp)
export const FileText = art('pdf-worksheet', Lucide.FileText)
export const Table2 = art('table', Lucide.Table2)
export const Sigma = art('equation', Lucide.Sigma)
export const LineChart = art('graph', Lucide.LineChart)
export const MoveHorizontal = art('number-line', Lucide.MoveHorizontal)
export const Axis3d = art('axes', Lucide.Axis3d)
export const Atom = art('subject-physics', Lucide.Atom)
export const PeriodicTable = art('periodic-table', Lucide.Atom)
export const GeometryBox = art('geometry-box', Lucide.DraftingCompass)
export const Ruler = art('ruler', Lucide.Ruler)
export const TriangleRight = art('set-square', Lucide.TriangleRight)
export const Gauge = art('protractor', Lucide.Gauge)
export const DraftingCompass = art('compass', Lucide.DraftingCompass)
export const FlaskConical = art('science-labs', Lucide.FlaskConical)
export const Calculator = art('calculator', Lucide.Calculator)
export const Spotlight = art('spotlight', Lucide.Spotlight)
export const RevealArt = art('reveal', Lucide.Eye)
export const Blinds = art('screen-cover', Lucide.Blinds)
export const Timer = art('timer', Lucide.Timer)
export const Clapperboard = art('record', Lucide.Clapperboard)
export const WriteOverScreen = art('write-over-screen', Lucide.MonitorUp)
export const MousePointerClick = art('use-apps-below', Lucide.MousePointerClick)
export const Sparkles = art('assistant', Lucide.Sparkles)
export const SlidersHorizontal = art('settings', Lucide.Settings)
export const Layers = art('background', Lucide.Layers)
export const Infinity = art('canvas-board', Lucide.Infinity)
export const BookOpen = art('notebook-board', Lucide.BookOpen)
export const HideToolbar = art('hide-toolbar', Lucide.PanelBottomClose)
export const Eye = art('show', Lucide.Eye)
export const EyeOff = art('hide', Lucide.EyeOff)
export const Laptop = art('laptop', Lucide.Laptop)
export const Presentation = art('smart-board', Lucide.Presentation)
export const MinimiseArt = art('minimise', Lucide.Minus)
export const LogOut = art('exit', Lucide.LogOut)
export const Keyboard = art('keyboard', Lucide.Keyboard)
export const Pin = art('pin', Lucide.Pin)
export const LockKeyhole = art('lock', Lucide.LockKeyhole)
export const UnlockKeyhole = art('unlock', Lucide.UnlockKeyhole)
export const Copy = art('copy', Lucide.Copy)
export const QrCode = art('share-phones', Lucide.QrCode)
export const FileDown = art('file-pdf', Lucide.FileDown)
export const SubjectMaths = art('subject-maths', Lucide.Sigma)
export const TestTubes = art('subject-chemistry', Lucide.TestTubes)
export const Dna = art('subject-biology', Lucide.Dna)
export const SubjectEnglish = art('subject-english', Lucide.BookOpen)
export const NotebookPen = art('subject-hindi', Lucide.NotebookPen)
export const PaperSquared = art('paper-squared', Lucide.Grid2x2)
export const PaperGraph = art('paper-graph', Lucide.Grid3x3)
export const PaperRuled = art('paper-ruled', Lucide.Rows3)
export const PaperFourline = art('paper-fourline', Lucide.AlignJustify)
export const PaperHindi = art('paper-hindi', Lucide.Languages)
export const ArtAudio = art('audio', Lucide.Music)
export const ArtClock = art('clock', Lucide.Clock)
export const ArtDice = art('dice', Lucide.Dices)
export const ArtEmptyLessons = art('empty-lessons')
export const ArtEmptyShelf = art('empty-shelf')
export const ArtLink = art('link', Lucide.Link)
export const ArtMagnifier = art('magnifier', Lucide.ZoomIn)
export const ArtMindMap = art('mind-map', Lucide.Network)
export const ArtNamePicker = art('name-picker', Lucide.Users)
export const ArtPencil = art('pencil', Lucide.Pencil)
export const ArtPoll = art('poll', Lucide.ChartColumn)
export const ArtScoreboard = art('scoreboard', Lucide.Trophy)
export const ArtSlides = art('slides', Lucide.Presentation)
export const ArtSplitBoard = art('split-board', Lucide.Columns2)
export const ArtStopwatch = art('stopwatch', Lucide.Timer)
export const ArtTimeline = art('timeline', Lucide.Milestone)
export const ArtVideo = art('video', Lucide.Video)
export const ArtWelcomeBoard = art('welcome-board')
export const ArtWelcomeLaptop = art('welcome-laptop')
