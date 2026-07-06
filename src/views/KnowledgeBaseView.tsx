import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Tag } from '../components/Tag'
import type { EntryListResult, EntrySortOrder } from '../domain/knowledge'
import { EntryList } from '../features/knowledge-base/EntryList'
import { FilterSidebar } from '../features/knowledge-base/FilterSidebar'
import { SearchBar } from '../features/knowledge-base/SearchBar'
import { SegmentedControl } from '../features/knowledge-base/SegmentedControl'
import { ipcKnowledgeRepository } from '../repositories/ipcKnowledgeRepository'
import { EntryDetailPanel } from './EntryDetailView'

const LIST_WIDTH_STORAGE_KEY = 'personal-knowledge-base:list-width:v1'
const LIST_WIDTH_MIN = 240
const LIST_WIDTH_MAX = 640
const LIST_WIDTH_DEFAULT = 340

function readStoredListWidth(): number {
  if (typeof window === 'undefined') {
    return LIST_WIDTH_DEFAULT
  }
  const raw = window.localStorage.getItem(LIST_WIDTH_STORAGE_KEY)
  if (!raw) {
    return LIST_WIDTH_DEFAULT
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return LIST_WIDTH_DEFAULT
  }
  return Math.max(LIST_WIDTH_MIN, Math.min(LIST_WIDTH_MAX, Math.round(parsed)))
}

