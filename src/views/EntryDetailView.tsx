import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ExternalLink, Pencil, RefreshCw, Save, Search, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorToolbar } from '../components/EditorToolbar'
import { RichMarkdownPreview } from '../components/RichMarkdownPreview'
import { RichTextEditor } from '../components/RichTextEditor'
import type { RichTextEditorHandle } from '../components/RichTextEditor'
import { Tag } from '../components/Tag'
import type { Entry, SourceInfo, TagFacet } from '../domain/knowledge'
import { SourceBadge } from '../features/knowledge-base/SourceBadge'
import { ipcKnowledgeRepository } from '../repositories/ipcKnowledgeRepository'

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function selectedNames(entry: Entry) {
  return entry.tags.map((tag) => tag.name)
}

function uniqueNames(names: string[]) {
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)))
}

interface SummarySection {
  label: string
  body: string
}

const summarySectionKeys: Array<{ label: string; matcher: RegExp }> = [
  { label: '内容总结', matcher: /(?:内容总结|摘要|总结)\s*[：:]\s*/ },
  { label: '适用场景', matcher: /适用场景\s*[：:]\s*/ },
  { label: '关键词', matcher: /关键词\s*[：:]\s*/ },
]

function parseSummarySections(summary: string): SummarySection[] | null {
  const normalized = summary.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return null
  }
  const markers = summarySectionKeys
    .map(({ label, matcher }) => {
      const match = matcher.exec(normalized)
      return match ? { label, start: match.index, end: match.index + match[0].length } : null
    })
    .filter((entry): entry is { label: string; start: number; end: number } => entry !== null)
    .sort((a, b) => a.start - b.start)

  if (markers.length === 0) {
    return null
  }

  return markers.map((marker, index) => {
    const nextStart = markers[index + 1]?.start ?? normalized.length
    const body = normalized.slice(marker.end, nextStart).replace(/\s+$/g, '').trim()
    return { label: marker.label, body }
  }).filter((section) => section.body.length > 0)
}

interface EntryDetailPanelProps {
  id?: string
  embedded?: boolean
}

