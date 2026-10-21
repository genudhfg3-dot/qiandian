import { app, BrowserWindow } from 'electron'
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'
import { installAssistant } from '../electron/assistant/controller'
const dir = resolve('.tmp/assistant-desktop-test')
mkdirSync(dir, { recursive: true })
app.setPath('userData', join(dir, 'profile'))
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
app.whenReady().then(async () => {
  const saved: unknown[] = [], requests: any[] = []
  writeFileSync(join(app.getPath('userData'), 'assistant-settings.json'), JSON.stringify({ screenshotHints: false, shortcut: 'CommandOrControl+Alt+Shift+F10' }))
  const server = createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part
    const data = JSON.parse(body); requests.push(data)
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    await delay(80)
    res.write('data: {"choices":[{"delta":{"content":"关闭前请先保存工作。"}}]}\n\n')
    await delay(160)
    res.end('data: {"choices":[{"delta":{"content":"\\n\\n未保存的修改可能丢失。"}}]}\n\ndata: [DONE]\n\n')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  try {
    installAssistant({
      load: (window, route) => { void window.loadFile(resolve('dist/index.html'), { hash: route }) },
      webPreferences: () => ({ preload: resolve('dist-electron/preload.cjs'), contextIsolation: true, nodeIntegration: false }),
      settings: () => ({ enabled: true, baseUrl: `http://127.0.0.1:${address.port}`, model: '本地流程测试', apiKey: 'fixture', apiKeyConfigured: true, sendSourceUrl: false }),
      capture: () => {}, openSettings: () => {}, anchor: () => undefined,
      save: async value => { saved.push(value); return 'fixture-entry' },
    })
    const window = BrowserWindow.getAllWindows().find(win => win.getTitle().includes('随手问'))!
    if (window.webContents.isLoading()) await new Promise<void>(resolve => window.webContents.once('did-finish-load', () => resolve()))
    const js = (code: string) => window.webContents.executeJavaScript(code)
    await delay(300)
    assert.equal(await js('document.querySelector("h1").textContent'), '随手问')
    assert.equal(await js('window.assistantApi !== undefined'), true)
    const wakeTimes: number[] = []
    for (let i = 0; i < 20; i++) {
      await js('window.assistantApi.hide()')
      wakeTimes.push(await js('(async () => {const start=performance.now();await window.assistantApi.open();const input=document.querySelector("textarea");input.focus();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(document.activeElement!==input)throw new Error("input not focused");return Math.round(performance.now()-start)})()'))
    }
    wakeTimes.sort((a,b) => a-b)
    console.log(JSON.stringify({ warmOpenSamples: 20, p50Ms: (wakeTimes[9] + wakeTimes[10]) / 2, p95Ms: wakeTimes[18] }))
    const empty = await window.webContents.capturePage(); writeFileSync(join(dir, 'empty.png'), empty.toPNG())
    await js('window.assistantApi.send("关闭软件前要注意什么？")')
    for (let i = 0; i < 80; i++) { const state = await js('window.assistantApi.state()'); if (!state.busy && state.messages.length) break; await delay(50) }
    let state = await js('window.assistantApi.state()')
    assert.equal(state.messages.length, 2); assert.equal(state.messages[1].status, 'done'); assert.ok(state.messages[1].firstTokenMs >= 0)
    assert.match(await js('document.body.innerText'), /关闭前请先保存工作/)
    const image = await js(`(() => {const c=document.createElement('canvas');c.width=240;c.height=80;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,240,80);x.fillStyle='black';x.font='18px Arial';x.fillText('Save your work.',15,32);x.font='12px Arial';x.fillText('Unsaved changes may be lost.',15,58);return c.toDataURL('image/png')})()`)
    await js(`window.assistantApi.image(${JSON.stringify(image)})`)
    await js('window.assistantApi.send("翻译截图")')
    for (let i = 0; i < 80; i++) { state = await js('window.assistantApi.state()'); if (!state.busy) break; await delay(50) }
    assert.equal(requests[1].messages.at(-1).content[1].type, 'image_url')
    const answer = state.messages.at(-1)
    await js(`window.assistantApi.save(${JSON.stringify({ messageId: answer.id, title: '测试问答', text: answer.text, includeOriginal: true, tagNames: ['测试'] })})`)
    await js(`window.assistantApi.save(${JSON.stringify({ messageId: answer.id, title: '测试问答', text: answer.text, includeOriginal: true, tagNames: [] })})`)
    assert.equal(saved.length, 1); assert.equal((saved[0] as any).images.length, 1)
    await delay(250)
    assert.equal(await js('document.querySelector("header").getBoundingClientRect().top'), 0)
    await js('document.querySelector("main").scrollTop = document.querySelector("main").scrollHeight')
    await delay(80)
    const result = await window.webContents.capturePage(); writeFileSync(join(dir, 'conversation.png'), result.toPNG())
    await js('window.assistantApi.open("新选中文字", "ask")')
    state = await js('window.assistantApi.state()'); assert.equal(state.incoming.text, '新选中文字')
    await js('window.assistantApi.acceptIncoming("new")'); state = await js('window.assistantApi.state()'); assert.equal(state.messages.length, 0); assert.equal(state.draft, '新选中文字')
    await js('window.assistantApi.send("停止测试")'); await js('window.assistantApi.cancel()')
    await delay(300); state = await js('window.assistantApi.state()'); assert.equal(state.messages.at(-1).status, 'stopped')
    await js('window.assistantApi.retry()'); await delay(450); state = await js('window.assistantApi.state()'); assert.equal(state.messages.length, 2); assert.equal(state.messages.at(-1).status, 'done')
    const before = await js('window.assistantApi.preferences()')
    await assert.rejects(js('window.assistantApi.updatePreferences({screenshotHints: false, shortcut: "invalid shortcut"})'))
    assert.equal((await js('window.assistantApi.preferences()')).shortcut, before.shortcut)
    await js('window.assistantApi.updatePreferences({screenshotHints: false, shortcut: "CommandOrControl+Alt+Shift+F11"})')
    assert.equal((await js('window.assistantApi.preferences()')).screenshotHints, false)
    // Capture a clean, self-contained public demo using synthetic content only.
    await js('window.assistantApi.reset()')
    await js(`window.assistantApi.image(${JSON.stringify(image)})`)
    await js('window.assistantApi.send("请把图片里的文字翻译成中文。")')
    for (let i = 0; i < 80; i++) { if (!(await js('window.assistantApi.state()')).busy) break; await delay(50) }
    await delay(200)
    writeFileSync(join(dir, 'conversation.png'), (await window.webContents.capturePage()).toPNG())
    const hint = new BrowserWindow({ width: 292, height: 96, useContentSize: true, frame: false, show: false, webPreferences: { preload: resolve('dist-electron/preload.cjs'), contextIsolation: true, nodeIntegration: false } })
    await hint.loadFile(resolve('dist/index.html'), { hash: '/assistant-hint' })
    for (const width of [240, 292, 380]) {
      hint.setContentSize(width, 96)
      await delay(120)
      const layout = await hint.webContents.executeJavaScript(`(() => {
        const buttons = [...document.querySelectorAll('button')].map(el => { const r = el.getBoundingClientRect(); return { text: el.textContent, fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight } });
        return { buttons, noScroll: document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth };
      })()`)
      assert.equal(layout.buttons.length, 3)
      assert.ok(layout.buttons.every((button: { fits: boolean }) => button.fits), 'hint actions must fit in the window')
      assert.equal(layout.noScroll, true, 'hint must not produce page scrollbars')
    }
    hint.setContentSize(292, 96); await delay(120)
    writeFileSync(join(dir, 'hint.png'), (await hint.webContents.capturePage()).toPNG())
    await hint.loadFile(resolve('dist/index.html'), { hash: '/about' }); await delay(150)
    assert.match(await hint.webContents.executeJavaScript('document.body.innerText'), /v1\.2\.0/)
    assert.match(await hint.webContents.executeJavaScript('document.body.innerText'), /Alt\+R/)
    hint.destroy()
    console.log('PASS: actual Electron preload/UI, text/image requests, follow-up context, idempotent save, incoming selection, reset, cancel/retry, settings validation; screenshots in .tmp/assistant-desktop-test')
    server.close(); app.quit()
  } catch (error) { console.error(error); server.close(); app.exit(1) }
})
