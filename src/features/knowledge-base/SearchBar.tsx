import { Search, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-[6px] bg-cream-soft px-3 py-1.5">
      <Search size={14} className="text-soft-ink" strokeWidth={2} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        placeholder="搜索全文 / 标题 / 来源"
        type="search"
      />
      {value.trim() ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-faint hover:text-ink"
          aria-label="清空搜索"
        >
          <X size={13} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  )
}
