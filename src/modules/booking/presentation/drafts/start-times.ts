import { formatTimeOfDay } from '../../application/contracts/booking-constraints';

/**
 * The spacings offered for the start-time grid; a saved value outside the list
 * is kept as an extra choice.
 */
// eslint-disable-next-line no-magic-numbers -- the list of offered spacings is the data
export const SLOT_INTERVAL_CHOICES = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

const MINUTES_PER_HOUR = 60;
const EXAMPLE_FROM_HOUR = 8;
const EXAMPLE_FROM_MINUTE = EXAMPLE_FROM_HOUR * MINUTES_PER_HOUR;
const EXAMPLE_COUNT = 4;

/**
 * The first start times a visitor would see from 08:00 on. The grid is counted
 * from midnight, not from the opening time (that is how the slot engine lays
 * it), so a spacing that does not divide 08:00 shows as 08:20, 08:40 ... and the
 * example tells the truth about it.
 */
export function exampleStartTimes(intervalMinutes: number | null): readonly string[] {
  if (intervalMinutes === null || intervalMinutes < 1) {
    return [];
  }
  const first = Math.ceil(EXAMPLE_FROM_MINUTE / intervalMinutes) * intervalMinutes;
  return Array.from({ length: EXAMPLE_COUNT }, (_, step) =>
    formatTimeOfDay(first + step * intervalMinutes),
  );
}

/** The spacings to choose from, including the current one when it is not a standard choice. */
export function slotIntervalChoices(current: number | null): readonly number[] {
  const all =
    current === null || SLOT_INTERVAL_CHOICES.some((choice) => choice === current)
      ? [...SLOT_INTERVAL_CHOICES]
      : [...SLOT_INTERVAL_CHOICES, current];
  return all.sort((a, b) => a - b);
}
