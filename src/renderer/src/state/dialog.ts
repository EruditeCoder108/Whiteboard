import { signal } from '@preact/signals'

export interface DialogChoice { label: string; value: string; kind?: 'primary' | 'danger' }

/** A question that waits for a tap; `null` when none is open. */
export const dialog = signal<{ title: string; body: string; choices: DialogChoice[]; resolve: (value: string) => void } | null>(null)

/**
 * Ask with big touch buttons (the system's own confirm box is small and blocks the whole board).
 * Resolves with the chosen `value`, or 'cancel' when dismissed (Esc).
 */
export function ask(title: string, body: string, choices: DialogChoice[]): Promise<string> {
  dialog.value?.resolve('cancel')
  return new Promise(resolve => {
    dialog.value = { title, body, choices, resolve: value => { dialog.value = null; resolve(value) } }
  })
}
