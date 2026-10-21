import type { Database } from 'better-sqlite3'
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
} from '../../src/domain/knowledge'
import type { KnowledgeRepository } from '../../src/repositories/knowledgeRepository'
import { normalizeSourceAppName } from '../../src/utils/sourceApp'
import { generateEntrySummary, generateEntryTitle } from '../../src/utils/title'

interface EntryRow {
  id: number
  title: string | null
  title_is_auto: number
  content_md: string
  source_app: string | null
  source_title: string | null
  source_url: string | null
  summary: string | null
  metadata_status: Entry['metadataStatus'] | null
  metadata_updated_at: number | null
  created_at: number
  updated_at: number
}

interface TagRow {
  entry_id: number
  tag_id: number
  tag_name: string
  category_id: number | null
  category_color: TagColor | null
}

interface RawSourceFacetRow {
  app: string | null
  count: number
}

interface TagFacetRow {
  category_id: number | null
  category_name: string | null
  parent_id: number | null
  color: TagColor | null
  sort_order: number | null
  tag_id: number
  tag_name: string
  count: number
}

const categoryColors: TagColor[] = [
  'work',
  'reading',
  'inspiration',
  'tools',
  'personal',
  'writing',
  'study',
  'archive',
]

function makeInClause(prefix: string, values: string[], params: Record<string, string>) {
  return values.map((value, index) => {
    const key = `${prefix}${index}`
    params[key] = value
    return `@${key}`
  })
}

function sourceAppAliases(app: string) {
  const canonical = normalizeSourceAppName(app)
  if (canonical === 'Chrome') {
    return ['Chrome', 'Google Chrome', 'chrome', 'chrome.exe']
  }
  if (canonical === 'Edge') {
    return ['Edge', 'Microsoft Edge', 'msedge', 'msedge.exe']
  }
  if (canonical === 'Firefox') {
    return ['Firefox', 'firefox', 'firefox.exe']
  }
  return [canonical]
}

function excerptFrom(contentMd: string) {
  return generateEntrySummary(contentMd)
}

function uniqueTagNames(tagNames: string[] | undefined) {
  return Array.from(new Set((tagNames ?? []).map((tagName) => tagName.trim()).filter(Boolean)))
}

function getUncategorizedCategoryId(db: Database) {
  const row = db
    .prepare(
      `
        SELECT id
        FROM tag_categories
        WHERE color = 'uncategorized' OR name = '未分类'
        ORDER BY id ASC
        LIMIT 1
      `,
    )
    .get() as { id: number } | undefined

  return row?.id ?? null
}

function loadTagsByEntryId(db: Database, entryIds: number[]) {
  if (entryIds.length === 0) {
    return new Map<number, Tag[]>()
  }

  const params: Record<string, string> = {}
  const placeholders = makeInClause(
    'entryId',
    entryIds.map((id) => String(id)),
    params,
  )
  const rows = db
    .prepare(
      `
        SELECT
          et.entry_id,
          t.id AS tag_id,
          t.name AS tag_name,
          c.id AS category_id,
          c.color AS category_color
        FROM entry_tags et
        JOIN tags t ON t.id = et.tag_id
        LEFT JOIN tag_categories c ON c.id = t.category_id
        WHERE CAST(et.entry_id AS TEXT) IN (${placeholders.join(', ')})
        ORDER BY t.name ASC
      `,
    )
    .all(params) as TagRow[]

  const tagsByEntryId = new Map<number, Tag[]>()
  rows.forEach((row) => {
    const tags = tagsByEntryId.get(row.entry_id) ?? []
    tags.push({
      id: String(row.tag_id),
      name: row.tag_name,
      categoryId: row.category_id ? String(row.category_id) : null,
      color: row.category_color ?? 'uncategorized',
    })
    tagsByEntryId.set(row.entry_id, tags)
  })

  return tagsByEntryId
}

