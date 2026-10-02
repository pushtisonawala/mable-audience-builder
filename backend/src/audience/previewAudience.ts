import type Database from "better-sqlite3";
import type { Condition } from "../domain/types";
import { evaluateAudience, type Member } from "./evaluate";
import { countEventsPerUser } from "./repository";

export interface PreviewRequest {
  name: string;
  asOf: string; // ISO-8601, already validated
  conditions: Condition[];
}

export interface PreviewResponse {
  name: string;
  asOf: string;
  total: number;
  members: Member[];
}

/** Evaluates an audience definition relative to `asOf` (never the server clock). */
export function previewAudience(db: Database.Database, request: PreviewRequest): PreviewResponse {
  const asOfMs = Date.parse(request.asOf);

  const userCounts = countEventsPerUser(db, request.conditions, asOfMs);
  const members = evaluateAudience(request.conditions, userCounts);

  return {
    name: request.name,
    asOf: new Date(asOfMs).toISOString(),
    total: members.length,
    members,
  };
}
