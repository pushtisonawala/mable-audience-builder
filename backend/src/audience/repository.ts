import type Database from "better-sqlite3";
import type { Condition } from "../domain/types";
import type { UserCounts } from "./evaluate";
import { windowStartMs } from "./window";

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
