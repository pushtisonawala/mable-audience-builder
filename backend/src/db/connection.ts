import Database from "better-sqlite3";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY,
    anonymous_id TEXT    NOT NULL,
    event_type   TEXT    NOT NULL CHECK (event_type IN (
                   'page_view', 'product_view', 'add_to_cart', 'checkout_started', 'purchase'
                 )),
    occurred_at  INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_events_user_time_type
    ON events (anonymous_id, occurred_at, event_type);
`;

export function openDatabase(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.exec(SCHEMA);
  return db;
}
