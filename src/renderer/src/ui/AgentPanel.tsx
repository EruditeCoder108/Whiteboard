import { useEffect, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import type { AssistantConfig, AssistantDraft, BridgeStatus, JsonObject } from '@shared/agent'
import { BoardAgent, stageBatch } from '@/engine/agent'
import { board } from '@/engine/instance'
import { paintItem } from '@/engine/items'
import { S, showToast } from '@/state/store'

function DraftPreview({ draft }: { draft: AssistantDraft }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    try {
      const staged = stageBatch(board.doc.items, draft.batch, board.doc.version, it => board.fitItem(it))
      const items = staged.items.filter(it => staged.changed.includes(it.id))
      const bounds = board.doc.bounds(items)
      if (!bounds) return
      const pad = 16, scale = Math.min((canvas.width - pad * 2) / Math.max(1, bounds[2] - bounds[0]), (canvas.height - pad * 2) / Math.max(1, bounds[3] - bounds[1]), 1.5)
      ctx.save(); ctx.translate(pad, pad); ctx.scale(scale, scale); ctx.translate(-bounds[0], -bounds[1])
      items.forEach(it => paintItem(ctx, it)); ctx.restore()
    } catch { /* the revision notice supplies the reason; no stale draft is painted */ }
  }, [draft, S.documentRevision.value])
  return <canvas ref={ref} class="agent-preview" width={640} height={300} aria-label="Preview of proposed objects" />
}

