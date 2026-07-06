import { strict as assert } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entryFile = resolve(root, '.tmp/verifyAiMetadataEntry.mjs')
const outFile = resolve(root, '.tmp/verifyAiMetadata.cjs')
const tempDir = await mkdtemp(join(tmpdir(), 'pkb-ai-'))

await mkdir(resolve(root, '.tmp'), { recursive: true })
await writeFile(entryFile, `
export * from '../electron/database/index.ts'
export * from '../electron/metadata/aiSettings.ts'
export * from '../electron/metadata/aiMetadataService.ts'
export * from '../electron/metadata/metadataQueue.ts'
`, 'utf8')

await build({
  entryPoints: [entryFile],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`safe:${value}`, 'utf8'),
  decryptString: (value) => value.toString('utf8').replace(/^safe:/, ''),
}

let db = null

try {
  const module = await import(`${pathToFileURL(outFile).href}?t=${Date.now()}`)
  const {
    MetadataQueue,
    openKnowledgeDatabase,
    createSqliteKnowledgeRepository,
    readAiRuntimeSettings,
    readAiSettings,
    writeAiSettings,
    generateAiMetadata,
    normalizeAiMetadata,
    normalizeSuggestedTags,
  } = module
  const dbPath = join(tempDir, 'knowledge.sqlite')
  db = openKnowledgeDatabase(dbPath)
  openKnowledgeDatabase(dbPath).close()

  assert.ok(db.prepare('SELECT version FROM schema_migrations WHERE version = 2').get(), 'migration version 2 should be recorded')
  const columns = db.prepare('PRAGMA table_info(entries)').all().map((column) => column.name)
  assert.ok(columns.includes('summary'), 'entries.summary should exist')
  assert.ok(columns.includes('metadata_status'), 'entries.metadata_status should exist')
  assert.ok(columns.includes('metadata_updated_at'), 'entries.metadata_updated_at should exist')

  const defaults = readAiSettings(db)
  assert.equal(defaults.enabled, false, 'AI should default to disabled')
  assert.equal(defaults.sendSourceUrl, false, 'source URL sending should default to disabled')
  assert.equal(defaults.apiKeyConfigured, false, 'API key should default to unconfigured')

  const fallbackSaved = writeAiSettings(db, {
    enabled: true,
    baseUrl: 'https://example.test/v1 ',
    model: 'metadata-model ',
    apiKey: 'local-secret',
    sendSourceUrl: true,
  })
  assert.equal(fallbackSaved.apiKeyConfigured, true, 'fallback API key should be configured')
  assert.equal(readAiSettings(db).apiKeyConfigured, true, 'public settings should only expose key status')
  assert.equal(readAiRuntimeSettings(db).apiKey, 'local-secret', 'runtime settings should recover fallback key locally')
  const publicSettingsRow = db.prepare("SELECT value FROM app_settings WHERE key = 'ai.metadata.settings'").get()
  assert.equal(JSON.parse(publicSettingsRow.value).apiKey, undefined, 'public settings must not store plaintext API key')

  writeAiSettings(db, { ...fallbackSaved, clearApiKey: true })
  assert.equal(readAiRuntimeSettings(db).apiKey, '', 'clear API key should remove stored key')
  writeAiSettings(db, { ...fallbackSaved, apiKey: 'safe-secret' }, fakeSafeStorage)
  assert.equal(readAiRuntimeSettings(db, fakeSafeStorage).apiKey, 'safe-secret', 'safe storage key should decrypt locally')

  db.prepare("UPDATE app_settings SET value = ? WHERE key = 'ai.metadata.settings'").run(JSON.stringify({ ...fallbackSaved, apiKey: 'legacy-plain' }))
  assert.equal(readAiRuntimeSettings(db, fakeSafeStorage).apiKey, 'safe-secret', 'existing secure key should win over legacy plaintext')
  writeAiSettings(db, { ...fallbackSaved, clearApiKey: true }, fakeSafeStorage)
  assert.equal(readAiRuntimeSettings(db, fakeSafeStorage).apiKey, '', 'safe key clear should work')
  db.prepare("UPDATE app_settings SET value = ? WHERE key = 'ai.metadata.settings'").run(JSON.stringify({ ...fallbackSaved, apiKey: 'legacy-plain' }))
  assert.equal(readAiSettings(db, fakeSafeStorage).apiKeyConfigured, true, 'legacy plaintext should migrate into secure key on read')
  assert.equal(JSON.parse(db.prepare("SELECT value FROM app_settings WHERE key = 'ai.metadata.settings'").get().value).apiKey, undefined, 'legacy plaintext key should be removed from public settings')

  const savedRuntime = readAiRuntimeSettings(db, fakeSafeStorage)
  let fetchCalls = 0
  const disabledResult = await generateAiMetadata({ ...savedRuntime, enabled: false }, { contentMd: '正文', tagNames: [] }, async () => {
    fetchCalls += 1
    throw new Error('should not request when disabled')
  })
  assert.equal(disabledResult, null, 'disabled AI should return null metadata')
  assert.equal(fetchCalls, 0, 'disabled AI should not call fetch')

  const longSummary = '这是一个用于验证摘要质量的长句子，包含关键结论、后续动作、对象和范围，确保模型返回内容会被控制在合理长度内，同时不会因为来源标题或应用名称污染标题。'
  const success = await generateAiMetadata(savedRuntime, { contentMd: '正文第一句用于回退标题。', source: { app: 'Chrome', title: '页面标题', url: 'https://private.test' }, tagNames: ['旧标签'] }, async (_url, init) => {
    fetchCalls += 1
    const body = JSON.parse(init.body)
    assert.equal(body.messages[1].content.includes('https://private.test'), true, 'source URL should be sent only when enabled')
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 'Chrome Chrome 页面标题 页面标题 超长标题需要被截断', summary: longSummary, suggestedTags: ['#AI', 'AI', '旧标签', ' 长标签名称应该会被截断处理 '] }) } }] }), { status: 200 })
  })
  assert.ok(success.title.length <= 24, 'AI title should be capped at 24 characters')
  assert.equal(success.title.includes('Chrome'), false, 'AI title should remove source app noise')
  assert.ok(success.summary.length <= 120, 'AI summary should be capped at 120 characters')
  assert.deepEqual(success.suggestedTags, ['AI', '长标签名称应该会被截断处理'.slice(0, 16)], 'suggested tags should be normalized and deduped')

  await assert.rejects(
    () => generateAiMetadata(savedRuntime, { contentMd: '正文' }, async () => new Response('{}', { status: 500 })),
    /AI request failed/,
    'mock AI failure should throw for caller fallback',
  )

  const fallbackMetadata = normalizeAiMetadata({ title: 'Chrome', summary: '太短', suggestedTags: ['A', 'A'] }, { contentMd: '这是正文首句，应该作为标题回退。第二句继续补充摘要内容。', source: { app: 'Chrome' }, tagNames: [] })
  assert.notEqual(fallbackMetadata.title, 'Chrome', 'bad AI title should fall back to local title')
  assert.ok(fallbackMetadata.summary.length > 0, 'bad AI summary should fall back locally')
  assert.deepEqual(normalizeSuggestedTags(['测试', '测试', '#产品'], ['测试']), ['产品'], 'tag normalization should dedupe existing tags')

  const repository = createSqliteKnowledgeRepository(db)
  const entry = await repository.createEntry({ contentMd: '# 本地条目\n\n正文内容。', tagNames: ['原标签'] })
  const updated = await repository.updateEntryMetadata({ id: entry.id, title: 'AI 条目', summary: 'AI 生成摘要', suggestedTags: ['新标签'], status: 'ready' })
  assert.equal(updated.title, 'AI 条目', 'metadata update should update title')
  assert.equal(updated.summary, 'AI 生成摘要', 'metadata update should store summary')
  assert.equal(updated.excerpt, 'AI 生成摘要', 'list excerpt should prefer summary')
  assert.equal(updated.metadataStatus, 'ready', 'metadata status should be stored')
  assert.equal(updated.tags.some((tag) => tag.name === '新标签'), false, 'suggested tags should not auto-create before confirmation')
  const applied = await repository.updateEntryMetadata({ id: entry.id, suggestedTags: ['新标签'], applySuggestedTags: true, status: 'ready' })
  assert.ok(applied.tags.some((tag) => tag.name === '新标签'), 'confirmed suggested tags should be attached')

  let active = 0
  let maxActive = 0
  const order = []
  const queue = new MetadataQueue(async (id) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    order.push(id)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
    return id
  })
  assert.deepEqual(queue.enqueueMany(['1', '2', '1']), { queued: 2 }, 'bulk queue should dedupe ids')
  const waited = queue.enqueue('3', true)
  assert.equal(await waited, '3', 'single queue should support waiting for result')
  assert.equal(maxActive, 1, 'metadata queue should run serially')
  assert.deepEqual(order, ['1', '2', '3'], 'metadata queue should preserve enqueue order')

  db.close()
  db = null
  console.log('AI metadata verification passed')
} finally {
  db?.close?.()
  await rm(tempDir, { recursive: true, force: true })
  await rm(resolve(root, '.tmp'), { recursive: true, force: true })
}
