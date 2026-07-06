import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, protocol, safeStorage, screen, Tray } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  EntryCreateInput,
  EntryDeleteInput,
  EntryListQuery,
  EntryMetadataUpdateInput,
  EntryUpdateInput,
  AiSettingsUpdateInput,
  SourceInfo,
  TagCategoryCreateInput,
  TagCategoryUpdateInput,
  TagCategoryDeleteInput,
  TagCreateInput,
  TagDeleteInput,
  TagUpdateInput,
} from '../src/domain/knowledge'
import type { KnowledgeRepository } from '../src/repositories/knowledgeRepository'
import { openKnowledgeDatabase, createSqliteKnowledgeRepository, resetDatabase } from './database'
import { readClipboardAsMarkdown } from './capture/readClipboard'
import { getCurrentSource } from './capture/source'
import {
  cleanupImagesWithoutDatabaseReferences,
  discardImages,
  registerImageProtocol,
} from './capture/imageProtocol'
import { readAiRuntimeSettings, readAiSettings, writeAiSettings } from './metadata/aiSettings'
import { generateEntryTitle } from '../src/utils/title'
import { generateAiMetadata, toMetadataInput } from './metadata/aiMetadataService'
import { MetadataQueue } from './metadata/metadataQueue'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-image',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
])

interface PersistedBounds {
  x: number
  y: number
  width: number
  height: number
}

