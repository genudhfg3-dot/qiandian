import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { build } from 'esbuild'

const projectRoot = process.cwd()
const outdir = path.join(projectRoot, '.tmp')
const markdownOutfile = path.join(outdir, 'verifyClipboardMarkdown.mjs')
const imageOutfile = path.join(outdir, 'verifyImageStorage.mjs')
const sourceOutfile = path.join(outdir, 'verifyCaptureSource.mjs')
const imageUrlsOutfile = path.join(outdir, 'verifyImageUrls.mjs')
const captureStatusOutfile = path.join(outdir, 'verifyCaptureStatus.mjs')
const markdownPreviewOutfile = path.join(outdir, 'verifyMarkdownPreview.mjs')
const sourceFormOutfile = path.join(outdir, 'verifySourceForm.mjs')
const tempUserData = await mkdtemp(path.join(tmpdir(), 'pkb-clipboard-'))

await build({
  entryPoints: [path.join(projectRoot, 'electron/capture/clipboardMarkdown.ts')],
  outfile: markdownOutfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
})

await build({
  entryPoints: [path.join(projectRoot, 'electron/capture/imageStorage.ts')],
  outfile: imageOutfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
})

await build({
  entryPoints: [path.join(projectRoot, 'electron/capture/source.ts')],
  outfile: sourceOutfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['active-win'],
  logLevel: 'silent',
})

await build({
  entryPoints: [path.join(projectRoot, 'src/utils/imageUrls.ts')],
  outfile: imageUrlsOutfile,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  logLevel: 'silent',
})
await build({
  entryPoints: [path.join(projectRoot, 'src/utils/captureStatus.ts')],
  outfile: captureStatusOutfile,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  logLevel: 'silent',
})

await build({
  entryPoints: [path.join(projectRoot, 'src/utils/markdownPreview.ts')],
  outfile: markdownPreviewOutfile,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  logLevel: 'silent',
})

await build({
  entryPoints: [path.join(projectRoot, 'src/utils/sourceForm.ts')],
  outfile: sourceFormOutfile,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  logLevel: 'silent',
})

