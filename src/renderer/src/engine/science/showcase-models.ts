import type { LabItem, MagnetSample } from '../types'
import type { ModelDefinition, ModelParams, ParamSpec } from './models'
import { apparatusMixture } from './models'

const spec = (label: string, unit: string, min: number, max: number, step = 1): ParamSpec => ({ label, unit, min, max, step })
const smooth = (v: number): number => { const x = Math.max(0, Math.min(1, v)); return x * x * (3 - 2 * x) }
export const SHOWCASE_IDS = ['flux-studio', 'indicator-studio', 'heart-studio'] as const
export const isShowcase = (id: string): boolean => (SHOWCASE_IDS as readonly string[]).includes(id)

/** A recorded position-time trace is an input, not a numerical integrator.
 * Linear segments have an exact derivative; a final stationary segment stops emf.
 */
export function fluxState(p: ModelParams, t: number, trace?: readonly MagnetSample[]): Record<string, number> {
  let x = p.position, velocity = 0
  if (p.motion === 0) {
    const w = 2 * Math.PI / p.period
    x = -0.32 * Math.cos(w * t); velocity = 0.32 * w * Math.sin(w * t)
  } else if (trace?.length) {
    x = trace[trace.length - 1].x
    if (t < trace[0].t) x = trace[0].x
    else if (trace.length >= 2 && t <= trace[trace.length - 1].t) {
      let i = 1
      while (i < trace.length - 1 && trace[i].t < t) i++
      const a = trace[i - 1], b = trace[i], dt = b.t - a.t
      velocity = (b.x - a.x) / dt; x = a.x + velocity * Math.max(0, t - a.t)
    }
  }
  const width = 0.13, flux = p.flux * 0.001 * Math.exp(-((x / width) ** 2))
  return { x, velocity, flux, emf: velocity === 0 ? 0 : 2 * p.turns * flux * x * velocity / width ** 2 }
}
export function indicatorState(p: ModelParams, t: number): Record<string, number> {
  return { ...apparatusMixture(p, smooth((t - 2.3) / 2.2), smooth((t - 7.2) / 3.6)),
    stage: t < 1 ? 0 : t < 5.6 ? 1 : t < 12 ? 2 : 3,
    acidRate: t > 2.3 && t < 4.5 ? 6 * ((t - 2.3) / 2.2) * (1 - (t - 2.3) / 2.2) / 2.2 : 0,
    baseRate: t > 7.2 && t < 10.8 ? 6 * ((t - 7.2) / 3.6) * (1 - (t - 7.2) / 3.6) / 3.6 : 0 }
}
export const HEART_STAGES = ['Fill', 'Atrial squeeze', 'Eject', 'Relax'] as const
export function heartState(p: ModelParams, t: number): Record<string, number> {
  const beats = t * p.bpm / 60, phase = beats - Math.floor(beats)
  const stage = phase < 0.45 ? 0 : phase < 0.55 ? 1 : phase < 0.9 ? 2 : 3
  // Normalised pedagogical filling, not a patient volume/pressure waveform.
  const fill = stage === 0 ? 0.35 + 0.5 * smooth(phase / 0.45) : stage === 1 ? 0.85 + 0.15 * smooth((phase - 0.45) / 0.1) : stage === 2 ? 1 - 0.65 * smooth((phase - 0.55) / 0.35) : 0.35
  return { beats, phase, stage, fill, avOpen: Number(stage < 2), outflowOpen: Number(stage === 2 && phase > 0.59 && phase < 0.86), bpm: p.bpm }
}
export const SHOWCASE_MODELS: readonly ModelDefinition[] = [
  { id: 'flux-studio', title: 'Induction studio', subject: 'physics', topic: 'Electricity', question: 'Make a voltage with your own hand.', description: 'Drag the magnet, reverse direction, then replay your movement beside a live voltage graph.', assumption: 'SI units. Prescribed Gaussian flux per turn (width 0.13 m); exact Faraday derivative for that envelope. Recorded hand motion is piecewise linear. No 3D field solver, circuit load or calibrated galvanometer.', equation: 'ε = −N dΦ/dt   ·   Φ = Φ₀ exp[−(x/0.13 m)²]', params: { turns: spec('Coil turns', '', 10, 200), flux: spec('Peak flux per turn', 'mWb', 0.1, 10, 0.1), motion: { ...spec('Magnet motion', '', 0, 1), choices: [{ value: 0, label: 'Automatic sweep' }, { value: 1, label: 'Your recorded movement' }] }, period: spec('Sweep period', 's', 1, 8, 0.1), position: spec('Resting position', 'm', -0.34, 0.34, 0.01) }, defaults: { turns: 60, flux: 2, motion: 0, period: 4, position: -0.32 }, duration: () => 8, state: fluxState, readouts: [['x', 'Position', 'm'], ['velocity', 'Velocity', 'm/s'], ['emf', 'Voltage', 'V']], graph: { key: 'emf', label: 'Induced voltage', unit: 'V' } },
  { id: 'indicator-studio', title: 'Colour chemistry studio', subject: 'chemistry', topic: 'Reactions', question: 'Follow the pour. Explain the colour.', description: 'Pour diluted vinegar and baking-soda solution into cabbage indicator, with glass apparatus, continuous colours and a contained bubble plume.', assumption: 'Dilute ideal solutions at 25°C; instant mixing and stoichiometry, CO₂ escapes. Starts with 20 mL indicator in water. Approximate equilibrium pH; cabbage colours, fluid motion and timing are illustrations, not a fluid/kinetics solver.', equation: 'CH₃COOH + NaHCO₃ → CH₃COONa + CO₂↑ + H₂O', params: { acid: spec('Diluted vinegar', 'mL', 5, 100), base: spec('Baking-soda solution', 'mL', 5, 100), concentration: spec('Both solution strengths', 'mol/L', 0.01, 0.2, 0.01) }, defaults: { acid: 30, base: 50, concentration: 0.1 }, duration: () => 16, state: indicatorState, readouts: [['ph', 'Approx. pH', ''], ['gas', 'CO₂ formed', 'mmol'], ['volume', 'Liquid', 'mL']], graph: { key: 'ph', label: 'Approximate pH', unit: '' } },
  { id: 'heart-studio', title: 'Inside the heartbeat', subject: 'biology', topic: 'Living systems', question: 'Four chambers. Two loops. One heartbeat.', description: 'Explore an illustrated heart cutaway with moving valve leaflets and guided circulation.', assumption: 'Human anatomy teaching illustration; viewer left is the person’s right. Phase durations, chamber filling and flow markers are qualitative, not a haemodynamic or diagnostic model. Dark red = oxygen-poor, bright red = oxygen-rich. Blood is always red.', equation: 'Body → right heart → lungs → left heart → body', params: { bpm: spec('Illustrative heartbeat', 'beats/min', 40, 120), focus: { ...spec('Flow focus', '', 0, 2), choices: [{ value: 0, label: 'Both circuits' }, { value: 1, label: 'Heart → lungs' }, { value: 2, label: 'Heart → body' }] } }, defaults: { bpm: 60, focus: 0 }, duration: p => 240 / p.bpm, state: heartState, readouts: [['bpm', 'Heartbeat', 'beats/min'], ['beats', 'Beat cycles', ''], ['fill', 'Illustrative filling', 'fraction']], graph: { key: 'fill', label: 'Illustrative ventricular filling', unit: 'fraction' } }
]
export function validMagnetTrace(raw: unknown): raw is MagnetSample[] {
  return Array.isArray(raw) && raw.length >= 2 && raw.length <= 800 && raw.every((p, i) => p && typeof p === 'object' && Object.keys(p).length === 2 && Number.isFinite(p.t) && Number.isFinite(p.x) && p.x >= -0.34 && p.x <= 0.34 && p.t >= 0 && p.t <= 30 && (i === 0 ? p.t === 0 : p.t > raw[i - 1].t))
}
export const magnetCenter = (x: number): number => 350 + x * 700
export const magnetPosition = (x: number): number => Math.max(-0.34, Math.min(0.34, (x - 350) / 700))
export function labDuration(it: Pick<LabItem, 'model' | 'params' | 'gesture'>, fallback: number): number {
  return it.model === 'flux-studio' && it.params.motion === 1 && it.gesture?.length ? it.gesture[it.gesture.length - 1].t + 0.25 : fallback
}
