import type {
  Entry,
  EntryCreateInput,
  EntryDeleteInput,
  EntryListQuery,
  EntryUpdateInput,
  EntryListResult,
  AiSettings,
  AiSettingsUpdateInput,
  AiConnectionTestResult,
  MetadataRegenerationResult,
  EntryMetadataUpdateInput,
  SourceInfo,
  TagCategoryCreateInput,
  TagCategoryUpdateInput,
  TagCategoryDeleteInput,
  TagCreateInput,
  TagDeleteInput,
  TagListResult,
  TagUpdateInput,
} from './domain/knowledge'

export interface KnowledgeApi {
  listEntries(query?: EntryListQuery): Promise<EntryListResult>
  getEntry(id: string): Promise<Entry | null>
  createEntry(input: EntryCreateInput): Promise<Entry>
  updateEntry(input: EntryUpdateInput): Promise<Entry>
  deleteEntry(input: EntryDeleteInput): Promise<void>
  updateEntryMetadata(input: EntryMetadataUpdateInput): Promise<Entry>
  onEntriesChanged(callback: () => void): () => void
  regenerateMetadata(id: string): Promise<Entry>
  regenerateAllMetadata(ids?: string[]): Promise<MetadataRegenerationResult>
  listTags(): Promise<TagListResult>
  createTag(input: TagCreateInput): Promise<TagListResult>
  updateTag(input: TagUpdateInput): Promise<TagListResult>
  deleteTag(input: TagDeleteInput): Promise<TagListResult>
  createTagCategory(input: TagCategoryCreateInput): Promise<TagListResult>
  updateTagCategory(input: TagCategoryUpdateInput): Promise<TagListResult>
  deleteTagCategory(input: TagCategoryDeleteInput): Promise<TagListResult>
}

export interface CapturedClipboardImage {
  path: string
  mime: 'image/png'
}

export interface ClipboardReadResult {
  contentMd: string
  title?: string
  format: 'html' | 'text' | 'image' | 'empty'
  imageUnsupported: boolean
  isEmpty: boolean
  images: CapturedClipboardImage[]
  imageError?: string
  source?: SourceInfo
}

export interface SettingsApi {
  getAiSettings(): Promise<AiSettings>
  updateAiSettings(settings: AiSettingsUpdateInput): Promise<AiSettings>
  testAiSettings(settings: AiSettingsUpdateInput): Promise<AiConnectionTestResult>
}

export interface CaptureApi {
  getCurrentSource(): Promise<SourceInfo>
  readClipboard(): Promise<ClipboardReadResult>
  discardImages(imagePaths: string[]): Promise<void>
  openWindow(): Promise<void>
  showFloatingButton(): Promise<void>
  floatingDragStart(point?: { x: number; y: number }): Promise<void>
  floatingDragEnd(cancelled?: boolean): Promise<{ moved: boolean }>
  closeCurrentWindow(): Promise<void>
  onCloseRequest(callback: () => void): () => void
}

declare global {
  interface Window {
    assistantApi?: import('./domain/assistant').AssistantApi
    knowledgeApi?: KnowledgeApi
    captureApi?: CaptureApi
    settingsApi?: SettingsApi
  }
}

