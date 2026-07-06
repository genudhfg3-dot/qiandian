import type { Database } from 'better-sqlite3'
import type { AiSettings, AiSettingsUpdateInput } from '../../src/domain/knowledge'

const settingsKey = 'ai.metadata.settings'
const apiKeyKey = 'ai.metadata.apiKey'

type StoredApiKey = {
  storage: 'safeStorage' | 'local-fallback'
  value: string
}

export interface SecureKeyStorage {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

export interface AiRuntimeSettings extends AiSettings {
  apiKey: string
}

export const defaultAiSettings: AiSettings = {
  enabled: false,
  baseUrl: '',
  model: '',
  sendSourceUrl: false,
  apiKeyConfigured: false,
}

function readRawSettings(db: Database) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(settingsKey) as { value: string } | undefined
  if (!row) {
    return {}
  }

  try {
    return JSON.parse(row.value) as Partial<AiSettingsUpdateInput & { apiKey?: string; apiKeyConfigured?: boolean }>
  } catch {
    return {}
  }
}

function writePublicSettings(db: Database, settings: AiSettings) {
  const publicSettings = {
    enabled: Boolean(settings.enabled),
    baseUrl: settings.baseUrl.trim(),
    model: settings.model.trim(),
    sendSourceUrl: Boolean(settings.sendSourceUrl),
  }

  db.prepare(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `,
  ).run(settingsKey, JSON.stringify(publicSettings), Date.now())
}

function canUseSafeStorage(storage?: SecureKeyStorage | null) {
  try {
    return Boolean(storage?.isEncryptionAvailable())
  } catch {
    return false
  }
}

function encodeFallback(value: string) {
  return Buffer.from(value, 'utf8').toString('base64')
}

function decodeFallback(value: string) {
  return Buffer.from(value, 'base64').toString('utf8')
}

export function readStoredApiKey(db: Database, storage?: SecureKeyStorage | null) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(apiKeyKey) as { value: string } | undefined
  if (!row) {
    return ''
  }

  try {
    const stored = JSON.parse(row.value) as StoredApiKey
    const availableStorage = canUseSafeStorage(storage) ? storage : null
    if (stored.storage === 'safeStorage' && availableStorage) {
      return availableStorage.decryptString(Buffer.from(stored.value, 'base64'))
    }
    if (stored.storage === 'local-fallback') {
      return decodeFallback(stored.value)
    }
  } catch {
    return ''
  }

  return ''
}

export function writeStoredApiKey(db: Database, apiKey: string, storage?: SecureKeyStorage | null) {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    clearStoredApiKey(db)
    return
  }

  const availableStorage = canUseSafeStorage(storage) ? storage : null
  const stored: StoredApiKey = availableStorage
    ? { storage: 'safeStorage', value: availableStorage.encryptString(trimmed).toString('base64') }
    : { storage: 'local-fallback', value: encodeFallback(trimmed) }

  db.prepare(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `,
  ).run(apiKeyKey, JSON.stringify(stored), Date.now())
}

export function clearStoredApiKey(db: Database) {
  db.prepare('DELETE FROM app_settings WHERE key = ?').run(apiKeyKey)
}

function migratePlaintextApiKey(db: Database, apiKey: string | undefined, storage?: SecureKeyStorage | null) {
  const trimmed = apiKey?.trim()
  if (!trimmed) {
    return
  }

  if (!readStoredApiKey(db, storage)) {
    writeStoredApiKey(db, trimmed, storage)
  }
}

export function readAiSettings(db: Database, storage?: SecureKeyStorage | null): AiSettings {
  const parsed = readRawSettings(db)
  migratePlaintextApiKey(db, parsed.apiKey, storage)

  const settings: AiSettings = {
    enabled: Boolean(parsed.enabled),
    baseUrl: parsed.baseUrl?.trim() ?? '',
    model: parsed.model?.trim() ?? '',
    sendSourceUrl: Boolean(parsed.sendSourceUrl),
    apiKeyConfigured: Boolean(readStoredApiKey(db, storage)),
  }

  writePublicSettings(db, settings)
  return settings
}

export function readAiRuntimeSettings(db: Database, storage?: SecureKeyStorage | null): AiRuntimeSettings {
  const publicSettings = readAiSettings(db, storage)
  const apiKey = readStoredApiKey(db, storage)
  return {
    ...publicSettings,
    apiKey,
    apiKeyConfigured: Boolean(apiKey),
  }
}

export function writeAiSettings(db: Database, settings: AiSettingsUpdateInput, storage?: SecureKeyStorage | null): AiSettings {
  if (settings.clearApiKey) {
    clearStoredApiKey(db)
  } else if (settings.apiKey !== undefined) {
    writeStoredApiKey(db, settings.apiKey, storage)
  }

  const nextSettings: AiSettings = {
    enabled: Boolean(settings.enabled),
    baseUrl: settings.baseUrl.trim(),
    model: settings.model.trim(),
    sendSourceUrl: Boolean(settings.sendSourceUrl),
    apiKeyConfigured: Boolean(readStoredApiKey(db, storage)),
  }

  writePublicSettings(db, nextSettings)
  return nextSettings
}
