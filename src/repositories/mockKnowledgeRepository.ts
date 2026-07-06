import { mockEntries, mockTagCategories, mockTags } from '../data/mockEntries'
import type {
  Entry,
  EntryCreateInput,
  EntryDeleteInput,
  EntryListQuery,
  EntryListResult,
  EntryMetadataUpdateInput,
  EntryUpdateInput,
  SourceFacet,
  Tag,
  TagCategoryCreateInput,
  TagCategoryUpdateInput,
  TagCategoryDeleteInput,
  TagCategoryFacet,
  TagColor,
  TagCreateInput,
  TagDeleteInput,
  TagFacet,
  TagListResult,
  TagUpdateInput,
} from '../domain/knowledge'
import { normalizeSourceAppName } from '../utils/sourceApp'
import { generateEntrySummary, generateEntryTitle } from '../utils/title'
import type { KnowledgeRepository } from './knowledgeRepository'

const normalize = (value: string) => value.trim().toLocaleLowerCase()
const colorCycle: TagColor[] = [
  'work',
  'reading',
  'inspiration',
  'tools',
  'personal',
  'writing',
  'study',
  'archive',
]

function matchesSearch(entry: Entry, rawQuery: string | undefined) {
  const query = normalize(rawQuery ?? '')
  if (!query) {
    return true
  }

  const searchable = [
    entry.title,
    entry.excerpt,
    entry.summary ?? '',
    entry.contentMd,
    entry.source.app,
    entry.source.title ?? '',
    entry.source.url ?? '',
  ]
    .join(' ')
    .toLocaleLowerCase()

  return searchable.includes(query)
}

function matchesTags(entry: Entry, tagIds: string[] | undefined) {
  if (!tagIds?.length) {
    return true
  }

  const entryTagIds = new Set(entry.tags.map((tag) => tag.id))
  return tagIds.some((tagId) => entryTagIds.has(tagId))
}

function matchesSources(entry: Entry, sourceApps: string[] | undefined) {
  if (!sourceApps?.length) {
    return true
  }

  const selected = new Set(sourceApps.map(normalizeSourceAppName))
  return selected.has(normalizeSourceAppName(entry.source.app))
}

function uniqueTagNames(tagNames: string[] | undefined) {
  return Array.from(new Set((tagNames ?? []).map((tagName) => tagName.trim()).filter(Boolean)))
}

function tagCountMap(entries: Entry[]) {
  const counts = new Map<string, number>()
  entries.forEach((entry) => {
    entry.tags.forEach((tag) => counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1))
  })
  return counts
}


