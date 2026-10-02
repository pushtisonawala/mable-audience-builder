import type { Evidence, PreviewResponse } from "../api/types";
import { EVENT_TYPE_LABELS, OPERATOR_LABELS, formatUtc } from "../labels";
import type { PreviewState } from "../state/usePreview";

interface Props {
  state: PreviewState;
  isStale: boolean;
  onRetry: () => void;
}

export function PreviewResults({ state, isStale, onRetry }: Props) {
  return (
    <section className="card" aria-labelledby="results-heading">
      <h2 id="results-heading">Preview</h2>

      {/* Screen readers announce changes to this region (loading, result count). */}
      <p className="status" role="status" aria-live="polite">
        {statusText(state)}
      </p>

      {state.status === "error" && <ErrorPanel state={state} onRetry={onRetry} />}

      {state.status === "success" && (
        <>
          {isStale && (
            <p className="notice">The rule has changed since this preview. Run the preview again to update it.</p>
          )}
          <Results data={state.data} />
        </>
      )}
    </section>
  );
}

function statusText(state: PreviewState): string {
  switch (state.status) {
    case "idle":
      return "Build a rule and select Preview audience to see who matches.";
    case "loading":
      return "Loading audience…";
    case "success":
      return `${state.data.total} ${state.data.total === 1 ? "user matches" : "users match"}.`;
    case "error":
      return "";
  }
}

function ErrorPanel({ state, onRetry }: { state: Extract<PreviewState, { status: "error" }>; onRetry: () => void }) {
  const { error } = state;
  const isValidation = error.code === "VALIDATION_ERROR";

  return (
    <div className="error-panel" role="alert">
      <p className="error-title">{isValidation ? "Some fields need fixing" : "Couldn't load the preview"}</p>
      <p>{isValidation ? "Fix the highlighted fields and preview again." : error.message}</p>
      {error.requestId && <p className="hint">Reference: {error.requestId}</p>}
      {error.retryable && (
        <button type="button" className="button-secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

function Results({ data }: { data: PreviewResponse }) {
  return (
    <>
      <div className="summary">
        <span className="summary-number">{data.total}</span>
        <span>
          matching {data.total === 1 ? "user" : "users"} for <strong>{data.name}</strong>, as of {formatUtc(data.asOf)}
        </span>
      </div>

      {data.total === 0 ? (
        <div className="empty">
          <p className="empty-title">No users match this rule</p>
          <p className="hint">Try a longer time window, a lower count, or fewer conditions.</p>
        </div>
      ) : (
        <table className="members">
          <caption className="visually-hidden">Matching users and the evidence for each condition</caption>
          <thead>
            <tr>
              <th scope="col">Anonymous ID</th>
              <th scope="col">Why they match</th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((member) => (
              <tr key={member.anonymousId}>
                <td>
                  <code>{member.anonymousId}</code>
                </td>
                <td>
                  <ul className="evidence">
                    {member.evidence.map((e, i) => (
                      <li key={i}>{describeEvidence(e)}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/** "Product view: at least 2 in the last 7 days — observed 3" */
function describeEvidence(e: Evidence): string {
  const days = e.withinDays === 1 ? "day" : "days";
  return `${EVENT_TYPE_LABELS[e.eventType]}: ${OPERATOR_LABELS[e.operator]} ${e.count} in the last ${e.withinDays} ${days} — observed ${e.observedCount}`;
}
