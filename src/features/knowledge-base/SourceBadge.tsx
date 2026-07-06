import { Chrome, FileText, MessageCircle } from 'lucide-react'

interface SourceBadgeProps {
  app: string
  size?: 'sm' | 'md'
}

function getSourceIcon(app: string) {
  const normalized = app.toLowerCase()
  if (normalized.includes('chrome')) {
    return Chrome
  }

  if (app.includes('微信') || normalized.includes('wechat') || normalized.includes('weixin')) {
    return MessageCircle
  }

  return FileText
}

export function SourceBadge({ app, size = 'md' }: SourceBadgeProps) {
  const Icon = getSourceIcon(app)
  const iconSize = size === 'sm' ? 12 : 13
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-[13px]'

  return (
    <span className={`inline-flex items-center gap-1.5 text-ink ${textSize}`}>
      <Icon size={iconSize} className={size === 'sm' ? 'text-faint' : undefined} strokeWidth={1.8} />
      {app}
    </span>
  )
}
