import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const releaseDir = resolve(process.cwd(), 'release')
const retryableCodes = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM'])

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms))
}

for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    await rm(releaseDir, { recursive: true, force: true })
    console.log('release directory cleaned')
    process.exit(0)
  } catch (error) {
    if (!retryableCodes.has(error?.code) || attempt === 30) {
      console.error(`Could not clean release directory: ${error?.message ?? error}`)
      console.error('Close any running unpacked app or Explorer window inside release/, then rerun npm run package:win.')
      process.exit(1)
    }

    await wait(500 + attempt * 100)
  }
}
