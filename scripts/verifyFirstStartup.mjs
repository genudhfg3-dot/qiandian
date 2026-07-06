import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = resolve(root, '.tmp/verifyFirstStartupDatabase.cjs')
const tempUserData = await mkdtemp(join(tmpdir(), 'pkb-first-start-'))
const require = createRequire(import.meta.url)

function assertFile(path, message = `${path} should exist`) {
  assert.equal(existsSync(resolve(root, path)), true, message)
}

function assertContains(text, needle, message = `expected ${needle}`) {
  assert.equal(text.includes(needle), true, message)
}

assertFile('dist/index.html', 'renderer dist should exist')
assertFile('dist-electron/main.cjs', 'main bundle should exist')
assertFile('dist-electron/preload.cjs', 'preload bundle should exist')

const mainBundle = readFileSync(resolve(root, 'dist-electron/main.cjs'), 'utf8')
const preloadBundle = readFileSync(resolve(root, 'dist-electron/preload.cjs'), 'utf8')
assertContains(mainBundle, 'knowledge.sqlite', 'main bundle should initialize SQLite under userData')
assertContains(mainBundle, 'app-image', 'main bundle should register app-image protocol')
assertContains(mainBundle, 'preload.cjs', 'main bundle should point BrowserWindow at preload.cjs')
assertContains(mainBundle, '../dist/index.html', 'main bundle should load packaged renderer dist')
assertContains(preloadBundle, 'knowledge:listEntries', 'preload should expose listEntries only through IPC')
assertContains(preloadBundle, 'entries:create', 'preload should expose createEntry only through IPC')
assert.equal(preloadBundle.includes('getOpenWindows'), false, 'preload should not expose active-win enumeration')
assert.equal(preloadBundle.includes('fs/promises'), false, 'preload should not expose filesystem APIs')

const BetterSqlite3 = require('better-sqlite3')
assert.equal(typeof BetterSqlite3, 'function', 'better-sqlite3 should load in Electron node runtime')
const activeWin = require('active-win')
assert.equal(typeof activeWin, 'function', 'active-win should load and export active window reader')

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

  const databasePath = join(tempUserData, 'knowledge.sqlite')
  const db = openKnowledgeDatabase(databasePath)
  const repository = createSqliteKnowledgeRepository(db)

  assert.equal((await stat(databasePath)).isFile(), true, 'first startup should create SQLite DB in userData')
  const migration = db
    .prepare('SELECT version FROM schema_migrations WHERE version = 1')
    .get()
  assert.ok(migration, 'first startup should apply migration version 1')

  const seedResult = await repository.listEntries()
  assert.equal(seedResult.total, 5, 'first startup should seed default entries')
  assert.ok(seedResult.entries.some((entry) => entry.title.includes('SQLite')), 'seed data should be queryable')

  db.pragma('wal_checkpoint(TRUNCATE)')
  db.pragma('journal_mode = DELETE')
  db.close()
} finally {
  await rm(tempUserData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  await rm(resolve(root, '.tmp'), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

console.log('first startup verification passed')
