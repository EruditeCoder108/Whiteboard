import type { JSX } from 'preact'
import { BASEBALL } from '@/engine/science/props'
import { useEffect, useRef } from 'preact/hooks'
import { isShowcase } from '@/engine/science/showcase-models'
import { getModel, EXPLAIN_REVEAL } from '@/engine/science/models'
import { paintLab } from '@/engine/science/scene'

export function ConceptPreview({ id }: { id: string }): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!isShowcase(id) || !canvas.current) return
    const c = canvas.current.getContext('2d')!, m = getModel(id)!
    c.save(); c.scale(0.5, 0.5)
    paintLab(c, { t: 'l', id: `preview-${id}`, c: '#007c88', w: 1, p: [0, 0, 1000, 640], labVersion: 1, modelVersion: 1, model: id, params: { ...m.defaults }, frozenTime: 0, theme: 'blueprint', reveal: { ...EXPLAIN_REVEAL } }, id === 'indicator-studio' ? 8.8 : id === 'heart-studio' ? 0.73 : 0.6)
    c.restore()
  }, [id])
  if (isShowcase(id)) return <canvas class="science-preview science-studio-preview" width={500} height={320} ref={canvas} aria-hidden="true"/>
  return <svg class="science-preview" viewBox="0 0 220 120" aria-hidden="true">
    <path d="M18 98H202" stroke="#436f7c" fill="none"/>
    {id === 'projectile' ? <>
      <path d="M23 96Q103 -53 195 96" stroke="#66e6ef" stroke-width="2.5" fill="none"/>
      <path d="M107 22L159 22m-7-5 7 5-7 5" stroke="#ffc575" stroke-width="2" fill="none"/>
      <g fill="#66e6ef"><circle cx="23" cy="96" r="2.5"/><circle cx="49" cy="59" r="2.5"/><circle cx="75" cy="34" r="2.5"/></g>
      <g transform="translate(107 22) rotate(-14)">
        <circle r="11" fill={BASEBALL.leather} stroke={BASEBALL.rim} stroke-width=".6"/>
        <path d="M-7-8Q1 0-7 8M7-8Q-1 0 7 8M-7-5l3-1m-4 4 3-1m-3 4 3-1m-3 4 3-1M4-6l3 1m-3 2 3 1m-3 2 3 1m-3 2 3 1" stroke={BASEBALL.seam} stroke-width=".9" fill="none"/>
      </g>
    </> : id === 'optics' ? <>
      <path d="M110 19Q90 59 110 98Q130 59 110 19Z" fill="#66e6ef" fill-opacity=".15" stroke="#66e6ef" stroke-width="2"/>
      <path d="M35 95V37m-6 8 6-8 6 8M35 37H110L185 96M35 37L185 96" fill="none" stroke="#ffc575" stroke-width="2"/>
    </> : id === 'induction' ? <>
      <path d="M93 36c-20 0-20 51 0 51s20-51 0-51m13 0c-20 0-20 51 0 51s20-51 0-51m13 0c-20 0-20 51 0 51s20-51 0-51" stroke="#ffc575" fill="none" stroke-width="2"/>
      <rect x="20" y="50" width="61" height="22" rx="4" fill="#f8a0bd"/><path d="M51 50h30v22H51Z" fill="#66e6ef"/>
      <path d="M141 61h41m-7-5 7 5-7 5" stroke="#66e6ef" stroke-width="2" fill="none"/>
    </> : id === 'circuits' ? <>
      <path d="M52 58H24v36h170V58h-53" stroke="#66e6ef" stroke-width="2" fill="none"/>
      <circle cx="111" cy="47" r="23" fill="#ffc575" fill-opacity=".1"/><circle cx="111" cy="47" r="17" stroke="#ffc575" stroke-width="2" fill="none"/>
      <path d="M103 61v12h16V61m-16-20 16 13m0-13-16 13M59 86v17m9-22v27" stroke="#ffc575" stroke-width="2" fill="none"/>
    </> : id === 'oscillations' ? <>
      <path d="M50 18h120M109 18l-38 62" stroke="#9bb4c8" stroke-width="2" fill="none"/>
      <circle cx="69" cy="83" r="12" fill="#66e6ef"/>
      <path d="M152 25l-8 7 16 7-16 7 16 7-16 7 8 7v11" stroke="#ffc575" stroke-width="2" fill="none"/><rect x="142" y="78" width="20" height="15" rx="3" fill="#ffc575"/>
    </> : id === 'forces' ? <>
      <rect x="69" y="63" width="76" height="22" rx="6" fill="#f8a0bd"/><circle cx="87" cy="89" r="9" fill="#9bb4c8"/><circle cx="126" cy="89" r="9" fill="#9bb4c8"/>
      <path d="M77 45h65m-8-5 8 5-8 5" stroke="#66e6ef" stroke-width="2" fill="none"/>
    </> : id === 'matter' ? <>
      <path d="M42 22v73h132V22" fill="none" stroke="#9bb4c8" stroke-width="2"/>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => <circle cx={65 + i % 3 * 39} cy={43 + Math.floor(i / 3) * 20} r="5" fill={i % 2 ? '#66e6ef' : '#ffc575'}/>)}
    </> : id === 'reactions' ? <>
      <path d="M44 56h26m21 0h38m18 0h28M111 46l-13 22m13-22 13 22" stroke="#9bb4c8" stroke-width="2"/>
      <g fill="#fff8e9"><circle cx="44" cy="56" r="7"/><circle cx="70" cy="56" r="7"/><circle cx="98" cy="68" r="7"/><circle cx="124" cy="68" r="7"/></g>
      <g fill="#f8a0bd"><circle cx="111" cy="46" r="10"/><circle cx="153" cy="56" r="10"/><circle cx="179" cy="56" r="10"/></g>
    </> : id === 'circulation' ? <>
      <path d="M107 41C63 6 49 64 107 93C165 64 151 6 107 41Z" fill="#f8a0bd" fill-opacity=".2" stroke="#f8a0bd" stroke-width="2"/>
      <path d="M73 58H36V28h50M141 58h42v33h-43" stroke="#66e6ef" fill="none" stroke-width="2"/>
      <circle cx="37" cy="42" r="4" fill="#66e6ef"/><circle cx="183" cy="76" r="4" fill="#f8a0bd"/>
    </> : id === 'apparatus' ? <>
      <path d="M88 20v23L61 92h83l-27-49V20Z" fill="#b584ce" fill-opacity=".2" stroke="#9bb4c8" stroke-width="2"/>
      <path d="M70 77h65l9 15H61Z" fill="#b584ce"/><path d="M160 31Q178 60 159 60Q142 60 160 31Z" fill="#9be2dd"/>
      <g fill="#d9ffff"><circle cx="98" cy="80" r="3"/><circle cx="117" cy="71" r="2"/><circle cx="91" cy="65" r="2"/></g>
    </> : <>
      <path d="M18 59Q41 13 64 59T110 59T156 59T202 59" fill="none" stroke="#66e6ef" stroke-width="3"/>
      <path d="M18 69Q41 97 64 69T110 69T156 69T202 69" fill="none" stroke="#f8a0bd" stroke-width="2" stroke-dasharray="4 4"/>
    </>}
  </svg>
}
