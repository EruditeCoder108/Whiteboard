import { signal } from '@preact/signals'
import type { CapturedImage, CaptureSource } from '@shared/api'
import { board } from '@/engine/instance'
import { imageFromBlob } from '@/engine/media'
import type { ImageItem, Rect } from '@/engine/types'
import { S, showToast } from './store'

export interface Region { x0: number; y0: number; x1: number; y1: number }
export const captureOpen = signal(false)
export const captureSources = signal<CaptureSource[] | null>(null)
export const captureStill = signal<CapturedImage | null>(null)
export const captureRegion = signal<Region | null>(null)
export const captureBusy = signal(false)
export const captureError = signal('')
let request = 0

/** Normalised selection coordinates keep the crop correct when the preview is resized. */
export function cropPixels(region: Region | null, width: number, height: number): { x: number; y: number; width: number; height: number } | null {
  if (!region || ![...Object.values(region), width, height].every(Number.isFinite) || width < 1 || height < 1) return null
  if (region.x0 === region.x1 || region.y0 === region.y1) return null
  const clamp = (v: number): number => Math.max(0, Math.min(1, v))
  const x = Math.floor(clamp(Math.min(region.x0, region.x1)) * width), y = Math.floor(clamp(Math.min(region.y0, region.y1)) * height)
  const right = Math.ceil(clamp(Math.max(region.x0, region.x1)) * width), bottom = Math.ceil(clamp(Math.max(region.y0, region.y1)) * height)
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null
}

/** Centre the reference with room to write round it, keeping its original proportions. */
export function capturePlacement(width: number, height: number): Rect {
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) throw new Error('The capture has no picture.')
  const k = Math.min(1536 / width, 836 / height), w = width * k, h = height * k
  return [(1600 - w) / 2, (900 - h) / 2, (1600 + w) / 2, (900 + h) / 2]
}

/** Ordinary locked pictures travel with lesson save, export and phone sharing. */
export function placeCapture(image: CapturedImage): void {
  const item: ImageItem = { t: 'i', id: crypto.randomUUID(), c: '#111827', w: 1, p: capturePlacement(image.width, image.height), src: image.src, aspect: image.width / image.height, locked: true }
  board.addSheet([item], { x: 0, y: 0, extent: 1 }, board.doc.items.length === 0)
  board.setTool('pen')
  showToast('Captured · it is locked, write on it freely', 5000)
}

async function picture(image: CapturedImage, region: Region | null): Promise<CapturedImage> {
  const bytes = Uint8Array.from(atob(image.src.split(',')[1]), c => c.charCodeAt(0))
  let blob = new Blob([bytes], { type: 'image/png' })
  const crop = cropPixels(region, image.width, image.height)
  if (region && !crop) throw new Error('Drag an area on the picture first.')
  if (crop) {
    const bitmap = await createImageBitmap(blob)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = crop.width; canvas.height = crop.height
      canvas.getContext('2d')!.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
      blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not crop that area.')), 'image/png'))
    } finally { bitmap.close() }
  }
  return imageFromBlob(blob)
}

export const capture = {
  async open(): Promise<void> {
    if (captureOpen.value) return
    board.commitText(); S.popover.value = null
    captureOpen.value = true; captureStill.value = null; captureRegion.value = null
    await capture.refresh()
  },

  async refresh(): Promise<void> {
    const id = ++request
    captureBusy.value = true; captureError.value = ''; captureSources.value = null
    try {
      const sources = await window.api.capture.sources()
      if (id === request) captureSources.value = sources
    } catch { if (id === request) { captureSources.value = []; captureError.value = 'Could not list screens and windows. Refresh and try again.' } }
    finally { if (id === request) captureBusy.value = false }
  },

  close(): void {
    ++request
    captureOpen.value = false; captureSources.value = null; captureStill.value = null
    captureRegion.value = null; captureBusy.value = false; captureError.value = ''
  },

  async choose(source: CaptureSource): Promise<void> {
    if (captureBusy.value) return
    const id = ++request
    captureBusy.value = true; captureError.value = ''
    try {
      const result = await window.api.capture.grab(source.id)
      if (id !== request) return
      if (!result.ok) throw new Error(result.error)
      if (source.kind === 'screen') {
        captureStill.value = result; captureSources.value = null; captureRegion.value = null
      } else {
        const image = await picture(result, null)
        if (id !== request) return
        placeCapture(image); capture.close()
      }
    } catch (error) { if (id === request) captureError.value = error instanceof Error ? error.message : 'Could not capture that screen or window. Try again.' }
    finally { if (id === request) captureBusy.value = false }
  },

  async use(area: boolean): Promise<void> {
    const still = captureStill.value
    if (!still || captureBusy.value || area && !captureRegion.value) return
    const id = ++request
    captureBusy.value = true; captureError.value = ''
    try {
      const image = await picture(still, area ? captureRegion.value : null)
      if (id !== request) return
      placeCapture(image); capture.close()
    } catch (error) { if (id === request) captureError.value = error instanceof Error ? error.message : 'Could not add this capture. Try again.' }
    finally { if (id === request) captureBusy.value = false }
  }
}
