import { contextBridge, ipcRenderer } from 'electron'
import type { CaptureApi, KnowledgeApi, SettingsApi } from '../src/electron-api'

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
  floatingDragStart() {
    return ipcRenderer.invoke('capture:floatingDragStart')
  },
  floatingDragEnd() {
    return ipcRenderer.invoke('capture:floatingDragEnd')
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

