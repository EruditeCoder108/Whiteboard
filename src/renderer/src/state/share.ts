import { signal } from '@preact/signals'
import type { ShareAddress, ShareStatus } from '@shared/api'
import { board } from '@/engine/instance'
import { lessonName } from './lesson'

export const shareOpen = signal(false)
export const shareAddresses = signal<ShareAddress[] | null>(null)
export const shareAddress = signal('')
export const shareStatus = signal<ShareStatus>({ active: false, url: '', downloads: 0, expiresAt: 0 })
export const shareBusy = signal(false)
export const shareError = signal('')
export const shareMessage = signal('')
let request = 0

/** Nothing starts merely by opening the panel: the teacher chooses the network first. */
export const sharing = {
  async open(): Promise<void> {
    shareOpen.value = true
    shareAddresses.value = null
    shareError.value = ''; shareMessage.value = ''
    try {
      const addresses = await window.api.share.addresses()
      shareAddresses.value = addresses
      if (!addresses.some(n => n.address === shareAddress.value)) shareAddress.value = addresses[0]?.address ?? ''
    } catch { shareError.value = 'Could not find a network. Save the PDF instead.'; shareAddresses.value = [] }
  },

  async start(): Promise<void> {
    if (shareBusy.value || !shareAddress.value || shareStatus.value.active) return
    const id = ++request
    shareBusy.value = true; shareError.value = ''; shareMessage.value = ''
    try {
      board.commitText()
      const name = lessonName.value, address = shareAddress.value
      const pages = await board.exportPages({ split: true })
      if (id !== request) return
      if (!pages.length) throw new Error('Nothing to share yet. Add something to the lesson first.')
      const result = await window.api.share.start(pages, name, address)
      if (id !== request) return
      if (!result.ok) throw new Error(result.error)
      shareStatus.value = { active: true, downloads: 0, url: result.url, expiresAt: result.expiresAt }
    } catch (error) {
      if (id === request) shareError.value = error instanceof Error ? error.message : 'Could not prepare the PDF. Save the PDF instead.'
    } finally { if (id === request) shareBusy.value = false }
  },

  async stop(close = false): Promise<void> {
    ++request
    try {
      await window.api.share.stop()
      shareStatus.value = { active: false, url: '', downloads: 0, expiresAt: 0 }
      shareBusy.value = false
      shareMessage.value = 'Sharing stopped. The old link no longer works.'
      if (close) shareOpen.value = false
    } catch { shareError.value = 'Could not stop sharing. Try Stop sharing again.' }
  },

  async refresh(): Promise<void> {
    const id = request
    try {
      const status = await window.api.share.status()
      if (id !== request || shareBusy.value) return
      if (shareStatus.value.active && !status.active) shareMessage.value = 'Sharing has ended. Start again for a new link.'
      shareStatus.value = status
    } catch { /* keep Stop visible if a status check fails */ }
  }
}
