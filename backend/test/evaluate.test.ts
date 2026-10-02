import { describe, expect, it } from "vitest";
import { evaluateAudience, satisfies, type UserCounts } from "../src/audience/evaluate";
import { windowStartMs } from "../src/audience/window";
import type { Condition } from "../src/domain/types";

const viewedTwice: Condition = { eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 };
const noPurchase: Condition = { eventType: "purchase", operator: "exactly", count: 0, withinDays: 7 };

describe("satisfies", () => {
  it("at_least passes on the boundary and above, fails below", () => {
    expect(satisfies("at_least", 2, 1)).toBe(false);
    expect(satisfies("at_least", 2, 2)).toBe(true);
    expect(satisfies("at_least", 2, 3)).toBe(true);
  });

  it("exactly passes only on an equal count", () => {
    expect(satisfies("exactly", 2, 1)).toBe(false);
    expect(satisfies("exactly", 2, 2)).toBe(true);
    expect(satisfies("exactly", 2, 3)).toBe(false);
  });

  it("exactly 0 matches users with no events", () => {
    expect(satisfies("exactly", 0, 0)).toBe(true);
    expect(satisfies("exactly", 0, 1)).toBe(false);
  });
});

describe("evaluateAudience", () => {
  it("combines conditions with AND", () => {
    const users: UserCounts[] = [
      { anonymousId: "both", counts: [3, 0] },
      { anonymousId: "only_first", counts: [3, 1] },
      { anonymousId: "only_second", counts: [1, 0] },
      { anonymousId: "neither", counts: [0, 2] },
    ];

    const members = evaluateAudience([viewedTwice, noPurchase], users);

    expect(members.map((m) => m.anonymousId)).toEqual(["both"]);
  });

  it("returns per-condition evidence in condition order", () => {
    const members = evaluateAudience([viewedTwice, noPurchase], [{ anonymousId: "a", counts: [3, 0] }]);

    expect(members[0]?.evidence).toEqual([
      { eventType: "product_view", operator: "at_least", count: 2, withinDays: 7, observedCount: 3 },
      { eventType: "purchase", operator: "exactly", count: 0, withinDays: 7, observedCount: 0 },
    ]);
  });

  it("keeps separate evidence for two conditions on the same event type", () => {
    const recent: Condition = { eventType: "product_view", operator: "at_least", count: 1, withinDays: 1 };
    const members = evaluateAudience([recent, viewedTwice], [{ anonymousId: "a", counts: [1, 4] }]);

    expect(members[0]?.evidence.map((e) => e.observedCount)).toEqual([1, 4]);
  });

  it("returns an empty list when nobody matches or there are no users", () => {
    expect(evaluateAudience([viewedTwice], [{ anonymousId: "a", counts: [1] }])).toEqual([]);
    expect(evaluateAudience([viewedTwice], [])).toEqual([]);
  });
});

describe("windowStartMs", () => {
  it("looks back whole 24h days from asOf", () => {
    const asOf = Date.parse("2026-09-29T00:00:00.000Z");
    expect(windowStartMs(asOf, 7)).toBe(Date.parse("2026-09-22T00:00:00.000Z"));
    expect(windowStartMs(asOf, 1)).toBe(Date.parse("2026-09-28T00:00:00.000Z"));
  });
});
