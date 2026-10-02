import { useEffect, useRef, useState, type Dispatch, type FormEvent } from "react";
import {
  MAX_CONDITIONS,
  fieldId,
  newConditionId,
  type FieldErrors,
  type RuleForm,
  type RuleFormAction,
} from "../state/ruleForm";
import { ConditionRow } from "./ConditionRow";
import { FieldError } from "./FieldError";

interface Props {
  form: RuleForm;
  dispatch: Dispatch<RuleFormAction>;
  errors: FieldErrors;
  isLoading: boolean;
  onSubmit: () => void;
}

export function RuleEditor({ form, dispatch, errors, isLoading, onSubmit }: Props) {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // After adding or removing a row, move keyboard focus somewhere sensible
  // instead of letting it fall back to the top of the page.
  const [focusTarget, setFocusTarget] = useState<"newRow" | "addButton" | null>(null);

  useEffect(() => {
    if (focusTarget === "newRow") {
      const lastIndex = form.conditions.length - 1;
      document.getElementById(fieldId(`conditions[${lastIndex}].eventType`))?.focus();
    } else if (focusTarget === "addButton") {
      addButtonRef.current?.focus();
    }
    setFocusTarget(null);
  }, [focusTarget, form.conditions.length]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault(); // stay on the page; we send the request ourselves
    onSubmit();
  };

  const atLimit = form.conditions.length >= MAX_CONDITIONS;

  return (
    <form className="card" onSubmit={handleSubmit} noValidate aria-labelledby="definition-heading">
      <h2 id="definition-heading">Audience definition</h2>

      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Audience name</label>
          <input
            id="name"
            value={form.name}
            onChange={(e) => dispatch({ type: "setName", value: e.target.value })}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          <FieldError id="name-error" message={errors.name} />
        </div>

        <div className="field">
          <label htmlFor="asOf">Evaluate as of (UTC)</label>
          <input
            id="asOf"
            type="datetime-local"
            value={form.asOf}
            onChange={(e) => dispatch({ type: "setAsOf", value: e.target.value })}
            aria-invalid={errors.asOf ? true : undefined}
            aria-describedby={errors.asOf ? "asOf-hint asOf-error" : "asOf-hint"}
          />
          <p id="asOf-hint" className="hint">
            Time windows look back from this moment.
          </p>
          <FieldError id="asOf-error" message={errors.asOf} />
        </div>
      </div>

      <fieldset className="conditions" aria-describedby="conditions-hint">
        <legend>Conditions</legend>
        <p id="conditions-hint" className="hint">
          A user is included only if they match every condition.
        </p>

        {form.conditions.map((condition, index) => (
          <ConditionRow
            key={condition.id}
            index={index}
            condition={condition}
            errors={errors}
            onChange={(field, value) => dispatch({ type: "updateCondition", id: condition.id, field, value })}
            onRemove={() => {
              dispatch({ type: "removeCondition", id: condition.id });
              setFocusTarget("addButton");
            }}
          />
        ))}

        <FieldError id="conditions-error" message={errors.conditions} />

        <button
          ref={addButtonRef}
          type="button"
          className="button-secondary"
          onClick={() => {
            if (atLimit) return;
            dispatch({ type: "addCondition", id: newConditionId() });
            setFocusTarget("newRow");
          }}
          aria-describedby={atLimit ? "conditions-limit" : undefined}
        >
          + Add condition
        </button>
        {atLimit && (
          <p id="conditions-limit" className="hint">
            You can add up to {MAX_CONDITIONS} conditions.
          </p>
        )}
      </fieldset>

      <button type="submit" className="button-primary" aria-busy={isLoading}>
        {isLoading ? "Previewing…" : "Preview audience"}
      </button>
    </form>
  );
}