export function AgentPanel({ agent }: { agent: BoardAgent }): JSX.Element | null {
  const [config, setConfig] = useState<AssistantConfig>({ endpoint: 'http://127.0.0.1:11434/v1', model: '', protocol: 'chat', hasKey: false })
  const [key, setKey] = useState('')
  const [bridge, setBridge] = useState<BridgeStatus>({ enabled: false })
  const [prompt, setPrompt] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [draft, setDraft] = useState<AssistantDraft | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const draftRef = useRef<HTMLDivElement>(null)
  const open = S.popover.value === 'agent'
  useEffect(() => { if (open) void Promise.all([window.api.agent.config(), window.api.agent.status()]).then(([c, b]) => { setConfig(c); setBridge(b) }).catch(e => setMessage(e.message)) }, [open])
  useEffect(() => () => window.api.agent.cancel(), [])
  useEffect(() => { if (draft) draftRef.current?.scrollIntoView({ block: 'nearest' }) }, [draft])
  if (!open) return null
  const stale = draft && draft.batch.expectedRevision !== S.documentRevision.value
  const local = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(config.endpoint)
  const save = async (): Promise<AssistantConfig> => {
    const saved = await window.api.agent.saveConfig({ ...config, key: key || undefined })
    setConfig(saved); setKey(''); return saved
  }
  const generate = async (): Promise<void> => {
    setBusy(true); setDraft(null); setSettingsOpen(false); setMessage('Preparing a draft…')
    try {
      await save()
      const result = await window.api.agent.generate(prompt, board.selection.map(it => it.id))
      if (!result.ok) setMessage(result.error)
      else { setDraft(result.draft); setMessage(result.message) }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not prepare draft') }
    finally { setBusy(false) }
  }
  const apply = (): void => {
    if (!draft) return
    const result = agent.call('whiteboard_apply', draft.batch)
    if (!result.ok) { setMessage(result.error); return }
    setMessage(`${draft.summary} applied. Undo restores the previous board.`); setDraft(null); S.popover.value = null; board.fitSelection()
  }
  const starter = (kind: 'plan' | 'compare' | 'arrange'): void => {
    const prefix = crypto.randomUUID().slice(0, 8), x = board.view.x + 120 / board.view.zoom, y = board.view.y + 140 / board.view.zoom
    let operations: JsonObject[], label: string
    if (kind === 'arrange') {
      if (!board.selection.length) { setMessage('Select the objects you want to arrange first.'); return }
      operations = [{ op: 'arrange', ids: board.selection.map(it => it.id), layout: 'grid', gap: 32 }]; label = 'Arrange selection'
    } else {
      const titles = kind === 'plan' ? ['To do\n\nAdd your tasks here', 'In progress\n\nWhat are you working on?', 'Done\n\nKeep the wins here'] : ['Advantages\n\nWhat works well?', 'Questions\n\nWhat needs exploring?', 'Tradeoffs\n\nWhat will it cost?']
      operations = titles.map((text, i) => ({ op: 'create', id: `${prefix}-${i}`, kind: 'note', x: x + i * 260, y, width: 228, height: 240,
        text, fill: ['#fff1a8', '#dbeafe', '#dcfce7'][i], fontSize: 22 }))
      label = kind === 'plan' ? 'Planning board' : 'Compare ideas'
    }
    const result = agent.call('whiteboard_apply', { expectedRevision: board.doc.version, requestId: crypto.randomUUID(), label, operations })
    if (!result.ok) setMessage(result.error)
    else { setMessage(`${label} added. Every object is editable.`); S.popover.value = null; board.fitSelection() }
  }
  const toggleBridge = async (): Promise<void> => {
    setConnecting(true)
    try { const status = await (bridge.enabled ? window.api.agent.disable() : window.api.agent.enable()); setBridge(status); if (status.error) setMessage(status.error) }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Connection failed') }
    finally { setConnecting(false) }
  }
  return <aside class="agent-panel ui nodrag" data-popover-keep="" data-testid="agent-panel" aria-label="Agent tools and assistant">
    <div class="agent-heading"><strong>Agent tools</strong><button aria-label="Close agent panel" onClick={() => { window.api.agent.cancel(); S.popover.value = null }}>×</button></div>
    <p class="agent-muted">Create editable content, or let an agent work with the board.</p>
    <div class="agent-section"><h3>Start without a model</h3><div class="agent-buttons">
      <button disabled={busy} onClick={() => starter('plan')}>Planning board</button>
      <button disabled={busy} onClick={() => starter('compare')}>Compare ideas</button>
      <button disabled={busy} onClick={() => starter('arrange')}>Arrange selection</button>
    </div></div>
    <div class="agent-section"><h3>Assistant</h3>
      <p class="agent-muted">Connect a local model with tool support. No OpenAI key is needed for a local server.</p>
      <button class="agent-link" onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen}>Connection settings {settingsOpen ? '▴' : '▾'}</button>
      {settingsOpen && <div class="agent-fields">
        <label>API base URL<input data-testid="assistant-endpoint" disabled={busy} value={config.endpoint} onInput={e => setConfig({ ...config, endpoint: e.currentTarget.value })} placeholder="http://127.0.0.1:11434/v1" /></label>
        <label>API format<select disabled={busy} value={config.protocol} onChange={e => setConfig({ ...config, protocol: e.currentTarget.value as 'chat' | 'responses' })}><option value="chat">Chat Completions (local / compatible)</option><option value="responses">Responses</option></select></label>
        <label>Model<input disabled={busy} data-testid="assistant-model" list="agent-models" value={config.model} onInput={e => setConfig({ ...config, model: e.currentTarget.value })} placeholder="An installed tool-capable model" /><datalist id="agent-models">{models.map(m => <option key={m} value={m} />)}</datalist></label>
        <label>API key · optional<input data-testid="assistant-key" type="password" autoComplete="off" disabled={busy} value={key} onInput={e => setKey(e.currentTarget.value)} placeholder={config.hasKey ? 'Key saved securely' : 'Leave empty for local models'} /></label>
        <div class="agent-buttons">
          <button disabled={busy || connecting} onClick={() => { setConnecting(true); void save().then(() => window.api.agent.models()).then(m => { setModels(m); setMessage(m.length ? `Found ${m.length} models. Choose one above.` : 'No models found. Load a local model first.') }).catch(e => setMessage(e.message)).finally(() => setConnecting(false)) }}>Find models</button>
          <button disabled={busy || connecting} onClick={() => { void save().then(() => setMessage('Connection settings saved.')).catch(e => setMessage(e.message)) }}>Save settings</button>
          {config.hasKey && <button disabled={busy} onClick={() => { void window.api.agent.saveConfig({ ...config, clearKey: true }).then(setConfig).catch(e => setMessage(e.message)) }}>Remove key</button>}
        </div>
      </div>}
      <p class="agent-muted">{local ? 'Prompt and board text go to your local model.' : 'Prompt and board text will be sent to the API URL above.'} {board.selection.length ? `${board.selection.length} selected objects guide the request.` : 'Uses a compact board snapshot.'}</p>
      <textarea data-testid="assistant-prompt" value={prompt} disabled={busy} onInput={e => setPrompt(e.currentTarget.value)} maxLength={8000} placeholder="Create a study plan with three notes…" rows={3} />
      <div class="agent-buttons"><button class="agent-primary" disabled={busy || connecting || !prompt.trim()} onClick={() => { void generate() }}>Prepare draft</button>{busy && <button onClick={() => window.api.agent.cancel()}>Stop</button>}</div>
      {draft && <div ref={draftRef} class="agent-draft" data-testid="assistant-draft"><strong>{draft.summary}</strong><DraftPreview draft={draft} />
        <p class="agent-muted">{draft.preview.ok ? (draft.preview.changed as string[] | undefined)?.length ?? 0 : 0} objects affected. {draft.preview.ok ? (draft.preview.removed as string[] | undefined)?.length ?? 0 : 0} removed. One undo step.</p>
        {stale && <p class="agent-error">Board changed. Prepare a fresh draft.</p>}
        <div class="agent-buttons"><button class="agent-primary" disabled={!!stale} onClick={apply}>Apply draft</button><button onClick={() => setDraft(null)}>Discard</button></div>
      </div>}
    </div>
    <div class="agent-section"><h3>External agents <span class={bridge.enabled ? 'agent-on' : 'agent-muted'}>{bridge.enabled ? 'Connected locally' : 'Off'}</span></h3>
      <p class="agent-muted">MCP lets your existing agent read and edit this board directly. It uses the agent’s model; this app needs no API key. Enable for this session, then add the copied configuration to your MCP client. Requires Node.js 22 or newer.</p>
      <div class="agent-buttons"><button disabled={connecting} onClick={() => { void toggleBridge() }}>{bridge.enabled ? 'Disable connection' : 'Enable connection'}</button>{bridge.enabled && <button onClick={() => { void window.api.agent.copyConfig().then(ok => { if (ok) showToast('MCP configuration copied') }) }}>Copy MCP configuration</button>}</div>
      {bridge.enabled && <details><summary>Connection details</summary><p class="agent-muted">Local access only. Disabling closes the endpoint and revokes its token.</p><pre>{bridge.config}</pre></details>}
    </div>
    {message && <p class="agent-message" role="status" aria-live="polite">{message}</p>}
  </aside>
}
