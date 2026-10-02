import type { ChangeEvent } from "react";
import { EVENT_TYPES, OPERATORS } from "../api/types";
import { EVENT_TYPE_LABELS, OPERATOR_LABELS } from "../labels";
import { fieldId, type ConditionDraft, type ConditionField, type FieldErrors } from "../state/ruleForm";
import { FieldError } from "./FieldError";

interface Props {
  index: number;
  condition: ConditionDraft;
  errors: FieldErrors;
  onChange: (field: ConditionField, value: string) => void;
  onRemove: () => void;
}

export function ConditionRow({ index, condition, errors, onChange, onRemove }: Props) {
  const path = (field: ConditionField) => `conditions[${index}].${field}`;
  const id = (field: ConditionField) => fieldId(path(field));
  const errorId = (field: ConditionField) => `${id(field)}-error`;
  const number = index + 1;

  // Props shared by the two number inputs: accessible error wiring.
  const numberInputProps = (field: "count" | "withinDays") => ({
    id: id(field),
    type: "number",
    inputMode: "numeric" as const,
    step: 1,
    value: condition[field],
    onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(field, e.target.value),
    "aria-invalid": errors[path(field)] ? true : undefined,
    "aria-describedby": errors[path(field)] ? errorId(field) : undefined,
  });

  return (
    <fieldset className="condition">
      <legend>Condition {number}</legend>

      <div className="condition-fields">
        <div className="field">
          <label htmlFor={id("eventType")}>Event</label>
          <select
            id={id("eventType")}
            value={condition.eventType}
            onChange={(e) => onChange("eventType", e.target.value)}
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={id("operator")}>Occurs</label>
          <select
            id={id("operator")}
            value={condition.operator}
            onChange={(e) => onChange("operator", e.target.value)}
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </option>
            ))}
          </select>
        </div>

        <div className="field field-narrow">
          <label htmlFor={id("count")}>Times</label>
          <input {...numberInputProps("count")} min={0} max={10000} />
          <FieldError id={errorId("count")} message={errors[path("count")]} />
        </div>

        <div className="field field-narrow">
          <label htmlFor={id("withinDays")}>In the last (days)</label>
          <input {...numberInputProps("withinDays")} min={1} max={365} />
          <FieldError id={errorId("withinDays")} message={errors[path("withinDays")]} />
        </div>

        <button type="button" className="button-ghost remove" onClick={onRemove} aria-label={`Remove condition ${number}`}>
          Remove
        </button>
      </div>
    </fieldset>
  );
}
