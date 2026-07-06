import { Image as ImageIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { RichMarkdownPreview } from '../../components/RichMarkdownPreview'
import { Tag } from '../../components/Tag'
import type { Entry } from '../../domain/knowledge'
import { toAppImageUrl } from '../../utils/imageUrls'
import { SourceBadge } from './SourceBadge'

interface EntryListProps {
  entries: Entry[]
  isLoading?: boolean
  activeId?: string
}

const relativeFormatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })

function metadataStatusLabel(status: Entry['metadataStatus']) {
  switch (status) {
    case 'pending':
      return 'AI 排队中'
    case 'ready':
      return '已生成摘要'
    case 'failed':
      return '生成失败'
    case 'disabled':
      return 'AI 未启用'
    default:
      return ''
  }
}

function formatCreatedAt(timestamp: number) {
  const diffMs = timestamp - Date.now()
  const diffHours = Math.round(diffMs / 3_600_000)
  const diffDays = Math.round(diffMs / 86_400_000)

  if (Math.abs(diffHours) < 24) {
    return relativeFormatter.format(diffHours, 'hour')
  }

  if (Math.abs(diffDays) < 8) {
    return relativeFormatter.format(diffDays, 'day')
  }

  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(timestamp)
}

export function EntryList({ entries, isLoading, activeId }: EntryListProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-[6px] border border-dashed border-hairline bg-cream-soft/45 px-6 text-center">
        <p className="text-[13px] text-soft-ink">正在读取知识库...</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-[6px] border border-dashed border-hairline bg-cream-soft/45 px-6 text-center">
        <div>
          <p className="font-serif text-[17px] font-medium text-ink">没有找到匹配的条目</p>
          <p className="mt-1 text-[12px] text-soft-ink">换个关键词，或移除部分标签和来源筛选。</p>
        </div>
      </div>
    )
  }

  return <div className="flex flex-col">{entries.map((entry, index) => <EntryRow key={entry.id} entry={entry} isLast={index === entries.length - 1} isActive={entry.id === activeId} />)}</div>
}

function EntryRow({ entry, isLast, isActive }: { entry: Entry; isLast: boolean; isActive: boolean }) {
  const thumbnailUrl = entry.images.map(toAppImageUrl).find(Boolean)
  const metadataLabel = metadataStatusLabel(entry.metadataStatus)

  return (
    <Link to={`/entries/${entry.id}`} className={`block pb-3 outline-none transition ${isActive ? 'bg-cream-soft/60' : 'hover:bg-cream-soft/35 focus:bg-cream-soft/45'} ${isLast ? '' : 'mb-3 border-b border-hairline-soft'}`}>
      <article className="rounded-[4px] px-1 py-1">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3 className="font-serif text-[16px] font-medium leading-snug text-ink">{entry.title}</h3>
          <span className="shrink-0 text-[11px] text-faint">{formatCreatedAt(entry.createdAt)}</span>
        </div>
        {metadataLabel ? <div className="mb-1 text-[11px] text-faint">{metadataLabel}</div> : null}
        <div className="flex items-start gap-2.5">
          {entry.images.length > 0 ? (
            <div className="flex h-[38px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-cream-soft" style={thumbnailUrl ? undefined : { background: 'linear-gradient(135deg, #F3E5C8, #C9B98B)' }}>
              {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon size={14} className="text-soft-ink" strokeWidth={1.6} />}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="mb-2 max-h-[68px] overflow-hidden">
              <RichMarkdownPreview markdown={entry.summary || entry.contentMd} compact maxLines={3} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {entry.tags.map((tag) => <Tag key={tag.id} label={tag.name} category={tag.color} />)}
              <SourceBadge app={entry.source.app} size="sm" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
