import { CLOSED_DAY } from './draft';

import type { WeekDraft } from './draft';
import type { DayDto, RangeDto } from '../../dto/location-dto';

const standard = (close: string): DayDto => ({
  intervals: [{ start: '08:00', end: close }],
  breaks: [{ start: '12:00', end: '13:00' }],
});
const morning: DayDto = { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] };
const extended: DayDto = {
  intervals: [{ start: '07:00', end: '20:00' }],
  breaks: [{ start: '12:00', end: '13:00' }],
};

/** Starting weeks to choose from. A template only fills the editor; nothing is saved by choosing one. */
export const WEEK_TEMPLATES = {
  standardOffice: [
    standard('18:00'),
    standard('18:00'),
    standard('18:00'),
    standard('18:00'),
    { intervals: [{ start: '08:00', end: '16:00' }], breaks: [] },
    CLOSED_DAY,
    CLOSED_DAY,
  ],
  mornings: [morning, morning, morning, morning, morning, CLOSED_DAY, CLOSED_DAY],
  extended: [extended, extended, extended, extended, extended, CLOSED_DAY, CLOSED_DAY],
  closed: [CLOSED_DAY, CLOSED_DAY, CLOSED_DAY, CLOSED_DAY, CLOSED_DAY, CLOSED_DAY, CLOSED_DAY],
} as const satisfies Record<string, WeekDraft>;

export type WeekTemplateKey = keyof typeof WEEK_TEMPLATES;
export const WEEK_TEMPLATE_KEYS = Object.keys(WEEK_TEMPLATES) as WeekTemplateKey[];

/** A day written the same way whatever order its rows were typed in, so two days can be compared. */
export function canonicalDay(day: DayDto): string {
  const order = (ranges: readonly RangeDto[]) =>
    ranges.map(({ start, end }) => `${start}-${end}`).sort();
  return JSON.stringify([order(day.intervals), order(day.breaks)]);
}

export interface DayChange {
  /** 0 is Monday. */
  readonly weekday: number;
  readonly before: DayDto;
  readonly after: DayDto;
}

/** The days that differ between two weeks, what each was and what it would become. */
export function changedDays(before: WeekDraft, after: WeekDraft): DayChange[] {
  return after.flatMap((day, weekday) => {
    const was = before[weekday] ?? CLOSED_DAY;
    return canonicalDay(was) === canonicalDay(day) ? [] : [{ weekday, before: was, after: day }];
  });
}
