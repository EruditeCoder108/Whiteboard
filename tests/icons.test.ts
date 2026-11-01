import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const folder = resolve('src/renderer/src/assets/art')
const icons = readFileSync(resolve('src/renderer/src/ui/icons.tsx'), 'utf8')
const names = JSON.parse(icons.match(/export const artNames = (\[[^\n]+\]) as const/)![1]) as string[]
describe('committed teaching art', () => {
  it('has a real file and exported mapping for every picture, including reserved tools', () => {
    expect(readdirSync(folder).filter(n => n.endsWith('.webp')).sort()).toEqual(names.map(n => n + '.webp').sort())
    for (const name of names) expect(icons).toContain("art('" + name + "'")
  })
  it('stays inside the image size budget', () => {
    const sizes = names.map(n => statSync(resolve(folder, n + '.webp')).size)
    expect(sizes.reduce((a,b) => a+b,0)).toBeLessThan(3000000)
    names.forEach((n,i) => { if (!/^(empty|welcome)-/.test(n)) expect(sizes[i]).toBeLessThanOrEqual(30000) })
  })
  it('has real transparent corners and the correct output dimensions', async () => {
    for (const name of names) {
      const { data, info } = await sharp(resolve(folder, name + '.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      expect([info.width, info.height]).toEqual(/^(empty|welcome)-/.test(name) ? [640,360] : [192,192])
      for (const x of [0,info.width-1]) for (const y of [0,info.height-1]) expect(data[(y*info.width+x)*4+3]).toBe(0)
    }
  })
})
