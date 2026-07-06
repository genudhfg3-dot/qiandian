import type { ReactNode } from 'react'
import { rewriteMarkdownImageUrls } from '../utils/imageUrls'

const inlineFormatPattern = /\*\*([^*]+)\*\*|<mark>(.*?)<\/mark>|<span style="color:\s*(#[0-9a-fA-F]{6})">(.*?)<\/span>|<span style="font-size:\s*(\d+)px">(.*?)<\/span>/g

function renderInline(text: string) {
  const nodes: ReactNode[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  inlineFormatPattern.lastIndex = 0

  while ((match = inlineFormatPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index))
    }

    const key = `${match.index}-${inlineFormatPattern.lastIndex}`
    if (match[1]) {
      nodes.push(<strong key={key}>{match[1]}</strong>)
    } else if (match[2]) {
      nodes.push(<mark key={key} className="rounded-[2px] bg-[#FFE28A] px-[2px] text-ink">{match[2]}</mark>)
    } else if (match[3]) {
      nodes.push(<span key={key} style={{ color: match[3] }}>{match[4]}</span>)
    } else if (match[5]) {
      nodes.push(<span key={key} style={{ fontSize: `${match[5]}px` }}>{match[6]}</span>)
    }

    cursor = inlineFormatPattern.lastIndex
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes.length > 0 ? nodes : text
}

interface RichMarkdownPreviewProps {
  markdown: string
  emptyText?: string
  compact?: boolean
  maxLines?: number
}

export function RichMarkdownPreview({ markdown, emptyText = '暂无内容', compact = false, maxLines }: RichMarkdownPreviewProps) {
  const lines = rewriteMarkdownImageUrls(markdown).split('\n')
  const visibleLines = typeof maxLines === 'number' ? lines.slice(0, maxLines) : lines

  if (!markdown.trim()) {
    return <p className="text-[13px] text-faint">{emptyText}</p>
  }

  return (
    <article className={compact ? 'space-y-1 text-[13px] leading-[1.55] text-soft-ink' : 'space-y-3 text-[15px] leading-[1.85] text-ink'}>
      {visibleLines.map((rawLine, index) => {
        const line = rawLine.trimEnd()
        if (!line.trim()) {
          return compact ? null : <div key={`blank-${index}`} className="h-2" />
        }

        const image = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
        if (image) {
          return <img key={`${image[2]}-${index}`} src={image[2]} alt={image[1]} className={compact ? 'block max-h-20 max-w-full rounded-[4px] border border-hairline object-contain' : 'block max-h-[420px] max-w-full rounded-[6px] border border-hairline object-contain'} />
        }

        const heading = line.match(/^(#{1,3})\s+(.+)$/)
        if (heading) {
          const size = compact ? 'text-[14px]' : heading[1].length === 1 ? 'text-[22px]' : heading[1].length === 2 ? 'text-[19px]' : 'text-[16px]'
          return <h2 key={`${line}-${index}`} className={`font-serif font-medium leading-tight text-ink ${size}`}>{renderInline(heading[2])}</h2>
        }

        if (line.startsWith('- ')) {
          return <p key={`${line}-${index}`} className="pl-4 text-soft-ink before:mr-2 before:content-['•']">{renderInline(line.slice(2))}</p>
        }

        return <p key={`${line}-${index}`} className={compact ? 'line-clamp-2 text-soft-ink' : 'whitespace-pre-wrap text-soft-ink'}>{renderInline(line)}</p>
      })}
    </article>
  )
}
