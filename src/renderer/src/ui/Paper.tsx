import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Crop, ImagePlus, Images, Minus, Plus, RotateCcw, Trash2 } from './icons'
import { sameColor } from '@/engine/colour'
import { board } from '@/engine/instance'
import { PRESET, SPACING_RANGE, hasSpacing, isLayout } from '@/engine/grid'
import type { Texture } from '@/engine/texture'
import type { Paper, PaperStyle } from '@/engine/grid'
import { PAGE_H, PAGE_W } from '@/engine/pages'
import type { ArtFit, ArtSpan } from '@/engine/pages'
import { paintBackdrop } from '@/engine/scene'
import { actions } from '@/state/actions'
import { background, selectedPicture } from '@/state/background'
import { SURFACES, S } from '@/state/store'
import { Segmented, Slider, Swatch, Tile } from './kit'
import { openCrop } from './Crop'

const PAPER_GROUPS: [string, [Paper, string][]][] = [
  ['Writing', [['none', 'Plain'], ['ruled', 'Ruled'], ['fourline', 'Four-line'], ['hindi', 'Hindi lines']]],
  ['Maths', [['lines', 'Squares'], ['graph', 'Graph paper'], ['dots', 'Dots'], ['isodots', 'Isometric dots'], ['isogrid', 'Isometric grid'], ['semilog', 'Semi-log'], ['loglog', 'Log-log'], ['polar', 'Polar']]],
  ['Music and lesson layouts', [['music', 'Music'], ['compare', 'Two columns'], ['predict', 'Three columns'], ['worked', 'Worked example'], ['exit', 'Exit ticket']]],
  ['Playing fields', [['football', 'Football'], ['cricket', 'Cricket'], ['basketball', 'Basketball'], ['kabaddi', 'Kabaddi']]]
]
const TEXTURE_NAMES: [Texture, string][] = [['none', 'Smooth'], ['chalk', 'Chalk'], ['slate', 'Slate'], ['paper', 'Paper']]
const SPACINGS: [string, number][] = [['Small', .75], ['Medium', 1], ['Large', 1.5]]
const STRENGTHS: [string, number][] = [['Faint', .55], ['Normal', 1], ['Strong', 1.7]]
/** Line colours that read well on light and dark boards; "Usual" is the paper's own. */
const LINE_COLOURS: [string, string][] = [['#2f6bff', 'Blue'], ['#6b7280', 'Grey'], ['#16a34a', 'Green'], ['#b45309', 'Brown'], ['#e5484d', 'Red']]

const near = (a: number, b: number): boolean => Math.abs(a - b) < .005
const isPreset = (s: PaperStyle): boolean => s.spacing === 1 && s.strength === 1 && !s.lines

/** A small sample of a paper with the current settings, painted by the same code as the board. */
function PaperSample({ paper, color, style, layout }: { paper: Paper; color: string; style: PaperStyle; layout: boolean }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 72, h = cv.clientHeight || 54
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
    const ctx = cv.getContext('2d')!
    // A layout is shown whole; a pattern close up, as it looks when writing.
    const zoom = layout ? w / PAGE_W : .42
    paintBackdrop(ctx, { x: layout ? 0 : -8, y: layout ? (PAGE_H - h / zoom) / 2 : -8, zoom }, w, h, dpr,
      { color, paper, origin: [0, 0], style, ...(layout ? { sheet: [0, 0, PAGE_W, PAGE_H] as [number, number, number, number] } : {}) }, true)
  }, [paper, color, style.spacing, style.strength, style.lines, layout])
  return <canvas ref={ref} class="paper-prev" aria-hidden="true" />
}

/** A board surface as it looks behind writing: its colour and texture, close up. */
function SurfaceSample({ color, texture }: { color: string; texture: Texture }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 72, h = cv.clientHeight || 54
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
    paintBackdrop(cv.getContext('2d')!, { x: 0, y: 0, zoom: 1 }, w, h, dpr, { color, paper: 'none', origin: [0, 0], style: PRESET, texture }, true)
  }, [color, texture])
  return <canvas ref={ref} class="paper-prev" aria-hidden="true" />
}

/** The page (or frame) in view, ink included, so the paper can be judged under real writing. */
function HerePreview(): JSX.Element | null {
  const ref = useRef<HTMLCanvasElement>(null)
  const here = S.here.value
  const i = S.kind.value === 'notebook' ? S.page.value : S.frameIndex.value
  useEffect(() => {
    const cv = ref.current
    if (!cv || !here.unit || i < 0) return
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 300
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * PAGE_H / PAGE_W * dpr)
    board.paintPageThumb(i, cv)
  }, [here, i, S.contentRevision.value, S.documentRevision.value])
  if (!here.unit || i < 0) return null
  return <canvas ref={ref} class="paper-here" aria-label="This page with its paper" />
}

