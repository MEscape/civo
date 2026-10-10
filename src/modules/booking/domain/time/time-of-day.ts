/**
 * A wall-clock time as whole minutes after local midnight (`08:30` is 510).
 * `24:00` (1440) is allowed as the END of a range so a day can run to
 * midnight, and never as a start.
 */
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;
export const MS_PER_MINUTE = 60_000;

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** Parses `HH:mm`; `null` when it is not a time between 00:00 and 24:00. */
export function parseTimeOfDay(text: string): number | null {
  const match = TIME_PATTERN.exec(text);
  if (match === null) {
    return null;
  }
  const [, hours, minutes] = match;
  const total = Number(hours) * MINUTES_PER_HOUR + Number(minutes);
  return Number(minutes) < MINUTES_PER_HOUR && total <= MINUTES_PER_DAY ? total : null;
}

export function formatTimeOfDay(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
  const minutes = minuteOfDay % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
