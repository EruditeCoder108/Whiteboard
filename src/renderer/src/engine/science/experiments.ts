import type { LabItem } from '../types'
import { getModel, modelState, waveAt, apparatusState } from './models'
import { paintBaseball } from './props'
const TAU = Math.PI * 2
const graphCache = new WeakMap<LabItem, number[]>()
const number = (raw: number) => { const n = Math.abs(raw) < 1e-12 ? 0 : raw; return Math.abs(n) >= 1000 || (n !== 0 && Math.abs(n) < 0.01) ? n.toExponential(2) : n.toFixed(2) }

/** All scenes use native Canvas2D at an explicit scientific/illustrative instant. */
export function paintExperiment(ctx: CanvasRenderingContext2D, it: LabItem, time: number): void {
  const m = getModel(it.model)!, p = it.params, t = Math.max(0, Math.min(time, m.duration(p))), state = modelState(m.id, p, t), dark = it.theme === 'blueprint'
  const ink = dark ? '#e5f1f9' : '#22374a', muted = dark ? '#9bb4c8' : '#576c7c', line = dark ? '#284153' : '#dce6e4', cyan = dark ? '#66e6ef' : '#007c88', gold = dark ? '#ffc575' : '#a85c04', rose = dark ? '#f8a0bd' : '#b94269'
  ctx.save(); ctx.translate(it.p[0], it.p[1]); const scale = (it.p[2] - it.p[0]) / 1000; ctx.scale(scale, scale)
  ctx.beginPath(); ctx.roundRect(0, 0, 1000, 640, 22); ctx.clip(); ctx.fillStyle = dark ? '#0c2034' : '#fbfcf8'; ctx.fillRect(0, 0, 1000, 640)
  const text = (s: string, x: number, y: number, size = 15, color = ink, align: CanvasTextAlign = 'left') => { ctx.font = `${size >= 22 ? '600 ' : ''}${size}px "Segoe UI", sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y) }
  const stroke = (x: number, y: number, a: number, b: number, color = line, width = 2) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(a, b); ctx.stroke() }
  const dot = (x: number, y: number, r: number, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill() }
  const box = (x: number, y: number, w: number, h: number, color: string, r = 8) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill() }
  const arrow = (x: number, y: number, a: number, b: number, color = cyan) => { stroke(x, y, a, b, color, 2.5); const angle = Math.atan2(b - y, a - x); stroke(a, b, a - 8 * Math.cos(angle - 0.5), b - 8 * Math.sin(angle - 0.5), color); stroke(a, b, a - 8 * Math.cos(angle + 0.5), b - 8 * Math.sin(angle + 0.5), color) }
  const wrap = (s: string, x: number, y: number, width: number, size = 12, color = muted) => { let row = ''; for (const word of s.split(' ')) { ctx.font = `${size}px "Segoe UI", sans-serif`; if (row && ctx.measureText(`${row} ${word}`).width > width) { text(row, x, y, size, color); y += size * 1.5; row = word } else row += `${row ? ' ' : ''}${word}` } if (row) text(row, x, y, size, color) }
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(1, 1, 998, 638, 22); ctx.stroke()
  text(`${m.subject.toUpperCase()} / ${m.topic.toUpperCase()}`, 30, 28, 12, cyan); text(m.title, 30, 64, 30); text(`t = ${number(t)} s`, 970, 64, 23, cyan, 'right'); stroke(30, 94, 970, 94)
  text(m.question, 30, 122, 20); text('EXPLORE · FREEZE · DRAW', 970, 121, 11, muted, 'right')
  m.readouts.forEach(([key, label, unit], i) => { if (m.id === 'matter' && p.phase !== 2 && key === 'rms') return; text(label.toUpperCase(), 725, 177 + i * 62, 10, muted); text(m.id === 'optics' && state.atFocus ? 'No finite image' : `${number(state[key])}${unit ? ` ${unit}` : ''}`, 725, 201 + i * 62, 22, cyan) })
  ctx.save(); ctx.beginPath(); ctx.rect(35, 150, 650, 355); ctx.clip()
  if (m.id === 'optics') {
    const s = 230 / Math.max(p.distance, p.focal * 2, Math.min(Math.abs(state.image), 1.5)), cx = 340, cy = 357, oh = p.height * s, ox = cx - p.distance * s, sign = p.kind === 0 ? 1 : -1
    stroke(55, cy, 655, cy, muted); text('Optical axis · m', 60, 485, 12, muted)
    for (const side of p.kind === 0 ? [-1, 1] : [-1]) for (const k of [1, 2]) { const x = cx + side * p.focal * s * k; stroke(x, cy - 5, x, cy + 5, muted); text(k === 1 ? 'F' : '2F', x, cy + 18, 12, muted, 'center') }
    ctx.strokeStyle = cyan; ctx.lineWidth = 3; ctx.beginPath(); if (p.kind === 0) { ctx.moveTo(cx, cy - 100); ctx.quadraticCurveTo(cx - 22, cy, cx, cy + 100); ctx.quadraticCurveTo(cx + 22, cy, cx, cy - 100) } else { ctx.moveTo(cx - 14, cy - 100); ctx.quadraticCurveTo(cx + 23, cy, cx - 14, cy + 100) } ctx.stroke()
    arrow(ox, cy, ox, cy - oh, cyan); dot(ox, cy - oh - 6, 4, gold); text('Object', ox, cy + 44, 12, cyan, 'center')
    const progress = Math.min(1, t / 3), end = 270 * progress
    stroke(ox, cy - oh, cx, cy - oh, gold); stroke(cx, cy - oh, cx + sign * end, cy - oh + oh * end / (p.focal * s), gold)
    if (t >= 1) { stroke(ox, cy - oh, cx, cy, rose); stroke(cx, cy, cx + sign * end, cy + oh * end / (p.distance * s), rose) }
    if (!state.atFocus) {
      const ix = cx + sign * state.image * s, iy = cy - state.magnification * oh
      if (state.image < 0) { ctx.setLineDash([5, 5]); stroke(cx, cy - oh, ix, iy, gold); stroke(cx, cy, ix, iy, rose); ctx.setLineDash([]) }
      if (t >= 2) { arrow(ix, cy, ix, iy, gold); text(state.image < 0 ? 'Virtual image' : 'Real image', ix, Math.min(478, Math.max(171, iy - 24)), 12, gold, 'center') }
    } else text('At the focus: outgoing rays are parallel.', 72, 193, 16, gold)
    text(`f = ${number(p.focal)} m · u = ${number(p.distance)} m`, 70, 165, 12, muted)
  } else if (m.id === 'induction') {
    const x = 350 + state.x * 650
    stroke(85, 347, 640, 347, muted); text('−0.30 m', 90, 375, 12, muted); text('+0.30 m', 630, 375, 12, muted, 'right'); text('0', 350, 375, 12, muted, 'center')
    for (let i = 0; i < 6; i++) { ctx.strokeStyle = gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(325 + i * 9, 328, 13, 78, 0, 0, TAU); ctx.stroke() }
    box(x - 53, 310, 106, 36, rose, 6); box(x - 53, 310, 53, 36, cyan, 5); text('S', x - 28, 329, 18, '#0c2034', 'center'); text('N', x + 28, 329, 18, '#0c2034', 'center')
    if (it.reveal.vectors && Math.abs(state.velocity) > 1e-7) arrow(x, 270, x + state.velocity * 80, 270, cyan)
    text(`${p.turns} turns`, 350, 437, 16, gold, 'center'); text('An open coil measures induced voltage.', 350, 465, 13, muted, 'center')
    ctx.globalAlpha *= Math.min(0.3, Math.abs(state.emf)); dot(350, 327, 90, gold); ctx.restore(); ctx.save(); ctx.beginPath(); ctx.rect(35, 150, 650, 355); ctx.clip()
  } else if (m.id === 'circuits') {
    const bulb = (x: number, y: number, power: number, label: string) => {
      ctx.save(); ctx.globalAlpha *= Math.min(0.75, power / 8); dot(x, y, 43, gold); ctx.restore(); dot(x, y, 22, dark ? '#142b3b' : '#fff8e9')
      ctx.strokeStyle = gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.stroke(); stroke(x - 9, y - 9, x + 9, y + 9, gold); stroke(x + 9, y - 9, x - 9, y + 9, gold); text(`${label}: ${number(power)} W`, x, y + 51, 12, gold, 'center')
    }
    const circuit = [[115, 252], [570, 252], [570, 434], [115, 434], [115, 252]]
    circuit.slice(1).forEach((pt, i) => stroke(...circuit[i] as [number, number], ...pt as [number, number], cyan))
    if (p.arrangement) { stroke(115, 343, 570, 343, cyan); bulb(430, 252, state.p1, 'Bulb 1'); bulb(430, 343, state.p2, 'Bulb 2') } else { bulb(280, 252, state.p1, 'Bulb 1'); bulb(470, 252, state.p2, 'Bulb 2') }
    box(95, 391, 40, 41, dark ? '#0c2034' : '#fbfcf8', 0); stroke(94, 401, 136, 401, gold, 3); stroke(102, 419, 128, 419, gold, 3); text('+', 82, 401, 14, gold); text('−', 82, 419, 14, gold)
    if (state.current > 0) for (let i = 0; i < 8; i++) { const phase = ((t * Math.min(1, state.current) * 0.3 + i / 8) % 1) * 4, edge = Math.floor(phase), u = phase % 1; dot(circuit[edge][0] + (circuit[edge + 1][0] - circuit[edge][0]) * u, circuit[edge][1] + (circuit[edge + 1][1] - circuit[edge][1]) * u, 3, gold) }
    text(`${p.voltage} V · ${p.arrangement ? 'parallel' : 'series'}`, 345, 180, 18, ink, 'center'); text('Glow shows power. Dots illustrate conventional current.', 350, 478, 12, muted, 'center')
  } else if (m.id === 'oscillations') {
    stroke(245, 180, 455, 180, muted, 5)
    if (p.kind === 0) {
      const angle = state.q / p.length, x = 350 + 225 * Math.sin(angle), y = 183 + 225 * Math.cos(angle)
      ctx.setLineDash([3, 6]); stroke(350, 183, 350, 437, line); ctx.setLineDash([]); stroke(350, 183, x, y, cyan, 3); paintBaseball(ctx, x, y, 18); text(`L = ${p.length} m`, 390, 292, 14, muted)
    } else {
      const y = 340 + state.q / p.amplitude * 95
      ctx.strokeStyle = cyan; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(350, 184)
      for (let i = 0; i <= 18; i++) ctx.lineTo(350 + (i % 2 ? 15 : -15), 195 + (y - 214) * i / 18)
      ctx.lineTo(350, y); ctx.stroke(); box(320, y, 60, 35, gold); text('Displacement from equilibrium', 350, 477, 13, muted, 'center')
    }
    if (it.reveal.energy) { const total = Math.max(state.energy, 1e-9); box(115, 455, 460, 8, line, 0); box(115, 455, 460 * state.kinetic / total, 8, cyan, 0); text('Kinetic', 115, 478, 12, cyan); text('Potential', 575, 478, 12, gold, 'right') }
  } else if (m.id === 'waves') {
    const gain = 100 / (2 * p.amplitude), cy = 329
    stroke(60, cy, 650, cy, muted); text('x / m →', 646, 480, 12, muted, 'right'); text('Displacement / m', 65, 170, 12, muted)
    for (let i = 0; i <= 6; i++) text(String(i), 60 + i * 96, cy + 20, 11, muted, 'center')
    const path = (kind: number, color: string) => { ctx.strokeStyle = color; ctx.lineWidth = kind === 2 ? 3 : 1.5; ctx.beginPath(); for (let i = 0; i <= 240; i++) { const x = i / 40, a = TAU * (x / p.wavelength - p.frequency * t), y = kind === 2 ? waveAt(p, t, x) : p.amplitude * Math.sin(a + (kind ? p.phase * Math.PI / 180 : 0)); if (!i) ctx.moveTo(60, cy - y * gain); else ctx.lineTo(60 + x * 96, cy - y * gain) } ctx.stroke() }
    path(0, cyan); path(1, rose); path(2, gold); dot(252, cy - waveAt(p, t, 2) * gain, 7, gold)
    text('Wave 1', 95, 459, 13, cyan); text('Wave 2', 262, 459, 13, rose); text('Combined wave', 420, 459, 13, gold)
    text(`Vertical range: ±${number(2 * p.amplitude)} m`, 65, 192, 12, muted)
  } else if (m.id === 'forces') {
    const end = Math.max(1, modelState(m.id, p, m.duration(p)).x), x = 125 + state.x / end * 435
    stroke(80, 412, 640, 412, muted, 3); for (let i = 0; i < 25; i++) stroke(90 + i * 22, 416, 84 + i * 22, 424, line)
    box(x - 42, 360, 85, 33, rose); for (const dx of [-26, 26]) { dot(x + dx, 399, 13, muted); const angle = state.x / 0.07; stroke(x + dx, 399, x + dx + 10 * Math.cos(angle), 399 + 10 * Math.sin(angle), gold) }
    if (it.reveal.vectors) { arrow(x, 337, x + p.force * 5, 337, cyan); arrow(x, 445, x - state.friction * 5, 445, gold) }
    text(`Push ${number(p.force)} N →`, 100, 215, 18, cyan); text(`← Friction ${number(state.friction)} N`, 100, 250, 18, gold); text(state.acceleration === 0 ? 'The cart stays still.' : 'An unbalanced force changes its speed.', 100, 293, 16, ink)
    text('0 m', 95, 476, 12, muted); text(`${number(end)} m`, 630, 476, 12, muted, 'right')
  } else if (m.id === 'matter') {
    ctx.strokeStyle = muted; ctx.lineWidth = 2; ctx.strokeRect(135, 196, 430, 264)
    const count = p.count, columns = Math.ceil(Math.sqrt(count)), motion = Math.sqrt(p.temperature / 300), reflect = (v: number, span: number) => { const a = ((v % (2 * span)) + 2 * span) % (2 * span); return a < span ? a : 2 * span - a }
    for (let i = 0; i < count; i++) {
      let x: number, y: number
      if (p.phase === 0) { x = 172 + i % columns * 350 / columns + Math.sin(t * 5 * motion + i * 2.4) * 3; y = 422 - Math.floor(i / columns) * 170 / columns + Math.cos(t * 5 * motion + i) * 3 }
      else if (p.phase === 1) { x = 149 + reflect(i * 37.7 + t * 15 * motion * Math.sin(i + 1), 402); y = 325 + reflect(i * 23.9 + t * 9 * motion * Math.cos(i + 2), 118) }
      else { x = 149 + reflect(i * 47.7 + t * 43 * motion * Math.sin(i + 1), 402); y = 210 + reflect(i * 33.9 + t * 43 * motion * Math.cos(i + 2), 236) }
      dot(x, y, 7, i % 4 ? cyan : gold)
    }
    text(['SOLID · vibrate around fixed sites', 'LIQUID · move past neighbouring particles', 'GAS · spread throughout the container'][p.phase], 350, 176, 14, cyan, 'center'); text('Particle spacing and motion are illustrative.', 350, 489, 12, muted, 'center')
  } else if (m.id === 'reactions') {
    const molecule = (x: number, y: number, kind: number) => { if (kind === 0) { stroke(x - 9, y, x + 9, y, muted); dot(x - 9, y, 7, '#fff8e9'); dot(x + 9, y, 7, '#fff8e9') } else if (kind === 1) { stroke(x - 11, y, x + 11, y, muted); dot(x - 11, y, 10, rose); dot(x + 11, y, 10, rose) } else { stroke(x, y, x - 15, y + 12, muted); stroke(x, y, x + 15, y + 12, muted); dot(x, y, 11, rose); dot(x - 15, y + 12, 7, '#fff8e9'); dot(x + 15, y + 12, 7, '#fff8e9') } }
    const limit = Math.min(Math.floor(p.hydrogen / 2), p.oxygen), phase = Math.min(limit, t / 5 * limit), completed = Math.floor(phase + 1e-9), fraction = phase - completed, moving = completed < limit && fraction > 0, u = fraction * fraction * (3 - 2 * fraction)
    const counts = [state.hydrogen - (moving ? 2 : 0), state.oxygen - (moving ? 1 : 0), state.water]
    const location = (k: number, i: number): [number, number] => [92 + k * 219 + i % 3 * 44, 248 + Math.floor(i / 3) * 43]
    for (let k = 0; k < 3; k++) { text(['H₂', 'O₂', 'H₂O'][k], 137 + k * 219, 199, 22, k === 2 ? gold : cyan, 'center'); for (let i = 0; i < counts[k]; i++) molecule(...location(k, i), k) }
    if (moving) {
      const oxygen = location(1, counts[1])
      for (let j = 0; j < 2; j++) {
        const hydrogen = location(0, counts[0] + j), water = location(2, counts[2] + j)
        const from = [[oxygen[0] + (j ? 11 : -11), oxygen[1]], [hydrogen[0] - 9, hydrogen[1]], [hydrogen[0] + 9, hydrogen[1]]]
        const to = [[water[0], water[1]], [water[0] - 15, water[1] + 12], [water[0] + 15, water[1] + 12]]
        from.forEach((point, i) => dot(point[0] * (1 - u) + to[i][0] * u, point[1] * (1 - u) + to[i][1] * u - Math.sin(Math.PI * u) * 55, i ? 7 : 10, i ? '#fff8e9' : rose))
      }
    }
    arrow(367, 452, 491, 452, gold); text('Atoms conserved', 95, 456, 16, ink); text(`H: ${state.hAtoms}  ·  O: ${state.oAtoms}`, 95, 481, 13, muted)
  } else if (m.id === 'circulation') {
    // One explicit ordered path: RA, RV, lungs, LA, LV, body, RA.
    const path = [[275, 281], [275, 362], [185, 362], [185, 210], [500, 210], [500, 281], [407, 281], [407, 362], [583, 362], [583, 462], [93, 462], [93, 281], [275, 281]]
    const stageColour = (edge: number) => edge < 4 || edge >= 10 ? cyan : rose
    for (let i = 0; i < path.length - 1; i++) { stroke(...path[i] as [number, number], ...path[i + 1] as [number, number], stageColour(i), 5); if ([1, 3, 5, 7, 9, 11].includes(i)) { const [x, y] = path[i], [a, b] = path[i + 1]; arrow(x * 0.4 + a * 0.6, y * 0.4 + b * 0.6, x * 0.3 + a * 0.7, y * 0.3 + b * 0.7, stageColour(i)) } }
    box(270, 170, 160, 59, dark ? '#183f46' : '#e5f0ec'); text('LUNGS', 350, 189, 16, cyan, 'center'); text('Pick up oxygen', 350, 210, 11, muted, 'center')
    for (const [x, y, label, color] of [[240, 258, 'RA', cyan], [240, 339, 'RV', cyan], [372, 258, 'LA', rose], [372, 339, 'LV', rose]] as const) { box(x, y, 70, 48, dark ? '#203849' : '#e5ebef'); text(label, x + 35, y + 24, 19, color, 'center') }
    box(265, 432, 175, 49, dark ? '#3b283e' : '#f4e7ed'); text('BODY', 352, 446, 16, rose, 'center'); text('Deliver oxygen', 352, 466, 11, muted, 'center')
    for (let i = 0; i < p.cells; i++) { const v = ((t * p.bpm / 60 * 0.14 + i / p.cells) % 1) * (path.length - 1), edge = Math.floor(v), u = v % 1; dot(path[edge][0] * (1 - u) + path[edge + 1][0] * u, path[edge][1] * (1 - u) + path[edge + 1][1] * u, 5, stageColour(edge)) }
    text('Patient-facing left/right: right heart is drawn on your left.', 60, 490, 11, muted)
  } else if (m.id === 'apparatus') {
    const phColour = (ph: number) => ph < 4 ? '#ef709d' : ph < 6 ? '#b584ce' : ph < 7.5 ? '#8d78d5' : ph < 9.5 ? '#55bcc7' : '#83c879', liquid = phColour(state.ph)
    const flask = (x: number, y: number, color: string, remaining: number, tilt: number) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.beginPath(); ctx.moveTo(-13, -61); ctx.lineTo(-13, -29); ctx.lineTo(-44, 30); ctx.quadraticCurveTo(-49, 43, -35, 43); ctx.lineTo(35, 43); ctx.quadraticCurveTo(49, 43, 44, 30); ctx.lineTo(13, -29); ctx.lineTo(13, -61); ctx.closePath(); ctx.save(); ctx.clip(); ctx.fillStyle = color; ctx.fillRect(-55, 42 - 65 * remaining, 110, 70); ctx.restore(); ctx.strokeStyle = '#93baca'; ctx.lineWidth = 2.5; ctx.stroke(); stroke(-18, -61, 18, -61, '#93baca', 3); ctx.restore()
    }
    const acidActive = t > 0 && t < 2, baseActive = t > 2.5 && t < 5.5, acidTilt = acidActive ? 0.55 * Math.sin(Math.PI * t / 2) : 0, baseTilt = baseActive ? -0.55 * Math.sin(Math.PI * (t - 2.5) / 3) : 0
    flask(160, 270, '#efb892', 1 - state.acidPour, acidTilt); flask(525, 270, '#9be2dd', 1 - state.basePour, baseTilt)
    text('DILUTED VINEGAR', 148, 175, 12, gold, 'center'); text(`${p.acid} mL`, 148, 197, 13, muted, 'center'); text('BAKING-SODA SOLUTION', 533, 175, 11, cyan, 'center'); text(`${p.base} mL`, 533, 197, 13, muted, 'center')
    const liquidTop = 455 - state.volume / 250 * 120
    ctx.save(); ctx.beginPath(); ctx.rect(277, 335, 146, 124); ctx.clip(); box(277, liquidTop, 146, 130, liquid, 0)
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { const y = liquidTop + 8 + i * 10 + Math.sin(t * 3 + i) * 3; ctx.beginPath(); ctx.ellipse(348, y, 62, 7, Math.sin(t + i) * 0.12, 0, TAU); ctx.globalAlpha *= 0.8; ctx.stroke() } ctx.restore()
    ctx.strokeStyle = '#93baca'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(273, 330); ctx.lineTo(277, 459); ctx.lineTo(423, 459); ctx.lineTo(427, 330); ctx.stroke()
    for (let ml = 25; ml <= 200; ml += 25) { const y = 455 - ml / 250 * 120; stroke(404, y, 421, y, ink, 1); text(String(ml), 436, y, 9, muted) }
    if (acidActive || baseActive) { const tilt = acidActive ? acidTilt : baseTilt, sourceX = (acidActive ? 160 : 525) + 61 * Math.sin(tilt), sourceY = 270 - 61 * Math.cos(tilt), color = acidActive ? '#efb892' : '#9be2dd'; ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sourceX, sourceY); ctx.quadraticCurveTo(350, sourceY + 30, 350, liquidTop); ctx.stroke() }
    if (baseActive && state.gas - apparatusState(p, t - 0.1).gas > 1e-7) for (let i = 0; i < 14; i++) { const phase = (t * 0.65 + i * 0.173) % 1, x = 300 + (i * 43 % 104); ctx.strokeStyle = '#d9ffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + Math.sin(t * 4 + i) * 3, liquidTop + 60 - phase * 103, 2 + i % 3, 0, TAU); ctx.stroke() }
    const stage = t < 2 ? '1 · Pour the diluted vinegar' : t < 2.5 ? 'Acid turns the indicator pink' : t < 5.5 ? '2 · Add baking-soda solution · CO₂ escapes' : 'Observe the final indicator colour'
    text(stage, 350, 492, 13, ink, 'center'); text('Cabbage indicator · open beaker', 350, 314, 13, muted, 'center')
  }
  ctx.restore()
  if (m.graph && it.reveal.graphs) {
    let values = graphCache.get(it)
    if (!values) { values = Array.from({ length: 121 }, (_, i) => modelState(m.id, p, m.duration(p) * i / 120)[m.graph!.key]); graphCache.set(it, values) }
    const min = Math.min(0, ...values), max = Math.max(0.01, ...values), span = Math.max(0.01, max - min), gx = 738, gy = 480, gw = 220, gh = 95
    text(`${m.graph.label}${m.graph.unit ? ` / ${m.graph.unit}` : ''}`, 725, 359, 12, ink)
    for (let i = 0; i <= 2; i++) { const y = gy - gh * i / 2; stroke(gx, y, gx + gw, y, line, 1); text(number(min + span * i / 2), gx - 4, y, 9, muted, 'right') }
    ctx.strokeStyle = cyan; ctx.lineWidth = 2; ctx.beginPath(); values.forEach((value, i) => { const x = gx + i / 120 * gw, y = gy - (value - min) / span * gh; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y) }); ctx.stroke()
    const x = gx + t / m.duration(p) * gw; ctx.setLineDash([3, 4]); stroke(x, gy - gh, x, gy, rose, 1); ctx.setLineDash([]); dot(x, gy - (state[m.graph.key] - min) / span * gh, 4, rose); text('0 s', gx, 497, 11, muted); text(`${m.duration(p)} s`, gx + gw, 497, 11, muted, 'right')
  } else wrap(m.description, 725, 378, 240, 15, muted)
  stroke(30, 520, 970, 520)
  if (it.reveal.equations) wrap(m.equation, 30, 545, 920, 17, ink)
  else text('Change one thing. Predict what happens. Play and explain.', 30, 545, 16, cyan)
  wrap(m.assumption, 30, 583, 930, 11, muted)
  ctx.restore()
}
