import type Database from "better-sqlite3";
import type { Condition } from "../domain/types";
import type { UserCounts } from "./evaluate";
import { windowStartMs } from "./window";

/**
 * Counts, for every user in the audience universe, how many events match each
 * condition. The universe is every anonymous_id with at least one event before
 * asOf, so users with zero matching events still appear (with a count of 0).
 *
 * For two conditions the generated SQL looks like:
 *
 *   SELECT anonymous_id,
 *     SUM(CASE WHEN event_type = @type0 AND occurred_at >= @start0 THEN 1 ELSE 0 END) AS c0,
 *     SUM(CASE WHEN event_type = @type1 AND occurred_at >= @start1 THEN 1 ELSE 0 END) AS c1
 *   FROM events
 *   WHERE occurred_at < @asOf
 *   GROUP BY anonymous_id
 *   ORDER BY anonymous_id
 *
 * The WHERE clause applies every window's exclusive end (asOf); each CASE applies
 * its own window's inclusive start. All values are bound as named parameters;
 * only the column aliases (c0, c1, ...) are generated, from array indexes.
 */
export function countEventsPerUser(
  db: Database.Database,
  conditions: Condition[],
  asOfMs: number,
): UserCounts[] {
  const columns = conditions.map(
    (_, i) =>
      `SUM(CASE WHEN event_type = @type${i} AND occurred_at >= @start${i} THEN 1 ELSE 0 END) AS c${i}`,
  );

  const sql = `
    SELECT anonymous_id, ${columns.join(",\n           ")}
    FROM events
    WHERE occurred_at < @asOf
    GROUP BY anonymous_id
    ORDER BY anonymous_id
  `;

  const params: Record<string, string | number> = { asOf: asOfMs };
  conditions.forEach((condition, i) => {
    params[`type${i}`] = condition.eventType;
    params[`start${i}`] = windowStartMs(asOfMs, condition.withinDays);
  });

  const rows = db.prepare(sql).all(params) as Array<Record<string, string | number>>;

  return rows.map((row) => ({
    anonymousId: String(row.anonymous_id),
    counts: conditions.map((_, i) => Number(row[`c${i}`])),
  }));
}
