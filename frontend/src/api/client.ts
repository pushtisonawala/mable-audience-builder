import { API_BASE_URL } from "../config";
import type { ErrorBody, ErrorDetail, PreviewRequest, PreviewResponse } from "./types";

/**
 * Every failure from the API client is one of these, so the UI handles a single type.
 *  - "network": the request never got an HTTP response (server down, CORS, offline)
 *  - "http":    the server answered with an error status (4xx/5xx)
 */
export class ApiRequestError extends Error {
  constructor(
    readonly kind: "network" | "http",
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly details: ErrorDetail[] = [],
    readonly requestId?: string,
  ) {
    super(message);
  }

  /** Retrying can help for network failures and server errors, not for invalid input. */
  get retryable(): boolean {
    return this.kind === "network" || (this.status ?? 0) >= 500;
  }
}

export async function fetchAudiencePreview(
  request: PreviewRequest,
  signal?: AbortSignal,
): Promise<PreviewResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/v1/audiences/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err; // cancelled on purpose; the caller ignores it
    throw new ApiRequestError(
      "network",
      `Couldn't reach the audience service at ${API_BASE_URL}. Check that the backend is running.`,
    );
  }

  const requestId = response.headers.get("X-Request-Id") ?? undefined;
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ErrorBody | null)?.error;
    throw new ApiRequestError(
      "http",
      error?.message ?? `The server responded with status ${response.status}.`,
      response.status,
      error?.code,
      error?.details ?? [],
      requestId,
    );
  }

  return body as PreviewResponse;
}
