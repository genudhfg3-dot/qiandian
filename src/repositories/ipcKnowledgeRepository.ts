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
import type { KnowledgeRepository } from './knowledgeRepository'
import { mockKnowledgeRepository } from './mockKnowledgeRepository'

function getApi() {
  return typeof window === 'undefined' ? undefined : window.knowledgeApi
}

export const ipcKnowledgeRepository: KnowledgeRepository = {
  async listEntries(query?: EntryListQuery): Promise<EntryListResult> {
    return (getApi() ?? mockKnowledgeRepository).listEntries(query)
  },
  async getEntry(id: string): Promise<Entry | null> {
    return (getApi() ?? mockKnowledgeRepository).getEntry(id)
  },
  async createEntry(input: EntryCreateInput): Promise<Entry> {
    return (getApi() ?? mockKnowledgeRepository).createEntry(input)
  },
  async updateEntry(input: EntryUpdateInput): Promise<Entry> {
    return (getApi() ?? mockKnowledgeRepository).updateEntry(input)
  },
  async deleteEntry(input: EntryDeleteInput): Promise<void> {
    return (getApi() ?? mockKnowledgeRepository).deleteEntry(input)
  },
  async updateEntryMetadata(input: EntryMetadataUpdateInput): Promise<Entry> {
    return (getApi() ?? mockKnowledgeRepository).updateEntryMetadata(input)
  },
  async regenerateMetadata(id: string): Promise<Entry> {
    const api = getApi()
    return api?.regenerateMetadata ? api.regenerateMetadata(id) : mockKnowledgeRepository.regenerateMetadata(id)
  },
  async listTags(): Promise<TagListResult> {
    return (getApi() ?? mockKnowledgeRepository).listTags()
  },
  async createTag(input: TagCreateInput): Promise<TagListResult> {
    return (getApi() ?? mockKnowledgeRepository).createTag(input)
  },
  async updateTag(input: TagUpdateInput): Promise<TagListResult> {
    return (getApi() ?? mockKnowledgeRepository).updateTag(input)
  },
  async deleteTag(input: TagDeleteInput): Promise<TagListResult> {
    return (getApi() ?? mockKnowledgeRepository).deleteTag(input)
  },
  async createTagCategory(input: TagCategoryCreateInput): Promise<TagListResult> {
    return (getApi() ?? mockKnowledgeRepository).createTagCategory(input)
  },
  async updateTagCategory(input: TagCategoryUpdateInput): Promise<TagListResult> {
    const api = getApi()
    return api?.updateTagCategory ? api.updateTagCategory(input) : mockKnowledgeRepository.updateTagCategory(input)
  },
  async deleteTagCategory(input: TagCategoryDeleteInput): Promise<TagListResult> {
    return (getApi() ?? mockKnowledgeRepository).deleteTagCategory(input)
  },
}
