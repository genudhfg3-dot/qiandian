import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Bold, ChevronDown, Highlighter, Palette, Plus, Search, Type, X } from 'lucide-react'
import { RichTextEditor } from '../components/RichTextEditor'
import type { InlineFormatKind, RichTextEditorHandle } from '../components/RichTextEditor'
import { Tag } from '../components/Tag'
import type { SourceInfo, TagFacet } from '../domain/knowledge'
import type { CapturedClipboardImage } from '../electron-api'
import { captureRepository } from '../repositories/captureRepository'
import { ipcKnowledgeRepository } from '../repositories/ipcKnowledgeRepository'
import { captureStatusLabel, captureStatusMessage } from '../utils/captureStatus'
import type { CaptureSaveState } from '../utils/captureStatus'
import { manualCaptureSource, normalizeCaptureSource, updateCaptureSource } from '../utils/sourceForm'
import { toAppImageUrl } from '../utils/imageUrls'
import { generateEntryTitle } from '../utils/title'

const draftStorageKey = 'personal-knowledge-base:capture-draft:v1'
const closeFeedbackMs = 650
interface CaptureDraft {
  contentMd: string
  draftTitle: string
  selectedTagNames: string[]
  source: SourceInfo
  capturedImages: CapturedClipboardImage[]
  savedEntryId: string | null
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function statusClassName(state: CaptureSaveState) {
  if (state === 'success') {
    return 'text-teal-deep'
  }
  if (state === 'failure' || state === 'images_cleaned') {
    return 'text-terracotta'
  }
  return 'text-soft-ink'
}

function cleanDuplicatedSourceTitle(source: SourceInfo) {
  const normalized = normalizeCaptureSource(source)
  if (normalized.title?.trim().toLocaleLowerCase() === normalized.app.trim().toLocaleLowerCase()) {
    return { ...normalized, title: '' }
  }
  return normalized
}

function snapshotFor(draft: CaptureDraft) {
  return JSON.stringify({
    contentMd: draft.contentMd,
    draftTitle: draft.draftTitle,
    source: cleanDuplicatedSourceTitle(draft.source),
    tags: draft.selectedTagNames,
    images: draft.capturedImages.map((image) => image.path),
  })
}

function sourceSummary(source: SourceInfo) {
  const title = source.title?.trim()
  const url = source.url?.trim()
  return [source.app, title, url].filter(Boolean).join(' · ')
}

function mergeCapturedImages(current: CapturedClipboardImage[], next: CapturedClipboardImage[]) {
  const knownPaths = new Set(current.map((image) => image.path))
  return [...current, ...next.filter((image) => !knownPaths.has(image.path))]
}

function readStoredDraft(): CaptureDraft | null {
  try {
    const raw = window.localStorage.getItem(draftStorageKey)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<CaptureDraft>
    if (!parsed.contentMd?.trim()) {
      return null
    }
    return {
      contentMd: parsed.contentMd,
      draftTitle: parsed.draftTitle ?? '',
      selectedTagNames: Array.isArray(parsed.selectedTagNames) ? parsed.selectedTagNames.filter(Boolean) : [],
      source: cleanDuplicatedSourceTitle(parsed.source ?? manualCaptureSource),
      capturedImages: Array.isArray(parsed.capturedImages) ? parsed.capturedImages.filter((image) => image?.path) : [],
      savedEntryId: parsed.savedEntryId ?? null,
    }
  } catch {
    return null
  }
}

export function CaptureWindowView() {
  const [contentMd, setContentMd] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [availableTags, setAvailableTags] = useState<TagFacet[]>([])
  const [source, setSource] = useState(manualCaptureSource)
  const [sourceExpanded, setSourceExpanded] = useState(false)
  const [isLoadingTags, setIsLoadingTags] = useState(true)
  const [isLoadingSource, setIsLoadingSource] = useState(true)
  const [saveState, setSaveState] = useState<CaptureSaveState>('idle')
  const [capturedImages, setCapturedImages] = useState<CapturedClipboardImage[]>([])
  const [savedTitle, setSavedTitle] = useState<string | undefined>()
  const [statusError, setStatusError] = useState<string | undefined>()
  const [cleanedImageCount, setCleanedImageCount] = useState(0)
  const [notice, setNotice] = useState<string | null>('像便签一样直接写，关闭时会自动保存。')
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [hasRecoverableDraft, setHasRecoverableDraft] = useState(false)
  const editorRef = useRef<RichTextEditorHandle | null>(null)
  const capturedImagesRef = useRef<CapturedClipboardImage[]>([])
  const restoredDraftRef = useRef(false)
  const currentDraftRef = useRef<CaptureDraft>({ contentMd: '', draftTitle: '', selectedTagNames: [], source: manualCaptureSource, capturedImages: [], savedEntryId: null })
  const latestSnapshotRef = useRef(snapshotFor(currentDraftRef.current))
  const lastSavedSnapshotRef = useRef('')
  const savedEntryIdRef = useRef<string | null>(null)
  const savePromiseRef = useRef<Promise<boolean> | null>(null)
  const pendingSaveRef = useRef(false)
  const closeAfterSaveRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    const storedDraft = readStoredDraft()
    if (storedDraft) {
      restoredDraftRef.current = true
      setContentMd(storedDraft.contentMd)
      setDraftTitle(storedDraft.draftTitle)
      setSelectedTagNames(storedDraft.selectedTagNames)
      setSource(storedDraft.source)
      setCapturedImages(storedDraft.capturedImages)
      setSavedEntryId(storedDraft.savedEntryId)
      savedEntryIdRef.current = storedDraft.savedEntryId
      setHasRecoverableDraft(true)
      setNotice('已恢复上次未完成的草稿。')
    }
    setDraftReady(true)
  }, [])

  useEffect(() => {
    capturedImagesRef.current = capturedImages
  }, [capturedImages])

  useEffect(() => {
    savedEntryIdRef.current = savedEntryId
  }, [savedEntryId])

  const normalizedSource = useMemo(() => cleanDuplicatedSourceTitle(source), [source])
  const generatedTitle = useMemo(() => generateEntryTitle(contentMd, normalizedSource), [contentMd, normalizedSource])
  const currentDraft = useMemo(
    () => ({ contentMd, draftTitle, selectedTagNames, source: normalizedSource, capturedImages, savedEntryId }) satisfies CaptureDraft,
    [contentMd, draftTitle, selectedTagNames, normalizedSource, capturedImages, savedEntryId],
  )
  const currentSnapshot = useMemo(() => snapshotFor(currentDraft), [currentDraft])

  useEffect(() => {
    currentDraftRef.current = currentDraft
    latestSnapshotRef.current = currentSnapshot
    if (!draftReady) {
      return
    }

    if (contentMd.trim() && currentSnapshot !== lastSavedSnapshotRef.current) {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(currentDraft))
      setHasRecoverableDraft(true)
    } else if (!contentMd.trim()) {
      window.localStorage.removeItem(draftStorageKey)
      setHasRecoverableDraft(false)
    }
  }, [currentDraft, currentSnapshot, contentMd, draftReady])

  useEffect(() => () => {
    const images = capturedImagesRef.current
    if (images.length > 0) {
      void captureRepository.discardImages(images)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoadingTags(true)

    ipcKnowledgeRepository
      .listTags()
      .then((result) => {
        if (!cancelled) {
          setAvailableTags(result.categories.flatMap((category) => category.tags))
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setSaveState('failure')
          setStatusError(reason instanceof Error ? reason.message : '标签读取失败')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTags(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoadingSource(true)

    captureRepository
      .getCurrentSource()
      .then((currentSource) => {
        if (!cancelled && !restoredDraftRef.current) {
          setSource(cleanDuplicatedSourceTitle(currentSource))
        }
      })
      .catch(() => {
        if (!cancelled && !restoredDraftRef.current) {
          setSource(manualCaptureSource)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSource(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectedTags = useMemo(
    () =>
      selectedTagNames.map((tagName) =>
        availableTags.find((tag) => tag.name === tagName) ?? {
          id: tagName,
          name: tagName,
          categoryId: 'uncategorized',
          color: 'uncategorized' as const,
          count: 0,
        },
      ),
    [availableTags, selectedTagNames],
  )

  const filteredTags = useMemo(() => {
    const query = tagSearch.trim().toLocaleLowerCase()
    return availableTags.filter((tag) => !query || tag.name.toLocaleLowerCase().includes(query))
  }, [availableTags, tagSearch])

  const capturedImageUrls = useMemo(
    () => capturedImages.map((image) => toAppImageUrl(image.path)).filter((url): url is string => Boolean(url)),
    [capturedImages],
  )
  const isSaving = saveState === 'saving'
  const statusMessage = captureStatusMessage({ state: saveState, title: savedTitle, error: statusError, cleanedImageCount })

  const markUnsaved = () => {
    setSaveState('idle')
    setStatusError(undefined)
    setSavedTitle(undefined)
    setCleanedImageCount(0)
    setNotice(null)
  }

  const updateSource = (patch: Partial<SourceInfo>) => {
    setSource((current) => updateCaptureSource(current, patch))
    markUnsaved()
  }

  const toggleTag = (tagName: string) => {
    setSelectedTagNames((current) =>
      current.includes(tagName) ? current.filter((candidate) => candidate !== tagName) : [...current, tagName],
    )
    markUnsaved()
  }

  const addNewTag = () => {
    const tagName = newTagName.trim()
    if (!tagName) {
      return
    }

    setSelectedTagNames((current) => (current.includes(tagName) ? current : [...current, tagName]))
    setNewTagName('')
    markUnsaved()
  }

  const discardDraft = async () => {
    const images = capturedImagesRef.current
    if (images.length > 0 && !savedEntryIdRef.current) {
      await captureRepository.discardImages(images)
    }
    capturedImagesRef.current = []
    window.localStorage.removeItem(draftStorageKey)
    setContentMd('')
    setDraftTitle('')
    setSelectedTagNames([])
    setNewTagName('')
    setTagSearch('')
    setCapturedImages([])
    setSavedEntryId(null)
    savedEntryIdRef.current = null
    lastSavedSnapshotRef.current = ''
    setHasRecoverableDraft(false)
    setSaveState('idle')
    setNotice('草稿已丢弃。')
    window.requestAnimationFrame(() => editorRef.current?.focus())
  }

  const saveDraft = async (): Promise<boolean> => {
    if (savePromiseRef.current) {
      pendingSaveRef.current = true
      const result = await savePromiseRef.current
      if (result && pendingSaveRef.current) {
        pendingSaveRef.current = false
        return saveDraft()
      }
      return result
    }

    const draft = currentDraftRef.current
    const snapshotAtStart = latestSnapshotRef.current
    if (!draft.contentMd.trim()) {
      window.localStorage.removeItem(draftStorageKey)
      setHasRecoverableDraft(false)
      return true
    }

    if (snapshotAtStart === lastSavedSnapshotRef.current) {
      return true
    }

    setNotice(null)
    setStatusError(undefined)
    setSavedTitle(undefined)
    setCleanedImageCount(0)
    setSaveState('saving')

    savePromiseRef.current = (async () => {
      try {
        const payload = {
          title: draft.draftTitle.trim() || undefined,
          contentMd: draft.contentMd,
          source: draft.source,
          tagNames: draft.selectedTagNames,
          images: draft.capturedImages.map((image) => image.path),
        }
        const entry = savedEntryIdRef.current
          ? await ipcKnowledgeRepository.updateEntry({ id: savedEntryIdRef.current, ...payload })
          : await ipcKnowledgeRepository.createEntry(payload)
        capturedImagesRef.current = []
        savedEntryIdRef.current = entry.id
        setSavedEntryId(entry.id)
        setSaveState('success')
        setSavedTitle(entry.title)
        lastSavedSnapshotRef.current = snapshotAtStart
        window.localStorage.removeItem(draftStorageKey)
        setHasRecoverableDraft(false)
        return true
      } catch (reason) {
        const orphanImages = capturedImagesRef.current
        if (orphanImages.length > 0 && !savedEntryIdRef.current) {
          capturedImagesRef.current = []
          setCapturedImages([])
          await captureRepository.discardImages(orphanImages)
          setCleanedImageCount(orphanImages.length)
          setSaveState('images_cleaned')
        } else {
          setSaveState('failure')
        }
        setStatusError(reason instanceof Error ? reason.message : '保存失败')
        window.localStorage.setItem(draftStorageKey, JSON.stringify(currentDraftRef.current))
        setHasRecoverableDraft(true)
        return false
      }
    })()

    const result = await savePromiseRef.current
    savePromiseRef.current = null

    if (result && (pendingSaveRef.current || latestSnapshotRef.current !== lastSavedSnapshotRef.current)) {
      pendingSaveRef.current = false
      return saveDraft()
    }

    pendingSaveRef.current = false
    return result
  }

  useEffect(() => {
    if (!draftReady || !contentMd.trim()) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      void saveDraft()
    }, 900)

    return () => window.clearTimeout(timer)
  }, [draftReady, contentMd, currentSnapshot])

  const closeAfterSave = async () => {
    const hadContent = currentDraftRef.current.contentMd.trim().length > 0
    const saved = await saveDraft()
    if (saved || !hadContent) {
      if (hadContent) {
        setSaveState('success')
        setNotice('已保存，正在关闭。')
        await delay(closeFeedbackMs)
      }
      await captureRepository.closeCurrentWindow()
    }
  }

  useEffect(() => {
    closeAfterSaveRef.current = () => {
      void closeAfterSave()
    }
  })

  useEffect(() => captureRepository.onCloseRequest(() => closeAfterSaveRef.current()), [])

  const handleContentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      void closeAfterSave()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      void closeAfterSave()
    }
  }

  const handleImageClipboardPaste = async () => {
    setNotice('正在粘贴图片...')
    setStatusError(undefined)

    try {
      const result = await captureRepository.readClipboard()
      if (!result.contentMd.trim() && result.images.length === 0) {
        setNotice('剪贴板中没有可粘贴的图片。')
        return null
      }

      if (result.images.length > 0) {
        setCapturedImages((current) => mergeCapturedImages(current, result.images))
      }

      markUnsaved()
      setNotice(result.imageUnsupported ? `已粘贴内容，但图片保存有异常：${result.imageError ?? '未知错误'}` : '已粘贴图片。')
      return result.contentMd.trim() ? result.contentMd : null
    } catch (reason) {
      setSaveState('failure')
      setStatusError(reason instanceof Error ? reason.message : '图片粘贴失败')
      setNotice(null)
      return null
    }
  }

  const applyInlineFormat = (kind: InlineFormatKind) => {
    editorRef.current?.applyInlineFormat(kind)
    markUnsaved()
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F5EF] text-ink">
      <div className="flex h-12 items-center justify-center border-b border-hairline bg-[#D9D7D0]">
        <div className="flex items-center gap-1 rounded-[4px] border border-soft-ink/40 bg-[#C9C7C0] px-2 py-1 shadow-sm">
          <button type="button" onClick={() => applyInlineFormat('bold')} className="inline-flex size-8 items-center justify-center rounded-[4px] text-soft-ink hover:bg-surface/60 hover:text-ink" title="加粗">
            <Bold size={17} strokeWidth={1.9} />
          </button>
          <button type="button" onClick={() => applyInlineFormat('color')} className="inline-flex size-8 items-center justify-center rounded-[4px] text-soft-ink hover:bg-surface/60 hover:text-ink" title="变颜色">
            <Palette size={17} strokeWidth={1.9} />
          </button>
          <button type="button" onClick={() => applyInlineFormat('size')} className="inline-flex size-8 items-center justify-center rounded-[4px] text-soft-ink hover:bg-surface/60 hover:text-ink" title="变字号">
            <Type size={17} strokeWidth={1.9} />
          </button>
          <button type="button" onClick={() => applyInlineFormat('highlight')} className="inline-flex size-8 items-center justify-center rounded-[4px] text-soft-ink hover:bg-surface/60 hover:text-ink" title="高亮">
            <Highlighter size={17} strokeWidth={1.9} />
          </button>
          <div className="mx-1 h-5 w-px bg-soft-ink/30" />
          <button type="button" onClick={() => void closeAfterSave()} disabled={isSaving} className="inline-flex size-8 items-center justify-center rounded-[4px] text-soft-ink hover:bg-surface/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50" title="保存并关闭">
            <X size={17} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <main className="flex min-h-0 flex-1 flex-col bg-white px-12 py-8">
        <div className="mb-3 flex min-h-[24px] items-center justify-between gap-3">
          <input
            value={draftTitle}
            onChange={(event) => { setDraftTitle(event.target.value); markUnsaved() }}
            placeholder={contentMd.trim() ? generatedTitle : '快速笔记'}
            className="min-w-0 flex-1 bg-transparent font-serif text-[18px] font-medium text-ink outline-none placeholder:text-faint"
          />
          <div className="text-[11px] text-faint">直观编辑</div>
        </div>
        <RichTextEditor
          ref={editorRef}
          value={contentMd}
          onChange={setContentMd}
          onTouched={markUnsaved}
          onKeyDown={handleContentKeyDown}
          onPasteImageClipboard={handleImageClipboardPaste}
          autoFocus
          className="flex-1 border-0 bg-transparent px-0 py-0"
          placeholder="直接输入或粘贴内容..."
        />

        {capturedImageUrls.length > 0 ? (
          <div className="mt-3 flex gap-2 border-t border-hairline pt-3">
            {capturedImageUrls.map((imageUrl) => <img key={imageUrl} src={imageUrl} alt="" className="h-14 w-20 rounded-[4px] border border-hairline object-cover" />)}
          </div>
        ) : null}
      </main>

      <footer className="border-t border-hairline bg-[#F7F5EF] px-4 py-3">
        <button type="button" onClick={() => setSourceExpanded((current) => !current)} className="flex w-full items-center justify-between rounded-[4px] border border-hairline bg-white px-3 py-2 text-left text-[12px] text-soft-ink hover:text-ink">
          <span className="truncate">来源：{isLoadingSource ? '读取中' : sourceSummary(normalizedSource) || '手动来源'}</span>
          <ChevronDown className={sourceExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} size={14} strokeWidth={2} />
        </button>

        {sourceExpanded ? (
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_1fr]">
            <label className="grid gap-1 text-[11px] text-faint">
              来源应用
              <input value={source.app} onChange={(event) => updateSource({ app: event.target.value })} className="min-w-0 rounded-[4px] border border-hairline bg-white px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="来源应用" />
            </label>
            <label className="grid gap-1 text-[11px] text-faint">
              窗口标题
              <input value={source.title ?? ''} onChange={(event) => updateSource({ title: event.target.value })} className="min-w-0 rounded-[4px] border border-hairline bg-white px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="可留空" />
            </label>
            <label className="grid gap-1 text-[11px] text-faint">
              来源 URL
              <input value={source.url ?? ''} onChange={(event) => updateSource({ url: event.target.value })} className="min-w-0 rounded-[4px] border border-hairline bg-white px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="可留空" />
            </label>
          </div>
        ) : null}

        <div className="mt-3 grid gap-2">
          <div className="flex min-h-7 flex-wrap items-center gap-1.5">
            <span className="w-14 shrink-0 text-[12px] text-faint">已选标签</span>
            {selectedTags.length > 0 ? selectedTags.map((tag) => <Tag key={tag.name} label={tag.name} category={tag.color} closable onClose={() => toggleTag(tag.name)} />) : <span className="text-[12px] text-faint">无</span>}
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-14 shrink-0 text-[12px] text-faint">可选标签</span>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint" size={12} strokeWidth={2} />
                <input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} className="h-7 w-full rounded-[4px] border border-hairline bg-white pl-7 pr-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="搜索标签" />
              </div>
              <input value={newTagName} onChange={(event) => setNewTagName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addNewTag() } }} className="h-7 w-24 rounded-[4px] border border-hairline bg-white px-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-soft-ink" placeholder="新标签" />
              <button type="button" onClick={addNewTag} className="inline-flex h-7 items-center gap-1 rounded-[4px] border border-dashed border-faint bg-white px-2 text-[12px] text-soft-ink hover:text-ink"><Plus size={11} strokeWidth={2} />添加</button>
            </div>
            <div className="ml-14 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto pr-1">
              {filteredTags.map((tag) => {
                const active = selectedTagNames.includes(tag.name)
                return <button key={tag.id} type="button" onClick={() => toggleTag(tag.name)} className={`rounded-[4px] px-2 py-[2px] text-[12px] ${active ? 'bg-ink text-cream' : 'bg-white text-soft-ink hover:text-ink'}`}>{tag.name}</button>
              })}
              {isLoadingTags ? <span className="text-[12px] text-faint">读取标签中</span> : null}
              {!isLoadingTags && filteredTags.length === 0 ? <span className="text-[12px] text-faint">没有匹配标签</span> : null}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-[12px]">
          <span className={`font-medium ${statusClassName(saveState)}`}>{captureStatusLabel(saveState)}</span>
          <span className={`min-w-0 flex-1 truncate ${statusClassName(saveState)}`}>{statusMessage}{notice ? ` · ${notice}` : ''}</span>
          {hasRecoverableDraft ? <button type="button" onClick={() => void discardDraft()} className="shrink-0 rounded-[4px] border border-hairline bg-white px-2 py-[2px] text-faint hover:text-terracotta">丢弃草稿</button> : null}
          <span className="shrink-0 text-faint">关闭时自动保存 · Esc 关闭</span>
        </div>
      </footer>
    </div>
  )
}
