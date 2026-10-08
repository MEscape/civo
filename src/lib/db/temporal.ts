/**
 * Prisma 8 reads and writes `DateTime` columns as `Temporal.Instant`, not
 * `Date`. Only the member the read side needs is declared, so mappers do
 * not depend on the global `Temporal` type being available.
 */
export interface InstantRecord {
  readonly epochMilliseconds: number;
}

/** Converts a column read from Prisma 8 into the `Date` the domain uses. */
export function instantToDate(instant: InstantRecord): Date {
  return new Date(instant.epochMilliseconds);
}

/**
 * Converts a `Date` into the value Prisma 8 expects when WRITING a
 * `DateTime` column. A `Date` is not accepted as-is; ISO-8601 text is.
 */
export function dateToInstant(date: Date): string {
  return date.toISOString();
}