function loadImagesByEntryId(db: Database, entryIds: number[]) {
  if (entryIds.length === 0) {
    return new Map<number, string[]>()
  }

  const params: Record<string, string> = {}
  const placeholders = makeInClause(
    'entryId',
    entryIds.map((id) => String(id)),
    params,
  )
  const rows = db
    .prepare(
      `
        SELECT entry_id, file_path
        FROM images
        WHERE CAST(entry_id AS TEXT) IN (${placeholders.join(', ')})
        ORDER BY id ASC
      `,
    )
    .all(params) as { entry_id: number; file_path: string }[]

  const imagesByEntryId = new Map<number, string[]>()
  rows.forEach((row) => {
    const images = imagesByEntryId.get(row.entry_id) ?? []
    images.push(row.file_path)
    imagesByEntryId.set(row.entry_id, images)
  })

  return imagesByEntryId
}

function mapEntryRow(db: Database, row: EntryRow): Entry {
  const tagsByEntryId = loadTagsByEntryId(db, [row.id])
  const imagesByEntryId = loadImagesByEntryId(db, [row.id])
  return {
    id: String(row.id),
    title: row.title ?? '',
    titleIsAuto: Boolean(row.title_is_auto),
    contentMd: row.content_md,
    excerpt: row.summary?.trim() || excerptFrom(row.content_md),
    summary: row.summary ?? undefined,
    metadataStatus: row.metadata_status ?? 'local',
    metadataUpdatedAt: row.metadata_updated_at ?? null,
    images: imagesByEntryId.get(row.id) ?? [],
    source: {
      app: normalizeSourceAppName(row.source_app),
      title: row.source_title ?? undefined,
      url: row.source_url ?? undefined,
    },
    tags: tagsByEntryId.get(row.id) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function loadEntryById(db: Database, entryId: number) {
  const row = db
    .prepare(
      `
        SELECT id, title, title_is_auto, content_md, source_app, source_title, source_url, summary, metadata_status, metadata_updated_at, created_at, updated_at
        FROM entries
        WHERE id = ?
      `,
    )
    .get(entryId) as EntryRow | undefined

  return row ? mapEntryRow(db, row) : null
}

function buildTagList(db: Database, includeZeroCount: boolean): TagListResult {
  const rows = db
    .prepare(
      `
        SELECT
          c.id AS category_id,
          c.name AS category_name,
          c.parent_id,
          c.color,
          c.sort_order,
          t.id AS tag_id,
          t.name AS tag_name,
          COUNT(et.entry_id) AS count
        FROM tags t
        LEFT JOIN tag_categories c ON c.id = t.category_id
        LEFT JOIN entry_tags et ON et.tag_id = t.id
        GROUP BY t.id
        ORDER BY COALESCE(c.sort_order, 999), t.name ASC
      `,
    )
    .all() as TagFacetRow[]

  const categoriesById = new Map<string, TagCategoryFacet>()

  if (includeZeroCount) {
    const categoryRows = db
      .prepare(
        `
          SELECT id, name, parent_id, color, sort_order
          FROM tag_categories
          ORDER BY sort_order ASC, name ASC
        `,
      )
      .all() as Array<{
        id: number
        name: string
        parent_id: number | null
        color: TagColor | null
        sort_order: number | null
      }>

    categoryRows.forEach((row) => {
      categoriesById.set(String(row.id), {
        id: String(row.id),
        name: row.name,
        parentId: row.parent_id ? String(row.parent_id) : null,
        color: row.color ?? 'uncategorized',
        sortOrder: row.sort_order ?? 999,
        count: 0,
        tags: [],
      })
    })
  }

  rows.forEach((row) => {
    if (!includeZeroCount && row.count <= 0) {
      return
    }

    const categoryId = row.category_id ? String(row.category_id) : 'uncategorized'
    const category =
      categoriesById.get(categoryId) ??
      ({
        id: categoryId,
        name: row.category_name ?? '未分类',
        parentId: row.parent_id ? String(row.parent_id) : null,
        color: row.color ?? 'uncategorized',
        sortOrder: row.sort_order ?? 999,
        count: 0,
        tags: [],
      } satisfies TagCategoryFacet)

    const tag: TagFacet = {
      id: String(row.tag_id),
      name: row.tag_name,
      categoryId,
      color: row.color ?? 'uncategorized',
      count: row.count,
    }
    category.count += row.count
    category.tags.push(tag)
    categoriesById.set(categoryId, category)
  })

  const categories = Array.from(categoriesById.values()).sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    categories,
    total: categories.reduce((sum, category) => sum + category.tags.length, 0),
  }
}

function buildFacets(db: Database): EntryListResult['facets'] {
  const tagList = buildTagList(db, false)
  const rawSources = db
    .prepare(
      `
        SELECT source_app AS app, COUNT(*) AS count
        FROM entries
        WHERE source_app IS NOT NULL AND source_app != ''
        GROUP BY source_app
        ORDER BY source_app ASC
      `,
    )
    .all() as RawSourceFacetRow[]

  const sourceCounts = new Map<string, number>()
  rawSources.forEach((source) => {
    const app = normalizeSourceAppName(source.app)
    sourceCounts.set(app, (sourceCounts.get(app) ?? 0) + source.count)
  })
  const sources: SourceFacet[] = Array.from(sourceCounts, ([app, count]) => ({ app, count })).sort((a, b) =>
    a.app.localeCompare(b.app),
  )

  return { categories: tagList.categories, sources }
}

function createTagRecord(db: Database, input: TagCreateInput) {
  const name = input.name.trim()
  if (!name) {
    throw new Error('tag name is required')
  }

  const categoryId = input.categoryId ? Number(input.categoryId) : getUncategorizedCategoryId(db)
  db.prepare(
    'INSERT INTO tags (name, category_id) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET name = excluded.name',
  ).run(name, typeof categoryId === 'number' && Number.isFinite(categoryId) ? categoryId : null)
}

function updateTagRecord(db: Database, input: TagUpdateInput) {
  const tagId = Number(input.id)
  if (!Number.isFinite(tagId)) {
    throw new Error('invalid tag id')
  }

  const current = db.prepare('SELECT id, name, category_id FROM tags WHERE id = ?').get(tagId) as
    | { id: number; name: string; category_id: number | null }
    | undefined
  if (!current) {
    throw new Error('tag not found')
  }

  const nextName = input.name?.trim() || current.name
  const nextCategoryId = input.categoryId === undefined ? current.category_id : input.categoryId ? Number(input.categoryId) : null
  db.prepare('UPDATE tags SET name = ?, category_id = ? WHERE id = ?').run(nextName, nextCategoryId, tagId)
}

function deleteTagRecord(db: Database, input: TagDeleteInput) {
  const tagId = Number(input.id)
  if (!Number.isFinite(tagId)) {
    throw new Error('invalid tag id')
  }
  db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)
}

