import { Studio } from './studio-drawing'
import { labState } from './models'
import { magnetCenter } from './showcase-models'

export function paintFlux(s: Studio): void {
  const { c, it, time: t } = s, v = labState(it, t), mx = magnetCenter(v.x), cy = 270
  s.box(31, 117, 634, 463, s.dark ? '#0c222d' : '#edf5ef', 18)
  s.pill('01   MOVE → CHANGE FLUX → INDUCE VOLTAGE', 54, 137, 350)
  s.text('Grab the magnet with a finger or mouse', 55, 177, 16, s.ink, true)
  s.text('Stop it. Reverse it. Compare the voltage.', 55, 203, 13, s.muted)
  s.shadow(350, 349, 232, 22)
  // Coil rear halves and field guides sit behind the draggable magnet.
  const field = s.dark ? '#52b5b444' : '#29978944'
  for (const r of it.reveal.vectors ? [56, 81, 106] : []) {
    s.linePath(`M${mx + 60} ${cy}C${mx + 130} ${cy - r} ${mx - 130} ${cy - r} ${mx - 60} ${cy}C${mx - 130} ${cy + r} ${mx + 130} ${cy + r} ${mx + 60} ${cy}`, field, 1.2)
    s.arrow(mx, cy - r * 0.75, -20, 0, field, 1)
  }
  s.box(289, 333, 130, 12, s.dark ? '#304e54' : '#bed7ca', 4, '')
  for (let i = 0; i < 10; i++) {
    const x = 299 + i * 10
    s.linePath(`M${x} 320C${x - 22} 302 ${x - 22} 232 ${x} 217`, '#86522e', 7)
    s.linePath(`M${x} 320C${x - 22} 302 ${x - 22} 232 ${x} 217`, '#e2a966', 3)
  }
  // Rounded enamel bar with coherent lighting, pole labels and a grip hint.
  c.save(); c.translate(mx - 62, cy - 23); c.beginPath(); c.roundRect(0, 0, 124, 46, 9); c.clip()
  const red = c.createLinearGradient(0, 0, 0, 46); red.addColorStop(0, '#ffa08f'); red.addColorStop(0.4, '#e9585f'); red.addColorStop(1, '#a32b47')
  const blue = c.createLinearGradient(0, 0, 0, 46); blue.addColorStop(0, '#c0f3e6'); blue.addColorStop(0.45, '#54b9b8'); blue.addColorStop(1, '#216d86')
  c.fillStyle = blue; c.fillRect(0, 0, 62, 46); c.fillStyle = red; c.fillRect(62, 0, 62, 46)
  s.text('S', 30, 24, 22, '#ffffff', true, 'center'); s.text('N', 94, 24, 22, '#ffffff', true, 'center'); s.linePath('M5 7H119', '#ffffff66', 2); c.restore()
  // Front coil halves correctly occlude the magnet as it enters the solenoid.
  for (let i = 0; i < 10; i++) {
    const x = 299 + i * 10
    s.linePath(`M${x} 217C${x + 22} 231 ${x + 22} 302 ${x} 320`, '#925632', 7)
    s.linePath(`M${x} 217C${x + 22} 231 ${x + 22} 302 ${x} 320`, '#f7c583', 3)
  }
  s.text(`${it.params.turns} turns`, 350, 369, 13, s.muted, false, 'center')
  s.linePath('M311 324V393H173V435M391 323V393H527V435', '#e5b777', 2)
  s.linePath('M83 408H612', s.line)
  for (let i = -3; i <= 3; i++) { const x = magnetCenter(i / 10); s.linePath(`M${x} 403v10`, s.muted); s.text((i / 10).toFixed(1), x, 427, 10, s.muted, false, 'center') }
  s.text('position x / m  ·  coil centre = 0', 350, 454, 12, s.muted, false, 'center')
  s.box(230, 482, 240, 76, s.panel, 14)
  s.text(it.reveal.equations ? 'FARADAY’S LAW' : 'THE CHANGE IS WHAT COUNTS', 250, 503, 10, s.accent, true)
  s.text(it.reveal.equations ? 'ε = −N dΦ/dt' : 'Motion → voltage', 250, 534, 23, s.ink, true)
  s.text('A stationary magnet makes no voltage.', 349, 573, 12, s.muted, false, 'center')
  // Meter needle uses an explicitly bounded visual scale; SI voltage is separate.
  s.box(688, 117, 279, 463)
  s.text('INDUCED VOLTAGE', 710, 140, 11, s.muted, true)
  s.metric('Instantaneous ε', v.emf.toFixed(3), 'V', 708, 169, 237, '#f3bc79')
  c.save(); c.translate(829, 293)
  c.beginPath(); c.arc(0, 0, 82, Math.PI, 2 * Math.PI); c.strokeStyle = s.line; c.lineWidth = 10; c.stroke()
  for (let i = 0; i <= 8; i++) { const a = Math.PI + i * Math.PI / 8; s.linePath(`M${Math.cos(a) * 74} ${Math.sin(a) * 74}L${Math.cos(a) * 88} ${Math.sin(a) * 88}`, s.muted, 1) }
  const a = 1.5 * Math.PI + Math.tanh(v.emf / 0.5) * Math.PI * 0.45
  s.linePath(`M0 0L${Math.cos(a) * 70} ${Math.sin(a) * 70}`, '#f3bc79', 3); s.dot(0, 0, 7, '#f3bc79'); s.text('−', -95, 0, 17, s.muted); s.text('+', 93, 0, 17, s.muted); s.text('0', 0, -97, 11, s.muted, false, 'center'); c.restore()
  s.text('Illustrative meter · needle may saturate', 828, 318, 11, s.muted, false, 'center')
  s.text(`x ${v.x.toFixed(3)} m   ·   v ${v.velocity.toFixed(2)} m/s`, 710, 350, 13, s.ink)
  s.text(`Flux / turn ${(v.flux * 1000).toFixed(3)} mWb`, 710, 372, 12, s.muted)
  s.graph('emf', 'Voltage versus time', 'V', '#f3bc79')
  s.text(it.params.motion === 0 ? 'Auto sweep · grab to record your own' : it.gesture ? 'Your movement · press Play to replay' : 'Grab the magnet to record a movement', 707, 566, 11, s.accent)
}
