const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

/** `13:05` for minute 785 of a day; a minute outside the day wraps, which a preview of a few buffers never needs. */
export function clockText(minuteOfDay: number): string {
  const wrapped = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(wrapped / MINUTES_PER_HOUR);
  const minutes = wrapped % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const EXAMPLE_START_HOUR = 13;

/** The start the preview draws its example appointment at, in minutes after midnight: 13:00. */
export const EXAMPLE_START_MINUTE = EXAMPLE_START_HOUR * MINUTES_PER_HOUR;
