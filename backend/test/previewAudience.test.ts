import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { openDatabase } from "../src/db/connection";
import { SEED_AS_OF, seedDatabase } from "../src/db/seedData";
import { previewAudience } from "../src/audience/previewAudience";
import type { Condition } from "../src/domain/types";

// Integration tests: real SQL against an in-memory copy of the seed data.
// The expected IDs come from the per-user comments in src/db/seedData.ts.

const viewedTwice: Condition = { eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 };
const noPurchase: Condition = { eventType: "purchase", operator: "exactly", count: 0, withinDays: 7 };

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
});

const ids = (conditions: Condition[], asOf = SEED_AS_OF) =>
  previewAudience(db, { name: "test", asOf, conditions }).members.map((m) => m.anonymousId);

describe("previewAudience (seeded database)", () => {
  it("finds users who viewed at least twice but did not purchase in 7 days", () => {
    const result = previewAudience(db, {
      name: "Viewed but not purchased",
      asOf: SEED_AS_OF,
      conditions: [viewedTwice, noPurchase],
    });

    expect(result.total).toBe(7);
    expect(result.members.map((m) => m.anonymousId)).toEqual([
      "anon_1001",
      "anon_1002",
      "anon_1005",
      "anon_1008",
      "anon_1011",
      "anon_1012",
      "anon_1014",
    ]);
    expect(result.members[0]?.evidence.map((e) => e.observedCount)).toEqual([3, 0]);
  });

  it("includes an event exactly at the window start (anon_1005)", () => {
    expect(ids([viewedTwice, noPurchase])).toContain("anon_1005");
  });

  it("excludes an event 1 ms before the window start (anon_1006)", () => {
    expect(ids([viewedTwice, noPurchase])).not.toContain("anon_1006");
  });

  it("excludes events exactly at asOf (anon_1007 view, anon_1012 purchase)", () => {
    const result = ids([viewedTwice, noPurchase]);
    expect(result).not.toContain("anon_1007");
    expect(result).toContain("anon_1012");
  });

  it("matches users with no events of a type at all for exactly 0", () => {
    const result = ids([noPurchase]);

    // Universe = 13 users with an event before asOf; only anon_1003 purchased in the window.
    expect(result).toHaveLength(12);
    expect(result).not.toContain("anon_1003");
    expect(result).toContain("anon_1010"); // has never had a purchase row
  });

  it("ignores users whose events are all after asOf (anon_1009)", () => {
    expect(ids([noPurchase])).not.toContain("anon_1009");
  });

  it("supports exactly with a non-zero count", () => {
    const viewedExactlyThree: Condition = { ...viewedTwice, operator: "exactly", count: 3 };
    expect(ids([viewedExactlyThree])).toEqual(["anon_1001", "anon_1003", "anon_1014"]);
  });

  it("evaluates each condition in its own window, even for the same event type", () => {
    const viewedToday: Condition = { eventType: "product_view", operator: "at_least", count: 1, withinDays: 1 };
    const viewedThreeTimes: Condition = { ...viewedTwice, count: 3 };

    const result = previewAudience(db, { name: "t", asOf: SEED_AS_OF, conditions: [viewedToday, viewedThreeTimes] });

    expect(result.members.map((m) => m.anonymousId)).toEqual(["anon_1014"]);
    expect(result.members[0]?.evidence.map((e) => e.observedCount)).toEqual([1, 3]);
  });

  it("is reproducible: results depend on asOf, not the server clock", () => {
    // One day later the window becomes [Sep 23, Sep 30): anon_1005's start-boundary view
    // drops out, anon_1007's view at Sep 29 now counts, anon_1012's purchase now counts.
    expect(ids([viewedTwice, noPurchase], "2026-09-30T00:00:00.000Z")).toEqual([
      "anon_1001",
      "anon_1002",
      "anon_1007",
      "anon_1008",
      "anon_1011",
      "anon_1014",
    ]);
  });

  it("returns an empty audience when nobody matches", () => {
    const result = previewAudience(db, {
      name: "nobody",
      asOf: SEED_AS_OF,
      conditions: [{ eventType: "purchase", operator: "at_least", count: 5, withinDays: 7 }],
    });
    expect(result).toMatchObject({ total: 0, members: [] });
  });
});
