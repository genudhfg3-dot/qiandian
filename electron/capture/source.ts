import type { SourceInfo } from '../../src/domain/knowledge'
import { normalizeSourceAppName } from '../../src/utils/sourceApp'

interface ActiveWindowLike {
  title?: unknown
  url?: unknown
  owner?: {
    name?: unknown
  }
}

type ActiveWindowReader = () => Promise<ActiveWindowLike | undefined>

export const MANUAL_SOURCE: SourceInfo = {
  app: 'Manual Capture',
  title: '手动来源',
}

function optionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

async function loadActiveWindow(): Promise<ActiveWindowReader> {
  const activeWindowModule = (await import('active-win')) as {
    default?: ActiveWindowReader
  }

  if (typeof activeWindowModule.default !== 'function') {
    throw new Error('active-win default export is unavailable')
  }

  return activeWindowModule.default
}

export function mapActiveWindowToSource(
  windowInfo: ActiveWindowLike | undefined,
  fallback: SourceInfo = MANUAL_SOURCE,
): SourceInfo {
  const app = optionalText(windowInfo?.owner?.name)
  const title = optionalText(windowInfo?.title)
  const url = optionalText(windowInfo?.url)

  if (!app && !title && !url) {
    return fallback
  }

  return {
    app: normalizeSourceAppName(app ?? fallback.app),
    title: title ?? fallback.title,
    url,
  }
}

export async function getCurrentSource(): Promise<SourceInfo> {
  try {
    const activeWindow = await loadActiveWindow()
    return mapActiveWindowToSource(await activeWindow())
  } catch {
    return MANUAL_SOURCE
  }
}

