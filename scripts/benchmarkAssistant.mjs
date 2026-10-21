import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { rmSync } from 'node:fs'
const infoOnly = process.argv[2] === '--info'
const sampleCount = infoOnly ? 1 : Number(process.argv[2] || 20)
if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > 20) throw new Error('sample count must be 1–20')
await build({ entryPoints: ['scripts/benchmarkAssistantEntry.ts'], outfile: '.tmp/benchmark-assistant.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron', 'better-sqlite3'], logLevel: 'silent' })
const env = { ...process.env, ASSISTANT_BENCH_SAMPLES: String(sampleCount), ASSISTANT_BENCH_INFO: infoOnly ? '1' : '' }; delete env.ELECTRON_RUN_AS_NODE
const child = spawn(resolve('node_modules/electron/dist/electron.exe'), [resolve('.tmp/benchmark-assistant.cjs')], { env, stdio: 'inherit', windowsHide: true })
child.on('exit', code => { rmSync(resolve('.tmp/assistant-benchmark/electron-profile/Local State'), { force: true }); process.exitCode = code ?? 1 })
