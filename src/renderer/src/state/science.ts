import { signal } from '@preact/signals'
/** The active lab stays available while the teacher draws annotations. */
export const activeLabId = signal<string | null>(null)
export const scienceInspector = signal(true)
