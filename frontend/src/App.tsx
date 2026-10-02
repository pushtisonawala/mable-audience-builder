import { useReducer, useState } from "react";
import { RuleEditor } from "./components/RuleEditor";
import { PreviewResults } from "./components/PreviewResults";
import {
  fieldErrorsFromDetails,
  fieldId,
  initialRuleForm,
  ruleFormReducer,
  toPreviewRequest,
  validateRuleForm,
  type RuleForm,
} from "./state/ruleForm";
import { usePreview } from "./state/usePreview";

// The screen wires three separate pieces together:
//   form state    → ruleFormReducer (what the operator is editing)
//   server state  → usePreview      (the last request and its result)
//   request code  → api/client.ts   (used only inside usePreview)
export function App() {
  const [form, dispatch] = useReducer(ruleFormReducer, initialRuleForm);
  const { state: preview, run, retry } = usePreview();

  // Client-side errors are shown only after the first submit, not while typing.
  const [showClientErrors, setShowClientErrors] = useState(false);
  // The form exactly as it was when the current preview was requested. The reducer
  // returns a new object on every edit, so `form !== submittedForm` means "edited since".
  const [submittedForm, setSubmittedForm] = useState<RuleForm | null>(null);

  const clientErrors = validateRuleForm(form);
  const isStale = submittedForm !== null && form !== submittedForm;
  const serverErrors =
    preview.status === "error" && !isStale ? fieldErrorsFromDetails(preview.error.details) : {};
  const errors = { ...serverErrors, ...(showClientErrors ? clientErrors : {}) };

  const handleSubmit = () => {
    setShowClientErrors(true);
    const firstInvalid = Object.keys(clientErrors)[0];
    if (firstInvalid) {
      document.getElementById(fieldId(firstInvalid))?.focus();
      return; // invalid rules are never sent
    }
    setSubmittedForm(form);
    void run(toPreviewRequest(form));
  };

  return (
    <main className="page">
      <header className="page-header">
        <h1>Audience builder</h1>
        <p className="hint">Define a rule from anonymous behaviour and preview who matches.</p>
      </header>

      <div className="layout">
        <RuleEditor
          form={form}
          dispatch={dispatch}
          errors={errors}
          isLoading={preview.status === "loading"}
          onSubmit={handleSubmit}
        />
        <PreviewResults state={preview} isStale={isStale} onRetry={retry} />
      </div>
    </main>
  );
}
