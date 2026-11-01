import QRCode from 'qrcode'
import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import type { PollStatus, ShareAddress } from '@shared/api'
import { pollChart } from '@/engine/classroom'
import { board } from '@/engine/instance'
import { placeInView } from '@/engine/shelf'
import { S, isDarkBg } from '@/state/store'

const SETS: [string, string[]][] = [['A B C D', ['A', 'B', 'C', 'D']], ['Yes / No', ['Yes', 'No']], ['True / False', ['True', 'False']], ['Agree', ['Agree', 'Not sure', 'Disagree']], ['1 to 5', ['1', '2', '3', '4', '5']]]
const IDLE: PollStatus = { active: false, url: '', question: '', options: [], counts: [], total: 0, expiresAt: 0 }

/** Ask the class: students answer on their own phones over the school's Wi-Fi. No account, nothing leaves the room. */
export function PollSheet(): JSX.Element {
  const [question, setQuestion] = useState('')
  const [set, setSet] = useState(0)
  const [addresses, setAddresses] = useState<ShareAddress[] | null>(null)
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState<PollStatus>(IDLE)
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const close = (): void => { S.popover.value = null }
  useEffect(() => {
    void window.api.share.addresses().then(list => { setAddresses(list); setAddress(list[0]?.address ?? '') }).catch(() => setAddresses([]))
    void window.api.poll.status().then(setStatus)
  }, [])
  useEffect(() => {
    if (!status.active) return
    const id = window.setInterval(() => { void window.api.poll.status().then(setStatus) }, 1000)
    return () => window.clearInterval(id)
  }, [status.active])
  useEffect(() => {
    if (status.url) void QRCode.toDataURL(status.url, { width: 640, margin: 4, errorCorrectionLevel: 'M' }).then(setQr)
    else setQr('')
  }, [status.url])
  const start = async (): Promise<void> => {
    setBusy(true); setError('')
    const result = await window.api.poll.start(question.trim(), SETS[set][1], address)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setStatus(await window.api.poll.status())
  }
  const onBoard = (): void => {
    board.insertSaved(placeInView(pollChart(status.question, status.options, status.counts, isDarkBg.value), board.visibleRect(), .8))
    close()
  }
  const top = Math.max(1, ...status.counts)
  return (
    <div class="chooser new-lesson ui" role="dialog" aria-modal="true" aria-labelledby="poll-title" data-popover-keep="" onKeyDown={e => { if (e.key === 'Escape') close() }}>
      <div class="chooser-card panel new-lesson-card poll-card">
        <h1 id="poll-title">Ask the class</h1>
        {!status.active && <>
          <input class="link-field nodrag" type="text" aria-label="Question" placeholder="Your question (you can also just say it)" maxLength={200} value={question} onInput={e => setQuestion(e.currentTarget.value)} onKeyDown={e => e.stopPropagation()} />
          <div class="poll-sets" role="group" aria-label="Answers">
            {SETS.map(([name], i) => <button type="button" key={name} class={`chip nodrag ${set === i ? 'on' : ''}`} aria-pressed={set === i} onClick={() => setSet(i)}>{name}</button>)}
          </div>
          {addresses && !addresses.length && <p class="inputs-hint">This computer is not on a network. Connect it to the school Wi-Fi, or to a phone's hotspot, first.</p>}
          {addresses && addresses.length > 1 && <div class="poll-sets" role="group" aria-label="Network">
            {addresses.map(a => <button type="button" key={a.address} class={`chip nodrag ${address === a.address ? 'on' : ''}`} aria-pressed={address === a.address} onClick={() => setAddress(a.address)}>{a.name}</button>)}
          </div>}
          {error && <p class="inputs-hint link-wrong">{error}</p>}
          <div class="dialog-choices">
            <button type="button" class="dialog-btn primary nodrag" disabled={!address || busy} onClick={() => { void start() }}>Start the poll</button>
            <button type="button" class="dialog-btn nodrag" onClick={close}>Cancel</button>
          </div>
        </>}
        {status.active && <>
          <div class="poll-live">
            <div class="poll-join">
              {qr ? <img class="poll-qr" src={qr} alt="Scan to answer" /> : <div class="poll-qr" />}
              <small>{status.url}</small>
            </div>
            <div class="poll-results">
              {status.question && <h2>{status.question}</h2>}
              {status.options.map((o, i) => (
                <div class="poll-row" key={o}>
                  <span class="poll-label">{o}</span>
                  <span class="poll-track"><i style={{ width: `${status.counts[i] / top * 100}%` }} /></span>
                  <b>{status.counts[i]}</b>
                </div>
              ))}
              <div class="poll-total" aria-live="polite">{status.total} answer{status.total === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div class="dialog-choices">
            <button type="button" class="dialog-btn primary nodrag" disabled={!status.total} onClick={onBoard}>Put the result on the board</button>
            <button type="button" class="dialog-btn nodrag" onClick={() => { void window.api.poll.stop().then(() => setStatus(IDLE)) }}>Stop the poll</button>
            <button type="button" class="dialog-btn nodrag" onClick={close}>Keep it running</button>
          </div>
        </>}
      </div>
    </div>
  )
}
