import { clipboard } from 'electron'
import type { SourceInfo } from '../../src/domain/knowledge'
import { convertClipboardSnapshot } from './clipboardMarkdown'
import { saveClipboardPng } from './clipboardImage'

export async function readClipboardAsMarkdown(userDataPath: string, source?: SourceInfo) {
  const html = clipboard.readHTML()
  const text = clipboard.readText()
  const image = clipboard.readImage()

  if (image.isEmpty()) {
    return convertClipboardSnapshot({ html, text, source })
  }

  try {
    const imageAsset = await saveClipboardPng(userDataPath, image.toPNG())
    return convertClipboardSnapshot({
      html,
      text,
      images: [imageAsset],
      source,
    })
  } catch (error) {
    return convertClipboardSnapshot({
      html,
      text,
      imageError: error instanceof Error ? error.message : 'clipboard image write failed',
      source,
    })
  }
}
