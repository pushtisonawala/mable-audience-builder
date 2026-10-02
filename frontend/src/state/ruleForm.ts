import type { ErrorDetail, EventType, Operator, PreviewRequest } from "../api/types";

// Local form state: exactly what the operator is editing. Numbers are kept as the
// raw input strings so a field can be temporarily empty while typing; they are
// validated and converted only when building the request.

export interface ConditionDraft {
  id: string; // stable React key, never sent to the API
  eventType: EventType;
  operator: Operator;
  count: string;
  withinDays: string;
}

export interface RuleForm {
  name: string;
  asOf: string; // "YYYY-MM-DDTHH:mm", interpreted as UTC
  conditions: ConditionDraft[];
}

export type ConditionField = Exclude<keyof ConditionDraft, "id">;

export type RuleFormAction =
  | { type: "setName"; value: string }
  | { type: "setAsOf"; value: string }
  | { type: "addCondition"; id: string }
  | { type: "removeCondition"; id: string }
  | { type: "updateCondition"; id: string; field: ConditionField; value: string };

export const MAX_CONDITIONS = 10;

let idCounter = 0;
export const newConditionId = (): string => `condition-${++idCounter}`;

export const initialRuleForm: RuleForm = {
  name: "Viewed but not purchased",
  asOf: "2026-09-29T00:00",
  conditions: [
    { id: newConditionId(), eventType: "product_view", operator: "at_least", count: "2", withinDays: "7" },
    { id: newConditionId(), eventType: "purchase", operator: "exactly", count: "0", withinDays: "7" },
  ],
};

export function ruleFormReducer(state: RuleForm, action: RuleFormAction): RuleForm {
  switch (action.type) {
    case "setName":
      return { ...state, name: action.value };
    case "setAsOf":
      return { ...state, asOf: action.value };
    case "addCondition":
      if (state.conditions.length >= MAX_CONDITIONS) return state;
      return {
        ...state,
        conditions: [
          ...state.conditions,
          { id: action.id, eventType: "product_view", operator: "at_least", count: "1", withinDays: "7" },
        ],
      };
    case "removeCondition":
      return { ...state, conditions: state.conditions.filter((c) => c.id !== action.id) };
    case "updateCondition":
      return {
        ...state,
        conditions: state.conditions.map((c) =>
          c.id === action.id ? ({ ...c, [action.field]: action.value } as ConditionDraft) : c,
        ),
      };
  }
}

// ---- Validation ----
// Keys use the same path format as the backend's error details
// ("conditions[0].count"), so client and server errors display the same way.
export type FieldErrors = Record<string, string>;

const WHOLE_NUMBER = /^\d+$/;

function checkWholeNumber(raw: string, min: number, max: number): string | undefined {
  if (raw.trim() === "") return "Enter a number";
  if (!WHOLE_NUMBER.test(raw.trim())) return "Use a whole number";
  const n = Number(raw);
  if (n < min || n > max) return `Use a number from ${min} to ${max}`;
  return undefined;
}

export function validateRuleForm(form: RuleForm): FieldErrors {
  const errors: FieldErrors = {};

  if (form.name.trim() === "") errors.name = "Enter an audience name";
  else if (form.name.trim().length > 100) errors.name = "Use 100 characters or fewer";

  if (form.asOf === "" || Number.isNaN(Date.parse(`${form.asOf}Z`))) errors.asOf = "Enter a valid date and time";

  if (form.conditions.length === 0) errors.conditions = "Add at least one condition";

  form.conditions.forEach((c, i) => {
    const countError = checkWholeNumber(c.count, 0, 10_000);
    if (countError) errors[`conditions[${i}].count`] = countError;
    const daysError = checkWholeNumber(c.withinDays, 1, 365);
    if (daysError) errors[`conditions[${i}].withinDays`] = daysError;
  });

  return errors;
}

/** Converts a valid form into the API request. Call only when validateRuleForm returned no errors. */
export function toPreviewRequest(form: RuleForm): PreviewRequest {
  return {
    name: form.name.trim(),
    asOf: new Date(`${form.asOf}Z`).toISOString(),
    conditions: form.conditions.map((c) => ({
      eventType: c.eventType,
      operator: c.operator,
      count: Number(c.count),
      withinDays: Number(c.withinDays),
    })),
  };
}

export function fieldErrorsFromDetails(details: ErrorDetail[]): FieldErrors {
  return Object.fromEntries(details.map((d) => [d.path, d.message]));
}

/** "conditions[0].count" → "conditions-0-count", a safe HTML id for the field. */
export const fieldId = (path: string): string => path.replace(/[[\].]+/g, "-").replace(/-$/, "");
