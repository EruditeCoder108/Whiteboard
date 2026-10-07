import type { SaveResult } from '@shared/api'

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error'

/** Tracks revisions so a late save acknowledgement never marks newer edits as saved. */
export class Autosave {
  private revision = 0
  private savedRevision = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private running: Promise<boolean> | null = null

  constructor(
    private snapshot: () => string,
    private write: (json: string) => Promise<SaveResult>,
    private status: (status: SaveStatus, error?: string) => void,
    private delay = 1000
  ) {}

  markDirty(): void {
    this.revision++
    this.status('unsaved')
    clearTimeout(this.timer)
    this.timer = setTimeout(() => { void this.flush() }, this.delay)
  }

  async flush(): Promise<boolean> {
    clearTimeout(this.timer)
    if (this.running) return this.running
    this.running = this.savePending()
    try {
      return await this.running
    } finally {
      this.running = null
    }
  }

  private async savePending(): Promise<boolean> {
    while (this.savedRevision < this.revision) {
      const revision = this.revision
      this.status('saving')
      try {
        const result = await this.write(this.snapshot())
        if (!result.ok) {
          this.status('error', result.error)
          return false
        }
      } catch (error) {
        this.status('error', error instanceof Error ? error.message : 'Could not save your board')
        return false
      }
      this.savedRevision = revision
    }
    this.status('saved')
    return true
  }

  dispose(): void {
    clearTimeout(this.timer)
  }
}
