# Mable Audience Builder

Define an audience from anonymous behavioural events and preview who matches it, and why.

- **`backend/`**: TypeScript + Express API that evaluates audience rules against synthetic events stored in SQLite.
- **`frontend/`**: TypeScript + React (Vite) screen where an operator builds a rule and previews the audience. All matching is done by the backend.
- **`docs/`**: [DESIGN.md](docs/DESIGN.md) (decisions and trade-offs) and [AI_USAGE.md](docs/AI_USAGE.md).

## Prerequisites

- **Node.js 20 or newer** (developed on Node 24) and **npm**
- No database server is needed: SQLite runs from a local file.

## Run it

Use two terminals.

**1. Backend** (http://localhost:4000)

```bash
cd backend
npm install
npm run seed      # creates backend/audience.db with synthetic events
npm run dev       # or: npm start
```

**2. Frontend** (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Run the tests

```bash
cd backend && npm test && npm run typecheck
cd frontend && npm test && npm run typecheck
```

- Backend: unit tests for the evaluator, integration tests against the seeded database, and HTTP tests for the API and its errors (`backend/test/`).
- Frontend: form-state tests and UI tests that stub only `fetch` (`frontend/src/**/*.test.ts(x)`).

## How to preview an audience

1. The form opens with the example rule already filled in: **product view at least 2 times in the last 7 days** and **purchase exactly 0 times in the last 7 days**, evaluated **as of 2026-09-29 00:00 UTC**.
2. Select **Preview audience**. You should see **7 matching users**. Each row shows, for every condition, what was required and the count observed.
3. Change the rule (add or remove conditions, change counts, windows or the as-of time) and preview again. Results are flagged as out of date as soon as you edit the rule.

`asOf` makes results reproducible: windows are measured back from it, never from the server's clock. The seed data is anchored to 2026-09-29, so keep that date to see the designed cases.

### Seed data

Every synthetic user is a deliberate case for the example rule (details in `backend/src/db/seedData.ts`):

| User | Case | Matches example rule |
| --- | --- | --- |
| anon_1001 | 3 product views, no purchase | yes |
| anon_1002 | exactly 2 views (`at_least` boundary) | yes |
| anon_1003 | views, but purchased inside the window | no |
| anon_1004 | only 1 view | no |
| anon_1005 | one view exactly at the window start (inclusive) | yes |
| anon_1006 | one view 1 ms before the window start | no |
| anon_1007 | one view exactly at `asOf` (exclusive) | no |
| anon_1008 | purchase 8 days ago (outside the window) | yes |
| anon_1009 | all events after `asOf` (not in the audience universe) | no |
| anon_1010 | page views only | no |
| anon_1011 | abandoned checkout | yes |
| anon_1012 | purchase exactly at `asOf` (not counted) | yes |
| anon_1013 | views more than 7 days ago | no |
| anon_1014 | 3 views in the last 2 days | yes |

### Calling the API directly

```bash
curl -s -X POST http://localhost:4000/v1/audiences/preview \
  -H 'Content-Type: application/json' \
  -d '{"name":"Viewed but not purchased","asOf":"2026-09-29T00:00:00.000Z",
       "conditions":[{"eventType":"product_view","operator":"at_least","count":2,"withinDays":7},
                     {"eventType":"purchase","operator":"exactly","count":0,"withinDays":7}]}'
```

- `GET /health` returns `{"status":"ok"}`.
- Every error response has the same shape: `{"error":{"code","message","details?":[{"path","message"}]}}`. Codes: `VALIDATION_ERROR` (400), `INVALID_JSON` (400), `PAYLOAD_TOO_LARGE` (413), `NOT_FOUND` (404), `INTERNAL_ERROR` (500).
- Request rules: 1 to 10 conditions; `eventType` is one of `page_view`, `product_view`, `add_to_cart`, `checkout_started`, `purchase`; `operator` is `at_least` or `exactly`; `count` is a whole number from 0 to 10000; `withinDays` is a whole number from 1 to 365; unknown fields are rejected.

## Configuration

| Variable | App | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | backend | `4000` | HTTP port |
| `DB_PATH` | backend | `backend/audience.db` | SQLite file |
| `CORS_ORIGIN` | backend | `http://localhost:5173` | Origin allowed to call the API from a browser |
| `VITE_API_BASE_URL` | frontend | `http://localhost:4000` | Backend base URL (copy `frontend/.env.example` to `.env.local`) |

## Logging

The backend writes one JSON line per request: request id, method, path, status and duration. The id is also returned in the `X-Request-Id` header and shown in the UI's error panel, so a failure on screen can be matched to its log line. Validation failures log only the field paths, never the submitted values; unexpected errors log the stack trace on the server only.

## Dependencies

| Package | Why |
| --- | --- |
| `express` | HTTP routing and middleware |
| `zod` | Request validation at the HTTP boundary, with per-field error paths |
| `better-sqlite3` | SQLite driver with prepared statements (all values are bound, never concatenated) |
| `react`, `react-dom` | UI |
| Dev: `typescript`, `tsx`, `vite`, `vitest`, `supertest`, `@testing-library/*`, `jsdom` | Type checking, running TypeScript directly, bundling, and tests |

No state-management or data-fetching library is used: form state is a `useReducer` reducer and server state is a small hook (`frontend/src/state/`).

`better-sqlite3` ships prebuilt binaries for common platforms. If `npm install` reports that it had to compile and failed, install your platform's build tools (for example, Xcode Command Line Tools on macOS) and run `npm install` again.

## Project structure

```
backend/
  src/
    domain/types.ts            event types, operators, Condition
    db/                        schema, seed data, seed script
    audience/                  window, SQL counting (repository), pure evaluator, service
    http/                      validation, error shape, logging
    app.ts, server.ts          Express app and entry point
  test/                        evaluator, integration and API tests
frontend/
  src/
    api/                       contract types and fetch client (request code)
    state/                     ruleForm reducer (form state), usePreview hook (server state)
    components/                RuleEditor, ConditionRow, PreviewResults
docs/
```
