import { Studio } from './studio-drawing'
import { heartState, HEART_STAGES } from './showcase-models'

const rich = '#f77c72', poor = '#aa637e', wall = '#c36069'
function valve(s: Studio, x: number, y: number, open: boolean, width = 32, angle = 0): void {
  const { c } = s; c.save(); c.translate(x, y); c.rotate(angle)
  s.linePath(`M${-width / 2 - 5} 0h5M${width / 2} 0h5`, '#ffdfc5', 4)
  const gap = open ? width * 0.31 : 0, drop = open ? 19 : 5
  s.linePath(`M${-width / 2} 0Q${-width / 3} ${drop} ${-gap} ${drop}M${width / 2} 0Q${width / 3} ${drop} ${gap} ${drop}`, '#ffe7ca', 3)
  c.restore()
}
function route(s: Studio, d: string, color: string, active: boolean, points: [number, number][], speed: number): void {
  const { c } = s; c.save(); c.globalAlpha *= active ? 1 : 0.18
  s.linePath(d, s.dark ? '#071a25' : '#e2eae3', 17); s.linePath(d, color, 10); s.linePath(d, '#ffffff22', 2)
  // Constant arc-length markers illustrate direction, not measured cell speed.
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1])), total = lengths.reduce((a, b) => a + b, 0)
  for (let j = 0; j < 5; j++) {
    let pos = ((s.time * speed + j / 5) % 1) * total, i = 0
    while (i < lengths.length - 1 && pos > lengths[i]) { pos -= lengths[i]; i++ }
    const u = pos / lengths[i], a = points[i], b = points[i + 1]
    s.dot(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 3, '#fff3df')
  }
  c.restore()
}
export function paintHeart(s: Studio): void {
  const { c, it, time: t } = s, v = heartState(it.params, t), phase = v.stage, lungsActive = it.params.focus !== 2, bodyActive = it.params.focus !== 1
  s.box(31, 117, 634, 463, s.dark ? '#0c222d' : '#edf5ef', 18)
  s.pill('ANATOMY CUTAWAY   ·   FRONT VIEW', 54, 137, 270)
  s.text('Person’s right', 213, 196, 10, s.muted, false, 'center'); s.text('Person’s left', 532, 191, 10, s.muted, false, 'center')
  // Two external circuits around the heart. Dark and bright red encode O₂.
  route(s, 'M321 243L160 243L160 481L222 481', poor, bodyActive, [[222,481],[160,481],[160,243],[321,243]], 0.16)
  route(s, 'M427 258L427 209L579 209L579 502L224 502', rich, bodyActive, [[427,258],[427,209],[579,209],[579,502],[224,502]], 0.16)
  route(s, 'M351 249L351 181L391 181', poor, lungsActive, [[351,249],[351,181],[391,181]], 0.4)
  route(s, 'M471 181L484 181L484 251', rich, lungsActive, [[471,181],[484,181],[484,251]], 0.4)
  c.save(); c.globalAlpha *= bodyActive ? 1 : 0.2
  // A capillary exchange patch joins arterial supply to venous return.
  for (const [x, y] of [[236,480],[254,485],[251,505],[234,510]]) {
    s.path(`M${x - 7} ${y - 8}l8 -3 9 6 -2 10 -9 3 -7 -6Z`, s.dark ? '#78837a44' : '#d1d6c3', '#b7bba388', 1)
    s.dot(x, y, 2.5, s.dark ? '#c1bdb977' : '#829384')
  }
  s.linePath('M222 502Q250 499 237 489Q232 481 222 481', '#d18180', 4); c.restore()
  // Lung silhouette and branching bronchi are an illustration, not extra boxes.
  c.save(); c.globalAlpha *= lungsActive ? 1 : 0.35
  s.path('M427 140C408 139 399 143 392 158C381 180 388 190 411 186L430 176Z', s.dark ? '#bf9da640' : '#d6b9bd', '#c78d9c', 1.5)
  s.path('M443 140C462 139 470 147 475 161C483 181 474 191 454 185L440 177Z', s.dark ? '#bf9da640' : '#d6b9bd', '#c78d9c', 1.5)
  s.linePath('M436 136V155M436 153L409 171M436 153L457 171M416 166L403 178M450 165L462 178', '#d9c1b6', 2)
  s.text('LUNGS · gain oxygen', 435, 126, 10, s.muted, true, 'center'); c.restore()
  // Vessels behind the cutaway. Pulmonary artery is oxygen-poor despite its name.
  s.linePath('M304 265V208M300 329L279 444', poor, 28)
  s.linePath('M353 307L352 213L381 184', poor, 26)
  s.linePath('M427 298L427 230Q427 199 452 214L469 240', rich, 30)
  s.linePath('M486 242L459 261', rich, 20)
  s.shadow(402, 485, 145, 17)
  const muscle = c.createLinearGradient(244, 214, 509, 477); muscle.addColorStop(0, '#e79791'); muscle.addColorStop(0.4, '#c76c77'); muscle.addColorStop(1, '#8e435c')
  s.path('M292 224C245 222 239 249 250 297C225 335 252 403 305 439C340 464 391 491 443 489C470 470 505 415 516 366C530 315 516 268 493 246C470 222 456 226 432 232C409 218 390 221 366 237C342 225 315 222 292 224Z', muscle, '#f0b0a9', 2)
  // Four cavities with a thick muscular septum and a substantially thicker LV wall.
  const atrialScale = phase === 1 ? 1 - Math.sin((v.phase - 0.45) / 0.1 * Math.PI) * 0.1 : 1
  c.save(); c.translate(294, 277); c.scale(atrialScale, atrialScale); c.translate(-294, -277)
  s.path('M291 241C257 240 256 265 267 292C280 312 310 311 326 296C338 277 329 246 310 244Z', '#633448', '#e79a9d', 2); c.restore()
  c.save(); c.translate(456, 279); c.scale(atrialScale, atrialScale); c.translate(-456, -279)
  s.path('M450 246C430 249 421 271 429 293C443 309 475 310 490 291C499 264 477 244 450 246Z', '#963e50', '#efb2a3', 2); c.restore()
  const contraction = 1 - v.fill
  c.save(); c.translate(332, 371); c.scale(1 - contraction * 0.11, 1 - contraction * 0.055); c.translate(-332, -371)
  s.path('M288 314C269 338 271 378 301 409C326 433 354 451 390 459C370 418 374 357 346 325C330 310 307 310 288 314Z', '#70354b', '#e1979c', 2)
  s.path('M301 326Q283 355 300 383M311 399L349 426M334 329Q354 362 351 396', '#8b4a5c', '#bb7183', 1.5)
  c.restore()
  c.save(); c.translate(448, 380); c.scale(1 - contraction * 0.13, 1 - contraction * 0.055); c.translate(-448, -380)
  s.path('M415 318C396 347 395 392 410 438L438 466C466 440 483 397 486 362C485 333 469 315 446 315Z', '#aa4657', '#ffc1a7', 3)
  s.path('M426 329Q408 361 423 405M447 437Q469 400 472 363M435 341L448 391', '#b45062', '#dc7c7c', 2)
  // Chordae attach AV leaflets to papillary muscles; outflow valves have no chordae.
  s.linePath('M423 321L433 376L449 324M457 325L466 374L472 321', '#f6c3aa88', 1)
  c.restore()
  s.linePath('M289 320L313 366L331 320', '#efc5b688', 1)
  s.path('M351 305Q383 312 397 345Q391 397 403 453L425 476Q396 419 409 375Q419 342 430 308Z', wall, '#ed9a96', 2)
  // Blood flow through the openings and the two ascending outflow tracts.
  s.linePath('M336 359Q351 342 352 284', poor, 12); s.linePath('M448 356Q425 332 429 282', rich, 12)
  valve(s, 305, 313, !!v.avOpen, 44, -0.12); valve(s, 451, 314, !!v.avOpen, 40, 0.04)
  valve(s, 352, 290, !!v.outflowOpen, 23, Math.PI); valve(s, 429, 289, !!v.outflowOpen, 23, Math.PI)
  if (v.avOpen && it.reveal.vectors) { s.arrow(296, 276, 4, 58, poor, 3); s.arrow(453, 275, -4, 62, rich, 3) }
  if (v.outflowOpen && it.reveal.vectors) { s.arrow(331, 369, 15, -60, poor, 3); s.arrow(447, 369, -17, -60, rich, 3) }
  s.text('RA', 293, 269, 16, '#fff0e7', true, 'center'); s.text('LA', 456, 272, 16, '#fff0e7', true, 'center')
  s.text('RV', 325, 386, 20, '#fff0e7', true, 'center'); s.text('LV', 447, 401, 20, '#fff0e7', true, 'center')
  // Compact callouts with visible leader lines; all four chambers stay labelled.
  s.linePath('M243 270H203M252 365H202M500 267H537M499 400H538', s.muted, 1)
  s.text('Right atrium', 199, 270, 11, s.ink, false, 'right'); s.text('Right ventricle', 199, 365, 11, s.ink, false, 'right')
  s.text('Left atrium', 541, 267, 11, s.ink); s.text('Left ventricle', 541, 400, 11, s.ink)
  s.text('Body tissues', 219, 527, 11, s.ink, true, 'center'); s.text('deliver O₂ · collect CO₂', 219, 547, 10, s.muted, false, 'center')
  s.dot(93, 569, 4, poor); s.text('oxygen-poor', 105, 569, 11, s.muted); s.dot(215, 569, 4, rich); s.text('oxygen-rich', 227, 569, 11, s.muted)
  s.text('Blood is always red.', 633, 569, 11, s.muted, false, 'right')
  s.box(688, 117, 279, 463)
  s.text('ONE BEAT · FOUR STAGES', 709, 144, 11, s.muted, true)
  for (let i = 0; i < 4; i++) {
    const y = 174 + i * 39
    s.box(707, y - 13, 241, 31, i === phase ? s.dark ? '#28524e' : '#d8eee4' : s.panel, 8, '')
    s.dot(723, y + 2, 8, i === phase ? s.accent : s.line); s.text(String(i + 1), 723, y + 2, 9, i === phase ? '#123535' : s.muted, true, 'center')
    s.text(HEART_STAGES[i], 741, y + 2, 14, i === phase ? s.accent : s.muted, i === phase)
  }
  const descriptions = [['Blood enters relaxed ventricles.', 'AV valves open; outflow valves close.'], ['Atria complete ventricular filling.', 'AV valves remain open.'], ['Ventricles contract and eject blood.', 'AV close; outflow valves open briefly.'], ['Ventricles relax before refilling.', 'All valves close during this transition.']]
  s.text(descriptions[phase][0], 710, 333, 12, s.ink); s.text(descriptions[phase][1], 710, 354, 11, s.muted)
  s.text(`${it.params.bpm} beats/min  ·  beat ${Math.min(4, Math.floor(v.beats) + 1)} / 4`, 710, 377, 12, s.accent)
  s.graph('fill', 'Illustrative ventricular filling', 'fraction', rich)
  s.text(it.reveal.equations ? 'Body → right → lungs → left → body' : 'AV = tricuspid + mitral valves', 710, 568, 11, s.muted)
}
