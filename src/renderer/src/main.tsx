import { render } from 'preact'
import { App } from './app'
import { board } from './engine/instance'
import { S } from './state/store'
import { replay } from './state/replay'
import './styles.css'
import { launchHandle, labToWorld } from './engine/science/scene'
import { evaluate, flight } from './engine/science/projectile'
import { MODELS, modelState, modelDuration, labState, labDuration } from './engine/science/models'
import { paintLab } from './engine/science/scene'
import * as insert from './state/insert'

// Test/debug hook (the renderer is local-only and context-isolated, so this is safe).
;(window as unknown as Record<string, unknown>).__fw = {
  board,
  S,
  replay,
  insert,
  science: { launchHandle, labToWorld, evaluate, flight, models: MODELS, modelState, modelDuration, labState, labDuration, paintLab },
  itemCount: () => board.doc.items.length
}

render(<App />, document.getElementById('root')!)
