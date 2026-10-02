import express, { type NextFunction, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import { previewAudience } from "./audience/previewAudience";
import { ApiError, type ErrorBody } from "./http/errors";
import { log, requestLogger } from "./http/logger";
import { parsePreviewRequest } from "./http/validation";

export interface AppOptions {
  corsOrigin: string;
}

/**
 * Builds the Express app. The database is passed in (not imported) so tests can
 * use an in-memory copy and the server can use the real file.
 */
export function createApp(db: Database.Database, options: AppOptions) {
  const app = express();

  // 1. Log every request (id, method, path, status, duration).
  app.use(requestLogger);

  // 2. Allow the frontend's origin to call us from the browser (CORS).
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", options.corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
    if (req.method === "OPTIONS") {
      res.sendStatus(204); // browser "preflight" check: answer and stop here
      return;
    }
    next();
  });

  // 3. Parse JSON bodies, with a size cap so huge payloads are rejected early.
  app.use(express.json({ limit: "16kb" }));

  // ---- Routes ----

  app.get("/health", (_req: Request, res: Response) => {
    db.prepare("SELECT 1").get(); // throws (→ 500) if the database is unusable
    res.json({ status: "ok" });
  });

  app.post("/v1/audiences/preview", (req: Request, res: Response) => {
    const request = parsePreviewRequest(req.body); // throws a 400 ApiError if invalid
    res.json(previewAudience(db, request));
  });

  // ---- Fallbacks (order matters: these run only if nothing above responded) ----

  app.use((req: Request) => {
    throw new ApiError(404, "NOT_FOUND", `No route for ${req.method} ${req.path}`);
  });

  // Express recognises an error handler by its 4 parameters.
  app.use((err: unknown, _req: Request, res: Response<ErrorBody>, _next: NextFunction) => {
    const requestId = res.locals.requestId;

    if (err instanceof ApiError) {
      if (err.details) {
        // Log which fields failed, never the submitted values.
        log("warn", "validation failed", { requestId, fields: err.details.map((d) => d.path) });
      }
      res.status(err.status).json(err.toBody());
      return;
    }

    // Errors thrown by express.json() while reading the body.
    const type = (err as { type?: string }).type;
    if (type === "entity.parse.failed") {
      res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON" } });
      return;
    }
    if (type === "entity.too.large") {
      res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" } });
      return;
    }

    // Anything else is a bug or an infrastructure failure: log the details on the
    // server, but never send stack traces or internal messages to the client.
    log("error", "unhandled error", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Try again." } });
  });

  return app;
}
