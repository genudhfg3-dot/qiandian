import type { Database } from 'better-sqlite3'

const MIGRATION_VERSION = 3

function hasColumn(db: Database, table: string, column: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === column)
}

function addColumnIfMissing(db: Database, table: string, column: string, definition: string) {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

export function runMigrations(db: Database) {
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY,
      title TEXT,
      content_md TEXT NOT NULL,
      source_app TEXT,
      source_title TEXT,
      source_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY,
      entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tag_categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES tag_categories(id) ON DELETE SET NULL,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      UNIQUE(parent_id, name)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category_id INTEGER REFERENCES tag_categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (entry_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
      title,
      content_md,
      content='entries',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
      INSERT INTO entries_fts(rowid, title, content_md)
      VALUES (new.id, new.title, new.content_md);
    END;

    CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
      INSERT INTO entries_fts(entries_fts, rowid, title, content_md)
      VALUES ('delete', old.id, old.title, old.content_md);
    END;

    CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
      INSERT INTO entries_fts(entries_fts, rowid, title, content_md)
      VALUES ('delete', old.id, old.title, old.content_md);
      INSERT INTO entries_fts(rowid, title, content_md)
      VALUES (new.id, new.title, new.content_md);
    END;
  `)

  addColumnIfMissing(db, 'entries', 'summary', 'TEXT')
  addColumnIfMissing(db, 'entries', 'metadata_status', "TEXT DEFAULT 'local'")
  addColumnIfMissing(db, 'entries', 'metadata_updated_at', 'INTEGER')
  // 老数据一律视为"手动标题"（0），避免升级后 AI 悄悄改动用户已经确认过的标题
  addColumnIfMissing(db, 'entries', 'title_is_auto', 'INTEGER NOT NULL DEFAULT 0')

  db.exec(`
    INSERT OR IGNORE INTO schema_migrations (version, applied_at)
    VALUES (1, strftime('%s', 'now') * 1000);

    INSERT OR IGNORE INTO schema_migrations (version, applied_at)
    VALUES (${MIGRATION_VERSION}, strftime('%s', 'now') * 1000);
  `)
}
