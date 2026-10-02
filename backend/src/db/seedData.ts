import type Database from "better-sqlite3";
import type { EventType } from "../domain/types";

// All seed timestamps are defined relative to this fixed instant, so the data and the
// expected results never drift. Preview with this asOf to reproduce the cases below.
export const SEED_AS_OF = "2026-09-29T00:00:00.000Z";

const AS_OF_MS = Date.parse(SEED_AS_OF);
const DAY_MS = 24 * 60 * 60 * 1000;

/** A point in time `days` (may be fractional) before SEED_AS_OF. Negative = after asOf. */
const daysBefore = (days: number): number => AS_OF_MS - days * DAY_MS;

export interface SeedEvent {
  anonymousId: string;
  eventType: EventType;
  occurredAt: number; // epoch ms
}

type EventSpec = [EventType, number];

const user = (anonymousId: string, events: EventSpec[]): SeedEvent[] =>
  events.map(([eventType, occurredAt]) => ({ anonymousId, eventType, occurredAt }));

// Each user is a deliberate case for the example rule
//   product_view at_least 2 within 7 days AND purchase exactly 0 within 7 days
// evaluated at SEED_AS_OF. The 7-day window is [asOf - 7d, asOf).
export const SEED_EVENTS: SeedEvent[] = [
  // anon_1001 — clear match: 3 product views, no purchase.
  ...user("anon_1001", [
    ["page_view", daysBefore(6.2)],
    ["product_view", daysBefore(6)],
    ["product_view", daysBefore(4)],
    ["product_view", daysBefore(2)],
  ]),

  // anon_1002 — match on the at_least boundary: exactly 2 product views.
  ...user("anon_1002", [
    ["product_view", daysBefore(5)],
    ["product_view", daysBefore(1)],
  ]),

  // anon_1003 — no match: enough views, but purchased inside the window.
  ...user("anon_1003", [
    ["product_view", daysBefore(5)],
    ["product_view", daysBefore(4)],
    ["product_view", daysBefore(3.5)],
    ["add_to_cart", daysBefore(3.2)],
    ["checkout_started", daysBefore(3.1)],
    ["purchase", daysBefore(3)],
  ]),

  // anon_1004 — no match: only 1 product view.
  ...user("anon_1004", [
    ["page_view", daysBefore(2.5)],
    ["product_view", daysBefore(2)],
  ]),

  // anon_1005 — match via window START boundary: one view at exactly asOf - 7d
  // (start is inclusive) plus one more view = 2.
  ...user("anon_1005", [
    ["product_view", daysBefore(7)],
    ["product_view", daysBefore(3)],
  ]),

  // anon_1006 — no match: one view 1 ms before the window starts (outside),
  // so only 1 view counts.
  ...user("anon_1006", [
    ["product_view", daysBefore(7) - 1],
    ["product_view", daysBefore(3)],
  ]),

  // anon_1007 — no match via window END boundary: one view at exactly asOf
  // (end is exclusive), so only 1 view counts.
  ...user("anon_1007", [
    ["product_view", daysBefore(2)],
    ["product_view", daysBefore(0)],
  ]),

  // anon_1008 — match: purchased, but 8 days ago (outside the window), then came
  // back and viewed twice.
  ...user("anon_1008", [
    ["purchase", daysBefore(8)],
    ["product_view", daysBefore(5)],
    ["product_view", daysBefore(4)],
  ]),

  // anon_1009 — not in the audience universe at all: every event is AFTER asOf.
  // Proves the preview ignores the "future" relative to asOf.
  ...user("anon_1009", [
    ["product_view", daysBefore(-1)],
    ["product_view", daysBefore(-1.5)],
    ["product_view", daysBefore(-2)],
  ]),

  // anon_1010 — no match: browses pages but never views a product.
  ...user("anon_1010", [
    ["page_view", daysBefore(4)],
    ["page_view", daysBefore(3)],
    ["page_view", daysBefore(1)],
  ]),

  // anon_1011 — match: abandoned checkout (cart + checkout started, no purchase).
  ...user("anon_1011", [
    ["product_view", daysBefore(3)],
    ["product_view", daysBefore(2.9)],
    ["add_to_cart", daysBefore(2.8)],
    ["checkout_started", daysBefore(2.7)],
  ]),

  // anon_1012 — match: purchase at exactly asOf (end exclusive) does NOT count.
  ...user("anon_1012", [
    ["product_view", daysBefore(4)],
    ["product_view", daysBefore(3)],
    ["purchase", daysBefore(0)],
  ]),

  // anon_1013 — no match: viewed twice, but 10+ days ago (outside the window).
  ...user("anon_1013", [
    ["product_view", daysBefore(11)],
    ["product_view", daysBefore(10)],
  ]),
];

/** Replaces all events with SEED_EVENTS. Runs in one transaction: all or nothing. */
export function seedDatabase(db: Database.Database): number {
  const insert = db.prepare(
    "INSERT INTO events (anonymous_id, event_type, occurred_at) VALUES (?, ?, ?)",
  );

  const run = db.transaction((events: SeedEvent[]) => {
    db.prepare("DELETE FROM events").run();
    for (const e of events) {
      insert.run(e.anonymousId, e.eventType, e.occurredAt);
    }
  });

  run(SEED_EVENTS);
  return SEED_EVENTS.length;
}
