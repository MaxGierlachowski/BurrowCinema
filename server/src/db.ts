import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const dir = process.env.DATA_DIR ?? './data'
mkdirSync(dir, { recursive: true })

export const db = new DatabaseSync(join(dir, 'burrowcinema.db'))

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS draws (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    item_type TEXT NOT NULL,
    source_label TEXT NOT NULL,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    ended_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS participants (
    draw_id TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    PRIMARY KEY (draw_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS items (
    draw_id TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,
    source TEXT NOT NULL,
    item_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    year INTEGER,
    rating REAL,
    poster TEXT,
    PRIMARY KEY (draw_id, item_key)
  );

  CREATE TABLE IF NOT EXISTS swipes (
    draw_id TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    liked INTEGER NOT NULL,
    swiped_at INTEGER NOT NULL,
    PRIMARY KEY (draw_id, user_id, item_key)
  );

  CREATE INDEX IF NOT EXISTS participants_by_user ON participants (user_id);
`)

export function transaction(run: () => void) {
  db.exec('BEGIN')
  try {
    run()
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
