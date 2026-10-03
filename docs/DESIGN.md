# Design

## How the data is stored

All events live in one SQLite table called `events`:

| column | what it holds |
| --- | --- |
| `id` | row number |
| `anonymous_id` | a made-up user id like `anon_1001`. No names or personal data. |
| `event_type` | one of the 5 event types. The database refuses anything else (`CHECK` constraint). |
| `occurred_at` | when it happened, as milliseconds since 1970 (UTC) |

**Why store time as a number?** Comparing two numbers is exact. Text dates and timezones are easy to get wrong.

**The index** on `(anonymous_id, occurred_at, event_type)` holds exactly what the audience query reads, so the database never needs the full table.

**Who counts as a user?** There is no separate users table. A user is anyone with at least one event before `asOf`. This matters for rules like "purchased exactly 0 times": people who never bought anything have no purchase rows, so we have to start from everyone and treat "no rows" as a count of 0. People whose first event is after `asOf` don't exist yet from the preview's point of view, so they are left out.

**Test data** is fixed to 29 Sep 2026, and every test user is there for a reason, including edge cases.

## How a rule is evaluated

It happens in two steps.

**Step 1: the database counts** (`audience/repository.ts`).
One query groups events by user and counts matches for every condition at once:

```sql
SUM(CASE WHEN event_type = @type0 AND occurred_at >= @start0 THEN 1 ELSE 0 END) AS c0
```

For each event, this adds 1 if it matches the condition and 0 if it doesn't. `WHERE occurred_at < @asOf` drops anything at or after `asOf`.
User values are passed as parameters (`@type0`), never pasted into the SQL. Only the column names `c0`, `c1` are generated, from our own counter, so SQL injection isn't possible.

**Step 2: TypeScript decides** (`audience/evaluate.ts`).
A small function takes each user's counts and:

1. builds the **evidence**: each condition plus the number we actually saw ("needed at least 2, saw 3"),
2. checks each condition (`at_least` means `>=`, `exactly` means `===`),
3. keeps the user only if **every** condition passes (`.every()`, which is the AND).

**Why split it?** The database is good at counting, and the "who passes" rules sit in one tiny function with no database or clock, easy to test with made-up numbers. Adding `at_most` took one list entry plus one `case`; TypeScript complains if the case is missing.

Evidence repeats the whole condition, because two conditions can share an event type with different windows. Results are sorted by user id for stable output.

## The time window

For a condition with `withinDays: 7`, the window is:

**from (asOf minus 7 days), included, up to asOf, not included.**

- An event exactly at the start **counts**.
- An event exactly at `asOf` **doesn't count**.

This is the standard convention: each moment belongs to exactly one window, so nothing is counted twice or lost.

**Why `asOf` and not "now"?** With the server clock, the same rule would give a different answer tomorrow. With `asOf` in the request, the same question always gives the same answer; one test moves `asOf` by a day and checks exactly the expected users change.

**Why 24-hour blocks in UTC, not calendar days?** Calendar days depend on a timezone (Mumbai and New York differ), and the brief names none, so I used 24-hour UTC blocks and labelled the field "UTC" in the UI.

## Trade-off: what changes if the data gets big

Today the database returns counts for **every** user and TypeScript picks the matches. That's simple and fine for small data, but with millions of users memory grows with all users, not with the audience.

What I would change, in order:

1. **Filter in the database.** Add a `HAVING` clause built from the same operators, so only matching users leave the database. Test that it agrees with the TypeScript function.
2. **Return results in pages.** An operator needs the total and some examples, not millions of ids.
3. **Pre-count per day.** A table of events per user, type and day turns a 7-day window into 7 small sums. The catch: windows snap to whole UTC days, a product decision too.
4. **Move to PostgreSQL** for many concurrent users; the SQL is standard.
