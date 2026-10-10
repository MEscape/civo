import { invariant } from '@lib/utils';

import {
  epochToZonedWallClock,
  formatLocalDate,
  formatTimeOfDay,
  parseTimeZone,
} from '../../application/contracts/booking-constraints';

const FALLBACK_ZONE = 'UTC';

export interface WallClock {
  /** `YYYY-MM-DD` in the zone. */
  readonly date: string;
  /** `HH:mm` in the zone. */
  readonly time: string;
}

/**
 * The wall-clock date and time an instant has in a zone. The location's zone,
 * never the browser's, decides what a slot "is": 10:00 in Berlin stays 10:00
 * for a visitor who is travelling. An unknown zone name falls back to UTC
 * instead of failing the whole screen.
 */
export function toWallClock(instant: Date | string, timeZone: string): WallClock {
  const zone = parseTimeZone(timeZone) ?? parseTimeZone(FALLBACK_ZONE);
  invariant(zone !== null, 'UTC is always a valid time zone.');
  const epoch = instant instanceof Date ? instant.getTime() : new Date(instant).getTime();
  const { date, minuteOfDay } = epochToZonedWallClock(epoch, zone);
  return { date: formatLocalDate(date), time: formatTimeOfDay(minuteOfDay) };
}