export function EntryDetailPanel({ id, embedded = false }: EntryDetailPanelProps) {
  const navigate = useNavigate()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [availableTags, setAvailableTags] = useState<TagFacet[]>([])
  const [tagSearch, setTagSearch] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [draftTagNames, setDraftTagNames] = useState<string[]>([])
  const [draftSource, setDraftSource] = useState<SourceInfo>({ app: '手动来源' })
  const editorRef = useRef<RichTextEditorHandle | null>(null)
  const isEditingRef = useRef(isEditing)

  useEffect(() => {
    isEditingRef.current = isEditing
  }, [isEditing])

  const loadEntry = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const nextEntry = await ipcKnowledgeRepository.getEntry(id ?? '')
      setEntry(nextEntry)
      if (nextEntry && !isEditingRef.current) {
        setDraftTitle(nextEntry.title)
        setDraftContent(nextEntry.contentMd)
        setDraftTagNames(selectedNames(nextEntry))
        setDraftSource(nextEntry.source)
      }
      try {
        const tagList = await ipcKnowledgeRepository.listTags()
        setAvailableTags(tagList.categories.flatMap((category) => category.tags))
      } catch {
        setAvailableTags([])
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '知识读取失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0)
    void loadEntry()
  }, [id])

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => editorRef.current?.focus())
    }
  }, [isEditing])

  const selectedTags = useMemo(
    () =>
      draftTagNames.map((tagName) =>
        availableTags.find((tag) => tag.name === tagName) ?? {
          id: tagName,
          name: tagName,
          categoryId: 'uncategorized',
          color: 'uncategorized' as const,
          count: 0,
        },
      ),
    [availableTags, draftTagNames],
  )

  const filteredTags = useMemo(() => {
    const query = tagSearch.trim().toLocaleLowerCase()
    return availableTags.filter((tag) => !query || tag.name.toLocaleLowerCase().includes(query))
  }, [availableTags, tagSearch])

  const beginEdit = () => {
    if (!entry) {
      return
    }
    setDraftTitle(entry.title)
    setDraftContent(entry.contentMd)
    setDraftTagNames(selectedNames(entry))
    setDraftSource(entry.source)
    setNotice(null)
    setError(null)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setError(null)
    if (entry) {
      setDraftTitle(entry.title)
      setDraftContent(entry.contentMd)
      setDraftTagNames(selectedNames(entry))
      setDraftSource(entry.source)
    }
  }

  const toggleTag = (tagName: string) => {
    setDraftTagNames((current) =>
      current.includes(tagName) ? current.filter((candidate) => candidate !== tagName) : [...current, tagName],
    )
  }

  const addNewTag = () => {
    const tagName = newTagName.trim()
    if (!tagName) {
      return
    }
    setDraftTagNames((current) => uniqueNames([...current, tagName]))
    setNewTagName('')
  }

  const saveEntry = async () => {
    if (!entry) {
      return
    }
    if (!draftContent.trim()) {
      setError('正文不能为空')
      return
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await ipcKnowledgeRepository.updateEntry({
        id: entry.id,
        title: draftTitle,
        contentMd: draftContent,
        source: draftSource,
        tagNames: draftTagNames,
        images: entry.images,
      })
      setEntry(updated)
      setDraftTagNames(selectedNames(updated))
      setIsEditing(false)
      setNotice('已保存修改')
      void ipcKnowledgeRepository.listTags().then((tagList) => setAvailableTags(tagList.categories.flatMap((category) => category.tags)))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const regenerateMetadata = async () => {
    if (!entry) {
      return
    }
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await ipcKnowledgeRepository.regenerateMetadata(entry.id)
      setEntry(updated)
      setDraftTitle(updated.title)
      setDraftTagNames(selectedNames(updated))
      const statusMessages: Record<string, string> = {
        ready: '已重新生成标题和摘要',
        disabled: 'AI 未启用，请在设置中开启',
        failed: 'AI 生成失败，请检查模型配置和 API 密钥',
        pending: '正在生成中...',
      }
      setNotice(updated.metadataStatus ? (statusMessages[updated.metadataStatus] ?? 'AI 未启用或生成失败，已保留本地内容') : 'AI 未启用或生成失败，已保留本地内容')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '重新生成失败')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteEntry = async () => {
    if (!entry) {
      return
    }
    const confirmed = window.confirm(`确定删除「${entry.title}」吗？删除后无法从知识库中恢复。`)
    if (!confirmed) {
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await ipcKnowledgeRepository.deleteEntry({ id: entry.id })
      navigate('/')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败')
    } finally {
      setIsSaving(false)
    }
  }

  const content = (
    <section className={embedded ? 'min-h-0 bg-surface' : 'mx-auto max-w-4xl overflow-hidden rounded-[10px] border border-hairline bg-surface'}>
      <div className="border-b border-hairline px-5 py-4">
        {embedded ? null : (
          <Link to="/" className="mb-4 inline-flex items-center gap-1 text-[12px] text-soft-ink hover:text-ink">
            <ArrowLeft size={13} strokeWidth={2} /> 返回知识库
          </Link>
        )}
        {entry ? (
          <>
            <div className="flex items-start justify-between gap-4">
              {isEditing ? (
                <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="min-w-0 flex-1 rounded-[4px] border border-hairline bg-cream-soft px-3 py-2 font-serif text-[24px] font-medium leading-tight text-ink outline-none focus:border-soft-ink" placeholder="标题可留空，保存时自动生成" />
              ) : (
                <h1 className="font-serif text-[28px] font-medium leading-tight text-ink">{entry.title}</h1>
              )}
              <div className="flex shrink-0 items-center gap-1">
                {isEditing ? (
                  <>
                    <button type="button" onClick={() => void saveEntry()} disabled={isSaving} className="inline-flex items-center gap-1 rounded-[4px] bg-ink px-3 py-1.5 text-[12px] font-medium text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"><Save size={13} strokeWidth={2} />保存</button>
                    <button type="button" onClick={cancelEdit} disabled={isSaving} className="inline-flex items-center gap-1 rounded-[4px] border border-hairline px-3 py-1.5 text-[12px] text-soft-ink hover:text-ink"><X size={13} strokeWidth={2} />取消</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => void regenerateMetadata()} disabled={isSaving} className="inline-flex items-center gap-1 rounded-[4px] border border-hairline px-3 py-1.5 text-[12px] text-soft-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={13} strokeWidth={2} />重新生成</button>
                    <button type="button" onClick={beginEdit} className="inline-flex items-center gap-1 rounded-[4px] border border-hairline px-3 py-1.5 text-[12px] text-soft-ink hover:text-ink"><Pencil size={13} strokeWidth={2} />编辑</button>
                    <button type="button" onClick={() => void deleteEntry()} disabled={isSaving} className="inline-flex items-center gap-1 rounded-[4px] border border-hairline px-3 py-1.5 text-[12px] text-terracotta hover:bg-cream-soft disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={13} strokeWidth={2} />删除</button>
                  </>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <input value={draftSource.app} onChange={(event) => setDraftSource((current) => ({ ...current, app: event.target.value }))} className="min-w-0 rounded-[4px] border border-hairline bg-transparent px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="来源应用" />
                <input value={draftSource.title ?? ''} onChange={(event) => setDraftSource((current) => ({ ...current, title: event.target.value }))} className="min-w-0 rounded-[4px] border border-hairline bg-transparent px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="来源标题" />
                <input value={draftSource.url ?? ''} onChange={(event) => setDraftSource((current) => ({ ...current, url: event.target.value }))} className="min-w-0 rounded-[4px] border border-hairline bg-transparent px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="来源 URL" />
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-soft-ink">
                <SourceBadge app={entry.source.app} />
                {entry.source.title ? <span className="truncate">{entry.source.title}</span> : null}
                {entry.source.url ? (
                  <a href={entry.source.url} className="inline-flex items-center gap-1 text-teal-deep hover:underline">
                    来源链接 <ExternalLink size={12} strokeWidth={2} />
                  </a>
                ) : null}
                <span className="text-faint">{dateFormatter.format(entry.createdAt)}</span>
                <span className="text-faint">元数据状态：{entry.metadataStatus ?? 'local'}</span>
              </div>
            )}

            {isEditing ? (
              <div className="mt-3 grid gap-2">
                <div className="flex min-h-7 flex-wrap items-center gap-1.5">
                  <span className="w-14 shrink-0 text-[12px] text-faint">已选标签</span>
                  {selectedTags.length > 0 ? selectedTags.map((tag) => <Tag key={tag.name} label={tag.name} category={tag.color} closable onClose={() => toggleTag(tag.name)} />) : <span className="text-[12px] text-faint">无</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-14 shrink-0 text-[12px] text-faint">可选标签</span>
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint" size={12} strokeWidth={2} />
                    <input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} className="h-7 w-full rounded-[4px] border border-hairline bg-white pl-7 pr-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="搜索标签" />
                  </div>
                  <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addNewTag() } }} className="h-7 w-24 rounded-[4px] border border-hairline bg-white px-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="新标签" />
                  <button type="button" onClick={addNewTag} className="inline-flex h-7 items-center gap-1 rounded-[4px] border border-dashed border-faint bg-white px-2 text-[12px] text-soft-ink hover:text-ink">添加</button>
                </div>
                <div className="ml-14 flex max-h-16 flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {filteredTags.map((tag) => {
                    const active = draftTagNames.includes(tag.name)
                    return <button key={tag.id} type="button" onClick={() => toggleTag(tag.name)} className={`rounded-[4px] px-2 py-[2px] text-[12px] ${active ? 'bg-ink text-cream' : 'bg-white text-soft-ink hover:text-ink'}`}>{tag.name}</button>
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entry.tags.map((tag) => <Tag key={tag.id} label={tag.name} category={tag.color} />)}
              </div>
            )}
          </>
        ) : null}
      </div>

      {entry && !isEditing && entry.summary ? (
        <div className="border-b border-hairline bg-cream-soft/40 px-5 py-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">AI 摘要</div>
          {(() => {
            const sections = parseSummarySections(entry.summary)
            if (!sections) {
              return <div className="whitespace-pre-wrap text-[13px] leading-[1.7] text-soft-ink">{entry.summary}</div>
            }
            return (
              <dl className="grid gap-1.5 text-[13px] leading-[1.7] text-soft-ink">
                {sections.map((section) => (
                  <div key={section.label} className="grid grid-cols-[64px_1fr] gap-2">
                    <dt className="text-[12px] font-medium text-faint">{section.label}</dt>
                    <dd className="whitespace-pre-wrap">{section.body}</dd>
                  </div>
                ))}
              </dl>
            )
          })()}
        </div>
      ) : null}

      <div className="px-5 py-5">
        {isLoading ? <div className="text-[13px] text-soft-ink">正在读取全文...</div> : null}
        {error ? <div className="mb-3 rounded-[6px] border border-hairline bg-cream-soft px-4 py-3 text-[13px] text-terracotta">{error}</div> : null}
        {notice ? <div className="mb-3 rounded-[6px] border border-hairline bg-cream-soft px-4 py-3 text-[13px] text-teal-deep">{notice}</div> : null}
        {!isLoading && !error && !entry ? <div className="text-[13px] text-soft-ink">没有找到这条知识。</div> : null}
        {entry && isEditing ? (
          <div className="grid gap-2">
            <EditorToolbar editorRef={editorRef} />
            <RichTextEditor ref={editorRef} value={draftContent} onChange={setDraftContent} className="min-h-[420px] w-full" placeholder="直接输入或粘贴正文..." />
          </div>
        ) : null}
        {entry && !isEditing ? <RichMarkdownPreview markdown={entry.contentMd} /> : null}
      </div>
    </section>
  )

  return embedded ? content : <div className="h-full overflow-y-auto bg-cream px-6 pb-8">{content}</div>
}

export function EntryDetailView() {
  const { id } = useParams()
  return <EntryDetailPanel id={id} />
}
