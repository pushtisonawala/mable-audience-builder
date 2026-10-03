import type { Condition, Operator } from "../domain/types";

// Event counts for one user. counts[i] is the number of events matching
// conditions[i] (its event type, inside its window).
export interface UserCounts {
  anonymousId: string;
  counts: number[];
}

// The condition plus what we actually saw, so an operator can read
// "needed at least 2, observed 3" without re-deriving anything.
export interface Evidence extends Condition {
  observedCount: number;
}

export interface Member {
  anonymousId: string;
  evidence: Evidence[];
}

export function satisfies(operator: Operator, required: number, observed: number): boolean {
  switch (operator) {
    case "at_least":
      return observed >= required;
    case "exactly":
      return observed === required;
    case "at_most":
      return observed <= required;
  }
}

/**
 * Pure audience logic: no database, no clock. A user is a member only if
 * they satisfy EVERY condition (AND). Input order is preserved.
 */
export function evaluateAudience(conditions: Condition[], users: UserCounts[]): Member[] {
  const members: Member[] = [];

  for (const user of users) {
    const evidence: Evidence[] = conditions.map((condition, i) => ({
      ...condition,
      observedCount: user.counts[i] ?? 0,
    }));

    const isMember = evidence.every((e) => satisfies(e.operator, e.count, e.observedCount));

    if (isMember) {
      members.push({ anonymousId: user.anonymousId, evidence });
    }
  }

  return members;
}
