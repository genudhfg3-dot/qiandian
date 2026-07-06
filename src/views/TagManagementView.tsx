import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderPlus, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Tag } from '../components/Tag'
import type { TagListResult, TagColor } from '../domain/knowledge'
import { ipcKnowledgeRepository } from '../repositories/ipcKnowledgeRepository'

const swatchColors: TagColor[] = [
  'work',
  'reading',
  'inspiration',
  'tools',
  'personal',
  'writing',
  'study',
  'archive',
]

const swatchClass: Record<TagColor, string> = {
  work: 'bg-tag-work',
  reading: 'bg-tag-reading',
  inspiration: 'bg-tag-inspiration',
  tools: 'bg-tag-tools',
  personal: 'bg-tag-personal',
  writing: 'bg-tag-writing',
  study: 'bg-tag-study',
  archive: 'bg-tag-archive',
  uncategorized: 'bg-tag-uncategorized',
}

interface ColorSwatchGridProps {
  value: TagColor
  onChange: (color: TagColor) => void
  size?: 'sm' | 'md'
}

function ColorSwatchGrid({ value, onChange, size = 'md' }: ColorSwatchGridProps) {
  const dot = size === 'sm' ? 'size-4' : 'size-5'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {swatchColors.map((color) => {
        const active = value === color
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`选择颜色 ${color}`}
            aria-pressed={active}
            className={`${dot} rounded-full ${swatchClass[color]} transition ${
              active ? 'ring-2 ring-ink ring-offset-1 ring-offset-surface' : 'hover:scale-110'
            }`}
          />
        )
      })}
    </div>
  )
}

interface CategoryColorButtonProps {
  color: TagColor
  disabled?: boolean
  onSelect: (color: TagColor) => void
}

