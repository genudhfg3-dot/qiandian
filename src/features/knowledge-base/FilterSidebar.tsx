import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Tag } from '../../components/Tag'
import type { SourceFacet, TagCategoryFacet } from '../../domain/knowledge'
import { SourceBadge } from './SourceBadge'
import { TYPOGRAPHY_THEME_OPTIONS, readTypographyTheme, writeTypographyTheme, type TypographyTheme } from '../../utils/typographyTheme'

interface FilterSidebarProps {
  categories: TagCategoryFacet[]
  sources: SourceFacet[]
  selectedTagIds: string[]
  selectedSourceApps: string[]
  onToggleTag: (tagId: string) => void
  onToggleSource: (sourceApp: string) => void
}

export function FilterSidebar({
  categories,
  sources,
  selectedTagIds,
  selectedSourceApps,
  onToggleTag,
  onToggleSource,
}: FilterSidebarProps) {
  const { pathname } = useLocation()
  const [typographyTheme, setTypographyTheme] = useState<TypographyTheme>(readTypographyTheme())

  const handleThemeChange = (theme: TypographyTheme) => {
    writeTypographyTheme(theme)
    setTypographyTheme(theme)
  }
  const navItems = [
    { to: '/', label: '知识库', active: pathname === '/' || pathname.startsWith('/entries/') },
    { to: '/tags', label: '标签管理', active: pathname === '/tags' },
    { to: '/settings', label: 'AI 设置', active: pathname === '/settings' },
    { to: '/about', label: '关于千点', active: pathname === '/about' },
  ]

  return (
    <aside className="border-r border-hairline px-3 py-4">
      {categories.map((category) => (
        <div key={category.id} className="mb-4">
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <span className="font-serif text-[15px] font-medium text-ink">{category.name}</span>
            <span className="text-[11px] text-faint">{category.count}</span>
          </div>
          <div className="flex flex-col gap-1">
            {category.tags.map((tag) => {
              const active = selectedTagIds.includes(tag.id)
              return (
                <button key={tag.id} type="button" onClick={() => onToggleTag(tag.id)} className={`flex items-center justify-between px-1 py-[3px] text-left ${active ? 'rounded-[4px] bg-cream-soft' : 'hover:text-ink'}`} aria-pressed={active}>
                  <Tag label={tag.name} category={tag.color} size="sm" />
                  <span className="text-[11px] text-faint">{tag.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="mb-1.5 mt-6 px-1">
        <span className="font-serif text-[15px] font-medium text-ink">来源</span>
      </div>
      <div className="flex flex-col gap-1">
        {sources.map((source) => {
          const active = selectedSourceApps.includes(source.app)
          return (
            <button key={source.app} type="button" onClick={() => onToggleSource(source.app)} className={`flex items-center justify-between px-1 py-[3px] text-left ${active ? 'rounded-[4px] bg-cream-soft' : 'hover:text-ink'}`} aria-pressed={active}>
              <SourceBadge app={source.app} />
              <span className="text-[11px] text-faint">{source.count}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 border-t border-hairline pt-3">
        <div className="mb-2 px-1">
          <span className="text-[11px] text-faint">正文外观</span>
        </div>
        <div className="flex gap-1 px-1">
          {TYPOGRAPHY_THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleThemeChange(option.value)}
              className={`flex-1 rounded-[4px] px-1 py-1 text-center text-[11px] transition-colors ${
                typographyTheme === option.value
                  ? 'bg-ink font-medium text-cream'
                  : 'text-soft-ink hover:bg-cream-soft hover:text-ink'
              }`}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-1 border-t border-hairline pt-3">
        {navItems.map((item) => (
          <Link key={item.to} to={item.to} className={item.active ? 'rounded-[4px] bg-cream-soft px-2 py-1.5 text-[12px] font-medium text-ink' : 'rounded-[4px] px-2 py-1.5 text-[12px] text-soft-ink hover:bg-cream-soft hover:text-ink'}>
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  )
}
