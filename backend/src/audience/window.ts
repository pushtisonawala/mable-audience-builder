const DAY_MS = 24 * 60 * 60 * 1000;

// A condition's window is the half-open interval [asOf - withinDays, asOf):
// the start is included, asOf itself is excluded. Days are fixed 24h blocks in UTC.
export function windowStartMs(asOfMs: number, withinDays: number): number {
  return asOfMs - withinDays * DAY_MS;
}
