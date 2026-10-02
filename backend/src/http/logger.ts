import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type Level = "info" | "warn" | "error";

// One JSON object per line: easy to read locally and easy to search/parse later.
// Silent under tests so test output stays readable.
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

/**
 * Gives every request an id (also returned as the X-Request-Id header) and logs
 * method, path, status and duration when the response finishes. Request bodies
 * are deliberately NOT logged.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  const startedAt = performance.now();

  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const level: Level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    log(level, "request", {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });

  next();
}
