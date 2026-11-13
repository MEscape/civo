import { changedDays } from './templates';
import { timeOf, readableRanges } from './time';

import type { WeekDraft } from './draft';
import type { DayDto } from '../../dto/location-dto';

/** What changed about a day, in the terms a person says it: when it opens or closes, or that the day itself came or went. */
export type DayFact =
  | { readonly weekday: number; readonly kind: 'closed' }
  | { readonly weekday: number; readonly kind: 'opened'; readonly to: string }
  | {
      readonly weekday: number;
      readonly kind: 'opensEarlier' | 'opensLater';
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly weekday: number;
      readonly kind: 'closesEarlier' | 'closesLater';
      readonly from: string;
      readonly to: string;
    }
  | { readonly weekday: number; readonly kind: 'other' };

function boundsOf(day: DayDto): { readonly open: number; readonly close: number } | null {
  const ranges = readableRanges(day.intervals);
  return ranges.length === 0
    ? null
    : {
        open: Math.min(...ranges.map(({ start }) => start)),
        close: Math.max(...ranges.map(({ end }) => end)),
      };
}

/**
 * The facts of a change of week, one or two per changed day, from the data and nothing else: the
 * sentence "Friday now closes at 14:00 instead of 16:00" is made from `closesEarlier` with its two
 * times, never typed by hand.
 */
export function dayFacts(before: WeekDraft, after: WeekDraft): DayFact[] {
  return changedDays(before, after).flatMap(({ weekday, before: was, after: now }): DayFact[] => {
    const from = boundsOf(was);
    const to = boundsOf(now);
    if (from === null && to === null) {
      return [{ weekday, kind: 'other' }];
    }
    if (to === null) {
      return [{ weekday, kind: 'closed' }];
    }
    if (from === null) {
      return [{ weekday, kind: 'opened', to: `${timeOf(to.open)}–${timeOf(to.close)}` }];
    }
    const facts: DayFact[] = [];
    if (to.open !== from.open) {
      facts.push({
        weekday,
        kind: to.open < from.open ? 'opensEarlier' : 'opensLater',
        from: timeOf(from.open),
        to: timeOf(to.open),
      });
    }
    if (to.close !== from.close) {
      facts.push({
        weekday,
        kind: to.close < from.close ? 'closesEarlier' : 'closesLater',
        from: timeOf(from.close),
        to: timeOf(to.close),
      });
    }
    return facts.length === 0 ? [{ weekday, kind: 'other' }] : facts;
  });
}
