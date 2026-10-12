import { MS_PER_DAY } from '@lib/utils';

const ISO_DATE_LENGTH = 10;

/** `YYYY-MM-DD` days from today to `days` ahead, for a calendar that looks at the near future. */
export function upcomingRange(days: number): { readonly from: string; readonly to: string } {
  const now = Date.now();
  const dayOf = (instant: number) => new Date(instant).toISOString().slice(0, ISO_DATE_LENGTH);
  return { from: dayOf(now), to: dayOf(now + days * MS_PER_DAY) };
}
