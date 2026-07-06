import { strict as assert } from 'node:assert'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = resolve(root, '.tmp/verifySqliteRepository.cjs')
const tempDir = await mkdtemp(join(tmpdir(), 'pkb-sqlite-'))

async function removeBestEffort(path) {
  try {
    await rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch (error) {
    if (error?.code === 'EBUSY') {
      console.warn(`cleanup skipped, file still busy: ${path}`)
      return
    }
    throw error
  }
}

await build({
  entryPoints: [resolve(root, 'electron/database/index.ts')],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

try {
  const { openKnowledgeDatabase, createSqliteKnowledgeRepository } = await import(
    `${pathToFileURL(outFile).href}?t=${Date.now()}`
  )

  const db = openKnowledgeDatabase(join(tempDir, 'knowledge.sqlite'))
  const repository = createSqliteKnowledgeRepository(db)

  const allEntries = await repository.listEntries()
  assert.equal(allEntries.total, 5, 'seed should insert five entries')

  const migration = db
    .prepare('SELECT version FROM schema_migrations WHERE version = 1')
    .get()
  assert.ok(migration, 'migration version 1 should be recorded')

  const ftsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'entries_fts'")
    .get()
  assert.ok(ftsTable, 'entries_fts should exist')

  const searchResult = await repository.listEntries({ q: 'Milkdown' })
  assert.equal(searchResult.total, 1, 'search should find the Milkdown entry')
  assert.match(searchResult.entries[0].title, /Milkdown/)

  const newest = await repository.listEntries({ sort: 'created_desc' })
  const oldest = await repository.listEntries({ sort: 'created_asc' })
  assert.ok(newest.entries[0].createdAt >= newest.entries.at(-1).createdAt, 'newest sort should be descending')
  assert.ok(oldest.entries[0].createdAt <= oldest.entries.at(-1).createdAt, 'oldest sort should be ascending')

  const firstTag = allEntries.entries.find((entry) => entry.tags.length > 0)?.tags[0]
  assert.ok(firstTag, 'seed should expose at least one tag')
  const tagResult = await repository.listEntries({ tagIds: [firstTag.id] })
  assert.ok(tagResult.total >= 1, 'tag filter should return tagged entries')
  assert.ok(
    tagResult.entries.every((entry) => entry.tags.some((tag) => tag.id === firstTag.id)),
    'tag filter should only return entries with selected tag',
  )

  db.prepare(
    `
      INSERT INTO entries (title, content_md, source_app, source_title, source_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    'Legacy Chrome source smoke',
    'Legacy source row created before source normalization.',
    'Google Chrome',
    'Legacy browser title',
    null,
    Date.now(),
    Date.now(),
  )

  const sourceResult = await repository.listEntries({ sourceApps: ['Chrome'] })
  assert.equal(sourceResult.total, 6, 'source filter should include Chrome aliases and normalized Chrome entries')
  assert.ok(
    sourceResult.entries.some((entry) => entry.title === 'Legacy Chrome source smoke'),
    'Chrome source filter should include Google Chrome aliases',
  )
  const chromeFacet = sourceResult.facets.sources.find((source) => source.app === 'Chrome')
  assert.equal(chromeFacet?.count, 6, 'source facets should merge Chrome aliases')

  const milkdownTag = searchResult.entries[0].tags[0]
  assert.ok(milkdownTag, 'Milkdown entry should have a tag')
  const combinedResult = await repository.listEntries({
    q: 'Milkdown',
    tagIds: [milkdownTag.id],
    sourceApps: ['Chrome'],
  })
  assert.equal(combinedResult.total, 1, 'combined filters should narrow to one entry')
  assert.match(combinedResult.entries[0].title, /Milkdown/)

  const tagList = await repository.listTags()
  assert.ok(tagList.total >= 6, 'tag management list should include seed tags')

  const createdStandaloneTagList = await repository.createTag({ name: 'standalone-management-tag' })
  const standaloneTag = createdStandaloneTagList.categories
    .flatMap((category) => category.tags)
    .find((tag) => tag.name === 'standalone-management-tag')
  assert.ok(standaloneTag, 'tag management should show newly created standalone tags')
  assert.equal(standaloneTag.count, 0, 'standalone tag should start with zero usage count')

  const autoTitledEntry = await repository.createEntry({
    contentMd: '# 自动标题烟测\n\n正文内容来自剪贴板。',
    source: { app: 'Google Chrome', title: 'Source title should not win' },
    tagNames: ['auto-title-tag'],
  })
  assert.equal(autoTitledEntry.title, '自动标题烟测', 'createEntry should derive title from Markdown heading')
  assert.equal(autoTitledEntry.source.app, 'Chrome', 'createEntry should normalize source app')
  const loadedAutoEntry = await repository.getEntry(autoTitledEntry.id)
  assert.equal(loadedAutoEntry?.contentMd, autoTitledEntry.contentMd, 'getEntry should load full Markdown body')

  const createdEntry = await repository.createEntry({
    title: 'Created capture smoke',
    contentMd: 'This Markdown body was inserted through createEntry.\n\n![clipboard-image-1](images/created-smoke.png)',
    source: { app: 'Chrome', title: 'Create IPC Smoke', url: 'https://example.com/capture' },
    tagNames: ['created-smoke-tag'],
    images: ['images/created-smoke.png'],
  })
  assert.equal(createdEntry.title, 'Created capture smoke', 'createEntry should return created entry')
  assert.equal(createdEntry.tags[0].name, 'created-smoke-tag', 'createEntry should attach new tag')
  assert.deepEqual(createdEntry.images, ['images/created-smoke.png'], 'createEntry should attach image paths')

  const createdSourceRow = db
    .prepare('SELECT source_app, source_title, source_url FROM entries WHERE id = ?')
    .get(Number(createdEntry.id))
  assert.deepEqual(
    createdSourceRow,
    {
      source_app: 'Chrome',
      source_title: 'Create IPC Smoke',
      source_url: 'https://example.com/capture',
    },
    'source fields should be stored',
  )

  const createdImageRow = db
    .prepare('SELECT file_path FROM images WHERE entry_id = ?')
    .get(Number(createdEntry.id))
  assert.deepEqual(createdImageRow, { file_path: 'images/created-smoke.png' }, 'image row should be stored')

  const createdSearch = await repository.listEntries({ q: 'createEntry' })
  assert.equal(createdSearch.total, 1, 'created entry should be searchable')
  assert.equal(createdSearch.entries[0].title, 'Created capture smoke')
  assert.deepEqual(createdSearch.entries[0].source, {
    app: 'Chrome',
    title: 'Create IPC Smoke',
    url: 'https://example.com/capture',
  }, 'listEntries should return stored source fields')
  assert.deepEqual(createdSearch.entries[0].images, ['images/created-smoke.png'], 'listEntries should return image paths')

  const newTag = createdSearch.facets.categories
    .flatMap((category) => category.tags)
    .find((tag) => tag.name === 'created-smoke-tag')
  assert.ok(newTag, 'new tag should be present in facets')
  const newTagResult = await repository.listEntries({ tagIds: [newTag.id] })
  assert.equal(newTagResult.total, 1, 'new tag filter should find created entry')
  assert.equal(newTagResult.entries[0].title, 'Created capture smoke')

  const updatedEntry = await repository.updateEntry({
    id: createdEntry.id,
    title: 'Updated detail smoke',
    contentMd: 'Updated body from detail editor.',
    source: { app: 'Google Chrome', title: 'Updated Detail Title', url: 'https://example.com/updated' },
    tagNames: ['updated-detail-tag'],
    images: ['images/updated-smoke.png'],
  })
  assert.equal(updatedEntry.title, 'Updated detail smoke', 'updateEntry should return updated entry')
  assert.equal(updatedEntry.source.app, 'Chrome', 'updateEntry should normalize source app')
  assert.deepEqual(updatedEntry.images, ['images/updated-smoke.png'], 'updateEntry should rewrite image rows')
  assert.equal(updatedEntry.tags[0].name, 'updated-detail-tag', 'updateEntry should rewrite tags')

  const updatedSearch = await repository.listEntries({ q: 'Updated body' })
  assert.equal(updatedSearch.total, 1, 'updated entry should be searchable by new content')
  assert.equal(updatedSearch.entries[0].id, createdEntry.id, 'updated search should find the same entry')

  await repository.deleteEntry({ id: createdEntry.id })
  const deletedEntry = await repository.getEntry(createdEntry.id)
  assert.equal(deletedEntry, null, 'deleteEntry should remove entry')
  const deletedImageRows = db.prepare('SELECT COUNT(*) AS count FROM images WHERE entry_id = ?').get(Number(createdEntry.id))
  assert.equal(deletedImageRows.count, 0, 'deleteEntry should remove related image rows')


  const categoryList = await repository.createTagCategory({ name: '管理分类', color: 'tools' })
  const createdCategory = categoryList.categories.find((category) => category.name === '管理分类')
  assert.ok(createdCategory, 'createTagCategory should create a category')

  const movedTagList = await repository.updateTag({ id: newTag.id, categoryId: createdCategory.id })
  const movedTag = movedTagList.categories
    .find((category) => category.id === createdCategory.id)
    ?.tags.find((tag) => tag.id === newTag.id)
  assert.ok(movedTag, 'updateTag should move tag into selected category')

  const deletedTagList = await repository.deleteTag({ id: newTag.id })
  assert.equal(
    deletedTagList.categories.flatMap((category) => category.tags).some((tag) => tag.id === newTag.id),
    false,
    'deleteTag should remove tag from management list',
  )

  const deletedCategoryList = await repository.deleteTagCategory({ id: createdCategory.id })
  assert.equal(
    deletedCategoryList.categories.some((category) => category.id === createdCategory.id),
    false,
    'deleteTagCategory should remove category',
  )

  db.pragma('wal_checkpoint(TRUNCATE)')
  db.pragma('journal_mode = DELETE')
  db.close()
  console.log('sqlite repository verification passed')
} finally {
  await removeBestEffort(tempDir)
  await removeBestEffort(resolve(root, '.tmp'))
}



