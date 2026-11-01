import { app, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

/** Keep manual export and phone sharing on the same landscape A4 pipeline. */
export async function pagesToPdf(pages: ArrayBuffer[]): Promise<Buffer> {
  const dir = await fs.mkdtemp(join(app.getPath('temp'), 'whiteboard-pdf-'))
  const printer = new BrowserWindow({ show: false, webPreferences: { offscreen: false, javascript: false } })
  try {
    await Promise.all(pages.map((png, i) => fs.writeFile(join(dir, `page-${i + 1}.png`), Buffer.from(png))))
    const html = `<!doctype html><meta charset="utf-8"><style>@page{size:A4 landscape;margin:0}html,body{margin:0}.page{width:297mm;height:210mm;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}img{max-width:285mm;max-height:198mm;object-fit:contain}</style>${pages.map((_, i) => `<div class="page"><img src="page-${i + 1}.png"></div>`).join('')}`
    await fs.writeFile(join(dir, 'index.html'), html, 'utf8')
    await printer.loadFile(join(dir, 'index.html'))
    return await printer.webContents.printToPDF({ landscape: true, pageSize: 'A4', printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } })
  } finally {
    printer.destroy()
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