function createCategoryRecord(db: Database, input: TagCategoryCreateInput) {
  const name = input.name.trim()
  if (!name) {
    throw new Error('category name is required')
  }

  const sortRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM tag_categories').get() as {
    sort_order: number
  }
  const color = input.color ?? categoryColors[sortRow.sort_order % categoryColors.length]
  db.prepare('INSERT OR IGNORE INTO tag_categories (name, parent_id, color, sort_order) VALUES (?, NULL, ?, ?)').run(
    name,
    color,
    sortRow.sort_order,
  )
}

function updateCategoryRecord(db: Database, input: TagCategoryUpdateInput) {
  const categoryId = Number(input.id)
  if (!Number.isFinite(categoryId)) {
    throw new Error('invalid category id')
  }

  const current = db.prepare('SELECT name, color FROM tag_categories WHERE id = ?').get(categoryId) as {
    name: string
    color: string
  } | undefined
  if (!current) {
    throw new Error('category not found')
  }

  const nextName = input.name?.trim() || current.name
  const nextColor = input.color || current.color
  db.prepare('UPDATE tag_categories SET name = ?, color = ? WHERE id = ?').run(nextName, nextColor, categoryId)
}

function deleteCategoryRecord(db: Database, input: TagCategoryDeleteInput) {
  const categoryId = Number(input.id)
  if (!Number.isFinite(categoryId)) {
    throw new Error('invalid category id')
  }
  const uncategorized = getUncategorizedCategoryId(db)
  if (uncategorized && categoryId === uncategorized) {
    throw new Error('cannot delete uncategorized category')
  }
  db.prepare('UPDATE tags SET category_id = ? WHERE category_id = ?').run(uncategorized, categoryId)
  db.prepare('DELETE FROM tag_categories WHERE id = ?').run(categoryId)
}

