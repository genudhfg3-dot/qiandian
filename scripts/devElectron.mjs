import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const devServerUrl = 'http://127.0.0.1:5173/'
const electronExecutable =
  process.platform === 'win32'
    ? resolve(root, 'node_modules/electron/dist/electron.exe')
    : resolve(root, 'node_modules/.bin/electron')

function spawnCommand(command, args, options = {}) {
  if (process.platform === 'win32' && ['npm', 'npx'].includes(command)) {
    return spawn('cmd.exe', ['/d', '/s', '/c', `${command}.cmd ${args.join(' ')}`], {
      cwd: root,
      stdio: 'inherit',
      ...options,
    })
  }

  return spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  })
}

async function runAndWait(command, args, options = {}) {
  const child = spawnCommand(command, args, options)
  const [code] = await once(child, 'exit')
  if (code !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${code}`)
  }
}

async function isViteReady() {
  try {
    const response = await fetch(devServerUrl)
    return response.ok
  } catch {
    return false
  }
}

let vite = null
if (!(await isViteReady())) {
  vite = spawnCommand('npm', ['run', 'dev', '--', '--host', '127.0.0.1'])
}

while (!(await isViteReady())) {
  await new Promise((resolveWait) => setTimeout(resolveWait, 250))
}

await runAndWait('node', ['scripts/buildElectron.mjs'])

const electron = spawnCommand(electronExecutable, ['.'], {
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devServerUrl,
  },
})

function shutdown() {
  electron.kill()
  vite?.kill()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

const [code] = await once(electron, 'exit')
vite?.kill()
process.exitCode = typeof code === 'number' ? code : 0