interface AppSettings {
  floatingButtonBounds?: PersistedBounds
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

const devServerUrl = process.env.VITE_DEV_SERVER_URL
const floatingButtonSize = 64
const floatingButtonMargin = 12
const captureShortcut = 'CommandOrControl+Shift+K'
let knowledgeRepository: KnowledgeRepository | null = null
let knowledgeDb: ReturnType<typeof openKnowledgeDatabase> | null = null
let mainWindow: BrowserWindow | null = null
let captureWindow: BrowserWindow | null = null
let captureCloseApproved = false
let floatingButtonWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let lastExternalSource: SourceInfo | null = null
let sourcePollTimer: NodeJS.Timeout | null = null
let floatingDragTimer: NodeJS.Timeout | null = null
let floatingDragOffset: { x: number; y: number } | null = null
let floatingDragStartCursor: { x: number; y: number } | null = null
const floatingDragClickThreshold = 4
const keyStorage = safeStorage
  ? {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      encryptString: (value: string) => safeStorage.encryptString(value),
      decryptString: (value: Buffer) => safeStorage.decryptString(value),
    }
  : null

function settingsFilePath() {
  return join(app.getPath('userData'), 'settings.json')
}

function readSettings(): AppSettings {
  try {
    const parsed = JSON.parse(readFileSync(settingsFilePath(), 'utf8')) as AppSettings
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeSettings(settings: AppSettings) {
  try {
    writeFileSync(settingsFilePath(), JSON.stringify(settings, null, 2), 'utf8')
  } catch (error) {
    console.warn('settings write failed', error)
  }
}

function findAppIconPath() {
  const candidates = [
    join(process.resourcesPath ?? '', 'build', 'app.ico'),
    join(process.cwd(), 'build', 'app.ico'),
    join(__dirname, '../build/app.ico'),
  ]
  return candidates.find((candidate) => candidate && existsSync(candidate))
}

function makeTrayIcon() {
  const iconPath = findAppIconPath()
  if (iconPath) {
    const image = nativeImage.createFromPath(iconPath)
    if (!image.isEmpty()) {
      return image.resize({ width: 16, height: 16 })
    }
  }

  const fallbackIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#D6532E"/>
      <path d="M16 24s-8-4.8-8-10.5A4.6 4.6 0 0 1 16 10a4.6 4.6 0 0 1 8 3.5C24 19.2 16 24 16 24z" fill="none" stroke="#FFF6E8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackIconSvg)}`)
  return image.resize({ width: 16, height: 16 })
}

function isOwnSource(source: SourceInfo) {
  const appName = source.app.toLowerCase()
  return appName.includes('千点') || appName.includes('个人知识库') || appName.includes('personal-knowledge-base') || appName.includes('electron')
}

async function refreshLastExternalSource() {
  const source = await getCurrentSource()
  if (!isOwnSource(source)) {
    lastExternalSource = source
  }
  return lastExternalSource ?? source
}

function startSourcePolling() {
  if (sourcePollTimer) {
    return
  }

  void refreshLastExternalSource()
  sourcePollTimer = setInterval(() => {
    void refreshLastExternalSource()
  }, 1500)
}

function stopSourcePolling() {
  if (sourcePollTimer) {
    clearInterval(sourcePollTimer)
    sourcePollTimer = null
  }
}

function loadRendererRoute(window: BrowserWindow, route: string) {
  if (devServerUrl) {
    void window.loadURL(`${devServerUrl}#${route}`)
    return
  }

  void window.loadFile(join(__dirname, '../dist/index.html'), { hash: route })
}

function sharedWebPreferences() {
  return {
    preload: join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function intersectsWorkArea(bounds: PersistedBounds, workArea: Electron.Rectangle) {
  return (
    bounds.x < workArea.x + workArea.width &&
    bounds.x + bounds.width > workArea.x &&
    bounds.y < workArea.y + workArea.height &&
    bounds.y + bounds.height > workArea.y
  )
}

function clampFloatingBounds(bounds: PersistedBounds): PersistedBounds {
  const displays = screen.getAllDisplays()
  const matchedDisplay = displays.find((display) => intersectsWorkArea(bounds, display.workArea)) ?? screen.getPrimaryDisplay()
  const workArea = matchedDisplay.workArea
  const width = floatingButtonSize
  const height = floatingButtonSize
  return {
    x: clamp(bounds.x, workArea.x + floatingButtonMargin, workArea.x + workArea.width - width - floatingButtonMargin),
    y: clamp(bounds.y, workArea.y + floatingButtonMargin, workArea.y + workArea.height - height - floatingButtonMargin),
    width,
    height,
  }
}

function defaultFloatingBounds(): PersistedBounds {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width - floatingButtonSize - floatingButtonMargin,
    y: workArea.y + 120,
    width: floatingButtonSize,
    height: floatingButtonSize,
  }
}

function persistFloatingButtonBounds() {
  if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
    return
  }

  const bounds = clampFloatingBounds(floatingButtonWindow.getBounds())
  writeSettings({ ...readSettings(), floatingButtonBounds: bounds })
}

function correctFloatingButtonBounds() {
  if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
    return
  }

  const bounds = clampFloatingBounds(floatingButtonWindow.getBounds())
  floatingButtonWindow.setBounds(bounds)
  writeSettings({ ...readSettings(), floatingButtonBounds: bounds })
}

function startFloatingButtonDrag() {
  if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
    return
  }

  const cursor = screen.getCursorScreenPoint()
  const bounds = floatingButtonWindow.getBounds()
  floatingDragOffset = { x: cursor.x - bounds.x, y: cursor.y - bounds.y }
  floatingDragStartCursor = { x: cursor.x, y: cursor.y }

  if (floatingDragTimer) {
    clearInterval(floatingDragTimer)
  }

  floatingDragTimer = setInterval(() => {
    if (!floatingButtonWindow || floatingButtonWindow.isDestroyed() || !floatingDragOffset) {
      return
    }
    const next = screen.getCursorScreenPoint()
    floatingButtonWindow.setPosition(
      Math.round(next.x - floatingDragOffset.x),
      Math.round(next.y - floatingDragOffset.y),
    )
  }, 16)
}

function endFloatingButtonDrag(): { moved: boolean } {
  if (floatingDragTimer) {
    clearInterval(floatingDragTimer)
    floatingDragTimer = null
  }

  let moved = false
  if (floatingDragStartCursor) {
    const cursor = screen.getCursorScreenPoint()
    const dx = cursor.x - floatingDragStartCursor.x
    const dy = cursor.y - floatingDragStartCursor.y
    moved = Math.abs(dx) > floatingDragClickThreshold || Math.abs(dy) > floatingDragClickThreshold
  }

  floatingDragOffset = null
  floatingDragStartCursor = null

  if (floatingButtonWindow && !floatingButtonWindow.isDestroyed()) {
    correctFloatingButtonBounds()
  }

  return { moved }
}

function showMainWindow() {
  const window = createMainWindow()
  window.show()
  if (window.isMinimized()) {
    window.restore()
  }
  window.focus()
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }

