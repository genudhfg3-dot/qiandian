export type MetadataQueueWorker<T> = (entryId: string) => Promise<T>

interface MetadataJob<T> {
  entryId: string
  resolve?: (value: T | null) => void
  reject?: (error: unknown) => void
}

export class MetadataQueue<T> {
  private readonly queue: MetadataJob<T>[] = []
  private readonly queuedIds = new Set<string>()
  private running = false

  constructor(private readonly worker: MetadataQueueWorker<T>) {}

  enqueue(entryId: string | undefined, waitForResult = false) {
    if (!entryId) {
      return waitForResult ? Promise.resolve(null) : undefined
    }

    if (this.queuedIds.has(entryId)) {
      return waitForResult ? Promise.resolve(null) : undefined
    }

    let promise: Promise<T | null> | undefined
    if (waitForResult) {
      promise = new Promise<T | null>((resolve, reject) => {
        this.queue.push({ entryId, resolve, reject })
      })
    } else {
      this.queue.push({ entryId })
    }

    this.queuedIds.add(entryId)
    void this.run()
    return promise
  }

  enqueueMany(entryIds: string[]) {
    let queued = 0
    for (const entryId of Array.from(new Set(entryIds.filter(Boolean)))) {
      if (!this.queuedIds.has(entryId)) {
        this.enqueue(entryId)
        queued += 1
      }
    }
    return { queued }
  }

  pendingCount() {
    return this.queue.length
  }

  private async run() {
    if (this.running) {
      return
    }

    this.running = true
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()
        if (!job) {
          continue
        }
        this.queuedIds.delete(job.entryId)
        try {
          const value = await this.worker(job.entryId)
          job.resolve?.(value)
        } catch (error) {
          job.reject?.(error)
        }
      }
    } finally {
      this.running = false
    }
  }
}
