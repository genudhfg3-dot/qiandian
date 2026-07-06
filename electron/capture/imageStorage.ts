import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { CapturedClipboardImage } from './clipboardMarkdown'

export const CLIPBOARD_IMAGE_MIME = 'image/png' as const
export const IMAGE_PROTOCOL = 'app-image'

const IMAGE_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/
const IMAGE_PATH_PATTERN = /^images\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/

function assertInsideDirectory(parentDir: string, childPath: string) {
  const resolvedParent = resolve(parentDir)
  const resolvedChild = resolve(childPath)
  if (resolvedChild !== resolvedParent && !resolvedChild.startsWith(`${resolvedParent}${sep}`)) {
    throw new Error('image path escaped storage directory')
  }
}

function isPngBuffer(buffer: Buffer) {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  )
}

export function getClipboardImagesDir(userDataPath: string) {
  return resolve(userDataPath, 'images')
}

export function normalizeImagePath(imagePath: string) {
  const normalized = imagePath.replace(/\\/g, '/').replace(/^\/+/, '').trim()
  if (!IMAGE_PATH_PATTERN.test(normalized)) {
    throw new Error('invalid image path')
  }

  return `images/${basename(normalized)}`
}

export function resolveImageFilePath(userDataPath: string, imagePath: string) {
  const normalized = normalizeImagePath(imagePath)
  const imagesDir = getClipboardImagesDir(userDataPath)
  const absolutePath = join(imagesDir, basename(normalized))
  assertInsideDirectory(imagesDir, absolutePath)
  return absolutePath
}

export function imagePathToProtocolUrl(imagePath: string) {
  const normalized = normalizeImagePath(imagePath)
  return `${IMAGE_PROTOCOL}://local/${encodeURIComponent(basename(normalized))}`
}

export function protocolUrlToImagePath(url: string) {
  const parsed = new URL(url)
  if (parsed.protocol !== `${IMAGE_PROTOCOL}:`) {
    throw new Error('invalid image protocol')
  }

  const filename = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
  if (parsed.hostname !== 'local' || !IMAGE_FILENAME_PATTERN.test(filename)) {
    throw new Error('invalid image protocol path')
  }

  return `images/${filename}`
}

export function resolveImageProtocolUrl(userDataPath: string, url: string) {
  return resolveImageFilePath(userDataPath, protocolUrlToImagePath(url))
}

export async function saveClipboardPng(userDataPath: string, pngBuffer: Buffer): Promise<CapturedClipboardImage> {
  if (pngBuffer.length === 0) {
    throw new Error('clipboard image is empty')
  }
  if (!isPngBuffer(pngBuffer)) {
    throw new Error('clipboard image must be PNG')
  }

  const imagesDir = getClipboardImagesDir(userDataPath)
  const filename = `${randomUUID()}.png`
  const absolutePath = join(imagesDir, filename)
  assertInsideDirectory(imagesDir, absolutePath)

  await mkdir(imagesDir, { recursive: true })
  await writeFile(absolutePath, pngBuffer, { flag: 'wx' })

  return {
    path: `images/${filename}`,
    mime: CLIPBOARD_IMAGE_MIME,
  }
}

export async function deleteImageFiles(userDataPath: string, imagePaths: string[]) {
  const uniquePaths = Array.from(new Set(imagePaths))
  await Promise.all(
    uniquePaths.map(async (imagePath) => {
      const absolutePath = resolveImageFilePath(userDataPath, imagePath)
      await rm(absolutePath, { force: true })
    }),
  )
}

export async function cleanupUnreferencedImageFiles(userDataPath: string, referencedImagePaths: string[]) {
  const imagesDir = getClipboardImagesDir(userDataPath)
  const referenced = new Set(
    referencedImagePaths.map((imagePath) => {
      try {
        return normalizeImagePath(imagePath)
      } catch {
        return null
      }
    }).filter((imagePath): imagePath is string => Boolean(imagePath)),
  )

  let deleted = 0
  let files: string[] = []
  try {
    files = await readdir(imagesDir)
  } catch {
    return { deleted }
  }

  for (const file of files) {
    if (!IMAGE_FILENAME_PATTERN.test(file)) {
      continue
    }

    const imagePath = `images/${file}`
    if (!referenced.has(imagePath)) {
      await rm(resolveImageFilePath(userDataPath, imagePath), { force: true })
      deleted += 1
    }
  }

  return { deleted }
}
