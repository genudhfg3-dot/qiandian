import type {
  Entry,
  EntryCreateInput,
  EntryDeleteInput,
  EntryListQuery,
  EntryListResult,
  EntryMetadataUpdateInput,
  EntryUpdateInput,
  TagCategoryCreateInput,
  TagCategoryUpdateInput,
  TagCategoryDeleteInput,
  TagCreateInput,
  TagDeleteInput,
  TagListResult,
  TagUpdateInput,
} from '../domain/knowledge'

export interface KnowledgeRepository {
  listEntries(query?: EntryListQuery): Promise<EntryListResult>
  getEntry(id: string): Promise<Entry | null>
  createEntry(input: EntryCreateInput): Promise<Entry>
  updateEntry(input: EntryUpdateInput): Promise<Entry>
  deleteEntry(input: EntryDeleteInput): Promise<void>
  updateEntryMetadata(input: EntryMetadataUpdateInput): Promise<Entry>
  regenerateMetadata(id: string): Promise<Entry>
  listTags(): Promise<TagListResult>
  createTag(input: TagCreateInput): Promise<TagListResult>
  updateTag(input: TagUpdateInput): Promise<TagListResult>
  deleteTag(input: TagDeleteInput): Promise<TagListResult>
  createTagCategory(input: TagCategoryCreateInput): Promise<TagListResult>
  updateTagCategory(input: TagCategoryUpdateInput): Promise<TagListResult>
  deleteTagCategory(input: TagCategoryDeleteInput): Promise<TagListResult>
}
