export function normalizeSourceAppName(app: string | null | undefined) {
  const raw = (app ?? '').trim()
  if (!raw) {
    return 'Manual Capture'
  }

  const normalized = raw.toLowerCase()
  if (normalized.includes('chrome') || normalized.includes('google')) {
    return 'Chrome'
  }
  if (normalized.includes('edge') || normalized.includes('msedge')) {
    return 'Edge'
  }
  if (normalized.includes('firefox')) {
    return 'Firefox'
  }
  if (normalized.includes('wechat') || normalized.includes('weixin') || raw.includes('微信')) {
    return '微信'
  }
  if (normalized.includes('wxwork') || raw.includes('企业微信')) {
    return '企业微信'
  }
  if (normalized.includes('obsidian')) {
    return 'Obsidian'
  }
  if (normalized.includes('notion')) {
    return 'Notion'
  }

  return raw
}
