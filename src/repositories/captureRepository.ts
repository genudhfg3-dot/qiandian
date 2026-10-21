import type { SourceInfo } from '../domain/knowledge'
import type { CapturedClipboardImage, ClipboardReadResult } from '../electron-api'

const manualSource: SourceInfo = {
  app: 'Manual Capture',
  title: '手动来源',
}

export interface CaptureRepository {
  getCurrentSource(): Promise<SourceInfo>
  readClipboard(): Promise<ClipboardReadResult>
  discardImages(images: CapturedClipboardImage[]): Promise<void>
  openWindow(): Promise<void>
  showFloatingButton(): Promise<void>
  floatingDragStart(point?: { x: number; y: number }): Promise<void>
  floatingDragEnd(cancelled?: boolean): Promise<{ moved: boolean }>
  closeCurrentWindow(): Promise<void>
  onCloseRequest(callback: () => void): () => void
}

export const captureRepository: CaptureRepository = {
  async getCurrentSource(): Promise<SourceInfo> {
    if (typeof window === 'undefined' || !window.captureApi) {
      return manualSource
    }

    return window.captureApi.getCurrentSource()
  },

  async readClipboard(): Promise<ClipboardReadResult> {
    if (typeof window === 'undefined' || !window.captureApi) {
      return {
        contentMd: '',
        format: 'empty',
        imageUnsupported: false,
        isEmpty: true,
        images: [],
        source: manualSource,
      }
    }

    return window.captureApi.readClipboard()
  },

  async discardImages(images: CapturedClipboardImage[]): Promise<void> {
    if (typeof window === 'undefined' || !window.captureApi || images.length === 0) {
      return
    }

    await window.captureApi.discardImages(images.map((image) => image.path))
  },

  async openWindow(): Promise<void> {
    if (typeof window === 'undefined' || !window.captureApi) {
      return
    }

    await window.captureApi.openWindow()
  },

  async showFloatingButton(): Promise<void> {
    if (typeof window === 'undefined' || !window.captureApi) {
      return
    }

    await window.captureApi.showFloatingButton()
  },

  async floatingDragStart(point): Promise<void> {
    if (typeof window === 'undefined' || !window.captureApi) {
      return
    }

    await window.captureApi.floatingDragStart(point)
  },

  async floatingDragEnd(cancelled): Promise<{ moved: boolean }> {
    if (typeof window === 'undefined' || !window.captureApi) {
      return { moved: false }
    }

    return window.captureApi.floatingDragEnd(cancelled)
  },

  async closeCurrentWindow(): Promise<void> {
    if (typeof window === 'undefined' || !window.captureApi) {
      return
    }

    await window.captureApi.closeCurrentWindow()
  },

  onCloseRequest(callback: () => void): () => void {
    if (typeof window === 'undefined' || !window.captureApi) {
      return () => undefined
    }

    return window.captureApi.onCloseRequest(callback)
  },
}
