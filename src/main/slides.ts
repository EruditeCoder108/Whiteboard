import { execFile } from 'node:child_process'
import { existsSync, promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TIMEOUT = 120_000

const run = (file: string, args: string[], env: Record<string, string> = {}): Promise<boolean> => new Promise(resolve => {
  execFile(file, args, { timeout: TIMEOUT, windowsHide: true, env: { ...process.env, ...env } }, error => resolve(!error))
})

/** PowerPoint, or its WPS twin. The paths travel in the environment, so a file name can never become a command. */
const POWERSHELL = `$ErrorActionPreference='Stop'
foreach ($id in 'PowerPoint.Application','KWPP.Application') {
  if (-not [Type]::GetTypeFromProgID($id)) { continue }
  $app = New-Object -ComObject $id
  try { $deck = $app.Presentations.Open($env:FW_SLIDES_IN, -1, 0, 0); $deck.SaveAs($env:FW_SLIDES_OUT, 32); $deck.Close(); exit 0 } finally { $app.Quit() }
}
exit 3`

const OFFICE_SUITES = ['C:\\Program Files\\LibreOffice\\program\\soffice.exe', 'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe']

/**
 * The slides as a PDF if this PC has something that can draw them exactly. Null when it has not: the
 * renderer then reads the file itself. Everything happens in a private folder that is removed afterwards.
 */
export async function slidesToPdf(bytes: ArrayBuffer, name: string): Promise<ArrayBuffer | null> {
  const ext = /\.ppt$/i.test(name) ? 'ppt' : 'pptx'
  const dir = await fs.mkdtemp(join(tmpdir(), 'fw-slides-'))
  try {
    const input = join(dir, `slides.${ext}`), output = join(dir, 'slides.pdf')
    await fs.writeFile(input, Buffer.from(bytes))
    const viaOffice = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', POWERSHELL], { FW_SLIDES_IN: input, FW_SLIDES_OUT: output })
    if (!viaOffice || !existsSync(output)) {
      const suite = OFFICE_SUITES.find(existsSync)
      if (suite) await run(suite, ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', dir, input])
    }
    if (!existsSync(output)) return null
    const pdf = await fs.readFile(output)
    return pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer
  } catch { return null } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
