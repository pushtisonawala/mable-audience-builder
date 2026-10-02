// Every error response has this one shape, so the frontend needs a single handler:
//   { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export interface ErrorDetail {
  path: string; // which field is wrong, e.g. "conditions[0].count"
  message: string;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

/** An error we expect and know how to describe to the client (4xx). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
  }

  toBody(): ErrorBody {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}
