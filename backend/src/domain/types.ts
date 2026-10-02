// Shared vocabulary for the audience domain.
// `as const` turns these arrays into readonly tuples, so TypeScript can derive
// precise union types from them (e.g. EventType = "page_view" | "product_view" | ...).

export const EVENT_TYPES = [
  "page_view",
  "product_view",
  "add_to_cart",
  "checkout_started",
  "purchase",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const OPERATORS = ["at_least", "exactly"] as const;

export type Operator = (typeof OPERATORS)[number];

export interface Condition {
  eventType: EventType;
  operator: Operator;
  count: number;
  withinDays: number;
}
