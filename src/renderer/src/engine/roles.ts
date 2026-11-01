/**
 * A tool per input: the thin tip, the thick end and a finger can each be their own tool and colour, so
 * turning the stylus around changes colour. Most classroom panels are IR and report every contact as a
 * touch, so the three are told apart by how big the contact is on this particular screen.
 */
export type InputKind = 'tip' | 'thick' | 'finger'
export type InputRole = 'same' | 'pen' | 'marker' | 'eraser' | 'move'

export const INPUT_ROLES: InputRole[] = ['same', 'pen', 'marker', 'eraser', 'move']
export const isInputRole = (v: unknown): v is InputRole => INPUT_ROLES.includes(v as InputRole)

/** A real stylus is always the tip (its eraser end already erases). With no measurements, every touch is a finger. */
export function inputKind(type: 'pen' | 'touch' | 'mouse', size: number, tipMax: number, thickMax: number): InputKind | null {
  if (type === 'mouse') return null
  if (type === 'pen') return 'tip'
  if (!size) return 'finger'
  if (tipMax && size <= tipMax) return 'tip'
  if (thickMax && size <= thickMax) return 'thick'
  return 'finger'
}

/** The contacts must really differ (by a fifth or more) or the board would keep guessing wrong. Limits sit between them. */
export function contactLimits(tip: number, thick: number, finger: number): { tipMax: number; thickMax: number } | null {
  if (!(tip > 0) || thick < tip * 1.2 || finger < thick * 1.2) return null
  return { tipMax: Math.round(Math.sqrt(tip * thick) * 10) / 10, thickMax: Math.round(Math.sqrt(thick * finger) * 10) / 10 }
}

/** Only while writing: with Select, Text or a shape in hand, every input does what the toolbar says. */
export const rolesApply = (tool: string): boolean => tool === 'pen' || tool === 'marker' || tool === 'eraser'