  const icon = findAppIconPath()
  const workArea = screen.getPrimaryDisplay().workArea
  const minWidth = 960
  const minHeight = 640
  const width = Math.max(minWidth, Math.round(workArea.width * 0.9))
  const height = Math.max(minHeight, Math.round(workArea.height * 0.88))
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    backgroundColor: '#F8F0DE',
    title: '千点',
    show: false,
    icon,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#F8F0DE',
      symbolColor: '#1F1812',
      height: 32,
    },
    webPreferences: sharedWebPreferences(),
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  loadRendererRoute(mainWindow, '/')
  return mainWindow
}

function createCaptureWindow() {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.show()
    captureWindow.focus()
    return captureWindow
  }

  const icon = findAppIconPath()
  captureCloseApproved = false
  captureWindow = new BrowserWindow({
    width: 700,
    height: 620,
    minWidth: 560,
    minHeight: 480,
    backgroundColor: '#F7F5EF',
    title: '快速笔记',
    alwaysOnTop: true,
    show: false,
    icon,
    webPreferences: sharedWebPreferences(),
  })

  captureWindow.on('close', (event) => {
    if (!isQuitting && !captureCloseApproved) {
      event.preventDefault()
      captureWindow?.webContents.send('capture:close-request')
    }
  })

  captureWindow.on('closed', () => {
    captureCloseApproved = false
    captureWindow = null
  })

  captureWindow.once('ready-to-show', () => {
    captureWindow?.show()
    captureWindow?.focus()
  })

  loadRendererRoute(captureWindow, '/capture')
  return captureWindow
}

function createFloatingButtonWindow() {
  if (floatingButtonWindow && !floatingButtonWindow.isDestroyed()) {
    floatingButtonWindow.show()
    correctFloatingButtonBounds()
    return floatingButtonWindow
  }

  const settings = readSettings()
  const bounds = clampFloatingBounds(settings.floatingButtonBounds ?? defaultFloatingBounds())
  floatingButtonWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: '快速捕获按钮',
    webPreferences: sharedWebPreferences(),
  })

  floatingButtonWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  floatingButtonWindow.on('moved', persistFloatingButtonBounds)
  floatingButtonWindow.on('closed', () => {
    floatingButtonWindow = null
    updateTrayMenu()
  })

  loadRendererRoute(floatingButtonWindow, '/capture-button')
  updateTrayMenu()
  return floatingButtonWindow
}

function updateTrayMenu() {
  if (!tray) {
    return
  }

  const launchSettings = app.getLoginItemSettings()
  const canChangeLaunchAtLogin = app.isPackaged
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '快速笔记', accelerator: captureShortcut, click: () => createCaptureWindow() },
      { label: '打开知识库', click: showMainWindow },
      {
        label: floatingButtonWindow && !floatingButtonWindow.isDestroyed() && floatingButtonWindow.isVisible() ? '隐藏悬浮按钮' : '显示悬浮按钮',
        click: () => {
          if (floatingButtonWindow && !floatingButtonWindow.isDestroyed() && floatingButtonWindow.isVisible()) {
            persistFloatingButtonBounds()
            floatingButtonWindow.hide()
          } else {
            createFloatingButtonWindow()
          }
          updateTrayMenu()
        },
      },
      { type: 'separator' },
      {
        label: canChangeLaunchAtLogin ? '开机自启动' : '开机自启动（打包后可用）',
        type: 'checkbox',
        checked: launchSettings.openAtLogin,
        enabled: canChangeLaunchAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({ openAtLogin: menuItem.checked, path: process.execPath })
          updateTrayMenu()
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ]),
  )
}

