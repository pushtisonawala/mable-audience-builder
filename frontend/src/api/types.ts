// The API contract, mirrored from the backend (backend/src/domain/types.ts and
// backend/src/http/errors.ts). If the contract changes, both sides change together.

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

export interface PreviewRequest {
  name: string;
  asOf: string;
  conditions: Condition[];
}

export interface Evidence extends Condition {
  observedCount: number;
}

export interface Member {
  anonymousId: string;
  evidence: Evidence[];
}

export interface PreviewResponse {
  name: string;
  asOf: string;
  total: number;
  members: Member[];
}

export interface ErrorDetail {
  path: string;
  message: string;
}

export interface ErrorBody {
  error: { code: string; message: string; details?: ErrorDetail[] };
}
