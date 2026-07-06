import { X } from 'lucide-react'
import type { TagColor } from '../domain/knowledge'

const styles: Record<TagColor, string> = {
  work: 'bg-tag-work text-tag-work-fg',
  reading: 'bg-tag-reading text-tag-reading-fg',
  inspiration: 'bg-tag-inspiration text-tag-inspiration-fg',
  tools: 'bg-tag-tools text-tag-tools-fg',
  personal: 'bg-tag-personal text-tag-personal-fg',
  writing: 'bg-tag-writing text-tag-writing-fg',
  study: 'bg-tag-study text-tag-study-fg',
  archive: 'bg-tag-archive text-tag-archive-fg',
  uncategorized: 'bg-tag-uncategorized text-tag-uncategorized-fg',
}

interface TagProps {
  label: string
  category: TagColor
  size?: 'sm' | 'md'
  closable?: boolean
  onClose?: () => void
}

export function Tag({ label, category, size = 'md', closable, onClose }: TagProps) {
  const sizeClass =
    size === 'sm' ? 'px-2 py-[1px] text-[11px]' : 'px-2.5 py-[2px] text-[12px]'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[4px] font-medium leading-snug ${styles[category]} ${sizeClass}`}
    >
      {label}
      {closable && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="-mr-0.5 inline-flex items-center opacity-80 hover:opacity-100"
          aria-label={`移除标签 ${label}`}
        >
          <X size={size === 'sm' ? 10 : 11} strokeWidth={2} />
        </button>
      )}
    </span>
  )
}
