export class ClipboardTracker {
  private previous: string | undefined
  reset() { this.previous = undefined }
  observe(hash: string) {
    const changed = this.previous !== undefined && hash !== '' && hash !== this.previous
    this.previous = hash
    return changed
  }
}