function ensureLaunchAtLogin() {
  if (!app.isPackaged) {
    return
  }

  const settings = app.getLoginItemSettings()
  if (!settings.openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true, path: process.execPath })
  }
}

function createTray() {
  if (tray) {
    return tray
  }

  tray = new Tray(makeTrayIcon())
  tray.setToolTip(`千点 · ${captureShortcut} 快速笔记`)
  tray.on('click', () => showMainWindow())
  updateTrayMenu()
  return tray
}

function notifyKnowledgeEntriesChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('knowledge:entriesChanged')
  }
}


async function generateMetadataForEntry(entryId: string) {
  if (!knowledgeRepository || !knowledgeDb) {
    return null
  }

  const entry = await knowledgeRepository.getEntry(entryId)
  if (!entry) {
    return null
  }

  // 只有 pending 状态才需要生成，其他状态跳过
  if (entry.metadataStatus !== 'pending') {
    return entry
  }

  const settings = readAiRuntimeSettings(knowledgeDb, keyStorage)
  if (!settings.enabled) {
    const disabled = await knowledgeRepository.updateEntryMetadata({ id: entry.id, status: 'disabled', updatedAt: Date.now() })
    notifyKnowledgeEntriesChanged()
    return disabled
  }

  try {
    const allTags = await knowledgeRepository.listTags()
    const existingTagNames = allTags.categories.flatMap((category) => category.tags.map((tag) => tag.name))
    const metadata = await generateAiMetadata(settings, toMetadataInput(entry, existingTagNames))
    if (!metadata) {
      const disabled = await knowledgeRepository.updateEntryMetadata({ id: entry.id, status: 'disabled', updatedAt: Date.now() })
      notifyKnowledgeEntriesChanged()
      return disabled
    }

    const shouldApplyTags = entry.tags.length === 0 && metadata.tags && metadata.tags.length > 0

    // 用户手动写了标题则保留，只在标题为自动生成时才用 AI 替换
    const autoTitle = generateEntryTitle(entry.contentMd, entry.source)
    const title = entry.title === autoTitle ? metadata.title : undefined

    const updated = await knowledgeRepository.updateEntryMetadata({
      id: entry.id,
      title,
      summary: metadata.summary,
      suggestedTags: metadata.tags,
      applySuggestedTags: shouldApplyTags,
      status: 'ready',
      updatedAt: Date.now(),
    })
    notifyKnowledgeEntriesChanged()
    return updated
  } catch (error) {
    console.warn('AI metadata generation failed', error)
    const failed = await knowledgeRepository.updateEntryMetadata({ id: entry.id, status: 'failed', updatedAt: Date.now() })
    notifyKnowledgeEntriesChanged()
    return failed
  }
}

const metadataQueue = new MetadataQueue<Awaited<ReturnType<KnowledgeRepository['getEntry']>>>(generateMetadataForEntry)

async function enqueueAllMetadataGeneration(ids?: string[]) {
  if (!knowledgeRepository) {
    return { queued: 0 }
  }

  const targetIds = ids?.length ? ids : (await knowledgeRepository.listEntries({ sort: 'created_desc' })).entries.map((entry) => entry.id)
  return metadataQueue.enqueueMany(targetIds)
}

