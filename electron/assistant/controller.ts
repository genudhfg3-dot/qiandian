import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, nativeImage, powerMonitor, screen } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AssistantState, AssistantPreferences, AssistantImage, AssistantApi } from '../../src/domain/assistant'
import type { AiRuntimeSettings } from '../metadata/aiSettings'
import type { EntryCreateInput } from '../../src/domain/knowledge'
import { saveClipboardPng, deleteImageFiles } from '../capture/imageStorage'
import { streamAnswer, type ChatMessage } from './chat'
import { ClipboardTracker } from './clipboardTracker'

interface Dependencies {
  load: (window: BrowserWindow, route: string) => void
  webPreferences: () => Electron.WebPreferences
  settings: () => AiRuntimeSettings
  capture: () => void
  openSettings: () => void
  anchor: () => Electron.Rectangle | undefined
  save: (input: EntryCreateInput) => Promise<string>
}

export function installAssistant(deps: Dependencies) {
  let window: BrowserWindow | null = null, hintWindow: BrowserWindow | null = null
  let controller: AbortController | null = null, locked = false, polling = false, closing = false
  let hintTimer: NodeJS.Timeout | undefined
  let firstOpen = true
  let snapshot: AssistantImage | null = null
  const clipboardTracker = new ClipboardTracker()
  let state: AssistantState = { messages: [], images: [], draft: '', busy: false, error: '', model: '', pinned: false, incoming: null }
  const path = join(app.getPath('userData'), 'assistant-settings.json')
  let prefs: AssistantPreferences = { screenshotHints: true, shortcut: 'Alt+R', shortcutError: '' }
  try { const stored = JSON.parse(readFileSync(path, 'utf8')); prefs.screenshotHints = stored.screenshotHints !== false; if (typeof stored.shortcut === 'string') prefs.shortcut = stored.shortcut } catch { /* first start */ }
  function model() { try { return deps.settings().model || '尚未配置模型' } catch { return '尚未配置模型' } }
  function publish() { state.model = model(); if (window && !window.isDestroyed()) window.webContents.send('assistant:state', state) }
  function position(width: number, height: number) {
    const anchor = deps.anchor()
    const area = (anchor ? screen.getDisplayMatching(anchor) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint())).workArea
    width = Math.min(width, area.width); height = Math.min(height, area.height)
    return { width, height, x: Math.max(area.x, Math.min(anchor ? anchor.x - width - 8 : area.x + area.width - width - 24, area.x + area.width - width)), y: Math.max(area.y, Math.min(anchor?.y ?? area.y + 40, area.y + area.height - height)) }
  }
  function ensureWindow() {
    if (window && !window.isDestroyed()) return window
    window = new BrowserWindow({ ...position(440, 660), minWidth: 340, minHeight: 360, show: false, backgroundColor: '#F8F0DE', title: '千点 · 随手问', webPreferences: deps.webPreferences() })
    window.on('close', event => { if (!closing) { event.preventDefault(); window?.hide() } })
    window.on('closed', () => { controller?.abort(); window = null })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', event => event.preventDefault())
    deps.load(window, '/assistant')
    return window
  }
  function open() {
    const current = ensureWindow()
    if (firstOpen) { current.setBounds(position(440, 660)); firstOpen = false }
    else {
      const bounds = current.getBounds(), area = screen.getDisplayMatching(bounds).workArea
      current.setBounds({ x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - bounds.width)), y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - bounds.height)) })
    }
    if (current.isMinimized()) current.restore()
    current.show(); current.focus(); publish()
  }
  function hideHint() { if (hintTimer) clearTimeout(hintTimer); hintWindow?.hide(); snapshot = null }
  function reset() { if (state.busy) throw new Error('请先停止当前回答。'); state = { ...state, messages: [], images: [], draft: '', error: '', incoming: null }; publish() }
  function addIncoming(text: string, images: AssistantImage[], action?: string) {
    if (state.messages.length || state.images.length || state.draft || state.busy) state.incoming = { text, images, action }
    else { state.images = images; state.draft = text; if (action) void send(action).catch(fail) }
    open(); publish()
  }
  function normalizeImage(dataUrl: string): AssistantImage {
    if (typeof dataUrl !== 'string' || dataUrl.length > 16_000_000 || !/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) throw new Error('请使用小于 12MB 的 PNG、JPEG 或 WebP 图片。')
    const image = nativeImage.createFromDataURL(dataUrl)
    if (image.isEmpty()) throw new Error('无法读取这张图片。')
    const { width, height } = image.getSize()
    if (width * height > 40_000_000) throw new Error('图片尺寸过大，请截取需要提问的部分。')
    const scale = Math.min(1, 2048 / Math.max(width, height))
    const resized = scale < 1 ? image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' }) : image
    const png = resized.toPNG()
    if (png.length > 8_000_000) throw new Error('图片过大，请缩小截图范围。')
    return { id: randomUUID(), dataUrl: `data:image/png;base64,${png.toString('base64')}` }
  }
  function fail(error: unknown) { state.error = error instanceof Error ? error.message : '操作失败，请重试。'; publish() }
  async function send(text: string, retry = false) {
    if (state.busy) throw new Error('请等待当前回答，或先停止生成。')
    if (typeof text !== 'string' || text.length > 16000) throw new Error('问题过长，请控制在 16000 字以内。')
    if (!text.trim() && !state.images.length) return
    const settings = deps.settings()
    if (!settings.enabled || !settings.apiKey || !settings.baseUrl || !settings.model) throw new Error('请先在 AI 设置中启用并配置模型。')
    const history = retry ? state.messages.slice(0, -1) : [...state.messages, { id: randomUUID(), role: 'user' as const, text: text.trim() || '请解释这张图片。', images: state.images }]
    const validHistory = history.filter(message => message.role === 'user' || message.status === 'done')
    if (validHistory.reduce((n, m) => n + m.text.length, 0) > 48000 || validHistory.reduce((n, m) => n + m.images.length, 0) > 6) throw new Error('当前对话内容较多，请开启新对话后继续。')
    const messages: ChatMessage[] = validHistory.map(message => ({ role: message.role, content: message.images.length ? [{ type: 'text', text: message.text }, ...message.images.map(image => ({ type: 'image_url', image_url: { url: image.dataUrl } }))] : message.text }))
    const answer = { id: randomUUID(), role: 'assistant' as const, text: '', images: [], status: 'streaming' as 'streaming' | 'done' | 'error' | 'stopped', firstTokenMs: undefined as number | undefined, totalMs: undefined as number | undefined }
    state.messages = [...history, answer]; state.images = []; state.draft = ''; state.busy = true; state.error = ''
    const request = new AbortController(); controller = request
    let timedOut = false, lastPublish = 0
    const start = performance.now()
    const timeout = setTimeout(() => { timedOut = true; request.abort() }, 90000)
    publish()
    try {
      await streamAnswer(settings, messages, request.signal, text => {
        answer.firstTokenMs ??= Math.round(performance.now() - start)
        answer.text += text
        if (answer.text.length > 100000) throw new Error('回答过长，已停止，请缩小问题范围。')
        if (performance.now() - lastPublish > 32) {
          // Streaming never retransmits image attachments through IPC.
          window?.webContents.send('assistant:delta', { id: answer.id, text: answer.text, firstTokenMs: answer.firstTokenMs })
          lastPublish = performance.now()
        }
      })
      answer.status = 'done'
    } catch (error) {
      answer.status = request.signal.aborted && !timedOut ? 'stopped' : 'error'
      state.error = timedOut ? '等待超过 90 秒，请重试或检查模型服务。' : request.signal.aborted ? '' : error instanceof Error ? error.message : '请求失败，请重试。'
    } finally {
      clearTimeout(timeout); answer.totalMs = Math.round(performance.now() - start); state.busy = false; controller = null; publish()
    }
  }
  function register(shortcut: string) {
    try { return globalShortcut.register(shortcut, open) } catch { return false }
  }
  if (!register(prefs.shortcut)) prefs.shortcutError = '助手快捷键被占用或无效，请在设置中修改。'
  function assertOwn(event: Electron.IpcMainInvokeEvent, assistantOnly = false) {
    const sender = BrowserWindow.fromWebContents(event.sender)
    if (!sender || event.senderFrame !== event.sender.mainFrame || (assistantOnly && sender !== window)) throw new Error('不允许此窗口执行该操作。')
    const url = event.sender.getURL()
    if (!url.startsWith('file:') && !/^http:\/\/localhost:\d+\//.test(url) && !/^http:\/\/127\.0\.0\.1:\d+\//.test(url)) throw new Error('不允许的页面来源。')
  }
  function handle(name: string, fn: (...args: any[]) => unknown, only = true) {
    ipcMain.handle(`assistant:${name}`, (event, ...args) => { assertOwn(event, only); return fn(...args) })
  }
  handle('open', (text?: string, action?: string) => {
    if (text !== undefined && (typeof text !== 'string' || text.length > 16000)) throw new Error('选中文字过长。')
    if (text) addIncoming(text, [], action === 'translate' ? `请翻译为中文：\n${text}` : action === 'explain' ? `请解释以下内容：\n${text}` : undefined)
    else open()
  }, false)
  handle('menu', () => Menu.buildFromTemplate([
    { label: '问助手', click: open }, { label: '快速收藏', click: deps.capture },
    { type: 'separator' }, { label: 'AI 设置', click: deps.openSettings },
  ]).popup(), false)
  handle('state', () => ({ ...state, model: model() }))
  handle('send', (text: string) => { void send(text).catch(fail) })
  handle('draft', (text: string) => { if (typeof text === 'string' && text.length <= 16000 && !state.busy) state.draft = text })
  handle('cancel', () => controller?.abort())
  handle('retry', () => {
    const last = state.messages.at(-1)
    if (last?.role === 'assistant' && ['error', 'stopped'].includes(last.status ?? '')) void send(state.messages.at(-2)?.text ?? '', true).catch(fail)
  })
  handle('reset', reset)
  handle('clipboard', () => {
    const image = clipboard.readImage()
    if (!image.isEmpty()) addIncoming('', [normalizeImage(image.toDataURL())])
    else { const text = clipboard.readText(); if (text.length > 16000) throw new Error('剪贴板文字过长。'); if (!text.trim()) throw new Error('剪贴板中没有文字或图片。'); addIncoming(text, []) }
  })
  handle('image', (dataUrl: string) => {
    if (state.busy) throw new Error('请先停止当前回答。')
    if (state.images.length >= 3) throw new Error('一次最多添加 3 张图片。')
    state.images = [...state.images, normalizeImage(dataUrl)]; publish()
  })
  handle('removeImage', (id: string) => { state.images = state.images.filter(image => image.id !== id); publish() })
  handle('acceptIncoming', (mode: string) => {
    const incoming = state.incoming
    if (!incoming) return
    if (mode === 'dismiss') { state.incoming = null; publish(); return }
    if (state.busy) throw new Error('请先停止当前回答。')
    if (!['new', 'add'].includes(mode)) throw new Error('无效操作。')
    if (mode === 'add' && state.images.length + incoming.images.length > 3) throw new Error('一次最多添加 3 张图片。')
    if (mode === 'new') reset()
    state.images = [...state.images, ...incoming.images]; state.draft = [state.draft, incoming.text].filter(Boolean).join('\n'); state.incoming = null; publish()
    if (incoming.action) void send(incoming.action).catch(fail)
  })
  handle('hide', () => window?.hide())
  handle('pin', () => { state.pinned = !state.pinned; window?.setAlwaysOnTop(state.pinned); publish() })
  handle('settings', deps.openSettings, false)
  handle('preferences', () => prefs, false)
  handle('updatePreferences', (input: AssistantPreferences) => {
    if (typeof input?.screenshotHints !== 'boolean' || typeof input.shortcut !== 'string' || input.shortcut.length > 80) throw new Error('助手设置格式无效。')
    const shortcut = input.shortcut.trim()
    if (shortcut !== prefs.shortcut || prefs.shortcutError) {
      if (!register(shortcut)) throw new Error('快捷键被占用或无效，请换一个组合。')
      if (shortcut !== prefs.shortcut && !prefs.shortcutError) globalShortcut.unregister(prefs.shortcut)
    }
    prefs = { screenshotHints: input.screenshotHints, shortcut, shortcutError: '' }
    writeFileSync(path, JSON.stringify(prefs)); clipboardTracker.reset(); if (!prefs.screenshotHints) hideHint()
    return prefs
  }, false)
  handle('hint', (action: string) => {
    const image = snapshot; hideHint()
    if (image && ['translate', 'ask'].includes(action)) addIncoming('', [image], action === 'translate' ? '请将图片中的文字完整翻译为中文。' : undefined)
  }, false)
  const saved = new Map<string, string>(), saving = new Set<string>()
  handle('save', async (input: Parameters<AssistantApi['save']>[0]) => {
    if (!input || typeof input.text !== 'string' || input.text.length > 120000 || typeof input.title !== 'string' || input.title.length > 200 || !Array.isArray(input.tagNames) || input.tagNames.length > 20 || input.tagNames.some(tag => typeof tag !== 'string' || tag.length > 50)) throw new Error('保存内容格式无效。')
    const message = state.messages.find(m => m.id === input.messageId && m.role === 'assistant' && m.text)
    if (!message || state.busy) throw new Error('请等待回答完成后保存。')
    if (saved.has(message.id)) return saved.get(message.id)
    if (saving.has(message.id)) throw new Error('正在保存，请稍候。')
    saving.add(message.id)
    const paths: string[] = []
    try {
      let original = ''
      if (input.includeOriginal) {
        const index = state.messages.indexOf(message)
        for (const user of state.messages.slice(0, index).filter(m => m.role === 'user')) {
          original += `${user.text}\n\n`
          for (const image of user.images) { const stored = await saveClipboardPng(app.getPath('userData'), Buffer.from(image.dataUrl.split(',')[1], 'base64')); paths.push(stored.path); original += `![原始截图](${stored.path})\n\n` }
        }
      }
      const id = await deps.save({ title: input.title.trim() || undefined, contentMd: `${original}${input.text}`, images: paths, tagNames: input.tagNames, source: { app: '千点助手', title: state.model } })
      saved.set(message.id, id); if (saved.size > 200) saved.delete(saved.keys().next().value!); return id
    } catch (error) { await deleteImageFiles(app.getPath('userData'), paths); throw error } finally { saving.delete(message.id) }
  })
  function showHint(image: AssistantImage) {
    snapshot = image
    if (!hintWindow || hintWindow.isDestroyed()) {
      hintWindow = new BrowserWindow({ ...position(292, 96), useContentSize: true, frame: false, resizable: false, show: false, focusable: false, alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#FFFCF4', webPreferences: deps.webPreferences() })
      const current = hintWindow
      current.once('ready-to-show', () => { if (snapshot) current.showInactive() })
      deps.load(current, '/assistant-hint')
    } else { hintWindow.setBounds(position(292, 96)); hintWindow.showInactive() }
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(hideHint, 5000)
  }
  const timer = setInterval(() => {
    if (!prefs.screenshotHints || locked || polling) return
    polling = true
    try {
      const image = clipboard.readImage()
      const png = image.isEmpty() ? null : image.toPNG()
      const hash = png ? createHash('sha256').update(png).digest('hex') : ''
      if (!clipboardTracker.observe(hash)) return
      if (png && png.length < 12_000_000) showHint(normalizeImage(`data:image/png;base64,${png.toString('base64')}`))
    } catch { /* unsupported or oversized clipboard image; keep background polling quiet */ } finally { polling = false }
  }, 900)
  powerMonitor.on('lock-screen', () => { locked = true; hideHint() })
  powerMonitor.on('suspend', () => { locked = true; hideHint() })
  const resume = () => { locked = false; clipboardTracker.reset() }
  powerMonitor.on('unlock-screen', resume); powerMonitor.on('resume', resume)
  app.on('before-quit', () => { closing = true; controller?.abort(); clearInterval(timer); hideHint(); state.images = []; state.messages = [] })
  // Prepare only local UI; never send a model request in the background.
  ensureWindow()
  return { open }
}
