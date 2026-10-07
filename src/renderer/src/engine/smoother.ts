/**
 * Speed-adaptive low-pass filter for pen/mouse input (a 2-D "One Euro" filter).
 *
 * Slow, shaky movement is smoothed heavily; fast strokes and sharp turns are
 * followed almost 1:1, so small handwriting keeps its shape.  Both axes share a
 * single cutoff so curves are never distorted.
 */
export class Smoother {
  private s: [number, number, number, number, number] | null = null

  reset(): void {
    this.s = null
  }

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }

  /** `t` in seconds.  `mincut` in Hz: lower = smoother. */
  feed(x: number, y: number, t: number, mincut: number, beta = 0.06): [number, number] {
    if (!this.s) {
      this.s = [x, y, 0, 0, t]
      return [x, y]
    }
    let [px, py, vx, vy, pt] = this.s
    const dt = Math.max(t - pt, 1e-3)
    const ad = Smoother.alpha(1, dt)
    vx += ad * ((x - px) / dt - vx)
    vy += ad * ((y - py) / dt - vy)
    const a = Smoother.alpha(mincut + beta * Math.hypot(vx, vy), dt)
    px += a * (x - px)
    py += a * (y - py)
    this.s = [px, py, vx, vy, t]
    return [px, py]
  }
}

/** Map the 0‥10 "smoothing" setting to a filter cutoff (Hz). */
export function smoothingToCutoff(level: number): number {
  return Math.max(0.35, 3.0 - 0.27 * level)
}
