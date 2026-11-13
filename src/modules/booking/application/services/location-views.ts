import { holidayKeysOn } from '../../domain/holidays/german-holidays';
import { availabilityOnDate } from '../../domain/scheduling/availability-plan';
import { WEEKDAYS } from '../../domain/scheduling/weekly-hours';
import { instantToDate } from '../../domain/time/instant';
import { formatInstantInZone } from '../../domain/time/instant-format';
import { formatLocalDate } from '../../domain/time/local-date';
import { formatTimeOfDay } from '../../domain/time/time-of-day';
import { localDateOf } from '../../domain/time/time-zone';

import type { WebsiteId } from '../../domain/models/ids';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { AvailabilityException } from '../../domain/scheduling/availability-plan';
import type { DaySchedule, TimeRange } from '../../domain/scheduling/weekly-hours';
import type { Instant } from '../../domain/time/instant';
import type { DayInput, RangeInput } from '../contracts/location-inputs';
import type { ExceptionView, LocationSummaryView, LocationView } from '../contracts/location-views';

const toRangeInput = ({ startMinute, endMinute }: TimeRange): RangeInput => ({
  start: formatTimeOfDay(startMinute),
  end: formatTimeOfDay(endMinute),
});

export function toDayInput({ ranges, breaks }: DaySchedule): DayInput {
  return { intervals: ranges.map(toRangeInput), breaks: breaks.map(toRangeInput) };
}

function toExceptionView({ kind, from, to, day }: AvailabilityException): ExceptionView {
  const fromText = formatLocalDate(from);
  const toText = formatLocalDate(to);
  return {
    kind,
    from: fromText,
    to: toText,
    day: kind === 'closed' ? null : toDayInput(day),
    // A name for the day only when it is one day; a run of days is not "a holiday".
    holiday: fromText === toText ? (holidayKeysOn(fromText)[0] ?? null) : null,
  };
}

/** A location in a list: where it is, whether it is on, and when it is open today on its own clock. */
export function toLocationSummary(location: StoredLocation, now: Instant): LocationSummaryView {
  const today = localDateOf(now, location.zone);
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    timeZone: location.zone,
    isActive: location.isActive,
    todayWindows: availabilityOnDate(location.openingHours, today, location.zone).map(
      ({ start, end }) => ({
        start: formatInstantInZone(start, location.zone),
        end: formatInstantInZone(end, location.zone),
      }),
    ),
  };
}

/** A location with its hours in the shape a form edits, and the version a change must name. */
export function toLocationView(
  location: StoredLocation,
  websiteId: WebsiteId,
  futureBookingCount: number,
): LocationView {
  return {
    websiteId,
    id: location.id,
    name: location.name,
    address: location.address,
    timeZone: location.zone,
    isActive: location.isActive,
    weekly: WEEKDAYS.map((weekday) => toDayInput(location.openingHours.weekly[weekday])),
    exceptions: location.openingHours.exceptions.map(toExceptionView),
    version: instantToDate(location.updatedAt).toISOString(),
    futureBookingCount,
  };
}
