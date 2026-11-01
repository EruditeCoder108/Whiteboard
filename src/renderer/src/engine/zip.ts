/** Just enough of the ZIP format to open a PowerPoint or OpenBoard file. Nothing is ever written to disk from one. */
const MAX_ENTRIES = 20000
const MAX_TOTAL = 800 * 1024 * 1024

export interface ZipEntry { name: string; read(): Promise<Uint8Array> }

async function inflate(data: Uint8Array, expected: number): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const parts: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    // A file that swells past what it declared is not one to keep reading.
    if (total > expected + 1024) { void reader.cancel(); throw new Error('This file is damaged.') }
    parts.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

export function readZip(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break }
  if (end < 0) throw new Error('This is not a file we can open.')
  const count = view.getUint16(end + 10, true)
  if (count > MAX_ENTRIES) throw new Error('This file has too many parts.')
  const entries = new Map<string, ZipEntry>()
  const names = new TextDecoder()
  let at = view.getUint32(end + 16, true), declared = 0
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new Error('This file is damaged.')
    const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true), full = view.getUint32(at + 24, true)
    const nameLength = view.getUint16(at + 28, true), extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true), local = view.getUint32(at + 42, true)
    const name = names.decode(bytes.subarray(at + 46, at + 46 + nameLength))
    declared += full
    if (declared > MAX_TOTAL) throw new Error('This file is too large to open.')
    if (!name.endsWith('/') && (method === 0 || method === 8)) {
      entries.set(name, {
        name,
        read: async () => {
          if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) throw new Error('This file is damaged.')
          const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
          const data = bytes.subarray(start, start + size)
          return method === 0 ? data : inflate(data, full)
        }
      })
    }
    at += 46 + nameLength + extra + comment
  }
  return entries
}

export const readText = async (entry: ZipEntry | undefined): Promise<string | null> => entry ? new TextDecoder().decode(await entry.read()) : null
