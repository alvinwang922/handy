import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS repairs (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      repair_id TEXT NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_repair_id ON events(repair_id, sequence);`);
  let closed = false;
  return {
    transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const result = fn(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    list: () => db.prepare('SELECT data FROM repairs ORDER BY rowid DESC').all().map(r => JSON.parse(r.data)),
    get(id) { const row = db.prepare('SELECT data FROM repairs WHERE id = ?').get(id); return row ? JSON.parse(row.data) : null; },
    put(repair) { db.prepare('INSERT INTO repairs (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data').run(repair.id, JSON.stringify(repair)); },
    append(event) { db.prepare('INSERT INTO events (repair_id, data) VALUES (?, ?)').run(event.repairId, JSON.stringify(event)); },
    events(id) {
      const rows = id ? db.prepare('SELECT sequence, data FROM events WHERE repair_id = ? ORDER BY sequence').all(id)
        : db.prepare('SELECT sequence, data FROM events ORDER BY sequence').all();
      return rows.map(row => ({ ...JSON.parse(row.data), sequence: row.sequence }));
    },
    clear() { db.exec('DELETE FROM repairs'); },
    close() { if (!closed) { db.close(); closed = true; } }
  };
}
