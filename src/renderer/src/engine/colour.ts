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

/** How well one colour reads on another: 1 (the same) to 21 (black on white), the usual WCAG measure. */
export const contrastRatio = (a: string, b: string): number => {
  const linear = (hex: string): number => {
    const [r, g, b] = hexRgb(hex).split(',').map(v => { const c = Number(v) / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 })
    return .2126 * r + .7152 * g + .0722 * b
  }
  const la = linear(a), lb = linear(b)
  return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05)
}

/** Dark boards get chalk-coloured paper lines and ink. */
export const isDarkColor = (hex: string): boolean => luminance(hex) < 0.45

export const sameColor = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/** '#2f6bff' → '47,107,255', for rgba() with an alpha of its own. */
export const hexRgb = (hex: string): string => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)).join(',')
}
