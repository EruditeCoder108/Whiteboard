/** Board colours: a hex string, three or six digits. */
export const DEFAULT_BOARD_COLOR = '#ffffff'
export const isBoardColor = (v: unknown): v is string => typeof v === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)

export const luminance = (hex: string): number => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Dark boards get chalk-coloured paper lines and ink. */
export const isDarkColor = (hex: string): boolean => luminance(hex) < 0.45

export const sameColor = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