function buildTagList(entries: Entry[], includeZeroCount: boolean): TagListResult {
  const counts = tagCountMap(entries)
  const uncategorized = mockTagCategories.find((category) => category.id === 'uncategorized')
  const categories = mockTagCategories
    .map((category) => {
      const tags: TagFacet[] = mockTags
        .filter((tag) => tag.categoryId === category.id || (!tag.categoryId && category.id === 'uncategorized'))
        .map((tag) => ({ ...tag, categoryId: tag.categoryId ?? uncategorized?.id ?? null, color: category.color, count: counts.get(tag.id) ?? 0 }))
        .filter((tag) => includeZeroCount || tag.count > 0)
      return { ...category, count: tags.reduce((sum, tag) => sum + tag.count, 0), tags } satisfies TagCategoryFacet
    })
    .filter((category) => includeZeroCount || category.tags.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return { categories, total: categories.reduce((sum, category) => sum + category.tags.length, 0) }
}

function buildFacets(entries: Entry[]): EntryListResult['facets'] {
  const sourceCounts = new Map<string, number>()
  mockEntries.forEach((entry) => {
    const app = normalizeSourceAppName(entry.source.app)
    sourceCounts.set(app, (sourceCounts.get(app) ?? 0) + 1)
  })

  const sources: SourceFacet[] = Array.from(sourceCounts.entries())
    .map(([app, count]) => ({ app, count }))
    .sort((a, b) => a.app.localeCompare(b.app, 'zh-Hans-CN'))

  return { ...buildTagList(entries, false), sources }
}

function createMockTag(input: TagCreateInput): Tag {
  const name = input.name.trim()
  if (!name) {
    throw new Error('tag name is required')
  }

  let tag = mockTags.find((candidate) => candidate.name === name)
  if (!tag) {
    const categoryId = input.categoryId ?? 'uncategorized'
    const category = mockTagCategories.find((candidate) => candidate.id === categoryId)
    tag = {
      id: `tag-${Date.now()}-${mockTags.length}`,
      name,
      categoryId,
      color: category?.color ?? 'uncategorized',
    }
    mockTags.push(tag)
  }

  return tag
}

function refreshEntryTagReferences() {
  const byId = new Map(mockTags.map((tag) => [tag.id, tag]))
  mockEntries.forEach((entry) => {
    entry.tags = entry.tags.map((tag) => byId.get(tag.id)).filter((tag): tag is Tag => Boolean(tag))
  })
}

export const mockKnowledgeRepository: KnowledgeRepository = {
  async listEntries(query: EntryListQuery = {}): Promise<EntryListResult> {
    const sort = query.sort ?? 'created_desc'
    const filtered = mockEntries
      .filter((entry) => matchesSearch(entry, query.q))
      .filter((entry) => matchesTags(entry, query.tagIds))
      .filter((entry) => matchesSources(entry, query.sourceApps))
      .slice()
      .sort((a, b) => (sort === 'created_asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt))

    return { entries: filtered, total: filtered.length, facets: buildFacets(mockEntries) }
  },
  async getEntry(id: string): Promise<Entry | null> {
    return mockEntries.find((entry) => entry.id === id) ?? null
  },
  async createEntry(input: EntryCreateInput): Promise<Entry> {
    const contentMd = input.contentMd.trim()
    if (!contentMd) {
      throw new Error('content is required')
    }

    const tagNames = uniqueTagNames(input.tagNames)
    const now = Date.now()
    const entryTags = tagNames.map((tagName) => createMockTag({ name: tagName }))
    const source = { ...(input.source ?? { app: 'Manual Capture' }), app: normalizeSourceAppName(input.source?.app) }

    const entry: Entry = {
      id: String(Math.max(0, ...mockEntries.map((candidate) => Number(candidate.id) || 0)) + 1),
      title: input.title?.trim() || generateEntryTitle(contentMd, source),
      contentMd,
      excerpt: generateEntrySummary(contentMd),
      images: input.images ?? [],
      source,
      tags: entryTags,
      createdAt: now,
      updatedAt: now,
    }

    mockEntries.unshift(entry)
    return entry
  },
  async updateEntry(input: EntryUpdateInput): Promise<Entry> {
    const index = mockEntries.findIndex((entry) => entry.id === input.id)
    if (index < 0) {
      throw new Error('entry not found')
    }

    const contentMd = input.contentMd.trim()
    if (!contentMd) {
      throw new Error('content is required')
    }

    const source = { ...(input.source ?? { app: 'Manual Capture' }), app: normalizeSourceAppName(input.source?.app) }
    const tagNames = uniqueTagNames(input.tagNames)
    const entryTags = tagNames.map((tagName) => createMockTag({ name: tagName }))
    const current = mockEntries[index]
    const updated: Entry = {
      ...current,
      title: input.title?.trim() || generateEntryTitle(contentMd, source),
      contentMd,
      excerpt: generateEntrySummary(contentMd),
      images: input.images ?? [],
      source,
      tags: entryTags,
      updatedAt: Date.now(),
    }
    mockEntries[index] = updated
    return updated
  },
  async deleteEntry(input: EntryDeleteInput): Promise<void> {
    const index = mockEntries.findIndex((entry) => entry.id === input.id)
    if (index < 0) {
      throw new Error('entry not found')
    }
    mockEntries.splice(index, 1)
  },

  async regenerateMetadata(id: string): Promise<Entry> {
    return this.updateEntryMetadata({ id, status: 'disabled', updatedAt: Date.now() })
  },
  async updateEntryMetadata(input: EntryMetadataUpdateInput): Promise<Entry> {
    const index = mockEntries.findIndex((entry) => entry.id === input.id)
    if (index < 0) {
      throw new Error('entry not found')
    }
    const current = mockEntries[index]
    const tagNames = input.applySuggestedTags
      ? uniqueTagNames([...(current.tags.map((tag) => tag.name)), ...(input.suggestedTags ?? [])])
      : current.tags.map((tag) => tag.name)
    const tags = tagNames.map((tagName) => createMockTag({ name: tagName }))
    const updated: Entry = {
      ...current,
      title: input.title?.trim() || current.title,
      summary: input.summary?.trim() || undefined,
      excerpt: input.summary?.trim() || generateEntrySummary(current.contentMd),
      metadataStatus: input.status,
      metadataUpdatedAt: input.updatedAt ?? Date.now(),
      tags,
      updatedAt: Date.now(),
    }
    mockEntries[index] = updated
    return updated
  },
  async listTags(): Promise<TagListResult> {
    return buildTagList(mockEntries, true)
  },
  async createTag(input: TagCreateInput): Promise<TagListResult> {
    createMockTag(input)
    return buildTagList(mockEntries, true)
  },
  async updateTag(input: TagUpdateInput): Promise<TagListResult> {
    const tag = mockTags.find((candidate) => candidate.id === input.id)
    if (!tag) {
      throw new Error('tag not found')
    }
    if (input.name?.trim()) {
      tag.name = input.name.trim()
    }
    if (input.categoryId !== undefined) {
      const category = mockTagCategories.find((candidate) => candidate.id === input.categoryId)
      tag.categoryId = input.categoryId
      tag.color = category?.color ?? 'uncategorized'
    }
    refreshEntryTagReferences()
    return buildTagList(mockEntries, true)
  },
  async deleteTag(input: TagDeleteInput): Promise<TagListResult> {
    const index = mockTags.findIndex((tag) => tag.id === input.id)
    if (index >= 0) {
      mockTags.splice(index, 1)
      refreshEntryTagReferences()
    }
    return buildTagList(mockEntries, true)
  },
  async createTagCategory(input: TagCategoryCreateInput): Promise<TagListResult> {
    const name = input.name.trim()
    if (!name) {
      throw new Error('category name is required')
    }
    const sortOrder = Math.max(0, ...mockTagCategories.map((category) => category.sortOrder)) + 1
    mockTagCategories.push({
      id: `category-${Date.now()}-${mockTagCategories.length}`,
      name,
      parentId: null,
      color: input.color ?? colorCycle[sortOrder % colorCycle.length],
      sortOrder,
    })
    return buildTagList(mockEntries, true)
  },
  async updateTagCategory(input: TagCategoryUpdateInput): Promise<TagListResult> {
    const category = mockTagCategories.find((candidate) => candidate.id === input.id)
    if (!category) {
      throw new Error('category not found')
    }
    if (input.name?.trim()) {
      category.name = input.name.trim()
    }
    if (input.color) {
      category.color = input.color
      mockTags.forEach((tag) => {
        if (tag.categoryId === input.id) {
          tag.color = input.color!
        }
      })
      refreshEntryTagReferences()
    }
    return buildTagList(mockEntries, true)
  },
  async deleteTagCategory(input: TagCategoryDeleteInput): Promise<TagListResult> {
    const index = mockTagCategories.findIndex((category) => category.id === input.id && category.id !== 'uncategorized')
    if (index >= 0) {
      mockTagCategories.splice(index, 1)
      mockTags.forEach((tag) => {
        if (tag.categoryId === input.id) {
          tag.categoryId = 'uncategorized'
          tag.color = 'uncategorized'
        }
      })
      refreshEntryTagReferences()
    }
    return buildTagList(mockEntries, true)
  },
}