async function testAiSettings(settings: AiSettingsUpdateInput) {
  if (!knowledgeDb) {
    throw new Error('database is not ready')
  }

  const apiKey = settings.apiKey?.trim() || readAiRuntimeSettings(knowledgeDb, keyStorage).apiKey
  const runtimeSettings = {
    enabled: true,
    baseUrl: settings.baseUrl.trim(),
    model: settings.model.trim(),
    sendSourceUrl: Boolean(settings.sendSourceUrl),
    apiKeyConfigured: Boolean(apiKey),
    apiKey,
  }

  if (!runtimeSettings.baseUrl || !runtimeSettings.model || !runtimeSettings.apiKey) {
    return { ok: false, message: '请先填写 API Base URL、模型名和 API Key。' }
  }

  try {
    await generateAiMetadata(runtimeSettings, { contentMd: '这是一段用于连接测试的示例文本。', tagNames: [] })
    return { ok: true, message: '连接成功，AI 接口可用。' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '连接测试失败。' }
  }
}

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll()
  const registered = globalShortcut.register(captureShortcut, () => createCaptureWindow())
  if (!registered) {
    console.warn(`global shortcut registration failed: ${captureShortcut}`)
  }
}

function ensureRepository(): KnowledgeRepository {
  if (knowledgeRepository) return knowledgeRepository

  // 首次初始化可能失败（如数据库损坏），尝试重新初始化
  console.warn('知识库未就绪，尝试重新初始化...')
  try {
    const userDataPath = app.getPath('userData')
    const databasePath = join(userDataPath, 'knowledge.sqlite')
    const db = openKnowledgeDatabase(databasePath)
    knowledgeDb = db
    knowledgeRepository = createSqliteKnowledgeRepository(db)
    void cleanupImagesWithoutDatabaseReferences(userDataPath, db)
    console.info('知识库重新初始化成功')
    return knowledgeRepository
  } catch (error) {
    // 数据库可能严重损坏，删除后重建
    console.error('重新初始化失败，尝试重置数据库:', error)
    try {
      const userDataPath = app.getPath('userData')
      const databasePath = join(userDataPath, 'knowledge.sqlite')
      resetDatabase(databasePath)
      const db = openKnowledgeDatabase(databasePath)
      knowledgeDb = db
      knowledgeRepository = createSqliteKnowledgeRepository(db)
      void cleanupImagesWithoutDatabaseReferences(userDataPath, db)
      console.info('数据库已重置并重新初始化成功')
      return knowledgeRepository
    } catch (resetError) {
      console.error('数据库重置后仍无法初始化:', resetError)
      throw new Error('知识库初始化失败，请重启应用')
    }
  }
}

ipcMain.handle('knowledge:listEntries', (_event, query?: EntryListQuery) => ensureRepository().listEntries(query))
ipcMain.handle('knowledge:getEntry', (_event, id: string) => ensureRepository().getEntry(id))
ipcMain.handle('entries:create', async (_event, input: EntryCreateInput) => {
  const entry = await ensureRepository().createEntry(input)
  notifyKnowledgeEntriesChanged()
  metadataQueue.enqueue(entry?.id)
  return entry
})
ipcMain.handle('entries:update', async (_event, input: EntryUpdateInput) => {
  const entry = await ensureRepository().updateEntry(input)
  notifyKnowledgeEntriesChanged()
  metadataQueue.enqueue(entry?.id)
  return entry
})
ipcMain.handle('entries:delete', async (_event, input: EntryDeleteInput) => {
  await ensureRepository().deleteEntry(input)
  notifyKnowledgeEntriesChanged()
})
ipcMain.handle('entries:updateMetadata', async (_event, input: EntryMetadataUpdateInput) => {
  const entry = await ensureRepository().updateEntryMetadata(input)
  notifyKnowledgeEntriesChanged()
  return entry
})
ipcMain.handle('metadata:regenerateEntry', async (_event, id: string) => {
  if (knowledgeRepository) {
    try {
      await knowledgeRepository.updateEntryMetadata({ id, status: 'pending', updatedAt: Date.now() })
      notifyKnowledgeEntriesChanged()
    } catch (error) {
      console.warn('reset metadata status failed', error)
    }
  }
  return metadataQueue.enqueue(id, true)
})
ipcMain.handle('metadata:regenerateAll', async (_event, ids?: string[]) => enqueueAllMetadataGeneration(ids))
ipcMain.handle('settings:getAiSettings', () => {
  if (!knowledgeDb) {
    throw new Error('database is not ready')
  }
  return readAiSettings(knowledgeDb, keyStorage)
})
ipcMain.handle('settings:updateAiSettings', (_event, settings: AiSettingsUpdateInput) => {
  if (!knowledgeDb) {
    throw new Error('database is not ready')
  }
  return writeAiSettings(knowledgeDb, settings, keyStorage)
})
ipcMain.handle('settings:testAiSettings', (_event, settings: AiSettingsUpdateInput) => testAiSettings(settings))
ipcMain.handle('tags:list', () => ensureRepository().listTags())
ipcMain.handle('tags:create', (_event, input: TagCreateInput) => ensureRepository().createTag(input))
ipcMain.handle('tags:update', (_event, input: TagUpdateInput) => ensureRepository().updateTag(input))
ipcMain.handle('tags:delete', (_event, input: TagDeleteInput) => ensureRepository().deleteTag(input))
ipcMain.handle('tagCategories:create', (_event, input: TagCategoryCreateInput) =>
  ensureRepository().createTagCategory(input),
)
ipcMain.handle('tagCategories:update', (_event, input: TagCategoryUpdateInput) =>
  ensureRepository().updateTagCategory(input),
)
ipcMain.handle('tagCategories:delete', (_event, input: TagCategoryDeleteInput) =>
  ensureRepository().deleteTagCategory(input),
)

