import Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema.js';

export type Db = Database.Database;

/**
 * Opens a SQLite connection and applies the schema.
 *
 * `foreign_keys` is OFF by default in SQLite, per connection — without this pragma
 * the ON DELETE CASCADE on actions.goalId silently does nothing.
 */
export function createDb(filename: string = process.env.DATABASE_PATH ?? 'career-os.db'): Db {
  const db = new Database(filename);

  db.pragma('foreign_keys = ON');
  if (filename !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.exec(SCHEMA_SQL);

  return db;
}
