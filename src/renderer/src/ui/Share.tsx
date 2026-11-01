import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { FileDown, QrCode, Square, X } from './icons'
import QRCode from 'qrcode'
import { exportPdf } from '@/state/insert'
import { dialog } from '@/state/dialog'
import { lessonName } from '@/state/lesson'
import { sharing, shareAddress, shareAddresses, shareBusy, shareError, shareMessage, shareOpen, shareStatus } from '@/state/share'
import { Section, Tile } from './kit'

/** A classroom-sized QR and a Stop button that stays in reach while the contents scroll. */
export function SharePanel(): JSX.Element | null {
  const open = shareOpen.value, status = shareStatus.value, busy = shareBusy.value
  const [qr, setQr] = useState('')
  const [now, setNow] = useState(Date.now())
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setQr('')
    if (status.url) void QRCode.toDataURL(status.url, { width: 720, margin: 4, errorCorrectionLevel: 'M' })
      .then(data => { if (active) setQr(data) }).catch(() => { if (active) shareError.value = 'Could not draw the QR code. Type the link on the phone instead.' })
    return () => { active = false }
  }, [status.url])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const timer = setInterval(() => { setNow(Date.now()); void sharing.refresh() }, 1000)
    // Keep board shortcuts behind the sheet; Escape and the close button both stop the session.
    const keys = (e: KeyboardEvent): void => {
      if (!shareOpen.value || dialog.value) return
      e.stopImmediatePropagation()
      if (e.key === 'Escape') { e.preventDefault(); void sharing.stop(true) }
      if (e.key === 'Tab') {
        const buttons = [...panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []]
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        e.preventDefault()
        buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
      }
    }
    window.addEventListener('keydown', keys, true)
    const off = window.api.win.onFlush(() => { void sharing.stop(true) })
    return () => { clearInterval(timer); off(); window.removeEventListener('keydown', keys, true); previous?.focus() }
  }, [open])

  if (!open) return null
  const addresses = shareAddresses.value
  const seconds = Math.max(0, Math.min(30 * 60, Math.ceil((status.expiresAt - now) / 1000)))
  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  const save = async (): Promise<void> => { await sharing.stop(true); if (!shareOpen.value) await exportPdf({ split: true }) }
  return (
    <div class="share-shade ui" data-popover-keep="" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div class="share-panel panel" ref={panel}>
        <header class="share-head">
          <div><h1 id="share-title">Share to phones</h1><p>Phones must be on the same Wi-Fi as this PC. No cloud upload.</p></div>
          <button type="button" class="share-close nodrag" aria-label="Close sharing" onClick={() => { void sharing.stop(true) }}><X size={26} /></button>
        </header>
        <div class="share-body">
          {status.active ? <div class="share-live">
            <div class="share-code">
              {qr ? <img class="share-qr" src={qr} alt="Scan to download the lesson PDF" /> : <div class="share-qr share-qr-wait">Preparing QR…</div>}
              <p>Scan with your phone camera, or type:</p>
              <div class="share-url" data-share-url="">{status.url}</div>
            </div>
            <div class="share-details">
              <h2>{lessonName.value}</h2>
              <p class="share-count" role="status">{status.downloads} {status.downloads === 1 ? 'PDF download' : 'PDF downloads'}</p>
              <p class="share-timer">Sharing ends in <b>{countdown}</b></p>
              <p>The PDF is a copy from when sharing started. A download count can include the same phone more than once.</p>
              <h2>Not working?</h2>
              <p>Connect phones to the same Wi-Fi as the PC. School “guest” Wi-Fi often blocks devices from seeing each other.</p>
              <p>Windows may ask to allow the app through the firewall. Choose <b>Private networks</b>.</p>
              <p>The PC cannot check whether phones can reach it. Try Save PDF instead to share by USB.</p>
            </div>
          </div> : <div class="share-setup">
            <h2>{lessonName.value}</h2>
            {addresses === null ? <p role="status">Finding networks…</p> : addresses.length === 0
              ? <p class="share-no-network">This PC isn't on a network. Save the PDF and share it by USB instead.</p>
              : <><p>Choose the connection your students use. Sharing lasts 30 minutes, or until you stop it.</p>
                <div class="share-networks" role="group" aria-label="Network connection">{addresses.map(n => (
                  <button type="button" key={n.address} class={`chip nodrag ${shareAddress.value === n.address ? 'on' : ''}`} aria-pressed={shareAddress.value === n.address} disabled={busy} onClick={() => { shareAddress.value = n.address }}>{n.name} {n.address}</button>
                ))}</div>
                <p>Only the exported PDF is shared. Keep this panel open while students download.</p></>}
            {busy && <p role="status">Preparing the lesson PDF…</p>}
            {shareMessage.value && <p role="status">{shareMessage.value}</p>}
          </div>}
          {shareError.value && <p class="share-error" role="alert">{shareError.value}</p>}
        </div>
        <footer class="share-footer"><Section title={status.active || busy ? 'Finish sharing' : addresses?.length === 0 ? 'Save a copy' : 'Share this lesson'} cols={!status.active && !busy && addresses?.length === 0 ? 1 : 2}>
          {status.active || busy
            ? <Tile icon={Square} label="Stop sharing" danger onClick={() => { void sharing.stop() }} />
            : addresses?.length === 0 ? null : <Tile icon={QrCode} label="Start sharing" disabled={!addresses?.length} onClick={() => { void sharing.start() }} />}
          <Tile icon={FileDown} label={addresses?.length === 0 ? 'Save PDF' : 'Save PDF instead'} onClick={() => { void save() }} />
        </Section></footer>
      </div>
    </div>
  )
}
