import { canonicalDay } from './templates';
import { formatRanges } from './time';
import { hoursAndMinutes, weekMinutes } from './totals';

import type { WeekDraft } from './draft';
import type { DayDto } from '../../dto/location-dto';

/** The words a summary of a week is made of, in whichever language the caller speaks. */
export interface WeekSummaryTexts {
  readonly none: string;
  readonly day: (index: number) => string;
  readonly range: (from: string, to: string) => string;
  readonly group: (days: string, hours: string) => string;
  readonly withBreak: (hours: string, breaks: string) => string;
  readonly total: (hours: number, minutes: number) => string;
}

/**
 * A week in a few lines, worked out from the hours: runs of days with the same hours ("Mon–Thu
 * 08:00–18:00 (break 12:00–13:00)"), then the total. Closed days are left out, and a week with no
 * open day says so. The caller supplies the words, so a Server and a Client Component speak alike.
 */
export function summarizeWeek(week: WeekDraft, texts: WeekSummaryTexts): string[] {
  const runs: Array<{ days: number[]; day: DayDto }> = [];
  week.forEach((day, index) => {
    if (day.intervals.length === 0) {
      return;
    }
    const last = runs.at(-1);
    if (last?.days.at(-1) === index - 1 && canonicalDay(last.day) === canonicalDay(day)) {
      last.days.push(index);
    } else {
      runs.push({ days: [index], day });
    }
  });
  if (runs.length === 0) {
    return [texts.none];
  }

  const lines = runs.map(({ days, day }) => {
    const first = days[0] ?? 0;
    const last = days.at(-1) ?? first;
    const names =
      first === last ? texts.day(first) : texts.range(texts.day(first), texts.day(last));
    const hours = formatRanges(day.intervals);
    return texts.group(
      names,
      day.breaks.length === 0 ? hours : texts.withBreak(hours, formatRanges(day.breaks)),
    );
  });
  const { hours, minutes } = hoursAndMinutes(weekMinutes(week));
  return [...lines, texts.total(hours, minutes)];
}
