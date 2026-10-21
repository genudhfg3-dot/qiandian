import type { ReactNode } from 'react'
import { rewriteMarkdownImageUrls } from '../utils/imageUrls'
import { tryParseTableBlock } from '../utils/markdownTable'

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

interface TableBlock {
  type: 'table'
  headerCells: string[]
  bodyRows: string[][]
}

interface TextBlock {
  type: 'text'
  value: string
}

type PreviewBlock = TableBlock | TextBlock

function groupIntoBlocks(lines: string[]): PreviewBlock[] {
  const blocks: PreviewBlock[] = []
  let index = 0
  while (index < lines.length) {
    const table = tryParseTableBlock(lines, index)
    if (table) {
      blocks.push({ type: 'table', headerCells: table.headerCells, bodyRows: table.bodyRows })
      index += table.consumedLineCount
      continue
    }
    blocks.push({ type: 'text', value: lines[index] })
    index += 1
  }
  return blocks
}

interface RichMarkdownPreviewProps {
  markdown: string
  emptyText?: string
  compact?: boolean
  maxLines?: number
}

export function RichMarkdownPreview({ markdown, emptyText = '暂无内容', compact = false, maxLines }: RichMarkdownPreviewProps) {
  const blocks = groupIntoBlocks(rewriteMarkdownImageUrls(markdown).split('\n'))
  const visibleBlocks = typeof maxLines === 'number' ? blocks.slice(0, maxLines) : blocks

  if (!markdown.trim()) {
    return <p className="text-[13px] text-faint">{emptyText}</p>
  }

  return (
    <article className={`rich-preview ${compact ? 'compact space-y-1 text-[13px] leading-[1.55]' : 'space-y-3 text-[15px] leading-[1.85]'}`}>
      {visibleBlocks.map((block, index) => {
        if (block.type === 'table') {
          if (compact) {
            return (
              <p key={`table-${index}`} className="line-clamp-2 text-soft-ink">
                <span className="mr-1 rounded-[3px] bg-cream-soft px-1 text-[11px] font-medium text-soft-ink">表格</span>
                {block.headerCells.join(' · ')}
              </p>
            )
          }

          return (
            <div key={`table-${index}`} className="overflow-x-auto rounded-[6px] border border-hairline">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {block.headerCells.map((cell, cellIndex) => (
                      <th key={cellIndex} className="border-b border-hairline bg-cream-soft/60 px-3 py-1.5 text-left font-medium text-ink">
                        {renderInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.bodyRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 1 ? 'bg-cream-soft/25' : undefined}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="border-b border-hairline-soft px-3 py-1.5 align-top text-soft-ink">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        const line = block.value.trimEnd()
        if (!line.trim()) {
          return compact ? null : <div key={`blank-${index}`} className="h-2" />
        }

        const image = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
        if (image) {
          return <img key={`${image[2]}-${index}`} src={image[2]} alt={image[1]} className={compact ? 'block max-h-20 max-w-full rounded-[4px] border border-hairline object-contain' : 'block max-h-[420px] max-w-full rounded-[6px] border border-hairline object-contain'} />
        }

        const heading = line.match(/^(#{1,3})\s+(.+)$/)
        if (heading) {
          const level = heading[1].length
          const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
          const size = compact ? 'text-[14px]' : ''
          return <Tag key={`${line}-${index}`} className={`font-serif font-medium leading-tight ${size}`}>{renderInline(heading[2])}</Tag>
        }

        if (line.startsWith('- ')) {
          return <p key={`${line}-${index}`} className="rich-list-item pl-4 before:mr-2 before:content-['•']">{renderInline(line.slice(2))}</p>
        }

        return <p key={`${line}-${index}`} className={compact ? 'line-clamp-2' : 'whitespace-pre-wrap'}>{renderInline(line)}</p>
      })}
    </article>
  )
}
