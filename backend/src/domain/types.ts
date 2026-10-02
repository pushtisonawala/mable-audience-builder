
export const EVENT_TYPES = [
  "page_view",
  "product_view",
  "add_to_cart",
  "checkout_started",
  "purchase",

] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const OPERATORS = ["at_least", "exactly","at_most"] as const;

export type Operator = (typeof OPERATORS)[number];

export interface Condition {
  eventType: EventType;
  operator: Operator;
  count: number;
  withinDays: number;
}
