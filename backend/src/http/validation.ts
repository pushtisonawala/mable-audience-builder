import { z } from "zod";
import type { PreviewRequest } from "../audience/previewAudience";
import { EVENT_TYPES, OPERATORS } from "../domain/types";
import { ApiError, type ErrorDetail } from "./errors";

// The rules every incoming preview request must follow. Unknown fields are
// rejected (.strict()) so typos like "withinDay" fail loudly instead of being ignored.
const conditionSchema = z
  .object({
    eventType: z.enum(EVENT_TYPES, { error: `must be one of: ${EVENT_TYPES.join(", ")}` }),
    operator: z.enum(OPERATORS, { error: `must be one of: ${OPERATORS.join(", ")}` }),
    count: z
      .number({ error: "must be a number" })
      .int({ error: "must be a whole number" })
      .min(0, { error: "must be at least 0" })
      .max(10_000, { error: "must be at most 10000" }),
    withinDays: z
      .number({ error: "must be a number" })
      .int({ error: "must be a whole number" })
      .min(1, { error: "must be at least 1" })
      .max(365, { error: "must be at most 365" }),
  })
  .strict();

const previewRequestSchema = z
  .object({
    name: z
      .string({ error: "must be a string" })
      .trim()
      .min(1, { error: "must not be empty" })
      .max(100, { error: "must be at most 100 characters" }),
    asOf: z.iso.datetime({ offset: true, error: "must be an ISO-8601 date-time, e.g. 2026-09-29T00:00:00.000Z" }),
    conditions: z
      .array(conditionSchema, { error: "must be a list of conditions" })
      .min(1, { error: "must contain at least 1 condition" })
      .max(10, { error: "must contain at most 10 conditions" }),
  })
  .strict();

/** ["conditions", 0, "count"] → "conditions[0].count" */
function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) return "body";
  return path
    .map((part, i) => (typeof part === "number" ? `[${part}]` : i === 0 ? String(part) : `.${String(part)}`))
    .join("");
}

/** Returns a typed request, or throws a 400 ApiError listing every invalid field. */
export function parsePreviewRequest(body: unknown): PreviewRequest {
  const result = previewRequestSchema.safeParse(body);

  if (!result.success) {
    const details: ErrorDetail[] = result.error.issues.map((issue) => ({
      path: formatPath(issue.path),
      message: issue.message,
    }));
    throw new ApiError(400, "VALIDATION_ERROR", "Request is invalid", details);
  }

  return result.data;
}
