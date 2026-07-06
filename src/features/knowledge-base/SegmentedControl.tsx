import type { EntrySortOrder } from '../../domain/knowledge'

interface SegmentedControlProps {
  value: EntrySortOrder
  onChange: (value: EntrySortOrder) => void
}

const options: { label: string; value: EntrySortOrder }[] = [
  { label: '最新', value: 'created_desc' },
  { label: '最早', value: 'created_asc' },
]

export function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  return (
    <div className="flex overflow-hidden rounded-[4px] border border-hairline">
      {options.map((option, index) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 text-[12px] ${
              index > 0 ? 'border-l border-hairline' : ''
            } ${active ? 'bg-cream-soft font-medium text-ink' : 'text-soft-ink hover:text-ink'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
