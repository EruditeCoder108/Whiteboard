import type { LabItem } from '../types'
import { labDuration } from './models'
import { Studio } from './studio-drawing'
import { paintFlux } from './flux-studio'
import { paintIndicator } from './indicator-studio'
import { paintHeart } from './heart-studio'

export function paintShowcase(c: CanvasRenderingContext2D, it: LabItem, time: number): void {
  const s = new Studio(c, it, Math.max(0, Math.min(labDuration(it), time)))
  try {
    if (it.model === 'flux-studio') paintFlux(s)
    else if (it.model === 'indicator-studio') paintIndicator(s)
    else paintHeart(s)
  } finally { s.finish() }
}
