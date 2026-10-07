import { render } from 'preact'
import { App } from './app'
import { board } from './engine/instance'
import { S } from './state/store'
import { replay } from './state/replay'
import './styles.css'

// Test/debug hook (the renderer is local-only and context-isolated, so this is safe).
;(window as unknown as Record<string, unknown>).__fw = {
  board,
  S,
  replay,
  itemCount: () => board.doc.items.length
}

render(<App />, document.getElementById('root')!)
