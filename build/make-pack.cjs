// Turns a folder of transparent PNG masters into an icon pack: 192 px WebP, trimmed, with an even margin.
// Run: node build/make-pack.cjs <folder of masters> <pack name, e.g. modern>
const fs = require('node:fs'), path = require('node:path'), sharp = require('sharp')
const [masters, pack] = process.argv.slice(2)
if (!masters || !pack) throw Error('Usage: node build/make-pack.cjs <masters> <pack>')
const out = path.resolve(__dirname, '../src/renderer/src/assets/art-' + pack)
;(async () => {
  fs.mkdirSync(out, { recursive: true })
  for (const file of fs.readdirSync(masters).filter(n => n.endsWith('.png'))) {
    const input = path.join(masters, file)
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (const x of [0, info.width - 1]) for (const y of [0, info.height - 1]) if (data[(y * info.width + x) * 4 + 3] !== 0) throw Error(file + ': the corners are not transparent')
    const inner = await sharp(input).trim({ background: '#00000000', threshold: 0 }).resize(176, 176, { fit: 'inside' }).png().toBuffer()
    const im = await sharp(inner).metadata(), target = path.join(out, file.replace(/\.png$/, '.webp'))
    await sharp({ create: { width: 192, height: 192, channels: 4, background: '#00000000' } })
      .composite([{ input: inner, left: (192 - im.width) >> 1, top: (192 - im.height) >> 1 }])
      .webp({ quality: 82, alphaQuality: 100, effort: 6 }).toFile(target)
    if (fs.statSync(target).size > 30000) throw Error(file + ': bigger than 30 KB')
  }
  console.log(fs.readdirSync(out).length + ' icons in ' + out)
})()
