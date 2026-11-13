import type { RangeDto } from '../../dto/location-dto';

/** Minutes in an hour and a day: the units `HH:mm` text is read in. */
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** Minutes after midnight of `HH:mm` (`24:00` is the end of the day), or `null` when it is not a time. */
export function minutesOf(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  if (match === null) {
    return null;
  }
  const total = Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
  return Number(match[2]) < MINUTES_PER_HOUR && total <= MINUTES_PER_DAY ? total : null;
}

export function timeOf(minutes: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / MINUTES_PER_HOUR))}:${pad(minutes % MINUTES_PER_HOUR)}`;
}

export interface Minutes {
  readonly start: number;
  readonly end: number;
}

/** The ranges that read as a start before an end; the rest count as nothing. */
export function readableRanges(ranges: readonly RangeDto[]): Minutes[] {
  return ranges.flatMap(({ start, end }) => {
    const from = minutesOf(start);
    const to = minutesOf(end);
    return from !== null && to !== null && from < to ? [{ start: from, end: to }] : [];
  });
}

/** `08:00–12:00, 13:00–18:00`, in the order given. */
export function formatRanges(ranges: readonly RangeDto[]): string {
  return ranges.map(({ start, end }) => `${start}–${end}`).join(', ');
}
