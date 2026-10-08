import { addDays } from '@lib/utils';

/**
 * An instant `days` from `now`, moved to `hour` o'clock (UTC), in the canonical
 * string form the contracts require. Sample data is relative to the clock
 * so "upcoming" stays upcoming.
 */
export interface SamplePoint {
  readonly days: number;
  readonly hour: number;
}

export function sampleInstant(now: string, point: SamplePoint): string {
  const moment = addDays(now, point.days);
  moment.setUTCHours(point.hour, 0, 0, 0);
  return moment.toISOString();
}
