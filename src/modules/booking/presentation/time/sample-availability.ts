import { invariant, MS_PER_MINUTE } from '@lib/utils';

import {
  WEEKDAYS,
  eachLocalDate,
  parseLocalDate,
  parseTimeOfDay,
  parseTimeZone,
  weekdayOf,
  zonedTimeToEpoch,
} from '../../application/contracts/booking-constraints';
import { toSlotDto } from '../dto/availability-dto';

import type { LocalDate, TimeZone } from '../../application/contracts/booking-constraints';
import type { AvailabilityDto, SlotDto } from '../dto/availability-dto';

/** Monday to Friday; the sample location is closed at the weekend, like the sample opening hours. */
const WORKING_WEEKDAY_COUNT = 5;
const SAMPLE_OPEN_WEEKDAYS: ReadonlySet<number> = new Set(WEEKDAYS.slice(0, WORKING_WEEKDAY_COUNT));
const SAMPLE_STEP_MINUTES = 30;

function minuteOf(text: string): number {
  const minute = parseTimeOfDay(text);
  invariant(minute !== null, 'The sample opening hours are valid times.');
  return minute;
}

/** Opening hours as minutes of the day: a morning and an afternoon. */
const SAMPLE_OPENING_RANGES: ReadonlyArray<readonly [start: number, end: number]> = [
  [minuteOf('09:00'), minuteOf('12:00')],
  [minuteOf('13:00'), minuteOf('15:30')],
];

export interface SampleAvailabilityQuery {
  readonly serviceId: string;
  readonly locationId: string;
  readonly timeZone: string;
  readonly durationMinutes: number;
  /** `YYYY-MM-DD`, inclusive. */
  readonly from: string;
  /** `YYYY-MM-DD`, inclusive. */
  readonly to: string;
  readonly now: Date;
}

interface DaySlots {
  readonly date: LocalDate;
  readonly zone: TimeZone;
  readonly query: SampleAvailabilityQuery;
}

/** The free times of one day: every step inside the opening ranges that is still ahead of `now`. */
function slotsOfDay({ date, zone, query }: DaySlots): SlotDto[] {
  const slots: SlotDto[] = [];
  for (const [open, close] of SAMPLE_OPENING_RANGES) {
    for (
      let minute = open;
      minute + query.durationMinutes <= close;
      minute += SAMPLE_STEP_MINUTES
    ) {
      const start = zonedTimeToEpoch(date, minute, zone);
      if (start > query.now.getTime()) {
        const end = start + query.durationMinutes * MS_PER_MINUTE;
        slots.push(
          toSlotDto(
            { start: new Date(start), end: new Date(end), remainingParticipants: 1 },
            query.timeZone,
          ),
        );
      }
    }
  }
  return slots;
}

/**
 * Invented free times for the placeholder services of the editor canvas and
 * the palette preview. It answers the same shape as the live availability
 * query, so the real slot picker runs unchanged, but it never reaches the
 * server: a sample service has no id there, and nothing can be reserved.
 */
export function createSampleAvailability(query: SampleAvailabilityQuery): AvailabilityDto {
  const zone = parseTimeZone(query.timeZone);
  const from = parseLocalDate(query.from);
  const to = parseLocalDate(query.to);
  const isUsable = zone !== null && from !== null && to !== null;
  const openDays = isUsable
    ? eachLocalDate(from, to).filter((date) => SAMPLE_OPEN_WEEKDAYS.has(weekdayOf(date)))
    : [];

  return {
    serviceId: query.serviceId,
    locationId: query.locationId,
    timeZone: query.timeZone,
    from: query.from,
    to: query.to,
    slots: zone === null ? [] : openDays.flatMap((date) => slotsOfDay({ date, zone, query })),
  };
}
