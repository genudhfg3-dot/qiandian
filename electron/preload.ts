import { contextBridge, ipcRenderer } from 'electron'
import type { CaptureApi, KnowledgeApi, SettingsApi } from '../src/electron-api'
import type { AssistantApi } from '../src/domain/assistant'

const knowledgeApi: KnowledgeApi = {
  listEntries(query) {
    return ipcRenderer.invoke('knowledge:listEntries', query)
  },
  getEntry(id) {
    return ipcRenderer.invoke('knowledge:getEntry', id)
  },
  createEntry(input) {
    return ipcRenderer.invoke('entries:create', input)
  },
  updateEntry(input) {
    return ipcRenderer.invoke('entries:update', input)
  },
  deleteEntry(input) {
    return ipcRenderer.invoke('entries:delete', input)
  },
  updateEntryMetadata(input) {
    return ipcRenderer.invoke('entries:updateMetadata', input)
  },
  onEntriesChanged(callback) {
    const listener = () => callback()
    ipcRenderer.on('knowledge:entriesChanged', listener)
    return () => ipcRenderer.removeListener('knowledge:entriesChanged', listener)
  },
  regenerateMetadata(id) {
    return ipcRenderer.invoke('metadata:regenerateEntry', id)
  },
  regenerateAllMetadata(ids) {
    return ipcRenderer.invoke('metadata:regenerateAll', ids)
  },
  listTags() {
    return ipcRenderer.invoke('tags:list')
  },
  createTag(input) {
    return ipcRenderer.invoke('tags:create', input)
  },
  updateTag(input) {
    return ipcRenderer.invoke('tags:update', input)
  },
  deleteTag(input) {
    return ipcRenderer.invoke('tags:delete', input)
  },
  createTagCategory(input) {
    return ipcRenderer.invoke('tagCategories:create', input)
  },
  updateTagCategory(input) {
    return ipcRenderer.invoke('tagCategories:update', input)
  },
  deleteTagCategory(input) {
    return ipcRenderer.invoke('tagCategories:delete', input)
  },
}

const settingsApi: SettingsApi = {
  getAiSettings() {
    return ipcRenderer.invoke('settings:getAiSettings')
  },
  updateAiSettings(settings) {
    return ipcRenderer.invoke('settings:updateAiSettings', settings)
  },
  testAiSettings(settings) {
    return ipcRenderer.invoke('settings:testAiSettings', settings)
  },
}

const captureApi: CaptureApi = {
  getCurrentSource() {
    return ipcRenderer.invoke('capture:getCurrentSource')
  },
  readClipboard() {
    return ipcRenderer.invoke('capture:readClipboard')
  },
  discardImages(imagePaths) {
    return ipcRenderer.invoke('capture:discardImages', imagePaths)
  },
  openWindow() {
    return ipcRenderer.invoke('capture:openWindow')
  },
  showFloatingButton() {
    return ipcRenderer.invoke('capture:showFloatingButton')
  },
  floatingDragStart(point) {
    return ipcRenderer.invoke('capture:floatingDragStart', point)
  },
  floatingDragEnd(cancelled) {
    return ipcRenderer.invoke('capture:floatingDragEnd', cancelled)
  },
  closeCurrentWindow() {
    return ipcRenderer.invoke('capture:closeCurrentWindow')
  },
  onCloseRequest(callback) {
    const listener = () => callback()
    ipcRenderer.on('capture:close-request', listener)
    return () => ipcRenderer.removeListener('capture:close-request', listener)
  },
}

contextBridge.exposeInMainWorld('knowledgeApi', knowledgeApi)
contextBridge.exposeInMainWorld('captureApi', captureApi)
contextBridge.exposeInMainWorld('settingsApi', settingsApi)

const assistantApi: AssistantApi = {
  open: (text, action) => ipcRenderer.invoke('assistant:open', text, action),
  menu: () => ipcRenderer.invoke('assistant:menu'),
  state: () => ipcRenderer.invoke('assistant:state'),
  send: text => ipcRenderer.invoke('assistant:send', text),
  draft: text => ipcRenderer.invoke('assistant:draft', text),
  cancel: () => ipcRenderer.invoke('assistant:cancel'),
  retry: () => ipcRenderer.invoke('assistant:retry'),
  reset: () => ipcRenderer.invoke('assistant:reset'),
  clipboard: () => ipcRenderer.invoke('assistant:clipboard'),
  image: dataUrl => ipcRenderer.invoke('assistant:image', dataUrl),
  removeImage: id => ipcRenderer.invoke('assistant:removeImage', id),
  acceptIncoming: mode => ipcRenderer.invoke('assistant:acceptIncoming', mode),
  hide: () => ipcRenderer.invoke('assistant:hide'),
  pin: () => ipcRenderer.invoke('assistant:pin'),
  settings: () => ipcRenderer.invoke('assistant:settings'),
  preferences: () => ipcRenderer.invoke('assistant:preferences'),
  updatePreferences: input => ipcRenderer.invoke('assistant:updatePreferences', input),
  hint: action => ipcRenderer.invoke('assistant:hint', action),
  save: input => ipcRenderer.invoke('assistant:save', input),
  onDelta(callback) {
    const listener = (_event: Electron.IpcRendererEvent, delta: { id: string; text: string; firstTokenMs?: number }) => callback(delta)
    ipcRenderer.on('assistant:delta', listener)
    return () => ipcRenderer.removeListener('assistant:delta', listener)
  },
  onState(callback) {
    const listener = (_event: Electron.IpcRendererEvent, state: import('../src/domain/assistant').AssistantState) => callback(state)
    ipcRenderer.on('assistant:state', listener)
    return () => ipcRenderer.removeListener('assistant:state', listener)
  },
}
contextBridge.exposeInMainWorld('assistantApi', assistantApi)

