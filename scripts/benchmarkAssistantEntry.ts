import { app, BrowserWindow, safeStorage } from 'electron'
import Database from 'better-sqlite3'
import { join, resolve } from 'node:path'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { readStoredApiKey, type AiRuntimeSettings } from '../electron/metadata/aiSettings'
import { streamAnswer, type ChatMessage } from '../electron/assistant/chat'

const outputDir = resolve('.tmp/assistant-benchmark')
mkdirSync(outputDir, { recursive: true })
const profile = join(outputDir, 'electron-profile')
mkdirSync(profile, { recursive: true })
const encryptionState = join(process.env.APPDATA!, 'personal-knowledge-base', 'Local State')
// Electron safeStorage on Windows needs the application's encrypted OS key.
// Copy into an isolated profile so the benchmark never writes to the real profile.
if (existsSync(encryptionState)) copyFileSync(encryptionState, join(profile, 'Local State'))
app.setPath('userData', profile)
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  const results: object[] = []
  try {
    // Read settings only; never run migrations or mutate the user's knowledge base.
    const db = new Database(join(process.env.APPDATA!, 'personal-knowledge-base', 'knowledge.sqlite'), { readonly: true, fileMustExist: true })
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('ai.metadata.settings') as { value: string } | undefined
    const settings = { ...JSON.parse(row?.value || '{}'), apiKey: readStoredApiKey(db, safeStorage) } as AiRuntimeSettings
    db.close()
    console.log(JSON.stringify({ host: new URL(settings.baseUrl).hostname, model: settings.model, enabled: settings.enabled, configured: Boolean(settings.apiKey), samplesPerCategory: Number(process.env.ASSISTANT_BENCH_SAMPLES) }))
    if (process.env.ASSISTANT_BENCH_INFO) return
    if (!settings.enabled || !settings.apiKey) throw new Error('当前 AI 未启用或密钥不可用，无法实测。')
    const fixture = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    await fixture.loadURL('data:text/html,<html><body></body></html>')
    const dataUrl = await fixture.webContents.executeJavaScript(`(() => { const c=document.createElement('canvas'); c.width=600;c.height=160;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,600,160);x.fillStyle='#111';x.font='26px Arial';x.fillText('Save your work before closing.',24,65);x.fillText('Changes will be lost.',24,110);return c.toDataURL('image/png');})()`)
    fixture.destroy()
    const imageMessage: ChatMessage = { role: 'user', content: [{ type: 'text', text: '请将图片中的英文翻译为中文。只给译文。' }, { type: 'image_url', image_url: { url: dataUrl } }] }
    const cases: Array<{ name: string; messages: ChatMessage[] }> = [
      { name: 'text', messages: [{ role: 'user', content: '用约100个汉字解释为什么保存工作后再关闭软件。' }] },
      { name: 'image', messages: [imageMessage] },
      { name: 'followup', messages: [imageMessage, { role: 'assistant', content: '关闭前请保存工作。未保存的更改将丢失。' }, { role: 'user', content: '这里的 changes 指什么？用一句话回答。' }] },
    ]
    for (const category of cases) {
      for (let i = 0; i < Number(process.env.ASSISTANT_BENCH_SAMPLES); i++) {
        const start = performance.now(); let first: number | undefined, answer = ''
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000)
        try {
          await streamAnswer(settings, category.messages, controller.signal, text => { first ??= performance.now() - start; answer += text }, async (url, options) => {
            const response = await fetch(url, options)
            if (!response.ok) {
              const body = await response.clone().text()
              console.log(JSON.stringify({ category: category.name, diagnostic: body.replaceAll(settings.apiKey, '[redacted]').slice(0, 800) }))
            }
            return response
          })
          const result = { category: category.name, sample: i + 1, firstTokenMs: Math.round(first!), totalMs: Math.round(performance.now() - start), outputChars: answer.length, ...(i === 0 ? { answer } : {}) }
          results.push(result); console.log(JSON.stringify(result))
        } catch (error) {
          const result = { category: category.name, sample: i + 1, error: error instanceof Error ? error.message : 'request failed', totalMs: Math.round(performance.now() - start) }
          results.push(result); console.log(JSON.stringify(result))
          // Avoid repeatedly charging requests known to be incompatible.
          break
        } finally { clearTimeout(timer) }
      }
    }
    writeFileSync(join(outputDir, 'results.json'), JSON.stringify({ model: settings.model, fixture: 'synthetic English screenshot, 600x160', imageBytes: Buffer.byteLength(dataUrl.split(',')[1], 'base64'), results }, null, 2))
  } catch (error) { console.error(error instanceof Error ? error.message : 'Benchmark failed'); process.exitCode = 1 }
  finally { app.exit(process.exitCode || 0) }
})
