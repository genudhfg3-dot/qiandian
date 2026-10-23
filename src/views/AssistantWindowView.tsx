import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Clipboard, Copy, Heart, ImagePlus, Minus, Pin, Plus, Save, Settings, Square, X } from 'lucide-react'
import type { AssistantMessage, AssistantState } from '../domain/assistant'
import { RichMarkdownPreview } from '../components/RichMarkdownPreview'

const initial: AssistantState = { messages: [], images: [], draft: '', busy: false, error: '', model: '', pinned: false, incoming: null }
const actions = [ ['翻译', '请将以上内容或图片中的文字完整翻译为中文。'], ['解释', '请解释以上内容或图片，简洁说明重点。'], ['提取文字', '请准确提取图片中的文字，保留原有段落，不要额外解释。'] ]
const api = () => window.assistantApi

export function AssistantWindowView() {
  const [state, setState] = useState(initial)
  const [text, setText] = useState('')
  const [localError, setLocalError] = useState('')
  const [saveMessage, setSaveMessage] = useState<AssistantMessage | null>(null)
  const [saveText, setSaveText] = useState(''), [title, setTitle] = useState(''), [tags, setTags] = useState('')
  const [original, setOriginal] = useState(true), [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string[]>([]), [copied, setCopied] = useState('')
  const [preview, setPreview] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const input = useRef<HTMLTextAreaElement>(null), scroll = useRef<HTMLElement>(null), file = useRef<HTMLInputElement>(null)
  const nearBottom = useRef(true)
  async function run(task: Promise<unknown> | undefined) { try { setLocalError(''); await task } catch (error) { setLocalError(error instanceof Error ? error.message : '操作失败，请重试。') } }
  useEffect(() => {
    const off = api()?.onState(setState)
    const offDelta = api()?.onDelta(delta => setState(current => ({ ...current, messages: current.messages.map(message => message.id === delta.id ? { ...message, text: delta.text, firstTokenMs: delta.firstTokenMs } : message) })))
    void api()?.state().then(setState).catch(error => setLocalError(String(error)))
    const focus = () => { input.current?.focus({ preventScroll: true }); void api()?.state().then(setState) }
    window.addEventListener('focus', focus)
    return () => { off?.(); offDelta?.(); window.removeEventListener('focus', focus) }
  }, [])
  useEffect(() => { setText(state.draft); if (!state.busy) input.current?.focus({ preventScroll: true }) }, [state.draft, state.busy])
  useEffect(() => { if (nearBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight }, [state.messages])
  useEffect(() => { if (!state.busy) return; const start = Date.now(); setElapsed(0); const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000); return () => clearInterval(timer) }, [state.busy])
  useEffect(() => { const el = input.current; if (el) { el.style.height = '24px'; el.style.height = `${Math.min(el.scrollHeight, 96)}px` } }, [text])
  function edit(value: string) { setText(value); void run(api()?.draft(value)) }
  function send(value = text) { if (state.busy) return; nearBottom.current = true; void run(api()?.send(value)) }
  async function attach(files: FileList | File[]) {
    for (const item of Array.from(files)) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(item.type) || item.size > 12_000_000) { setLocalError('请选择小于 12MB 的 PNG、JPEG 或 WebP 图片。'); continue }
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(item) })
      await api()?.image(dataUrl)
    }
  }
  const latest = state.messages.at(-1)
  const error = localError || state.error
  return (
    <div className="assistant-shell fixed inset-0 flex flex-col overflow-hidden bg-cream text-ink" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!state.busy) void run(attach(event.dataTransfer.files)) }}>
      <header className="flex shrink-0 items-center gap-1 border-b border-hairline bg-surface px-3 py-1">
        <Heart size={16} className="mr-1 shrink-0 text-terracotta" />
        <h1 className="min-w-0 flex-1 text-[13px] font-medium">随手问</h1>
        <button className="assistant-icon" title={`模型设置 · ${state.model || '沿用当前 AI 模型'}`} aria-label="模型设置" onClick={() => void run(api()?.settings())}><Settings size={15} /></button>
        <button className="assistant-icon" title="新对话" aria-label="新对话" disabled={state.busy} onClick={() => void run(api()?.reset())}><Plus size={17} /></button>
        <button className={`assistant-icon ${state.pinned ? 'text-terracotta bg-cream-soft' : ''}`} title="置顶" aria-label="置顶" aria-pressed={state.pinned} onClick={() => void run(api()?.pin())}><Pin size={16} /></button>
        <button className="assistant-icon" title="收起" aria-label="收起" onClick={() => void run(api()?.hide())}><Minus size={18} /></button>
      </header>
      <main ref={scroll} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3" onScroll={event => { const el = event.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
        {!state.messages.length && <div className="py-7">
          <p className="text-[23px] font-medium tracking-tight">看到不懂的，随手问。</p>
          <p className="mt-3 text-[13px] leading-6 text-soft-ink">粘贴截图或文字，翻译、解释，或直接提问。<br />有用的答案，可以随手存进千点。</p>
          <button className="assistant-chip mt-5" onClick={() => void run(api()?.clipboard())}><Clipboard size={14} />带入剪贴板</button>
          {!api() && <p className="mt-4 text-xs text-terracotta">请在千点桌面应用中使用模型与剪贴板功能。</p>}
        </div>}
        <div className="space-y-4">
          {state.messages.map(message => <section key={message.id} className={message.role === 'user' ? 'ml-7 rounded-[10px] border border-hairline-soft bg-surface p-3' : 'mr-1'}>
            <div className="mb-2 flex items-center gap-2 text-[11px] text-faint">{message.role === 'user' ? '你' : <><Heart size={12} className="text-terracotta" />千点</>}{message.status === 'stopped' && ' · 已停止'}{message.status === 'error' && ' · 未完成'}</div>
            {!!message.images.length && <div className="mb-3 flex flex-wrap gap-2">{message.images.map(image => <button key={image.id} onClick={() => setPreview(image.dataUrl)} aria-label="放大截图"><img src={image.dataUrl} alt="提问截图" className="max-h-36 max-w-full rounded-[6px] border border-hairline object-contain" /></button>)}</div>}
            {message.role === 'user' ? <p className="whitespace-pre-wrap break-words text-[14px] leading-6">{message.text}</p> : message.text ? <RichMarkdownPreview markdown={message.text.replace(/!\[[^\]]*\]\([^)]*\)/g, '[图片引用]')} /> : <p role="status" className="text-[13px] text-soft-ink">{state.busy ? elapsed >= 4 ? `模型仍在响应 · ${elapsed} 秒，可随时停止` : '正在回答…' : '尚未收到答案'}</p>}
            {message.role === 'assistant' && message.status !== 'streaming' && message.text && <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-soft-ink">
              <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => void run(navigator.clipboard.writeText(message.text).then(() => setCopied(message.id)))}><Copy size={12} />{copied === message.id ? '已复制' : '复制'}</button>
              <button disabled={saved.includes(message.id)} className="inline-flex items-center gap-1 hover:text-terracotta" onClick={() => { setSaveMessage(message); setSaveText(message.text); setTitle(''); setTags(''); setOriginal(true) }}>{saved.includes(message.id) ? <Check size={12} /> : <Save size={12} />}{saved.includes(message.id) ? '已保存' : '保存到知识库'}</button>
            </div>}
          </section>)}
        </div>
      </main>
      <footer className="max-h-[70%] shrink-0 overflow-y-auto border-t border-hairline bg-surface px-3 py-2">
        {state.incoming && <div className="mb-3 rounded-[6px] border border-hairline bg-cream-soft p-3 text-xs"><p className="mb-2">收到{state.incoming.images.length ? '新截图' : '新文字'}，放在哪里？</p><div className="flex gap-3"><button disabled={state.busy} onClick={() => void run(api()?.acceptIncoming('add'))}>加入当前对话</button><button disabled={state.busy} onClick={() => void run(api()?.acceptIncoming('new'))}>新对话</button><button className="ml-auto" onClick={() => void run(api()?.acceptIncoming('dismiss'))}>忽略</button></div></div>}
        {error && <p role="alert" className="mb-2 text-xs leading-5 text-terracotta">{error}</p>}
        {!state.busy && latest?.role === 'assistant' && ['error', 'stopped'].includes(latest.status ?? '') && <button className="assistant-chip mb-2" onClick={() => void run(api()?.retry())}>重新回答</button>}
        {!!state.images.length && <div className="mb-2 flex gap-2">{state.images.map(image => <div key={image.id} className="relative"><button onClick={() => setPreview(image.dataUrl)}><img src={image.dataUrl} alt="待发送截图" className="h-16 w-20 rounded-[6px] border border-hairline object-contain" /></button><button aria-label="移除截图" className="absolute -right-1 -top-1 rounded-full bg-ink p-0.5 text-cream" onClick={() => void run(api()?.removeImage(image.id))}><X size={12} /></button></div>)}</div>}
        <div className="mb-1 flex flex-wrap gap-1">{actions.map(([label, prompt]) => <button key={label} className="rounded px-2 py-1 text-[11px] text-soft-ink hover:bg-cream-soft hover:text-terracotta" disabled={state.busy || (!text.trim() && !state.images.length && !state.messages.length)} onClick={() => send(text.trim() ? `${prompt}\n\n${text}` : prompt)}>{label}</button>)}</div>
        <div className="rounded-[10px] border border-hairline bg-cream/40 p-2 focus-within:border-terracotta">
          <textarea ref={input} value={text} disabled={state.busy} maxLength={16000} onChange={event => edit(event.target.value)} onPaste={event => { const images = Array.from(event.clipboardData.files); if (images.length) { event.preventDefault(); void run(attach(images)) } }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() } }} placeholder="输入问题，或粘贴截图…" aria-label="输入问题" rows={1} className="block max-h-24 min-h-6 w-full resize-none bg-transparent px-1 text-[14px] leading-6 outline-none placeholder:text-faint" />
          <div className="flex items-center gap-1">
            <button disabled={state.busy} className="assistant-icon" title="添加图片" aria-label="添加图片" onClick={() => file.current?.click()}><ImagePlus size={17} /></button>
            <button disabled={state.busy} className="assistant-icon" title="带入剪贴板" aria-label="带入剪贴板" onClick={() => void run(api()?.clipboard())}><Clipboard size={16} /></button>
            <span className="ml-auto mr-2 text-[10px] text-faint">{state.busy ? '回答中' : 'Enter 发送'}</span>
            <button aria-label={state.busy ? '停止生成' : '发送'} disabled={!api() || (!state.busy && !text.trim() && !state.images.length)} className="flex size-7 items-center justify-center rounded-full bg-terracotta text-terracotta-fg disabled:opacity-40" onClick={() => state.busy ? void run(api()?.cancel()) : send()}>{state.busy ? <Square size={13} fill="currentColor" /> : <ArrowUp size={18} />}</button>
          </div>
        </div>
        <input ref={file} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => { if (event.target.files) void run(attach(event.target.files)); event.target.value = '' }} />
      </footer>
      {preview && <div role="dialog" aria-label="截图预览" className="fixed inset-0 z-30 flex items-center justify-center bg-ink/90 p-5" onClick={() => setPreview('')}><img src={preview} alt="截图大图" className="max-h-full max-w-full object-contain" /><button className="absolute right-4 top-4 text-white" aria-label="关闭预览"><X /></button></div>}
      {saveMessage && <div role="dialog" aria-modal="true" aria-label="保存到知识库" className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-4"><form className="flex max-h-full w-full flex-col gap-3 rounded-[10px] border border-hairline bg-surface p-4" onSubmit={event => { event.preventDefault(); if (saving) return; setSaving(true); void run(api()?.save({ messageId: saveMessage.id, title, text: saveText, includeOriginal: original, tagNames: tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean) }).then(() => { setSaved(ids => [...ids, saveMessage.id]); setSaveMessage(null) }).finally(() => setSaving(false))) }}>
        <h2 className="text-base font-medium">保存到知识库</h2>
        <input aria-label="标题" className="assistant-field" value={title} maxLength={200} onChange={event => setTitle(event.target.value)} placeholder="标题（留空自动生成）" />
        <textarea aria-label="答案内容" className="assistant-field min-h-32 flex-1" rows={8} value={saveText} onChange={event => setSaveText(event.target.value)} />
        <input aria-label="标签" className="assistant-field" value={tags} onChange={event => setTags(event.target.value)} placeholder="标签，用逗号分隔" />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={original} onChange={event => setOriginal(event.target.checked)} />同时保存本次对话的原始文字和截图</label>
        {localError && <p role="alert" className="text-xs text-terracotta">{localError}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={saving} className="assistant-chip" onClick={() => setSaveMessage(null)}>取消</button><button type="submit" disabled={saving || !saveText.trim()} className="rounded-[6px] bg-terracotta px-4 py-2 text-xs text-terracotta-fg">{saving ? '保存中…' : '保存'}</button></div>
      </form></div>}
    </div>
  )
}

export function AssistantHintView() {
  return <div className="assistant-hint fixed inset-0 flex flex-col justify-center gap-2 overflow-hidden border border-hairline bg-surface px-3 py-2 text-xs">
    <div className="flex h-6 shrink-0 items-center gap-2 text-soft-ink">
      <Heart size={14} className="shrink-0 text-terracotta" />
      <span className="min-w-0 flex-1 truncate">截图已就绪</span>
      <button className="assistant-icon shrink-0" title="忽略截图" aria-label="忽略截图" onClick={() => void api()?.hint('dismiss')}><X size={14} /></button>
    </div>
    <div className="flex h-7 shrink-0 gap-2">
      <button className="min-w-0 flex-1 rounded border border-terracotta bg-terracotta text-terracotta-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-terracotta" onClick={() => void api()?.hint('translate')}>翻译图片</button>
      <button className="min-w-0 flex-1 rounded border border-hairline text-soft-ink hover:bg-cream-soft focus-visible:outline-2 focus-visible:outline-terracotta" onClick={() => void api()?.hint('ask')}>问这张图</button>
    </div>
  </div>
}
