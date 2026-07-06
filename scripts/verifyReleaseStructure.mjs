import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const releaseDir = resolve(root, 'release')

function assertExists(path, message = `${path} should exist`) {
  assert.equal(existsSync(resolve(root, path)), true, message)
}

assertExists('electron-builder.yml')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const config = readFileSync(resolve(root, 'electron-builder.yml'), 'utf8')
assert.equal(packageJson.main, 'dist-electron/main.cjs')
assert.equal(config.includes('publish: null'), true, 'release config must not publish')
assert.equal(config.includes('better-sqlite3/**/*'), true, 'release config should include better-sqlite3')
assert.equal(config.includes('active-win/**/*'), true, 'release config should include active-win')
assert.equal(config.includes('asarUnpack:'), true, 'native deps should be unpacked')

if (!existsSync(releaseDir)) {
  console.log('release directory not found; package structure verification skipped')
  process.exit(0)
}

const releaseFiles = readdirSync(releaseDir, { recursive: true }).map((entry) => String(entry).replace(/\\/g, '/'))
assert.ok(releaseFiles.some((entry) => entry.endsWith('.exe')), 'release should contain a Windows executable or installer')
assert.ok(
  releaseFiles.some((entry) => entry.includes('resources/app.asar')) ||
    releaseFiles.some((entry) => entry.includes('resources/app/dist-electron/main.cjs')),
  'release should contain packaged app resources',
)
assert.ok(
  releaseFiles.some((entry) => entry.includes('better-sqlite3')),
  'release should contain better-sqlite3 native dependency payload',
)
assert.ok(
  releaseFiles.some((entry) => entry.includes('active-win')),
  'release should contain active-win native dependency payload',
)

console.log('release structure verification passed')
