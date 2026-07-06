import { protocol } from 'electron'
import {
  IMAGE_PROTOCOL,
  cleanupUnreferencedImageFiles,
  deleteImageFiles,
  resolveImageProtocolUrl,
} from './imageStorage'

interface ImagePathRow {
  file_path: string
}

interface ImageDatabase {
  prepare(sql: string): {
    all(): unknown[]
  }
}

export function registerImageProtocol(userDataPath: string) {
  protocol.registerFileProtocol(IMAGE_PROTOCOL, (request, callback) => {
    try {
      callback({ path: resolveImageProtocolUrl(userDataPath, request.url) })
    } catch {
      callback({ error: -6 })
    }
  })
}

export async function discardImages(userDataPath: string, imagePaths: string[]) {
  await deleteImageFiles(userDataPath, imagePaths)
}

export function getReferencedImagePaths(db: ImageDatabase) {
  return (db.prepare('SELECT file_path FROM images').all() as ImagePathRow[]).map((row) => row.file_path)
}

export async function cleanupImagesWithoutDatabaseReferences(userDataPath: string, db: ImageDatabase) {
  return cleanupUnreferencedImageFiles(userDataPath, getReferencedImagePaths(db))
}
