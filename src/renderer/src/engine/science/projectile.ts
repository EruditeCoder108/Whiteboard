/** Projectile v1. SI translation/energy: x right, y up, level ground y=0, no drag.
 * The launch control stores degrees; trigonometry explicitly converts to radians.
 * Closed forms from NCERT XI Motion in a Plane §3.9, extended to y(0)=height.
 * At landing velocity is the left-hand limit immediately BEFORE impact.
 */
export interface ProjectileParams extends Record<string, number> { speed: number; angle: number; height: number; gravity: number; mass: number }
export const PARAMS = {
  speed: { label: 'Launch speed', unit: 'm/s', min: 0, max: 100, step: 0.1 },
  angle: { label: 'Launch angle', unit: '°', min: 0, max: 90, step: 0.1 },
  height: { label: 'Initial height', unit: 'm', min: 0, max: 100, step: 0.1 },
  gravity: { label: 'Gravity', unit: 'm/s²', min: 0.1, max: 30, step: 0.01 },
  mass: { label: 'Mass', unit: 'kg', min: 0.01, max: 100, step: 0.01 }
} as const
export const DEFAULT_PARAMS: ProjectileParams = { speed: 20, angle: 45, height: 0, gravity: 9.81, mass: 1 }
export function validParams(raw: unknown): raw is ProjectileParams {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const p = raw as Record<string, unknown>
  return Object.keys(p).length === 5 && (Object.keys(PARAMS) as (keyof typeof PARAMS)[]).every(k =>
    typeof p[k] === 'number' && Number.isFinite(p[k]) && (p[k] as number) >= PARAMS[k].min && (p[k] as number) <= PARAMS[k].max)
}
export function flight(p: Readonly<Record<string, number>>): { vx: number; vy0: number; duration: number; apexTime: number; maxHeight: number; range: number } {
  const a = p.angle * Math.PI / 180
  const vx = p.angle === 90 ? 0 : p.speed * Math.cos(a), vy0 = p.speed * Math.sin(a)
  const duration = (vy0 + Math.sqrt(vy0 * vy0 + 2 * p.gravity * p.height)) / p.gravity
  return { vx, vy0, duration, apexTime: vy0 / p.gravity, maxHeight: p.height + vy0 * vy0 / (2 * p.gravity), range: vx * duration }
}
export function evaluate(p: Readonly<Record<string, number>>, time: number) {
  const f = flight(p), t = Math.max(0, Math.min(f.duration, Number.isFinite(time) ? time : 0))
  const x = f.vx * t, y = t === f.duration ? 0 : Math.max(0, p.height + f.vy0 * t - p.gravity * t * t / 2)
  const vy = f.vy0 - p.gravity * t, speed = Math.hypot(f.vx, vy)
  const kinetic = p.mass * speed * speed / 2, potential = p.mass * p.gravity * y
  return { t, x, y, vx: f.vx, vy, speed, kinetic, potential, energy: kinetic + potential, landed: t === f.duration }
}
/** Bounded deterministic graph/trajectory samples, independent of frame rate. */
export function samples(p: Readonly<Record<string, number>>, count = 120) {
  const n = Math.max(2, Math.min(240, Math.round(count))), duration = flight(p).duration
  return Array.from({ length: n + 1 }, (_, i) => evaluate(p, duration * i / n))
}
