import Database from 'better-sqlite3'
import { unlinkSync, existsSync } from 'node:fs'
import { runMigrations } from './migrations'
import { seedInitialData } from './seed'
import { createSqliteKnowledgeRepository } from './sqliteKnowledgeRepository'

/**
 * 打开知识库数据库。
 * 如果数据库文件损坏（无法打开、迁移失败等），会自动删除并重建。
 */
export function openKnowledgeDatabase(databasePath: string) {
  try {
    const db = new Database(databasePath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    try {
      seedInitialData(db)
    } catch (error) {
      console.warn('seed initial data failed, continuing without seeding', error)
    }
    return db
  } catch (error) {
    console.error('打开数据库失败，尝试删除损坏的数据库并重建:', error)
    resetDatabase(databasePath)
    const db = new Database(databasePath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    seedInitialData(db)
    return db
  }
}

/**
 * 删除数据库文件（含 WAL/SHM 辅助文件），用于损坏恢复。
 */
export function resetDatabase(databasePath: string) {
  for (const suffix of ['', '-wal', '-shm']) {
    const filePath = databasePath + suffix
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath)
      } catch (e) {
        console.warn(`删除数据库文件失败: ${filePath}`, e)
      }
    }
  }
}

export { createSqliteKnowledgeRepository }
