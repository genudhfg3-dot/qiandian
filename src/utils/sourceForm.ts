import type { SourceInfo } from '../domain/knowledge'

export const manualCaptureSource: SourceInfo = {
  app: 'Manual Capture',
  title: '手动来源',
}

export function normalizeCaptureSource(source: SourceInfo): SourceInfo {
  const normalized: SourceInfo = {
    app: source.app.trim() || manualCaptureSource.app,
  }
  const title = source.title?.trim()
  const url = source.url?.trim()

  if (title) {
    normalized.title = title
  }
  if (url) {
    normalized.url = url
  }

  return normalized
}

export function updateCaptureSource(current: SourceInfo, patch: Partial<SourceInfo>): SourceInfo {
  return normalizeCaptureSource({ ...current, ...patch })
}