function CategoryColorButton({ color, disabled, onSelect }: CategoryColorButtonProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`size-6 rounded-full ${swatchClass[color]} ring-1 ring-hairline transition hover:ring-soft-ink disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label="修改分类颜色"
        title="修改分类颜色"
      />
      {open ? (
        <div className="absolute left-0 top-8 z-20 rounded-[6px] border border-hairline bg-surface p-2 shadow-md">
          <ColorSwatchGrid
            value={color}
            onChange={(next) => {
              setOpen(false)
              onSelect(next)
            }}
            size="sm"
          />
        </div>
      ) : null}
    </div>
  )
}

export function TagManagementView() {
  const [tagName, setTagName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [categoryColor, setCategoryColor] = useState<TagColor>('work')
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null)
  const [result, setResult] = useState<TagListResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const categories = result?.categories ?? []
  const fallbackCategoryId = useMemo(
    () => defaultCategoryId ?? categories.find((category) => category.color === 'uncategorized')?.id ?? categories[0]?.id ?? null,
    [categories, defaultCategoryId],
  )

  const loadTags = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const tags = await ipcKnowledgeRepository.listTags()
      setResult(tags)
      if (!defaultCategoryId) {
        setDefaultCategoryId(tags.categories.find((category) => category.color === 'uncategorized')?.id ?? tags.categories[0]?.id ?? null)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '标签读取失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTags()
  }, [])

  const withSaving = async (operation: () => Promise<TagListResult>, success: string) => {
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      setResult(await operation())
      setNotice(success)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败')
    } finally {
      setIsSaving(false)
    }
  }

  const createTag = async () => {
    const name = tagName.trim()
    if (!name) {
      return
    }

    await withSaving(() => ipcKnowledgeRepository.createTag({ name, categoryId: fallbackCategoryId }), `已创建标签：${name}`)
    setTagName('')
  }

  const createCategory = async () => {
    const name = categoryName.trim()
    if (!name) {
      return
    }

    await withSaving(() => ipcKnowledgeRepository.createTagCategory({ name, color: categoryColor }), `已创建分类：${name}`)
    setCategoryName('')
  }

  const deleteCategory = async (categoryId: string, categoryName: string) => {
    const confirmed = window.confirm(`确定删除分类「${categoryName}」吗？该分类下的标签会移动到未分类。`)
    if (!confirmed) {
      return
    }
    if (defaultCategoryId === categoryId) {
      setDefaultCategoryId(null)
    }
    await withSaving(() => ipcKnowledgeRepository.deleteTagCategory({ id: categoryId }), `已删除分类：${categoryName}`)
  }

  const updateCategoryColor = async (categoryId: string, color: TagColor) => {
    await withSaving(() => ipcKnowledgeRepository.updateTagCategory({ id: categoryId, color }), `已更新分类颜色`)
  }

  const deleteTag = async (tagId: string, tagName: string, count: number) => {
    const confirmed = window.confirm(`确定删除标签「${tagName}」吗？它会从 ${count} 条知识中移除。`)
    if (!confirmed) {
      return
    }
    await withSaving(() => ipcKnowledgeRepository.deleteTag({ id: tagId }), `已删除标签：${tagName}`)
  }

  return (
    <div className="h-full overflow-y-auto bg-cream px-6 pb-6">
      <div className="mx-auto grid max-w-6xl grid-cols-[200px_1fr] overflow-hidden rounded-[10px] border border-hairline bg-surface">
        <aside className="border-r border-hairline px-3 py-4">
          <div className="grid gap-1">
            <Link to="/" className="rounded-[4px] px-2 py-1.5 text-[12px] text-soft-ink hover:bg-cream-soft hover:text-ink">返回知识库</Link>
            <span className="rounded-[4px] bg-ink px-2 py-1.5 text-[12px] font-medium text-cream">标签管理</span>
            <Link to="/settings" className="rounded-[4px] px-2 py-1.5 text-[12px] text-soft-ink hover:bg-cream-soft hover:text-ink">AI 设置</Link>
            <Link to="/about" className="rounded-[4px] px-2 py-1.5 text-[12px] text-soft-ink hover:bg-cream-soft hover:text-ink">关于千点</Link>
          </div>
        </aside>
        <main>
        <div className="grid gap-4 border-b border-hairline px-5 py-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <h1 className="font-serif text-[22px] font-medium text-ink">标签管理</h1>
            <p className="mt-1 text-[12px] text-soft-ink">创建分类、移动标签、删除不再使用的标签。</p>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <input value={tagName} onChange={(event) => setTagName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createTag() } }} className="min-w-0 flex-1 rounded-[4px] border border-hairline bg-transparent px-3 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="新标签名称" />
              <select key={categories.length} value={fallbackCategoryId ?? ''} onChange={(event) => setDefaultCategoryId(event.target.value || null)} className="w-28 rounded-[4px] border border-hairline bg-surface px-2 py-1.5 text-[12px] text-soft-ink outline-none focus:border-soft-ink">
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <button type="button" onClick={() => void createTag()} disabled={isSaving || !tagName.trim()} className="inline-flex items-center gap-1 rounded-[4px] bg-ink px-3 py-1.5 text-[13px] font-medium text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={13} strokeWidth={2} />标签</button>
            </div>
            <div className="flex items-center gap-2">
              <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createCategory() } }} className="min-w-0 flex-1 rounded-[4px] border border-hairline bg-transparent px-3 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="新分类名称" />
              <ColorSwatchGrid value={categoryColor} onChange={setCategoryColor} size="sm" />
              <button type="button" onClick={() => void createCategory()} disabled={isSaving || !categoryName.trim()} className="inline-flex items-center gap-1 rounded-[4px] border border-hairline px-3 py-1.5 text-[13px] font-medium text-soft-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"><FolderPlus size={13} strokeWidth={2} />分类</button>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-[12px] text-soft-ink">
            <span>{isLoading ? '读取中' : `共 ${result?.total ?? 0} 个标签`}</span>
            {notice ? <span className="text-teal-deep">{notice}</span> : null}
          </div>

          {error ? <div className="mb-3 rounded-[6px] border border-hairline bg-cream-soft px-4 py-3 text-[13px] text-terracotta">{error}</div> : null}
          {!isLoading && !error && categories.length === 0 ? <div className="flex min-h-[220px] items-center justify-center rounded-[6px] border border-dashed border-hairline bg-cream-soft/45 text-[13px] text-soft-ink">还没有标签</div> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {categories.map((category) => (
              <section key={category.id} className="rounded-[6px] border border-hairline bg-cream-soft/40 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {category.color !== 'uncategorized' ? (
                      <CategoryColorButton
                        color={category.color}
                        disabled={isSaving}
                        onSelect={(next) => void updateCategoryColor(category.id, next)}
                      />
                    ) : (
                      <div className={`size-6 rounded-full ${swatchClass.uncategorized} ring-1 ring-hairline`} title="未分类颜色" />
                    )}
                    <div>
                      <h2 className="font-serif text-[16px] font-medium text-ink">{category.name}</h2>
                      <span className="text-[11px] text-faint">{category.tags.length} 个 · {category.count} 次使用</span>
                    </div>
                  </div>
                  {category.color !== 'uncategorized' ? (
                    <button type="button" onClick={() => void deleteCategory(category.id, category.name)} disabled={isSaving} className="inline-flex size-7 items-center justify-center rounded-[4px] text-faint hover:bg-surface hover:text-terracotta" title="删除分类，标签移入未分类"><Trash2 size={13} strokeWidth={2} /></button>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  {category.tags.map((tag) => (
                    <div key={tag.id} className="flex items-center gap-2 rounded-[4px] bg-surface/70 px-2 py-1.5">
                      <Tag label={`${tag.name} · ${tag.count}`} category={tag.color} />
                      <select value={tag.categoryId ?? ''} onChange={(event) => void withSaving(() => ipcKnowledgeRepository.updateTag({ id: tag.id, categoryId: event.target.value || null }), `已移动标签：${tag.name}`)} className="ml-auto w-28 rounded-[4px] border border-hairline bg-surface px-2 py-1 text-[12px] text-soft-ink outline-none focus:border-soft-ink">
                        {categories.map((targetCategory) => <option key={targetCategory.id} value={targetCategory.id}>{targetCategory.name}</option>)}
                      </select>
                      <button type="button" onClick={() => void deleteTag(tag.id, tag.name, tag.count)} disabled={isSaving} className="inline-flex size-7 items-center justify-center rounded-[4px] text-faint hover:bg-cream-soft hover:text-terracotta" title="删除标签"><Trash2 size={13} strokeWidth={2} /></button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        </main>
      </div>
    </div>
  )
}
