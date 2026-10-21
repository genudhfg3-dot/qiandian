import { strict as assert } from 'node:assert'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = resolve(root, '.tmp/verifyTitleProtection.cjs')
const tempDir = await mkdtemp(join(tmpdir(), 'pkb-title-'))

await build({
  entryPoints: [resolve(root, 'electron/database/index.ts')],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

let db = null

try {
  const { openKnowledgeDatabase, createSqliteKnowledgeRepository } = await import(
    `${pathToFileURL(outFile).href}?t=${Date.now()}`
  )

  db = openKnowledgeDatabase(join(tempDir, 'knowledge.sqlite'))
  const repository = createSqliteKnowledgeRepository(db)

  // 场景 1（复现原始 bug）：用户手打的标题恰好等于内容自动推导出的标题
  const coincidental = await repository.createEntry({
    title: '开发注意事项',
    contentMd: '# 开发注意事项\n\n这里是正文内容，第一行标题和用户手打标题完全一样。',
  })
  assert.equal(coincidental.title, '开发注意事项', 'manual title matching auto title should be stored as-is')
  assert.equal(coincidental.titleIsAuto, false, 'title provided by user must be marked as manual even if it coincides with the auto title')

  const aiTriedToOverwriteCoincidental = await repository.updateEntryMetadata({
    id: coincidental.id,
    title: 'AI 换的标题',
    summary: 'AI 摘要',
    status: 'ready',
  })
  assert.equal(aiTriedToOverwriteCoincidental.title, '开发注意事项', 'AI must not overwrite a manual title even if generateMetadataForEntry mistakenly passes one')

  // main.ts 里真正的判定逻辑：只有 titleIsAuto 为 true 才把 metadata.title 传给 updateEntryMetadata
  const shouldApplyAiTitle = coincidental.titleIsAuto ? 'AI 换的标题' : undefined
  assert.equal(shouldApplyAiTitle, undefined, 'generateMetadataForEntry must compute undefined title for a manual entry')

  // 场景 2：用户完全没写标题 -> 自动生成，且允许 AI 之后替换
  const blank = await repository.createEntry({
    contentMd: '# 自动标题来源\n\n用户没有手打标题，应该走自动生成路径。',
  })
  assert.equal(blank.title, '自动标题来源', 'blank title should fall back to generateEntryTitle result')
  assert.equal(blank.titleIsAuto, true, 'blank title entries must be marked as auto so AI can still replace them')

  const aiReplacedBlankTitle = await repository.updateEntryMetadata({
    id: blank.id,
    title: 'AI 生成的标题',
    summary: 'AI 摘要',
    status: 'ready',
  })
  assert.equal(aiReplacedBlankTitle.title, 'AI 生成的标题', 'AI should be allowed to set the title for an auto entry')

  // 场景 3：用户在编辑时把标题清空 -> 重新交还给自动生成
  const manual = await repository.createEntry({
    title: '手动标题不应被覆盖',
    contentMd: '正文内容占位。',
  })
  assert.equal(manual.titleIsAuto, false)

  const clearedBack = await repository.updateEntry({
    id: manual.id,
    title: '',
    contentMd: '正文内容占位。',
  })
  assert.equal(clearedBack.titleIsAuto, true, 'clearing the title field should hand control back to auto-generation')

  // 场景 4：编辑时标题文本不变（表单重新提交同一个值）-> 保留原有归属，不应该翻转成手动
  const untouchedEdit = await repository.updateEntry({
    id: blank.id,
    title: aiReplacedBlankTitle.title,
    contentMd: '# 自动标题来源\n\n用户没有手打标题，应该走自动生成路径。补充一句内容触发更新。',
  })
  assert.equal(untouchedEdit.titleIsAuto, true, 'resubmitting the same title text must not flip an auto title to manual')

  // 场景 5：编辑时用户主动改了标题文本 -> 标记为手动
  const manualEdit = await repository.updateEntry({
    id: blank.id,
    title: '用户重新写的标题',
    contentMd: untouchedEdit.contentMd,
  })
  assert.equal(manualEdit.titleIsAuto, false, 'typing a different title during edit must mark it manual')

  console.log('title protection verification passed')
} finally {
  db?.close?.()
  await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
}
