import Database from "better-sqlite3";

// occurred_at is stored as epoch milliseconds (UTC). Integer comparisons are exact
// and avoid any string/timezone formatting pitfalls.
//
// The event_type list must stay in sync with EVENT_TYPES in src/domain/types.ts.
// The CHECK constraint means the database itself rejects unknown event types.
//
// The index is "covering" for the audience query: that query groups by
// anonymous_id, filters on occurred_at and reads event_type, and all three live in
// the index, so SQLite can answer it without reading the table rows at all.
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

/** Opens (or creates) the SQLite database and makes sure the schema exists. */
export function openDatabase(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.exec(SCHEMA);
  return db;
}
