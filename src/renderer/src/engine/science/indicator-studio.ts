import { Studio } from './studio-drawing'
import { indicatorState } from './showcase-models'

const smooth = (v: number): number => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x) }
const palette: [number, [number, number, number]][] = [[2, [228, 96, 142]], [4, [203, 101, 183]], [7, [139, 108, 203]], [8, [77, 151, 201]], [9, [68, 187, 165]], [11, [157, 199, 89]], [14, [228, 202, 94]]]
export function indicatorColour(ph: number): string {
  let i = 1; while (i < palette.length - 1 && palette[i][0] < ph) i++
  const [low, a] = palette[i - 1], [high, b] = palette[i], u = Math.max(0, Math.min(1, (ph - low) / (high - low)))
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * u)).join(',')})`
}
const flaskPath = 'M-13 0L-13 44L-49 103Q-55 118-39 121H39Q55 118 49 103L13 44V0Z'
function flask(s: Studio, x: number, y: number, angle: number, amount: number, fill: string, label: string): void {
  const { c } = s
  c.save(); c.translate(x, y); c.rotate(angle)
  const p = new Path2D(flaskPath)
  c.save(); c.clip(p); c.rotate(-angle)
  // The liquid surface stays level with gravity as the glass rotates.
  const verts = [[-13, 0], [13, 0], [-49, 103], [49, 103], [-39, 121], [39, 121]].map(([x, y]) => y * Math.cos(angle) + x * Math.sin(angle))
  const bottom = Math.max(...verts), top = Math.min(...verts), level = bottom - (bottom - top) * Math.min(0.8, Math.max(0, amount / 150))
  c.globalAlpha *= 0.75; c.fillStyle = fill; c.fillRect(-170, level, 340, 200); c.globalAlpha /= 0.75
  s.linePath(`M-160 ${level}H160`, '#ffffffbb', 2); c.restore()
  const glass = c.createLinearGradient(-50, 0, 50, 0); glass.addColorStop(0, '#d6f2ed33'); glass.addColorStop(0.3, '#ffffff07'); glass.addColorStop(0.8, '#ffffff1b'); glass.addColorStop(1, '#d6f2ed44')
  s.path(flaskPath, glass, s.dark ? '#c6e6e9aa' : '#83a7adaf', 2)
  s.linePath('M-8 8V42L-36 101M-34 114H28M-17 -2H17', s.dark ? '#eefaff99' : '#ffffff', 3)
  c.restore()
  if (Math.abs(angle) < 0.1) { s.pill(label, x - 66, y + 140, 132, s.ink); s.text(`${amount.toFixed(0)} mL left`, x, y + 179, 11, s.muted, false, 'center') }
}
function pose(t: number, start: number, pourStart: number, pourEnd: number, end: number, homeX: number, sign: number): [number, number, number] {
  const u = t < pourStart ? smooth((t - start) / (pourStart - start)) : 1 - smooth((t - pourEnd) / (end - pourEnd))
  return [homeX + (350 - homeX) * u, 310 - 107 * u - 20 * Math.sin(Math.PI * u), sign * 1.95 * u]
}
export function paintIndicator(s: Studio): void {
  const { c, it, time: t } = s, p = it.params, v = indicatorState(p, t), color = indicatorColour(v.ph)
  const stages = ['Materials', 'Add acid', 'Reaction', 'Result'], hints = ['Purple indicator begins in 20 mL water.', 'Acetic acid shifts the indicator towards pink.', 'CO₂ forms while acid and bicarbonate react.', 'Final colour depends on which reactant remains.']
  s.box(31, 117, 634, 463, s.dark ? '#0c222d' : '#edf5ef', 18)
  s.pill(`0${v.stage + 1}   ${stages[v.stage].toUpperCase()}`, 54, 137, 148)
  // A restrained bench and shadows anchor the apparatus in one space.
  s.shadow(350, 439, 220, 20); s.linePath('M61 437H636', s.dark ? '#516866' : '#a9c6b6', 3)
  const ap = pose(t, 1, 2.3, 4.5, 5.6, 127, 1), bp = pose(t, 6, 7.2, 10.8, 12, 566, -1)
  const surface = 424 - v.volume / 250 * 189
  // Streams originate at the moving neck and terminate at the actual meniscus.
  for (const [pt, rate, ink] of [[ap, v.acidRate, '#ffd1d4'], [bp, v.baseRate, '#b4ede7']] as [[number, number, number], number, string][]) {
    if (rate > 0) {
      s.linePath(`M${pt[0]} ${pt[1]}Q${pt[0] + 4} ${pt[1] + 25} 350 ${surface}`, ink, 3 + 3 * rate)
      for (let i = 0; i < 3; i++) { const u = (t * 2.5 + i / 3) % 1; s.dot(350 + Math.sin(u * Math.PI) * 2, pt[1] + (surface - pt[1]) * u, 2, '#ffffffbb') }
    }
  }
  const beaker = new Path2D('M271 231L280 422Q282 432 294 432H408Q420 432 422 422L431 231Z')
  c.save(); c.clip(beaker)
  const wave = Math.sin(t * 6) * (v.acidRate + v.baseRate) * 2
  const liquid = new Path2D(`M270 ${surface}Q310 ${surface + wave} 350 ${surface}Q391 ${surface - wave} 434 ${surface}V433H270Z`)
  c.save(); c.clip(liquid)
  const tint = c.createLinearGradient(280, surface, 421, 433); tint.addColorStop(0, color); tint.addColorStop(1, color)
  c.fillStyle = tint; c.globalAlpha *= 0.8; c.fillRect(269, surface - 3, 166, 438 - surface); c.globalAlpha /= 0.8
  // All bubbles are masked by both the vessel and its current liquid volume.
  const recentGas = v.gas - indicatorState(p, Math.max(0, t - 0.8)).gas
  const activity = Math.min(1, recentGas * 8)
  for (let i = 0; i < 25 && activity > 0; i++) {
    const u = (t * (0.48 + (i % 5) * 0.09) + i * 0.618) % 1, x = 298 + (i * 37 % 102) + Math.sin(t * 2 + i) * 3, y = 423 - u * (423 - surface)
    c.globalAlpha *= activity * (0.3 + 0.7 * (1 - u)); s.dot(x, y, 2 + (i % 4) * 0.8, '#ffffff18', '#e8fcf7cc'); c.globalAlpha /= activity * (0.3 + 0.7 * (1 - u))
  }
  if (v.acidRate + v.baseRate > 0) for (let i = 0; i < 3; i++) { c.save(); c.globalAlpha *= 0.1; s.linePath(`M294 ${surface + 7 + i * 8}Q352 ${surface + 20 + Math.sin(t * 4 + i) * 5} 411 ${surface + 7 + i * 8}`, '#ffffff', 2); c.restore() }
  c.restore(); s.linePath(`M277 ${surface}Q350 ${surface + wave} 426 ${surface}`, '#f8f4ffbb', 2); c.restore()
  const glass = c.createLinearGradient(270, 0, 430, 0); glass.addColorStop(0, '#edf9ff33'); glass.addColorStop(0.25, '#ffffff04'); glass.addColorStop(0.9, '#ffffff04'); glass.addColorStop(1, '#edf9ff44')
  s.path('M271 231L280 422Q282 432 294 432H408Q420 432 422 422L431 231', glass, s.dark ? '#c0dfe8cc' : '#7eaaaf', 2)
  s.linePath('M270 231Q350 240 438 227M281 245L287 413', '#e9ffffaa', 3)
  for (let ml = 50; ml <= 250; ml += 50) { const y = 424 - ml / 250 * 189; s.linePath(`M394 ${y}h18`, s.dark ? '#d0ecebc0' : '#467b83', 1); s.text(String(ml), 390, y, 9, s.dark ? '#edfaff' : '#3e6972', false, 'right') }
  s.text('mL', 407, 222, 10, s.muted)
  flask(s, ...ap, p.acid * (1 - v.acidPour), '#f3b1c6', 'DILUTED VINEGAR')
  flask(s, ...bp, p.base * (1 - v.basePour), '#a4dbdd', 'BAKING SODA')
  s.text('Cabbage indicator', 350, 459, 14, s.ink, true, 'center')
  s.text('Colour is an approximate pH guide', 350, 481, 12, s.muted, false, 'center')
  for (let i = 0; i < 100; i++) { c.fillStyle = indicatorColour(2 + i / 99 * 10); c.fillRect(208 + i * 2.84, 507, 3, 13) }
  const marker = 208 + Math.max(0, Math.min(1, (v.ph - 2) / 10)) * 284
  s.path(`M${marker} 503l-5 -8h10Z`, s.ink)
  s.text('acidic', 208, 538, 11, s.muted); s.text('neutral', 350, 538, 11, s.muted, false, 'center'); s.text('basic', 492, 538, 11, s.muted, false, 'right')
  s.text(hints[v.stage], 350, 570, 12, s.muted, false, 'center')
  s.box(688, 117, 279, 463)
  s.metric('Approximate pH', v.ph.toFixed(2), '', 709, 147, 230, color)
  s.metric('Carbon dioxide formed', v.gas.toFixed(2), 'mmol', 709, 222, 230)
  s.metric('Liquid in beaker', v.volume.toFixed(1), 'mL', 709, 296, 230)
  s.text(it.reveal.equations ? 'Acid + bicarbonate → CO₂ + water' : 'The bubbles contain carbon dioxide.', 709, 354, 12, s.ink)
  s.text(it.reveal.equations ? 'Acetate stays in the solution.' : 'Change the amounts. Compare the result.', 709, 373, 12, s.muted)
  s.graph('ph', 'Colour follows approximate pH', '', color)
  s.text('Use the lesson stops to compare stages.', 709, 568, 11, s.accent)
}
