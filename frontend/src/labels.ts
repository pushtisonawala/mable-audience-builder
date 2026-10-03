import type { EventType, Operator } from "./api/types";

// Human-readable labels for the API's machine values.

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  page_view: "Page view",
  product_view: "Product view",
  add_to_cart: "Add to cart",
  checkout_started: "Checkout started",
  purchase: "Purchase",
};

export const OPERATOR_LABELS: Record<Operator, string> = {
  at_least: "at least",
  exactly: "exactly",
  at_most: "at most",
};

const utcFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** "2026-09-29T00:00:00.000Z" → "29 Sept 2026, 00:00 UTC" */
export const formatUtc = (iso: string): string => `${utcFormatter.format(new Date(iso))} UTC`;