ipcMain.handle('capture:getCurrentSource', async () => lastExternalSource ?? refreshLastExternalSource())
ipcMain.handle('capture:readClipboard', async () =>
  readClipboardAsMarkdown(app.getPath('userData'), lastExternalSource ?? (await refreshLastExternalSource())),
)
ipcMain.handle('capture:discardImages', (_event, imagePaths: string[]) => discardImages(app.getPath('userData'), imagePaths))
ipcMain.handle('capture:openWindow', () => {
  createCaptureWindow()
})
ipcMain.handle('capture:showFloatingButton', () => {
  createFloatingButtonWindow()
})
ipcMain.handle('capture:floatingDragStart', () => {
  startFloatingButtonDrag()
})
ipcMain.handle('capture:floatingDragEnd', () => endFloatingButtonDrag())
ipcMain.handle('capture:closeCurrentWindow', (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  if (senderWindow && senderWindow === captureWindow) {
    captureCloseApproved = true
    senderWindow.close()
  }
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  const userDataPath = app.getPath('userData')
  registerImageProtocol(userDataPath)
  const databasePath = join(userDataPath, 'knowledge.sqlite')

  try {
    const db = openKnowledgeDatabase(databasePath)
    knowledgeDb = db
    knowledgeRepository = createSqliteKnowledgeRepository(db)
    void cleanupImagesWithoutDatabaseReferences(userDataPath, db)
  } catch (error) {
    // openKnowledgeDatabase 内部已有一次重试（删除损坏文件后重建）
    // 如果仍然失败，knowledgeRepository 保持 null，ensureRepository() 会在 IPC 调用时再次尝试
    console.error('应用启动时数据库初始化失败，将在首次使用时重试:', error)
  }

  startSourcePolling()
  ensureLaunchAtLogin()
  createTray()
  registerGlobalShortcuts()
  createFloatingButtonWindow()
  showMainWindow()

  screen.on('display-added', correctFloatingButtonBounds)
  screen.on('display-removed', correctFloatingButtonBounds)
  screen.on('display-metrics-changed', correctFloatingButtonBounds)

  app.on('activate', () => {
    showMainWindow()
    createFloatingButtonWindow()
  })
})

app.on('second-instance', () => {
  showMainWindow()
  createFloatingButtonWindow()
})

app.on('before-quit', () => {
  isQuitting = true
  persistFloatingButtonBounds()
  stopSourcePolling()
  globalShortcut.unregisterAll()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    return
  }
})