export function KnowledgeBaseView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<EntrySortOrder>('created_desc')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [selectedSourceApps, setSelectedSourceApps] = useState<string[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [result, setResult] = useState<EntryListResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listWidth, setListWidth] = useState<number>(readStoredListWidth)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(LIST_WIDTH_STORAGE_KEY, String(listWidth))
  }, [listWidth])

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    const handle = event.currentTarget
    const startX = event.clientX
    const startWidth = listWidth
    try {
      handle.setPointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    setIsResizing(true)

    const handleMove = (moveEvent: PointerEvent) => {
      const next = Math.max(LIST_WIDTH_MIN, Math.min(LIST_WIDTH_MAX, startWidth + (moveEvent.clientX - startX)))
      setListWidth(next)
    }
    const handleUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      try {
        handle.releasePointerCapture(upEvent.pointerId)
      } catch {
        // ignore
      }
      setIsResizing(false)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }

  useEffect(() => {
    const refresh = () => setRefreshKey((current) => current + 1)
    const refreshOnVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    const unsubscribeEntriesChanged = window.knowledgeApi?.onEntriesChanged?.(refresh) ?? (() => undefined)

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshOnVisibilityChange)
    return () => {
      unsubscribeEntriesChanged()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshOnVisibilityChange)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    setIsLoading(true)
    setError(null)

    ipcKnowledgeRepository
      .listEntries({
        q: query,
        sort,
        tagIds: selectedTagIds,
        sourceApps: selectedSourceApps,
      })
      .then((nextResult) => {
        if (!cancelled) {
          setResult(nextResult)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : '知识库数据读取失败')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [query, refreshKey, selectedSourceApps, selectedTagIds, sort])

  const facets = result?.facets ?? { categories: [], sources: [] }
  const entries = result?.entries ?? []
  const total = result?.total ?? 0

  useEffect(() => {
    if (!result) {
      return
    }
    const knownTagIds = new Set(facets.categories.flatMap((category) => category.tags.map((tag) => tag.id)))
    if (selectedTagIds.some((id) => !knownTagIds.has(id))) {
      setSelectedTagIds((current) => current.filter((id) => knownTagIds.has(id)))
    }
    const knownSourceApps = new Set(facets.sources.map((source) => source.app))
    if (selectedSourceApps.some((app) => !knownSourceApps.has(app))) {
      setSelectedSourceApps((current) => current.filter((app) => knownSourceApps.has(app)))
    }
  }, [result, facets.categories, facets.sources, selectedTagIds, selectedSourceApps])

  const selectedTags = useMemo(() => {
    const tags = facets.categories.flatMap((category) => category.tags)
    return tags.filter((tag) => selectedTagIds.includes(tag.id))
  }, [facets.categories, selectedTagIds])

  const leaveDetailIfNeeded = () => {
    if (id) {
      navigate('/')
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((candidate) => candidate !== tagId) : [...current, tagId],
    )
    leaveDetailIfNeeded()
  }

  const toggleSource = (sourceApp: string) => {
    setSelectedSourceApps((current) =>
      current.includes(sourceApp)
        ? current.filter((app) => app !== sourceApp)
        : [...current, sourceApp],
    )
    leaveDetailIfNeeded()
  }

  const hasFilters = query.trim() || selectedTags.length > 0 || selectedSourceApps.length > 0

  return (
    <div className="flex h-full flex-col bg-cream px-3 pb-3">
      <div className="mx-auto flex h-full w-full flex-col overflow-hidden rounded-[10px] border border-hairline bg-surface">
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
          <SearchBar value={query} onChange={setQuery} />
          <SegmentedControl value={sort} onChange={setSort} />
        </div>

        <div
          className={`grid min-h-0 flex-1 ${isResizing ? 'select-none' : ''}`}
          style={{ gridTemplateColumns: `200px ${listWidth}px 6px 1fr` }}
        >
          <div className="min-h-0 overflow-y-auto">
            <FilterSidebar
              categories={facets.categories}
              sources={facets.sources}
              selectedTagIds={selectedTagIds}
              selectedSourceApps={selectedSourceApps}
              onToggleTag={toggleTag}
              onToggleSource={toggleSource}
            />
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="flex h-9 items-center gap-1.5 border-b border-hairline px-4 text-[12px] text-soft-ink">
              <span className="shrink-0">筛选</span>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                {selectedTags.map((tag) => (
                  <Tag key={tag.id} label={tag.name} category={tag.color} closable onClose={() => toggleTag(tag.id)} />
                ))}
                {selectedSourceApps.map((sourceApp) => (
                  <button key={sourceApp} type="button" onClick={() => toggleSource(sourceApp)} className="shrink-0 rounded-[4px] bg-cream-soft px-2.5 py-[2px] text-[12px] font-medium text-soft-ink hover:text-ink">
                    来源: {sourceApp} ×
                  </button>
                ))}
                {query.trim() ? (
                  <button type="button" onClick={() => setQuery('')} className="shrink-0 rounded-[4px] bg-cream-soft px-2.5 py-[2px] text-[12px] font-medium text-soft-ink hover:text-ink">
                    搜索: {query} ×
                  </button>
                ) : null}
                {!hasFilters ? <span className="text-faint">全部条目</span> : null}
              </div>
              <span className="shrink-0 text-faint">
                {isLoading ? '读取中' : `${total} 条 · ${sort === 'created_desc' ? '最新' : '最早'}`}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {error ? (
                <div className="rounded-[6px] border border-hairline bg-cream-soft px-4 py-3 text-[13px] text-soft-ink">{error}</div>
              ) : (
                <EntryList entries={entries} isLoading={isLoading} activeId={id} />
              )}
            </div>
          </div>

          <div
            onPointerDown={startResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="拖动调整列表宽度"
            title="拖动调整列表宽度"
            className={`group relative cursor-col-resize ${isResizing ? 'bg-soft-ink/40' : 'hover:bg-hairline'} transition-colors`}
          >
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-hairline" />
          </div>

          <div className="min-h-0 overflow-y-auto">
            {id ? (
              <EntryDetailPanel id={id} embedded />
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center px-8 py-12 text-center">
                <div>
                  <p className="font-serif text-[18px] font-medium text-ink">选择左侧一条查看</p>
                  <p className="mt-2 text-[12px] text-soft-ink">点击列表里的任意知识,在这里查看正文、摘要和标签,不影响列表浏览。</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
