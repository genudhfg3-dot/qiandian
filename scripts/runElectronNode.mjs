import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const script = process.argv[2]

if (!script) {
  throw new Error('Usage: node scripts/runElectronNode.mjs <script>')
}

const electronExecutable =
  process.platform === 'win32'
    ? resolve(root, 'node_modules/electron/dist/electron.exe')
    : resolve(root, 'node_modules/.bin/electron')

const child = spawn(electronExecutable, [resolve(root, script)], {
  cwd: root,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  stdio: 'inherit',
})

const [code] = await once(child, 'exit')
process.exitCode = typeof code === 'number' ? code : 1
