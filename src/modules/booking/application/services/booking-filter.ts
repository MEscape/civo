import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { BOOKING_STATUSES } from '../../domain/models/booking';
import {
  parseBookableResourceId,
  parseBookableServiceId,
  parseBookingLocationId,
} from '../../domain/models/ids';
import { asInstant } from '../../domain/time/instant';
import { addLocalDays, formatLocalDate } from '../../domain/time/local-date';
import { startOfLocalDay } from '../../domain/time/local-time-resolution';
import { createInterval } from '../../domain/time/time-interval';
import { localDateOf, parseTimeZone } from '../../domain/time/time-zone';
import { toBookingView } from '../booking-view-mappers';

import { loadLocations } from './employee-labels';
import { parseDateRange } from './request-parsing';

import type { LocationsById } from './employee-labels';
import type { BookingStatus } from '../../domain/models/booking';
import type { WebsiteId } from '../../domain/models/ids';
import type {
  BookingCountQuery,
  BookingScope,
  StoredBooking,
} from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { LocalDateRange } from '../../domain/time/local-date-range';
import type { TimeInterval } from '../../domain/time/time-interval';
import type { TimeZone } from '../../domain/time/time-zone';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { BookingFilterInput, BookingListState } from '../contracts/booking-inputs';
import type { BookingStateCountsView, BookingView } from '../contracts/booking-views';

type Reads = Pick<EmployeeAreaDependencies, 'bookings' | 'locationAdmin'>;

/** What a manager's list or calendar asks the repository for, resolved from the request. */
export interface BookingFilter {
  readonly days: LocalDateRange;
  readonly query: BookingCountQuery;
  readonly statuses: readonly BookingStatus[];
  readonly assignment?: 'open' | 'assigned';
  /** The website's locations: what each booking is put on the clock of. */
  readonly locations: LocationsById;
}

/** A state as the statuses and the assignment it stands for (BD-04). */
function selectionOf(
  state: BookingListState | undefined,
): Pick<BookingFilter, 'statuses' | 'assignment'> {
  if (state === undefined) {
    return { statuses: BOOKING_STATUSES };
  }
  return state === 'open' || state === 'assigned'
    ? { statuses: ['confirmed'], assignment: state }
    : { statuses: [state] };
}

/** The ids a filter names, parsed; a filter that is absent stays absent. */
function parseIds(
  input: BookingFilterInput,
): AppResult<
  Pick<BookingCountQuery, 'locationId' | 'serviceId' | 'resourceId'>,
  ValidationAppError
> {
  const parse = <T>(
    raw: string | undefined,
    parser: (text: string) => AppResult<T, ValidationAppError>,
  ) => (raw === undefined ? ok(undefined) : parser(raw));
  const locationId = parse(input.locationId, parseBookingLocationId);
  const serviceId = parse(input.serviceId, parseBookableServiceId);
  const resourceId = parse(input.resourceId, parseBookableResourceId);
  if (locationId.isErr()) {
    return err(locationId.error);
  }
  if (serviceId.isErr()) {
    return err(serviceId.error);
  }
  if (resourceId.isErr()) {
    return err(resourceId.error);
  }
  return ok({
    ...(locationId.value === undefined ? {} : { locationId: locationId.value }),
    ...(serviceId.value === undefined ? {} : { serviceId: serviceId.value }),
    ...(resourceId.value === undefined ? {} : { resourceId: resourceId.value }),
  });
}

/**
 * The clocks the days are read on: the chosen location's, else every location's. A website keeps its
 * locations in one zone in practice; when they differ, the span reaches from the earliest midnight to
 * the latest, so no booking of the days is left out (one of another zone near midnight may be in).
 */
function zonesOf(locations: LocationsById, locationId: string | undefined): readonly TimeZone[] {
  const chosen = locationId === undefined ? undefined : locations.get(locationId);
  const zones = chosen === undefined ? [...locations.values()].map((l) => l.zone) : [chosen.zone];
  // A website without locations has no bookings; its days are read in UTC, and nothing is found.
  const utc = parseTimeZone('UTC');
  return zones.length > 0 || utc === null ? zones : [utc];
}

function spanOf(
  days: LocalDateRange,
  zones: readonly TimeZone[],
): AppResult<TimeInterval, ValidationAppError> {
  const starts = zones.map((zone) => startOfLocalDay(days.from, zone));
  const ends = zones.map((zone) => startOfLocalDay(addLocalDays(days.to, 1), zone));
  const span = createInterval(asInstant(Math.min(...starts)), asInstant(Math.max(...ends)));
  return span === null ? err(fieldValidationFailed('to', CODES.dateRangeInvalid)) : ok(span);
}

/**
 * Reads a manager's filters: the days (today on the locations' clock when none are given, at most
 * `maxDays`), the ids, the reference and the state. A reference is compared exactly, so text that is
 * not one simply finds nothing.
 */
export function resolveBookingFilter(
  deps: Reads,
  scope: BookingScope,
  request: { readonly input: BookingFilterInput; readonly now: Instant; readonly maxDays: number },
): AppResultAsync<BookingFilter, ValidationAppError | InfrastructureAppError> {
  const { input, now, maxDays } = request;
  return loadLocations(deps, scope).andThen((locations) => {
    const zones = zonesOf(locations, input.locationId);
    const [first] = zones;
    if (first === undefined) {
      return err(fieldValidationFailed('locationId', CODES.locationInvalid));
    }
    const from = input.from ?? formatLocalDate(localDateOf(now, first));
    const reference = input.reference?.trim().toUpperCase();
    return parseDateRange({ from, to: input.to ?? from }, maxDays).andThen((days) =>
      parseIds(input).andThen((ids) =>
        spanOf(days, zones).map((span): BookingFilter => ({
          days,
          locations,
          ...selectionOf(input.state),
          query: {
            span,
            ...ids,
            ...(input.customerEmail === undefined ? {} : { customerEmail: input.customerEmail }),
            ...(reference === undefined || reference === '' ? {} : { reference }),
          },
        })),
      ),
    );
  });
}

/** The counts of the tabs: every state of the days and filters, whatever state is chosen. */
export function countsOf(
  deps: Reads,
  scope: BookingScope,
  query: BookingCountQuery,
): AppResultAsync<BookingStateCountsView, InfrastructureAppError> {
  return deps.bookings.countByState(scope, query).map(({ byStatus, openConfirmed }) => {
    const of = (status: BookingStatus) => byStatus[status] ?? 0;
    return {
      all: BOOKING_STATUSES.reduce((sum, status) => sum + of(status), 0),
      open: openConfirmed,
      assigned: of('confirmed') - openConfirmed,
      held: of('held'),
      completed: of('completed'),
      cancelled: of('cancelled'),
      no_show: of('no_show'),
      expired: of('expired'),
    };
  });
}

/**
 * Each booking on the clock of its own location (BD-02); one whose location is gone is left out.
 * Who booked is shown only to those who may contact customers (`mayContactCustomers`).
 */
export function viewsOf(
  stored: readonly StoredBooking[],
  locations: LocationsById,
  view: { readonly websiteId: WebsiteId; readonly withCustomer: boolean },
): BookingView[] {
  return stored.flatMap((one) => {
    const location = locations.get(one.booking.locationId);
    if (location === undefined) {
      return [];
    }
    const full = toBookingView(one, location.zone, view.websiteId);
    return [view.withCustomer ? full : { ...full, customer: null }];
  });
}

/** The days as the views carry them. */
export const daysView = (days: LocalDateRange) => ({
  from: formatLocalDate(days.from),
  to: formatLocalDate(days.to),
});
