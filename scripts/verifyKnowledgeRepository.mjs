import { strict as assert } from 'node:assert'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = resolve(root, '.tmp/verifyKnowledgeRepository.mjs')

await mkdir(dirname(outFile), { recursive: true })

try {
  await build({
    entryPoints: [resolve(root, 'src/repositories/mockKnowledgeRepository.ts')],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  })

  const { mockKnowledgeRepository } = await import(`${pathToFileURL(outFile).href}?t=${Date.now()}`)

  const searchResult = await mockKnowledgeRepository.listEntries({ q: 'Milkdown' })
  assert.equal(searchResult.total, 1, 'search should find the Milkdown entry')
  assert.equal(searchResult.entries[0].id, '5', 'search should return the expected entry')

  const newest = await mockKnowledgeRepository.listEntries({ sort: 'created_desc' })
  const oldest = await mockKnowledgeRepository.listEntries({ sort: 'created_asc' })
  assert.equal(newest.entries[0].id, '1', 'created_desc should return newest entry first')
  assert.equal(oldest.entries[0].id, '5', 'created_asc should return oldest entry first')

  const tagResult = await mockKnowledgeRepository.listEntries({ tagIds: ['design'] })
  assert.deepEqual(
    tagResult.entries.map((entry) => entry.id),
    ['2', '3'],
    'tag filter should return design-tagged entries',
  )

  const sourceResult = await mockKnowledgeRepository.listEntries({ sourceApps: ['Chrome'] })
  assert.equal(sourceResult.total, 5, 'source filter should include Chrome entries')

  const combinedResult = await mockKnowledgeRepository.listEntries({
    q: '剪贴板',
    tagIds: ['engineering'],
    sourceApps: ['Chrome'],
  })
  assert.equal(combinedResult.total, 1, 'combined filters should narrow to one entry')
  assert.equal(combinedResult.entries[0].id, '2', 'combined filters should return clipboard entry')

  console.log('knowledge repository verification passed')
} finally {
  await rm(resolve(root, '.tmp'), { recursive: true, force: true })
}