function rewriteEntryRelations(db: Database, entryId: number, tagNames: string[], images: string[], now: number) {
  const uncategorizedCategoryId = getUncategorizedCategoryId(db)
  const insertTag = db.prepare('INSERT INTO tags (name, category_id) VALUES (?, ?) ON CONFLICT(name) DO NOTHING')
  const getTag = db.prepare('SELECT id FROM tags WHERE name = ?')
  const insertEntryTag = db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)')
  const insertImage = db.prepare('INSERT INTO images (entry_id, file_path, created_at) VALUES (?, ?, ?)')

  db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(entryId)
  db.prepare('DELETE FROM images WHERE entry_id = ?').run(entryId)

  tagNames.forEach((tagName) => {
    insertTag.run(tagName, uncategorizedCategoryId)
    const tag = getTag.get(tagName) as { id: number } | undefined
    if (!tag) {
      throw new Error(`tag write failed: ${tagName}`)
    }
    insertEntryTag.run(entryId, tag.id)
  })

  images.forEach((image) => {
    const filePath = image.trim()
    if (filePath) {
      insertImage.run(entryId, filePath, now)
    }
  })
}

export function createSqliteKnowledgeRepository(db: Database): KnowledgeRepository {
  return {
    async listEntries(query: EntryListQuery = {}): Promise<EntryListResult> {
      const q = query.q?.trim()
      const sort = query.sort ?? 'created_desc'
      const tagIds = query.tagIds?.filter(Boolean) ?? []
      const sourceApps = query.sourceApps?.map(normalizeSourceAppName).filter(Boolean) ?? []
      const params: Record<string, string> = {}
      const where: string[] = []

      if (q) {
        params.q = `%${q}%`
        where.push(`
          (
            e.title LIKE @q
            OR e.content_md LIKE @q
            OR e.summary LIKE @q
            OR e.source_app LIKE @q
            OR e.source_title LIKE @q
            OR e.source_url LIKE @q
          )
        `)
      }

      if (tagIds.length > 0) {
        const placeholders = makeInClause('tagId', tagIds, params)
        where.push(`
          EXISTS (
            SELECT 1
            FROM entry_tags et
            WHERE et.entry_id = e.id AND CAST(et.tag_id AS TEXT) IN (${placeholders.join(', ')})
          )
        `)
      }

      if (sourceApps.length > 0) {
        const sourceAliases = Array.from(new Set(sourceApps.flatMap(sourceAppAliases)))
        const placeholders = makeInClause('sourceApp', sourceAliases, params)
        where.push(`e.source_app IN (${placeholders.join(', ')})`)
      }

      const rows = db
        .prepare(
          `
            SELECT e.id, e.title, e.title_is_auto, e.content_md, e.source_app, e.source_title, e.source_url, e.summary, e.metadata_status, e.metadata_updated_at, e.created_at, e.updated_at
            FROM entries e
            ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
            ORDER BY e.created_at ${sort === 'created_asc' ? 'ASC' : 'DESC'}
          `,
        )
        .all(params) as EntryRow[]

      const entryIds = rows.map((row) => row.id)
      const tagsByEntryId = loadTagsByEntryId(db, entryIds)
      const imagesByEntryId = loadImagesByEntryId(db, entryIds)
      const entries: Entry[] = rows.map((row) => ({
        id: String(row.id),
        title: row.title ?? '',
        titleIsAuto: Boolean(row.title_is_auto),
        contentMd: row.content_md,
        excerpt: row.summary?.trim() || excerptFrom(row.content_md),
        summary: row.summary ?? undefined,
        metadataStatus: row.metadata_status ?? 'local',
        metadataUpdatedAt: row.metadata_updated_at ?? null,
        images: imagesByEntryId.get(row.id) ?? [],
        source: {
          app: normalizeSourceAppName(row.source_app),
          title: row.source_title ?? undefined,
          url: row.source_url ?? undefined,
        },
        tags: tagsByEntryId.get(row.id) ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      return { entries, total: entries.length, facets: buildFacets(db) }
    },
    async getEntry(id: string): Promise<Entry | null> {
      const entryId = Number(id)
      return Number.isFinite(entryId) ? loadEntryById(db, entryId) : null
    },
    async createEntry(input: EntryCreateInput): Promise<Entry> {
      const contentMd = input.contentMd.trim()
      if (!contentMd) {
        throw new Error('content is required')
      }

      const source = {
        app: normalizeSourceAppName(input.source?.app),
        title: input.source?.title?.trim() || undefined,
        url: input.source?.url?.trim() || undefined,
      }
      const requestedTitle = input.title?.trim()
      const titleIsAuto = !requestedTitle
      const title = requestedTitle || generateEntryTitle(contentMd, source)
      const now = Date.now()
      const tagNames = uniqueTagNames(input.tagNames)
      const create = db.transaction(() => {
        const entryInfo = db
          .prepare(
            `
              INSERT INTO entries (title, title_is_auto, content_md, source_app, source_title, source_url, summary, metadata_status, metadata_updated_at, created_at, updated_at)
              VALUES (@title, @titleIsAuto, @contentMd, @sourceApp, @sourceTitle, @sourceUrl, @summary, @metadataStatus, @metadataUpdatedAt, @createdAt, @updatedAt)
            `,
          )
          .run({
            title,
            titleIsAuto: titleIsAuto ? 1 : 0,
            contentMd,
            sourceApp: source.app,
            sourceTitle: source.title ?? null,
            sourceUrl: source.url ?? null,
            summary: null,
            metadataStatus: 'pending',
            metadataUpdatedAt: now,
            createdAt: now,
            updatedAt: now,
          })

        const entryId = Number(entryInfo.lastInsertRowid)
        const uncategorizedCategoryId = getUncategorizedCategoryId(db)
        const insertTag = db.prepare('INSERT INTO tags (name, category_id) VALUES (?, ?) ON CONFLICT(name) DO NOTHING')
        const getTag = db.prepare('SELECT id FROM tags WHERE name = ?')
        const insertEntryTag = db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)')
        const insertImage = db.prepare('INSERT INTO images (entry_id, file_path, created_at) VALUES (?, ?, ?)')

        tagNames.forEach((tagName) => {
          insertTag.run(tagName, uncategorizedCategoryId)
          const tag = getTag.get(tagName) as { id: number } | undefined
          if (!tag) {
            throw new Error(`tag write failed: ${tagName}`)
          }
          insertEntryTag.run(entryId, tag.id)
        })

        ;(input.images ?? []).forEach((image) => {
          const filePath = image.trim()
          if (filePath) {
            insertImage.run(entryId, filePath, now)
          }
        })

        return entryId
      })

      const created = loadEntryById(db, create())
      if (!created) {
        throw new Error('entry write failed')
      }
      return created
    },
    async updateEntry(input: EntryUpdateInput): Promise<Entry> {
      const entryId = Number(input.id)
      if (!Number.isFinite(entryId)) {
        throw new Error('invalid entry id')
      }

      const existing = loadEntryById(db, entryId)
      if (!existing) {
        throw new Error('entry not found')
      }

      const contentMd = input.contentMd.trim()
      if (!contentMd) {
        throw new Error('content is required')
      }

      const source = {
        app: normalizeSourceAppName(input.source?.app),
        title: input.source?.title?.trim() || undefined,
        url: input.source?.url?.trim() || undefined,
      }
      const requestedTitle = input.title?.trim()
      let title: string
      let titleIsAuto: boolean
      if (!requestedTitle) {
        // 标题被清空 -> 视为交还给自动生成，之后 AI 仍可替换
        title = generateEntryTitle(contentMd, source)
        titleIsAuto = true
      } else if (requestedTitle === existing.title) {
        // 标题文本未变 -> 保持原有的手动/自动标记，不因重新提交表单而改变归属
        title = existing.title
        titleIsAuto = Boolean(existing.titleIsAuto)
      } else {
        // 用户主动改了标题文本 -> 标记为手动，之后 AI 不再覆盖
        title = requestedTitle
        titleIsAuto = false
      }
      const now = Date.now()
      const tagNames = uniqueTagNames(input.tagNames)
      const images = input.images ?? []

      // 内容变化且 AI 摘要尚未就绪时才触发重新生成；已就绪的不重复触发
      const contentChanged = contentMd !== existing.contentMd
      const shouldRegenerateMetadata = contentChanged && existing.metadataStatus !== 'ready'

      db.transaction(() => {
        const result = db
          .prepare(
            `
              UPDATE entries
              SET title = @title,
                  title_is_auto = @titleIsAuto,
                  content_md = @contentMd,
                  source_app = @sourceApp,
                  source_title = @sourceTitle,
                  source_url = @sourceUrl,
                  summary = @summary,
                  metadata_status = @metadataStatus,
                  metadata_updated_at = @metadataUpdatedAt,
                  updated_at = @updatedAt
              WHERE id = @entryId
            `,
          )
          .run({
            entryId,
            title,
            titleIsAuto: titleIsAuto ? 1 : 0,
            contentMd,
            sourceApp: source.app,
            sourceTitle: source.title ?? null,
            sourceUrl: source.url ?? null,
            summary: shouldRegenerateMetadata ? null : existing.summary,
            metadataStatus: shouldRegenerateMetadata ? 'pending' : existing.metadataStatus,
            metadataUpdatedAt: shouldRegenerateMetadata ? now : existing.metadataUpdatedAt,
            updatedAt: now,
          })

        if (result.changes === 0) {
          throw new Error('entry not found')
        }

        rewriteEntryRelations(db, entryId, tagNames, images, now)
      })()

      const updated = loadEntryById(db, entryId)
      if (!updated) {
        throw new Error('entry update failed')
      }
      return updated
    },
    async deleteEntry(input: EntryDeleteInput): Promise<void> {
      const entryId = Number(input.id)
      if (!Number.isFinite(entryId)) {
        throw new Error('invalid entry id')
      }

      const result = db.transaction(() => db.prepare('DELETE FROM entries WHERE id = ?').run(entryId))()
      if (result.changes === 0) {
        throw new Error('entry not found')
      }
    },

    async regenerateMetadata(id: string): Promise<Entry> {
      return this.updateEntryMetadata({ id, status: 'pending', updatedAt: Date.now() })
    },
    async updateEntryMetadata(input: EntryMetadataUpdateInput): Promise<Entry> {
      const entryId = Number(input.id)
      if (!Number.isFinite(entryId)) {
        throw new Error('invalid entry id')
      }

      const now = input.updatedAt ?? Date.now()
      const existing = loadEntryById(db, entryId)
      if (!existing) {
        throw new Error('entry not found')
      }

      db.transaction(() => {
        if (input.applySuggestedTags && input.suggestedTags?.length) {
          const nextTags = uniqueTagNames([...existing.tags.map((tag) => tag.name), ...input.suggestedTags])
          rewriteEntryRelations(db, entryId, nextTags, existing.images, now)
        }

        // 仓库层兜底：只有仍处于"自动生成"状态的标题才允许被 AI 结果替换，
        // 无论调用方（main.ts 等）是否正确做过判断，手动标题在这里也不会被覆盖。
        const title = existing.titleIsAuto && input.title?.trim() ? input.title.trim() : existing.title
        db.prepare(
          `
            UPDATE entries
            SET title = ?,
                summary = ?,
                metadata_status = ?,
                metadata_updated_at = ?,
                updated_at = ?
            WHERE id = ?
          `,
        ).run(title, input.summary?.trim() || null, input.status, now, now, entryId)
      })()

      const updated = loadEntryById(db, entryId)
      if (!updated) {
        throw new Error('entry metadata update failed')
      }
      return updated
    },
    async listTags(): Promise<TagListResult> {
      return buildTagList(db, true)
    },
    async createTag(input: TagCreateInput): Promise<TagListResult> {
      db.transaction(() => createTagRecord(db, input))()
      return buildTagList(db, true)
    },
    async updateTag(input: TagUpdateInput): Promise<TagListResult> {
      db.transaction(() => updateTagRecord(db, input))()
      return buildTagList(db, true)
    },
    async deleteTag(input: TagDeleteInput): Promise<TagListResult> {
      db.transaction(() => deleteTagRecord(db, input))()
      return buildTagList(db, true)
    },
    async createTagCategory(input: TagCategoryCreateInput): Promise<TagListResult> {
      db.transaction(() => createCategoryRecord(db, input))()
      return buildTagList(db, true)
    },
    async updateTagCategory(input: TagCategoryUpdateInput): Promise<TagListResult> {
      db.transaction(() => updateCategoryRecord(db, input))()
      return buildTagList(db, true)
    },
    async deleteTagCategory(input: TagCategoryDeleteInput): Promise<TagListResult> {
      db.transaction(() => deleteCategoryRecord(db, input))()
      return buildTagList(db, true)
    },
  }
}

