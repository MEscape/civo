/**
 * Locale-aware date helpers. Zero dependencies.
 * Dates are stored as UTC instants and converted to a time zone only at
 * presentation (i18n.md), so every formatter takes the zone explicitly.
 */

export type DateInput = Date | string | number;

function toDate(input: DateInput): Date {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${String(input)}`);
  }
  return date;
}

/** Formats a date for a locale and time zone. */
export function formatDate(
  input: DateInput,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(toDate(input));
}

/** Formats a date and time for a locale and time zone. */
export function formatDateTime(input: DateInput, locale: string, timeZone: string): string {
  return formatDate(input, locale, timeZone, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const RELATIVE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/**
 * Formats the distance between two instants as relative text ("vor 2 Tagen").
 * `now` is a parameter, not read from the clock, so the function is pure and
 * deterministic in tests (architecture.md: domain/application code must not
 * read the clock directly; injecting it here keeps this helper usable from
 * either layer without violating that).
 */
export function formatRelativeTime(input: DateInput, now: DateInput, locale: string): string {
  const differenceMs = toDate(input).getTime() - toDate(now).getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(differenceMs) >= unitMs) {
      return formatter.format(Math.round(differenceMs / unitMs), unit);
    }
  }
  return formatter.format(Math.round(differenceMs / 1000), 'second');
}

/** True when `date` falls on the same calendar day as `other` in the given time zone. */
export function isSameDay(date: DateInput, other: DateInput, timeZone: string): boolean {
  const format = (value: DateInput) =>
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(toDate(value));
  return format(date) === format(other);
}

/** Returns a new `Date` that is `days` later; negative values move earlier. UTC arithmetic, so DST never shifts it. */
export function addDays(input: DateInput, days: number): Date {
  const result = new Date(toDate(input));
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
