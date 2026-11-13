import { WEEK_TEMPLATES } from './week/templates';

import type { DayDto, LocationDto } from '../dto/location-dto';
import type { LocationFormValues } from '../schemas/location-schema';

/**
 * The zone a new location starts with: the platform serves German municipalities. It is a starting
 * point in a searchable field, not a rule; nothing in the application settings names another.
 */
export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

/** What the create form starts with: an ordinary office week the manager can change or replace. */
export function newLocationValues(): LocationFormValues {
  return {
    name: '',
    address: '',
    timeZone: DEFAULT_TIME_ZONE,
    isActive: true,
    openingHours: { weekly: WEEK_TEMPLATES.standardOffice.map(copyOf), exceptions: [] },
  };
}

const copyOf = ({ intervals, breaks }: DayDto) => ({
  intervals: intervals.map((range) => ({ ...range })),
  breaks: breaks.map((range) => ({ ...range })),
});

/** A location as the form edits it. */
export function toFormValues(location: LocationDto): LocationFormValues {
  return {
    name: location.name,
    address: location.address ?? '',
    timeZone: location.timeZone,
    isActive: location.isActive,
    openingHours: {
      weekly: location.weekly.map(copyOf),
      exceptions: location.exceptions.map(({ kind, from, to, day }) => ({
        kind,
        from,
        to,
        ...(day === null ? {} : { day: copyOf(day) }),
      })),
    },
  };
}

/**
 * The zones to choose from: every zone the runtime knows, plus the one already stored if the runtime
 * does not list it (a legacy name). Read on the server and handed to the form, so the list the page
 * was rendered with is the list the browser shows.
 */
export function listTimeZones(current: string): string[] {
  const known = Intl.supportedValuesOf('timeZone');
  return known.includes(current) ? known : [...known, current].sort();
}
