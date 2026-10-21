import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const output = resolve('.tmp/assistant-core.mjs')
await build({ stdin: { contents: "export * from './electron/assistant/chat.ts'; export * from './electron/capture/dragGesture.ts'; export * from './electron/assistant/clipboardTracker.ts'; export * from './electron/metadata/modelName.ts'", resolveDir: process.cwd(), loader: 'ts' }, outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' })
const { streamAnswer, DragGesture, quickReplyOptions, ClipboardTracker, normalizeModelName } = await import(pathToFileURL(output).href)
assert.equal(normalizeModelName('https://api.xiaomimimo.com/v1', ' MiMo-V2.6-Flash '), 'mimo-v2.6-flash')
assert.equal(normalizeModelName('https://other.example/v1', 'MiMo-V2.6-Flash'), 'MiMo-V2.6-Flash')
assert.equal(normalizeModelName('https://api.xiaomimimo.com/v1', 'Custom-ID'), 'Custom-ID')
assert.deepEqual(quickReplyOptions({ baseUrl: 'https://api.xiaomimimo.com/v1', model: 'MiMo-V2.6-Flash' }), { thinking: { type: 'disabled' } })
const tracker = new ClipboardTracker()
assert.equal(tracker.observe('old-image'), false)
assert.equal(tracker.observe('new-image'), true)
assert.equal(tracker.observe('new-image'), false)
assert.equal(tracker.observe(''), false)
assert.equal(tracker.observe('new-image'), true)
tracker.reset(); assert.equal(tracker.observe('resume-image'), false)
assert.deepEqual(quickReplyOptions({ baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5-pro' }), { thinking: { type: 'disabled' } })
assert.deepEqual(quickReplyOptions({ baseUrl: 'https://example.invalid/v1', model: 'mimo-v2.5-pro' }), {})
const settings = { enabled: true, baseUrl: 'https://example.invalid/v1', apiKey: 'test-only', model: 'fixture' }
const signal = new AbortController().signal
const encoder = new TextEncoder()
let received = ''
// Fragment every byte, including multibyte Chinese text and SSE CRLF boundaries.
const wire = 'data: {"choices":[{"delta":{"reasoning_content":"not an answer"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: [DONE]\r\n\r\n'
await streamAnswer(settings, [{ role: 'user', content: 'hi' }], signal, value => received += value, async (_url, init) => {
  const body = JSON.parse(init.body)
  assert.equal(body.model, 'fixture'); assert.equal(body.stream, true)
  return new Response(new ReadableStream({ start(controller) { for (const byte of encoder.encode(wire)) controller.enqueue(Uint8Array.of(byte)); controller.close() } }), { headers: { 'content-type': 'text/event-stream' } })
})
assert.equal(received, '你好')
received = ''
await streamAnswer(settings, [], signal, value => received += value, async () => Response.json({ choices: [{ message: { content: '完整响应' } }] }))
assert.equal(received, '完整响应')
for (const [status, body, pattern] of [[401, '', /鉴权/], [429, '', /受限/], [400, 'image input is not supported', /图片理解/], [404, 'No endpoints found that support image input', /图片理解/], [500, 'vision server down', /HTTP 500/]]) {
  await assert.rejects(streamAnswer(settings, [], signal, () => {}, async () => new Response(body, { status })), pattern)
}
await assert.rejects(streamAnswer(settings, [], signal, () => {}, async () => new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })), /未返回可读/)
const abort = new AbortController()
const cancelled = streamAnswer(settings, [], abort.signal, () => {}, async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))))
abort.abort(); await assert.rejects(cancelled, { name: 'AbortError' })
const drag = new DragGesture({ x: 110, y: 210 }, { x: 10, y: 10 })
assert.deepEqual(drag.update({ x: 112, y: 211 }), { x: 102, y: 201 }); assert.equal(drag.moved, false)
drag.update({ x: 200, y: 300 }); drag.update({ x: 110, y: 210 }); assert.equal(drag.moved, true)
assert.deepEqual(drag.update({ x: -500, y: 40 }), { x: -510, y: 30 })
console.log('PASS: fragmented SSE, actual answer tokens, JSON fallback, error classification, cancellation, drag threshold/return/negative coordinates')
