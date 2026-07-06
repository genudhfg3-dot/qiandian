import { mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const electronCache = resolve(root, '.electron-cache')
const electronBuilderCache = resolve(root, '.electron-builder-cache')

await mkdir(electronCache, { recursive: true })
await mkdir(electronBuilderCache, { recursive: true })

function commandPath(command) {
  if (command.includes('/') || command.includes('\\')) {
    return process.platform === 'win32' ? `${command}.cmd` : command
  }
  return process.platform === 'win32' ? `${command}.cmd` : command
}

async function run(command, args, extraEnv = {}) {
  const child = spawn(commandPath(command), args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ELECTRON_CACHE: electronCache,
      ELECTRON_BUILDER_CACHE: electronBuilderCache,
      ...extraEnv,
    },
  })

  const [code] = await once(child, 'exit')
  if (code !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${code}`)
  }
}

await run('npm', ['run', 'clean:release'])
await run('npm', ['run', 'build'])
await run('npm', ['run', 'verify:package'])
await run(resolve(root, 'node_modules/.bin/electron-builder'), ['--win', '--x64', '--publish', 'never'])
await run('npm', ['run', 'verify:release'])