/**
 * Background & paper. The colour is the whole lesson's unless "Only this page" is on; the paper and
 * picture are this page's (this frame's, on a canvas) unless "All pages" is on. Colour and paper also
 * become what new lessons start with; a picture never does.
 */
export function PaperPicker(): JSX.Element {
  const [onlyHere, setOnlyHere] = useState(false)
  const [everywhere, setEverywhere] = useState(false)
  const [artEverywhere, setArtEverywhere] = useState(false)
  const here = S.here.value
  const { style, art } = here
  const noun = here.unit === 'frame' ? 'frame' : 'page'
  const surface = (patch: { color?: string; texture?: Texture }): void => actions.setSurface(patch, onlyHere && here.unit !== null)
  const colour = (color: string): void => surface({ color })
  const tune = (patch: Parameters<typeof actions.setPaperStyle>[0]): void => actions.setPaperStyle(patch, everywhere)
  const spacing = (v: number): void => tune({ spacing: Math.round(Math.min(SPACING_RANGE[1], Math.max(SPACING_RANGE[0], v)) * 100) / 100 })
  const picture = selectedPicture()
  const scope = here.unit ? (everywhere ? `every ${noun}` : `this ${noun}`) : 'the canvas'
  return (
    <>
      <HerePreview />
      <div class="pop-sub paper-head">
        <span>Board <i>({onlyHere && here.unit ? `this ${noun}` : 'the whole lesson'})</i></span>
        {here.unit && <button type="button" class={`chip nodrag ${onlyHere ? 'on' : ''}`} aria-pressed={onlyHere} onClick={() => setOnlyHere(!onlyHere)}>Only this {noun}</button>}
      </div>
      <div class="surfaces">
        {SURFACES.map(s => {
          const on = sameColor(here.color, s.color) && here.texture === s.texture
          return (
            <button type="button" key={s.name} class={`paper-tile nodrag ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => surface({ color: s.color, texture: s.texture })}>
              <SurfaceSample color={s.color} texture={s.texture} />
              <span>{s.name}</span>
            </button>
          )
        })}
      </div>
      <div class="paper-tune">
        <div class="tune-row">
          <span class="tune-label">Texture</span>
          <Segmented<Texture> options={TEXTURE_NAMES.map(([value, label]) => ({ value, label }))} value={here.texture} onChange={texture => surface({ texture })} />
        </div>
        <div class="tune-row">
          <span class="tune-label">Own colour</span>
          <label class="swatch custom nodrag" title="A board colour of your own (keeps the texture)">
            <Plus size={14} strokeWidth={2} />
            <input type="color" value={here.color} onChange={(e) => colour((e.target as HTMLInputElement).value)} />
          </label>
          <span class="tune-note">The texture stays; only the colour changes.</span>
        </div>
      </div>

      <div class="pop-sub paper-head">
        <span>Paper <i>({scope}, and new lessons)</i></span>
        {here.unit && <button type="button" class={`chip nodrag ${everywhere ? 'on' : ''}`} aria-pressed={everywhere} onClick={() => setEverywhere(!everywhere)}>All {noun}s</button>}
      </div>
      {PAPER_GROUPS.map(([group, papers]) => (
        <div key={group} class="paper-group">
          <div class="paper-group-name">{group}</div>
          <div class="papers">
            {papers.map(([paper, name]) => (
              <button type="button" key={paper} class={`paper-tile nodrag ${here.paper === paper ? 'on' : ''}`} aria-pressed={here.paper === paper} onClick={() => actions.setPaper(paper, everywhere)}>
                <PaperSample paper={paper} color={here.color} style={style} layout={isLayout(paper)} />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {here.paper !== 'none' && (
        <div class="paper-tune">
          {hasSpacing(here.paper) && (
            <div class="tune-row">
              <span class="tune-label">Spacing</span>
              <Segmented<string> options={SPACINGS.map(([label]) => ({ value: label, label }))}
                value={SPACINGS.find(([, v]) => near(v, style.spacing))?.[0] ?? ''} onChange={l => spacing(SPACINGS.find(([n]) => n === l)![1])} />
              <span class="tune-step">
                <button type="button" class="nodrag" aria-label="Closer together" disabled={style.spacing <= SPACING_RANGE[0]} onClick={() => spacing(style.spacing - .1)}><Minus size={16} /></button>
                <b>{Math.round(style.spacing * 100)}%</b>
                <button type="button" class="nodrag" aria-label="Further apart" disabled={style.spacing >= SPACING_RANGE[1]} onClick={() => spacing(style.spacing + .1)}><Plus size={16} /></button>
              </span>
            </div>
          )}
          <div class="tune-row">
            <span class="tune-label">Strength</span>
            <Segmented<string> options={STRENGTHS.map(([label]) => ({ value: label, label }))}
              value={STRENGTHS.find(([, v]) => near(v, style.strength))?.[0] ?? ''} onChange={l => tune({ strength: STRENGTHS.find(([n]) => n === l)![1] })} />
          </div>
          <div class="tune-row">
            <span class="tune-label">Lines</span>
            <div class="swatches">
              <button type="button" class={`chip nodrag ${!style.lines ? 'on' : ''}`} aria-pressed={!style.lines} onClick={() => tune({ lines: null })}>Usual</button>
              {LINE_COLOURS.map(([c, name]) => <Swatch key={c} color={c} title={`${name} lines`} selected={!!style.lines && sameColor(style.lines, c)} onClick={() => tune({ lines: c })} />)}
              <label class="swatch custom nodrag" title="Custom line colour…">
                <Plus size={14} strokeWidth={2} />
                <input type="color" value={style.lines ?? '#2f6bff'} onChange={(e) => tune({ lines: (e.target as HTMLInputElement).value })} />
              </label>
            </div>
          </div>
          {!isPreset(style) && (
            <button type="button" class="chip nodrag" onClick={() => actions.resetPaper(everywhere)}><RotateCcw size={14} /> Restore the paper as designed</button>
          )}
          {style.lines && <p class="pop-hint">Margins and baselines stay red, so letters still sit on the right line.</p>}
        </div>
      )}

      <div class="pop-sub paper-head">
        <span>Picture behind the writing <i>({here.unit ? artEverywhere ? `every ${noun}` : `this ${noun}` : 'the canvas'})</i></span>
        {here.unit && <button type="button" class={`chip nodrag ${artEverywhere ? 'on' : ''}`} aria-pressed={artEverywhere} onClick={() => setArtEverywhere(!artEverywhere)}>All {noun}s</button>}
      </div>
      <div class="tiles two">
        <Tile icon={ImagePlus} label={art ? 'Replace picture…' : 'Choose picture…'} onClick={() => void background.choose(artEverywhere)} />
        <Tile icon={Images} label="Use selected picture" disabled={!picture} onClick={() => background.fromSelection(artEverywhere)} />
      </div>
      {!art && <p class="pop-hint">A worksheet, diagram or school template. It stays when you erase or clear the ink. Tip: import a PDF, select its page, then “Use selected picture”.</p>}
      {art && (
        <div class="paper-tune">
          <div class="tune-row">
            <span class="tune-label">Show</span>
            <Segmented<ArtFit> options={[{ value: 'fit', label: 'Whole picture' }, { value: 'fill', label: 'Fill the page' }]} value={art.fit} onChange={fit => background.adjust({ fit }, artEverywhere)} />
          </div>
          <div class="tune-row">
            <span class="tune-label">Position</span>
            <div class="align-grid" role="group" aria-label="Picture position">
              {[0, .5, 1].map(y => [0, .5, 1].map(x => (
                <button type="button" key={`${x},${y}`} class={`nodrag ${art.align[0] === x && art.align[1] === y ? 'on' : ''}`} aria-label={`${['Top', 'Middle', 'Bottom'][y * 2]} ${['left', 'centre', 'right'][x * 2]}`}
                  aria-pressed={art.align[0] === x && art.align[1] === y} onClick={() => background.adjust({ align: [x, y] }, artEverywhere)}><span /></button>
              )))}
            </div>
          </div>
          <div class="tune-row">
            <span class="tune-label">Strength</span>
            <Slider min={10} max={100} step={5} label="Picture strength" value={Math.round(art.opacity * 100)} onChange={v => background.adjust({ opacity: v / 100 }, artEverywhere)} />
            <span class="val">{Math.round(art.opacity * 100)}%</span>
          </div>
          {here.unit && (
            <div class="tune-row">
              <span class="tune-label">Long page</span>
              <Segmented<ArtSpan> options={[{ value: 'first', label: 'First screen' }, { value: 'each', label: 'Every screen' }, { value: 'whole', label: 'Whole page' }]} value={art.span} onChange={span => background.adjust({ span }, artEverywhere)} />
            </div>
          )}
          <button type="button" class="chip nodrag" onClick={() => openCrop(null)}><Crop size={14} /> Crop the picture</button>
          <button type="button" class="chip nodrag danger" onClick={() => background.remove(artEverywhere)}><Trash2 size={14} /> Remove the picture</button>
        </div>
      )}
    </>
  )
}

/** Board-mode sheet. */
export function PaperPopover(): JSX.Element {
  return <div class="popover panel ui paper-sheet" data-popover-keep=""><PaperPicker /></div>
}
