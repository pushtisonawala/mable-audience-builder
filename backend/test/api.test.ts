import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type Database from "better-sqlite3";
import { createApp } from "../src/app";
import { openDatabase } from "../src/db/connection";
import { SEED_AS_OF, seedDatabase } from "../src/db/seedData";

const ORIGIN = "http://localhost:5173";

const validBody = {
  name: "Viewed but not purchased",
  asOf: SEED_AS_OF,
  conditions: [
    { eventType: "product_view", operator: "at_least", count: 2, withinDays: 7 },
    { eventType: "purchase", operator: "exactly", count: 0, withinDays: 7 },
  ],
};

let db: Database.Database;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  seedDatabase(db);
  app = createApp(db, { corsOrigin: ORIGIN });
});

const preview = (body: unknown) => request(app).post("/v1/audiences/preview").send(body as object);

/** Sends validBody with one condition field replaced. */
const withCondition = (patch: Record<string, unknown>) =>
  preview({ ...validBody, conditions: [{ ...validBody.conditions[0], ...patch }] });

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("POST /v1/audiences/preview", () => {
  it("returns the audience with per-user evidence", async () => {
    const res = await preview(validBody);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Viewed but not purchased");
    expect(res.body.asOf).toBe(SEED_AS_OF);
    expect(res.body.total).toBe(7);
    expect(res.body.members[0]).toEqual({
      anonymousId: "anon_1001",
      evidence: [
        { eventType: "product_view", operator: "at_least", count: 2, withinDays: 7, observedCount: 3 },
        { eventType: "purchase", operator: "exactly", count: 0, withinDays: 7, observedCount: 0 },
      ],
    });
  });

  it("returns 200 with an empty list when nobody matches", async () => {
    const res = await withCondition({ eventType: "purchase", count: 50 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, members: [] });
  });

  it("sets a request id and CORS headers", async () => {
    const res = await preview(validBody);
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers["access-control-allow-origin"]).toBe(ORIGIN);
  });

  it("answers the browser's CORS preflight", async () => {
    const res = await request(app).options("/v1/audiences/preview");
    expect(res.status).toBe(204);
  });
});

describe("validation errors", () => {
  it("lists every invalid field with its path", async () => {
    const res = await preview({
      ...validBody,
      conditions: [
        { eventType: "click", operator: "more_than", count: -1, withinDays: 7 },
        { eventType: "purchase", operator: "exactly", count: 0, withinDays: 0 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("Request is invalid");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual([
      "conditions[0].eventType",
      "conditions[0].operator",
      "conditions[0].count",
      "conditions[1].withinDays",
    ]);
  });

  it.each([
    ["missing name", { ...validBody, name: undefined }, "name"],
    ["blank name", { ...validBody, name: "   " }, "name"],
    ["bad asOf", { ...validBody, asOf: "yesterday" }, "asOf"],
    ["no conditions", { ...validBody, conditions: [] }, "conditions"],
    ["unknown field", { ...validBody, limit: 5 }, "body"],
  ])("rejects %s", async (_label, body, path) => {
    const res = await preview(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe(path);
  });

  it.each([
    ["fractional count", { count: 1.5 }, "conditions[0].count"],
    ["string count", { count: "2" }, "conditions[0].count"],
    ["withinDays over 365", { withinDays: 366 }, "conditions[0].withinDays"],
    ["unknown condition field", { withinDay: 7 }, "conditions[0]"],
  ])("rejects %s", async (_label, patch, path) => {
    const res = await withCondition(patch);
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe(path);
  });

  it("rejects malformed JSON", async () => {
    const res = await request(app)
      .post("/v1/audiences/preview")
      .set("Content-Type", "application/json")
      .send('{"name": "oops",');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON" } });
  });

  it("rejects a body that is too large", async () => {
    const res = await preview({ ...validBody, name: "x".repeat(20_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("other errors", () => {
  it("returns 404 in the standard shape for unknown routes", async () => {
    const res = await request(app).get("/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns a generic 500 without leaking internals when the database fails", async () => {
    db.close();
    const res = await preview(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Try again." } });
  });
});
