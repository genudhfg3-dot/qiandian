import { build } from 'esbuild'
import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'dist-electron')

await rm(outDir, { recursive: true, force: true })

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['better-sqlite3', 'electron', 'active-win'],
  logLevel: 'info',
}

await Promise.all([
  build({
    ...common,
    entryPoints: [resolve(root, 'electron/main.ts')],
    outfile: resolve(outDir, 'main.cjs'),
  }),
  build({
    ...common,
    entryPoints: [resolve(root, 'electron/preload.ts')],
    outfile: resolve(outDir, 'preload.cjs'),
  }),
])

