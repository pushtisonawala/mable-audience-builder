import { describe, expect, it } from "vitest";
import {
  fieldErrorsFromDetails,
  fieldId,
  initialRuleForm,
  MAX_CONDITIONS,
  ruleFormReducer,
  toPreviewRequest,
  validateRuleForm,
  type RuleForm,
} from "./ruleForm";

const firstId = initialRuleForm.conditions[0]!.id;

describe("ruleFormReducer", () => {
  it("adds a condition with sensible defaults", () => {
    const next = ruleFormReducer(initialRuleForm, { type: "addCondition", id: "new" });
    expect(next.conditions).toHaveLength(3);
    expect(next.conditions[2]).toMatchObject({ id: "new", eventType: "product_view", operator: "at_least" });
  });

  it("stops adding at the maximum", () => {
    let form: RuleForm = initialRuleForm;
    for (let i = 0; i < 20; i++) form = ruleFormReducer(form, { type: "addCondition", id: `c${i}` });
    expect(form.conditions).toHaveLength(MAX_CONDITIONS);
  });

  it("removes a condition by id", () => {
    const next = ruleFormReducer(initialRuleForm, { type: "removeCondition", id: firstId });
    expect(next.conditions.map((c) => c.eventType)).toEqual(["purchase"]);
  });

  it("updates one field of one condition without touching the others", () => {
    const next = ruleFormReducer(initialRuleForm, { type: "updateCondition", id: firstId, field: "count", value: "5" });
    expect(next.conditions[0]?.count).toBe("5");
    expect(next.conditions[1]).toBe(initialRuleForm.conditions[1]);
  });
});

describe("validateRuleForm", () => {
  it("accepts the default rule", () => {
    expect(validateRuleForm(initialRuleForm)).toEqual({});
  });

  it("reports errors using the API's field paths", () => {
    const form: RuleForm = {
      name: "  ",
      asOf: "",
      conditions: [{ ...initialRuleForm.conditions[0]!, count: "1.5", withinDays: "0" }],
    };
    expect(validateRuleForm(form)).toEqual({
      name: "Enter an audience name",
      asOf: "Enter a valid date and time",
      "conditions[0].count": "Use a whole number",
      "conditions[0].withinDays": "Use a number from 1 to 365",
    });
  });

  it("requires at least one condition", () => {
    expect(validateRuleForm({ ...initialRuleForm, conditions: [] })).toEqual({
      conditions: "Add at least one condition",
    });
  });
});

describe("toPreviewRequest", () => {
  it("converts the form into the API request (UTC asOf, numeric fields, no ids)", () => {
    expect(toPreviewRequest(initialRuleForm)).toEqual({
      name: "Viewed but not purchased",
      asOf: "2026-09-29T00:00:00.000Z",
      conditions: [
        { eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 },
        { eventType: "purchase", operator: "exactly", count: 0, withinDays: 7 },
      ],
    });
  });
});

describe("server error helpers", () => {
  it("maps API error details to field errors and safe ids", () => {
    expect(fieldErrorsFromDetails([{ path: "conditions[1].count", message: "must be at least 0" }])).toEqual({
      "conditions[1].count": "must be at least 0",
    });
    expect(fieldId("conditions[1].count")).toBe("conditions-1-count");
  });
});
