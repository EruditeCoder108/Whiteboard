/** What is in a vessel: strong acid and alkali by amount, so a titration's pH comes out of the sums rather than a script. */
export interface Liquid { ml: number; acid: number; base: number; indicator: number; dye: number; temp: number }

export const CONTENTS: { name: string; acid: number; base: number; dye: number }[] = [
  { name: 'Water', acid: 0, base: 0, dye: 0 },
  { name: 'Dilute acid (HCl)', acid: .1, base: 0, dye: 0 },
  { name: 'Dilute alkali (NaOH)', acid: 0, base: .1, dye: 0 },
  { name: 'Copper sulphate', acid: 0, base: 0, dye: 1 },
  { name: 'Potassium permanganate', acid: 0, base: 0, dye: 2 }
]
export const INDICATORS = ['None', 'Litmus', 'Phenolphthalein', 'Methyl orange', 'Universal']
const DYES = ['', '#2f7fd6', '#7b1fa2']

/** pH from what is left after acid and alkali have neutralised each other. Amounts are in millimoles. */
export function phOf(acid: number, base: number, ml: number): number {
  if (ml <= 0) return 7
  const net = (acid - base) / ml // moles per litre
  if (Math.abs(net) < 1e-7) return 7
  const ph = net > 0 ? -Math.log10(net) : 14 + Math.log10(-net)
  return Math.max(0, Math.min(14, ph))
}

const hex = (c: number[]): string => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const rgb = (h: string): number[] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number): string => { const x = rgb(a), y = rgb(b), k = Math.max(0, Math.min(1, t)); return hex(x.map((v, i) => v + (y[i] - v) * k)) }

const UNIVERSAL: [number, string][] = [[0, '#c0152a'], [3, '#f0562b'], [5, '#f7b731'], [7, '#3fae49'], [9, '#2d8fd5'], [11, '#3b4fc4'], [14, '#6a2bb0']]
export const universalColor = (ph: number): string => {
  for (let i = 1; i < UNIVERSAL.length; i++) if (ph <= UNIVERSAL[i][0]) {
    const [p0, c0] = UNIVERSAL[i - 1], [p1, c1] = UNIVERSAL[i]
    return mix(c0, c1, (ph - p0) / (p1 - p0))
  }
  return UNIVERSAL[UNIVERSAL.length - 1][1]
}

/** The colour of a liquid, and how strongly it shows. Clear liquids stay faint so the glass reads as glass. */
export function liquidColor(l: Pick<Liquid, 'ml' | 'acid' | 'base' | 'indicator' | 'dye'>): { color: string; alpha: number } {
  const ph = phOf(l.acid, l.base, l.ml)
  switch (l.indicator) {
    case 1: return ph < 5 ? { color: '#d93a4a', alpha: .82 } : ph > 8 ? { color: '#3460d8', alpha: .82 } : { color: mix('#d93a4a', '#3460d8', (ph - 5) / 3), alpha: .82 }
    case 2: { const t = (ph - 8.2) / 1.8; return t <= 0 ? { color: '#dfeefb', alpha: .45 } : { color: '#e8368f', alpha: .3 + .55 * Math.min(1, t) } }
    case 3: return ph < 3.1 ? { color: '#d9302a', alpha: .85 } : ph > 4.4 ? { color: '#f2b705', alpha: .85 } : { color: mix('#d9302a', '#f2b705', (ph - 3.1) / 1.3), alpha: .85 }
    case 4: return { color: universalColor(ph), alpha: .85 }
  }
  if (l.dye && DYES[l.dye]) return { color: DYES[l.dye], alpha: .8 }
  return { color: '#bcdcf2', alpha: .55 }
}

/** Part of one vessel into another. Amounts travel with the volume, and temperatures mix. */
export function pour<T extends Liquid>(from: T, into: T, ml: number): void {
  const moved = Math.min(ml, from.ml)
  if (moved <= 0) return
  const share = moved / from.ml
  const acid = from.acid * share, base = from.base * share
  into.temp = (into.temp * into.ml + from.temp * moved) / (into.ml + moved)
  into.ml += moved; into.acid += acid; into.base += base
  from.ml -= moved; from.acid -= acid; from.base -= base
  // Strong acid and alkali react: only what is left over counts from here on.
  const gone = Math.min(into.acid, into.base)
  into.acid -= gone; into.base -= gone
  if (from.dye && !into.dye) into.dye = from.dye
  if (from.indicator && !into.indicator) into.indicator = from.indicator
}

const SHELL_ORDER = [[1, 2], [2, 2], [2, 6], [3, 2], [3, 6], [4, 2], [3, 10], [4, 6]]

/** Electrons in each shell, up to krypton: the part of the table school lessons draw as shells. */
export function shellsOf(z: number): number[] {
  // Chromium and copper take one from their fourth shell: half full and full third-shell d orbitals are more stable.
  if (z === 24) return [2, 8, 13, 1]
  if (z === 29) return [2, 8, 18, 1]
  const shells: number[] = []
  let left = Math.max(0, Math.min(36, Math.round(z)))
  for (const [n, room] of SHELL_ORDER) {
    if (!left) break
    const take = Math.min(left, room)
    while (shells.length < n) shells.push(0)
    shells[n - 1] += take
    left -= take
  }
  return shells
}
