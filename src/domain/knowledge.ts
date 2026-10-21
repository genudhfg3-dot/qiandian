export type TagColor =
  | 'work'
  | 'reading'
  | 'inspiration'
  | 'tools'
  | 'personal'
  | 'writing'
  | 'study'
  | 'archive'
  | 'uncategorized'

export interface TagCategory {
  id: string
  name: string
  parentId: string | null
  color: TagColor
  sortOrder: number
}

export interface Tag {
  id: string
  name: string
  categoryId: string | null
  color: TagColor
}

export interface SourceInfo {
  app: string
  title?: string
  url?: string
}

export type MetadataStatus = 'local' | 'pending' | 'ready' | 'failed' | 'disabled'

export interface Entry {
  id: string
  title: string
  titleIsAuto?: boolean
  contentMd: string
  excerpt: string
  summary?: string
  metadataStatus?: MetadataStatus
  metadataUpdatedAt?: number | null
  images: string[]
  source: SourceInfo
  tags: Tag[]
  createdAt: number
  updatedAt: number
}

export type EntrySortOrder = 'created_desc' | 'created_asc'

export interface EntryListQuery {
  q?: string
  tagIds?: string[]
  sourceApps?: string[]
  sort?: EntrySortOrder
}

export interface EntryCreateInput {
  title?: string
  contentMd: string
  source?: SourceInfo
  tagNames?: string[]
  images?: string[]
}

export interface EntryUpdateInput extends EntryCreateInput {
  id: string
}

export interface EntryDeleteInput {
  id: string
}

export interface TagCreateInput {
  name: string
  categoryId?: string | null
}

export interface TagUpdateInput {
  id: string
  name?: string
  categoryId?: string | null
}

export interface TagDeleteInput {
  id: string
}

export interface TagCategoryCreateInput {
  name: string
  color?: TagColor
}

export interface TagCategoryUpdateInput {
  id: string
  name?: string
  color?: TagColor
}

export interface TagCategoryDeleteInput {
  id: string
}

export interface TagListResult {
  categories: TagCategoryFacet[]
  total: number
}

export interface TagFacet extends Tag {
  count: number
}

export interface TagCategoryFacet extends TagCategory {
  count: number
  tags: TagFacet[]
}

export interface SourceFacet {
  app: string
  count: number
}

export interface EntryListResult {
  entries: Entry[]
  total: number
  facets: {
    categories: TagCategoryFacet[]
    sources: SourceFacet[]
  }
}

export interface AiSettings {
  enabled: boolean
  baseUrl: string
  model: string
  sendSourceUrl: boolean
  apiKeyConfigured: boolean
}

export interface AiSettingsUpdateInput {
  enabled: boolean
  baseUrl: string
  model: string
  sendSourceUrl: boolean
  apiKey?: string
  clearApiKey?: boolean
}

export interface AiConnectionTestResult {
  ok: boolean
  message: string
}

export interface MetadataRegenerationResult {
  queued: number
}

export interface AiMetadataResult {
  title: string
  summary: string
  tags: string[]
}

export interface EntryMetadataUpdateInput {
  id: string
  title?: string
  summary?: string
  suggestedTags?: string[]
  applySuggestedTags?: boolean
  status: MetadataStatus
  updatedAt?: number
}
