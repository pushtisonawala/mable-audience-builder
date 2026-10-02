import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError, fetchAudiencePreview } from "../api/client";
import type { PreviewRequest, PreviewResponse } from "../api/types";

// Server state: the lifecycle of the last preview request. One union type means
// impossible combinations (e.g. "loading" with an error) can't be represented.
export type PreviewState =
  | { status: "idle" }
  | { status: "loading"; request: PreviewRequest }
  | { status: "success"; request: PreviewRequest; data: PreviewResponse }
  | { status: "error"; request: PreviewRequest; error: ApiRequestError };

export function usePreview() {
  const [state, setState] = useState<PreviewState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(async (request: PreviewRequest) => {
    // A newer preview replaces an in-flight one, so a slow old response can never
    // overwrite a newer result.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState({ status: "loading", request });
    try {
      const data = await fetchAudiencePreview(request, controller.signal);
      if (!controller.signal.aborted) setState({ status: "success", request, data });
    } catch (err) {
      if (controller.signal.aborted) return;
      const error =
        err instanceof ApiRequestError
          ? err
          : new ApiRequestError("network", "Something went wrong while contacting the server.");
      setState({ status: "error", request, error });
    }
  }, []);

  const retry = useCallback(() => {
    if (state.status === "error") void run(state.request);
  }, [state, run]);

  // Cancel any in-flight request when the component unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, run, retry };
}
