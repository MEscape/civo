import { Temporal } from 'temporal-polyfill';

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
 * `DateTime` column. A `Date` is not accepted as-is. A column authored as a
 * Temporal type (the default) takes only a `Temporal.Instant`. Use the existing
 * polyfill directly so writes never fall back to incompatible ISO text on Node 24.
 */
export function dateToInstant(date: Date): Temporal.Instant {
  return Temporal.Instant.from(date.toISOString());
}
