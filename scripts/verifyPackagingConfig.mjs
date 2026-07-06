import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const builderConfig = readFileSync(resolve(root, 'electron-builder.yml'), 'utf8')
const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')

function assertFile(path, message = `${path} should exist`) {
  assert.equal(existsSync(resolve(root, path)), true, message)
}

function assertContains(text, needle, message = `expected config to include ${needle}`) {
  assert.equal(text.includes(needle), true, message)
}

assert.equal(packageJson.main, 'dist-electron/main.cjs', 'package main should point at Electron main bundle')
assert.equal(packageJson.scripts['package:win'], 'node scripts/packageWin.mjs')
assertFile('scripts/packageWin.mjs')
assertContains(packageJson.scripts['rebuild:native'], 'better-sqlite3')
assertContains(packageJson.scripts['rebuild:native'], 'active-win')
assert.equal(Boolean(packageJson.devDependencies['electron-builder']), true, 'electron-builder should be installed')
const packageWinScript = readFileSync(resolve(root, 'scripts/packageWin.mjs'), 'utf8')
assertContains(packageWinScript, 'ELECTRON_CACHE', 'package script should redirect Electron cache into workspace')
assertContains(packageWinScript, 'ELECTRON_BUILDER_CACHE', 'package script should redirect electron-builder cache into workspace')
assertContains(packageWinScript, '--publish', 'package script should disable publishing')
assertContains(packageWinScript, 'verify:release', 'package script should verify release structure after building')

assertFile('electron-builder.yml')
assertFile('build/app.ico')
assertFile('dist/index.html', 'renderer build should exist before packaging')
assertFile('dist-electron/main.cjs', 'Electron main bundle should exist before packaging')
assertFile('dist-electron/preload.cjs', 'Electron preload bundle should exist before packaging')
assertFile('node_modules/better-sqlite3/package.json')
assertFile('node_modules/active-win/package.json')
assertFile('node_modules/electron/dist/electron.exe')
assertContains(viteConfig, "base: './'", 'Vite build should use relative asset paths for packaged file:// loads')

assertContains(builderConfig, 'icon: build/app.ico', 'Windows package should use the app ico')
assertContains(builderConfig, 'extraResources:', 'builder should copy extra resources')
assertContains(builderConfig, 'from: build/app.ico', 'builder should include icon resource for runtime tray lookup')

const distIndex = readFileSync(resolve(root, 'dist/index.html'), 'utf8')
assert.equal(distIndex.includes('src="/assets/'), false, 'packaged renderer script path must not be absolute')
assert.equal(distIndex.includes('href="/assets/'), false, 'packaged renderer stylesheet path must not be absolute')

for (const required of [
  'electronDist: node_modules/electron/dist',
  'dist/**/*',
  'dist-electron/main.cjs',
  'dist-electron/preload.cjs',
  'package.json',
  'better-sqlite3/**/*',
  'active-win/**/*',
  'asarUnpack:',
  'node_modules/better-sqlite3/**',
  'node_modules/active-win/**',
  'publish: null',
  'npmRebuild: false',
]) {
  assertContains(builderConfig, required)
}

const mainBundle = readFileSync(resolve(root, 'dist-electron/main.cjs'), 'utf8')
const preloadBundle = readFileSync(resolve(root, 'dist-electron/preload.cjs'), 'utf8')
assertContains(mainBundle, 'app-image', 'main bundle should register app-image protocol')
assertContains(mainBundle, 'better-sqlite3', 'main bundle should keep better-sqlite3 external reference')
assertContains(mainBundle, 'active-win', 'main bundle should keep active-win external reference')

assertContains(mainBundle, 'globalShortcut', 'main bundle should register global capture shortcut')
assertContains(mainBundle, 'CommandOrControl+Shift+K', 'main bundle should include capture shortcut')
assertContains(mainBundle, 'floatingButtonBounds', 'main bundle should persist floating button bounds')
assertContains(mainBundle, 'settings.json', 'main bundle should persist local app settings')
assertContains(mainBundle, 'entries:update', 'main bundle should expose entry update IPC')
assertContains(mainBundle, 'entries:delete', 'main bundle should expose entry delete IPC')
assertContains(mainBundle, 'settings:getAiSettings', 'main bundle should expose AI settings IPC')
assertContains(mainBundle, 'settings:updateAiSettings', 'main bundle should expose AI settings update IPC')
assertContains(mainBundle, 'metadata:regenerateEntry', 'main bundle should expose AI metadata regeneration IPC')
assertContains(mainBundle, 'metadata:regenerateAll', 'main bundle should expose AI metadata bulk regeneration IPC')
assertContains(mainBundle, 'settings:testAiSettings', 'main bundle should expose AI settings connection test IPC')
assertContains(mainBundle, 'knowledge:entriesChanged', 'main bundle should broadcast entry changes')
assertContains(mainBundle, 'capture:close-request', 'main bundle should request renderer save before capture close')
assertContains(preloadBundle, 'entries:update', 'preload should include entry update IPC whitelist')
assertContains(preloadBundle, 'entries:delete', 'preload should include entry delete IPC whitelist')
assertContains(preloadBundle, 'settings:getAiSettings', 'preload should include AI settings IPC whitelist')
assertContains(preloadBundle, 'settings:updateAiSettings', 'preload should include AI settings update IPC whitelist')
assertContains(preloadBundle, 'metadata:regenerateEntry', 'preload should include AI metadata regeneration IPC whitelist')
assertContains(preloadBundle, 'metadata:regenerateAll', 'preload should include AI metadata bulk regeneration IPC whitelist')
assertContains(preloadBundle, 'settings:testAiSettings', 'preload should include AI settings connection test IPC whitelist')
assertContains(preloadBundle, 'knowledge:entriesChanged', 'preload should expose entry change listener')
assertContains(preloadBundle, 'capture:close-request', 'preload should expose capture close request listener')
assertContains(preloadBundle, 'capture:readClipboard', 'preload should include capture IPC whitelist')
assertContains(preloadBundle, 'capture:discardImages', 'preload should include image cleanup IPC whitelist')
assert.equal(preloadBundle.includes('getOpenWindows'), false, 'preload must not expose active-win window enumeration')
assert.equal(preloadBundle.includes('fs/promises'), false, 'preload must not expose filesystem APIs')

console.log('packaging configuration verification passed')
