import { compile } from './graph'

/**
 * The classroom calculator's sums, written as teachers read them: 2 × (3 + 4), √(16), sin(30), 15%.
 * Trigonometry is in degrees, as in school. A sum still being typed may leave its last brackets open.
 */
export function calculate(sum: string): number | null {
  let text = sum.trim()
  if (!text) return null
  text = text.replace(/√/g, 'sqrt').replace(/%/g, '/100')
  const open = (text.match(/\(/g) ?? []).length - (text.match(/\)/g) ?? []).length
  if (open < 0) return null
  text += ')'.repeat(open)
  text = inDegrees(text)
  const fn = compile(text)
  if (!fn) return null
  const value = fn(0)
  return Number.isFinite(value) ? Number(value.toPrecision(12)) : null
}

/** sin(30) → sin((pi/180)*(30)), bracket by bracket so that sin(30 + 15) stays one angle. */
function inDegrees(text: string): string {
  let out = ''
  for (let i = 0; i < text.length;) {
    const name = /^(sin|cos|tan)\(/i.exec(text.slice(i))
    if (!name) { out += text[i++]; continue }
    const start = i + name[0].length
    let depth = 1, end = start
    while (end < text.length && depth) { if (text[end] === '(') depth++; else if (text[end] === ')') depth--; end++ }
    out += `${name[1]}((pi/180)*(${inDegrees(text.slice(start, end - 1))}))`
    i = end
  }
  return out
}

/** Numbers as a teacher would write them: no 0.30000000000000004, a thin group-free plain form. */
export const showNumber = (v: number): string => String(v).replace('-', '−')
