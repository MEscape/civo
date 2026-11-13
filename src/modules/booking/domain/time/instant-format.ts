import { MS_PER_MINUTE } from '@lib/utils';

import { zoneOffsetMs } from './time-zone';

import type { Instant } from './instant';
import type { TimeZone } from './time-zone';

const MINUTES_PER_HOUR = 60;
const SECONDS_END = 19;

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * An instant as ISO-8601 text on the wall clock of a zone, with its offset: `2027-01-11T09:30:00+01:00`.
 * The text names the same moment everywhere (`parseInstant` reads it back) and shows the time the
 * people at the location see, which is what a screen draws. The offset is the zone's at that instant,
 * so it changes across a daylight-saving change.
 */
export function formatInstantInZone(instant: Instant, zone: TimeZone): string {
  const offsetMs = zoneOffsetMs(instant, zone);
  const local = new Date(instant + offsetMs).toISOString().slice(0, SECONDS_END);
  const offsetMinutes = Math.abs(offsetMs) / MS_PER_MINUTE;
  const sign = offsetMs < 0 ? '-' : '+';
  const hours = Math.floor(offsetMinutes / MINUTES_PER_HOUR);
  return `${local}${sign}${pad(hours)}:${pad(offsetMinutes % MINUTES_PER_HOUR)}`;
}