try {
  const { convertClipboardSnapshot } = await import(pathToFileURL(markdownOutfile).href)
  const {
    cleanupUnreferencedImageFiles,
    deleteImageFiles,
    getClipboardImagesDir,
    imagePathToProtocolUrl,
    protocolUrlToImagePath,
    resolveImageFilePath,
    resolveImageProtocolUrl,
    saveClipboardPng,
  } = await import(pathToFileURL(imageOutfile).href)
  const { MANUAL_SOURCE, mapActiveWindowToSource } = await import(pathToFileURL(sourceOutfile).href)
  const { rewriteMarkdownImageUrls, toAppImageUrl } = await import(pathToFileURL(imageUrlsOutfile).href)
  const { captureStatusLabel, captureStatusMessage } = await import(pathToFileURL(captureStatusOutfile).href)
  const { createMarkdownPreviewBlocks } = await import(pathToFileURL(markdownPreviewOutfile).href)
  const { normalizeCaptureSource, updateCaptureSource } = await import(pathToFileURL(sourceFormOutfile).href)

  const htmlResult = convertClipboardSnapshot({
    html: '<article><h1>Page Title</h1><p>This is <strong>important</strong> content.</p><img src="https://example.com/a.png"></article>',
  })
  assert.equal(htmlResult.format, 'html')
  assert.equal(htmlResult.title, 'Page Title')
  assert.equal(htmlResult.isEmpty, false)
  assert.equal(htmlResult.images.length, 0)
  assert.match(htmlResult.contentMd, /^# Page Title/m)
  assert.match(htmlResult.contentMd, /\*\*important\*\*/)
  assert.doesNotMatch(htmlResult.contentMd, /example\.com\/a\.png/)

  const mappedSource = mapActiveWindowToSource({
    title: 'Example Page - Browser',
    url: 'https://example.com/page',
    owner: { name: 'Chrome' },
  })
  assert.deepEqual(mappedSource, {
    app: 'Chrome',
    title: 'Example Page - Browser',
    url: 'https://example.com/page',
  })
  assert.deepEqual(mapActiveWindowToSource(undefined), MANUAL_SOURCE)

  const htmlWithSource = convertClipboardSnapshot({
    html: '<h1>With Source</h1>',
    source: mappedSource,
  })
  assert.deepEqual(htmlWithSource.source, mappedSource)

  const editedSource = updateCaptureSource(mappedSource, {
    app: 'Manual Browser',
    title: 'Edited Title',
    url: ' https://edited.example/path ',
  })
  assert.deepEqual(editedSource, {
    app: 'Manual Browser',
    title: 'Edited Title',
    url: 'https://edited.example/path',
  })
  assert.deepEqual(normalizeCaptureSource({ app: '   ', title: '  ', url: '' }), { app: 'Manual Capture' })

  assert.equal(captureStatusLabel('images_cleaned'), '图片已清理')
  assert.match(
    captureStatusMessage({ state: 'images_cleaned', cleanedImageCount: 2, error: 'disk full' }),
    /重新从剪贴板填入图片.*disk full/,
  )

  const textResult = convertClipboardSnapshot({
    text: 'Plain Title\r\nSecond line',
  })
  assert.equal(textResult.format, 'text')
  assert.equal(textResult.title, 'Plain Title')
  assert.equal(textResult.contentMd, 'Plain Title\nSecond line')
  assert.equal(textResult.isEmpty, false)
  assert.equal(textResult.images.length, 0)

  const emptyResult = convertClipboardSnapshot({})
  assert.equal(emptyResult.format, 'empty')
  assert.equal(emptyResult.contentMd, '')
  assert.equal(emptyResult.imageUnsupported, false)
  assert.equal(emptyResult.isEmpty, true)
  assert.equal(emptyResult.images.length, 0)

  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
  ])
  const savedImage = await saveClipboardPng(tempUserData, pngBytes)
  assert.equal(savedImage.mime, 'image/png')
  assert.match(savedImage.path, /^images\/[0-9a-f-]+\.png$/)

  const absoluteImagePath = path.join(tempUserData, savedImage.path)
  const imageStat = await stat(absoluteImagePath)
  assert.equal(imageStat.isFile(), true)
  assert.deepEqual(await readFile(absoluteImagePath), pngBytes)
  assert.equal(path.dirname(absoluteImagePath), getClipboardImagesDir(tempUserData))

  const protocolUrl = imagePathToProtocolUrl(savedImage.path)
  assert.equal(protocolUrl, toAppImageUrl(savedImage.path))
  assert.equal(protocolUrlToImagePath(protocolUrl), savedImage.path)
  assert.equal(resolveImageProtocolUrl(tempUserData, protocolUrl), resolveImageFilePath(tempUserData, savedImage.path))
  assert.equal(rewriteMarkdownImageUrls(`![x](${savedImage.path})`), `![x](${protocolUrl})`)
  const previewBlocks = createMarkdownPreviewBlocks(`# Preview` + '\n' + `![x](${savedImage.path})` + '\n' + `**body** text`)
  assert.deepEqual(previewBlocks, [
    { type: 'heading', text: 'Preview' },
    { type: 'image', alt: 'x', src: protocolUrl },
    { type: 'paragraph', text: 'body text' },
  ])
  assert.equal(toAppImageUrl('../outside.png'), undefined)
  assert.throws(() => resolveImageFilePath(tempUserData, '../outside.png'), /invalid image path/)
  assert.throws(() => protocolUrlToImagePath('app-image://local/..%2Foutside.png'), /invalid image protocol path/)

  const imageResult = convertClipboardSnapshot({ images: [savedImage] })
  assert.equal(imageResult.format, 'image')
  assert.equal(imageResult.imageUnsupported, false)
  assert.equal(imageResult.isEmpty, false)
  assert.deepEqual(imageResult.images, [savedImage])
  assert.equal(imageResult.contentMd, `![clipboard-image-1](${savedImage.path})`)

  const orphanImage = await saveClipboardPng(tempUserData, pngBytes)
  await cleanupUnreferencedImageFiles(tempUserData, [savedImage.path])
  assert.equal(existsSync(resolveImageFilePath(tempUserData, savedImage.path)), true)
  assert.equal(existsSync(resolveImageFilePath(tempUserData, orphanImage.path)), false)

  await assert.rejects(() => saveClipboardPng(tempUserData, Buffer.from('not-png')), /must be PNG/)
  await assert.rejects(() => deleteImageFiles(tempUserData, ['images/../escape.png']), /invalid image path/)
  await deleteImageFiles(tempUserData, [savedImage.path])
  assert.equal(existsSync(absoluteImagePath), false)
} finally {
  await rm(tempUserData, { recursive: true, force: true })
  if (existsSync(outdir)) {
    await rm(outdir, { recursive: true, force: true })
  }
}

console.log('clipboard markdown verification passed')

