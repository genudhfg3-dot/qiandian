import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
await build({ entryPoints: ['scripts/verifyAssistantDesktopEntry.ts'], outfile: '.tmp/verify-assistant-desktop.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'], logLevel: 'silent' })
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
const child = spawn(resolve('node_modules/electron/dist/electron.exe'), [resolve('.tmp/verify-assistant-desktop.cjs')], { env, stdio: 'inherit', windowsHide: true })
child.on('exit', code => { process.exitCode = code ?? 1 })
