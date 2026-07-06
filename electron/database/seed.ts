import type { Database } from 'better-sqlite3'
import { mockEntries, mockTagCategories, mockTags } from '../../src/data/mockEntries'

const SEED_MARKER_KEY = 'seed.initial.v1'

function hasSeedMarker(db: Database) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(SEED_MARKER_KEY) as
    | { value: string }
    | undefined
  return Boolean(row)
}

function writeSeedMarker(db: Database) {
  db.prepare(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `,
  ).run(SEED_MARKER_KEY, '1', Date.now())
}

export function seedInitialData(db: Database) {
  if (hasSeedMarker(db)) {
    return
  }

  const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM tag_categories').get() as { count: number }
  if (categoryCount.count > 0) {
    writeSeedMarker(db)
    return
  }

  const entryCount = db.prepare('SELECT COUNT(*) AS count FROM entries').get() as { count: number }
  if (entryCount.count > 0) {
    writeSeedMarker(db)
    return
  }

  const insertCategory = db.prepare(`
    INSERT INTO tag_categories (id, name, parent_id, color, sort_order)
    VALUES (@id, @name, @parentId, @color, @sortOrder)
  `)
  const insertTag = db.prepare(`
    INSERT INTO tags (id, name, category_id)
    VALUES (@id, @name, @categoryId)
  `)
  const insertEntry = db.prepare(`
    INSERT INTO entries (
      id,
      title,
      content_md,
      source_app,
      source_title,
      source_url,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @title,
      @contentMd,
      @sourceApp,
      @sourceTitle,
      @sourceUrl,
      @createdAt,
      @updatedAt
    )
  `)
  const insertEntryTag = db.prepare(`
    INSERT INTO entry_tags (entry_id, tag_id)
    VALUES (@entryId, @tagId)
  `)
  const insertImage = db.prepare(`
    INSERT INTO images (entry_id, file_path, created_at)
    VALUES (@entryId, @filePath, @createdAt)
  `)

  const categoryIds = new Map(mockTagCategories.map((category, index) => [category.id, index + 1]))
  const tagIds = new Map(mockTags.map((tag, index) => [tag.id, index + 1]))

  const seed = db.transaction(() => {
    mockTagCategories.forEach((category) => {
      insertCategory.run({
        id: categoryIds.get(category.id),
        name: category.name,
        parentId: category.parentId ? categoryIds.get(category.parentId) : null,
        color: category.color,
        sortOrder: category.sortOrder,
      })
    })

    mockTags.forEach((tag) => {
      insertTag.run({
        id: tagIds.get(tag.id),
        name: tag.name,
        categoryId: tag.categoryId ? categoryIds.get(tag.categoryId) : null,
      })
    })

    mockEntries.forEach((entry) => {
      const entryId = Number(entry.id)
      insertEntry.run({
        id: entryId,
        title: entry.title,
        contentMd: entry.contentMd,
        sourceApp: entry.source.app,
        sourceTitle: entry.source.title ?? null,
        sourceUrl: entry.source.url ?? null,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })

      entry.tags.forEach((tag) => {
        insertEntryTag.run({
          entryId,
          tagId: tagIds.get(tag.id),
        })
      })

      entry.images.forEach((image) => {
        insertImage.run({
          entryId,
          filePath: image,
          createdAt: entry.createdAt,
        })
      })
    })
  })

  seed()
  writeSeedMarker(db)
}
