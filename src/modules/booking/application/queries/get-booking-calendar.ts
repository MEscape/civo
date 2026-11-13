import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { MAX_CALENDAR_BOOKINGS, MAX_CALENDAR_DAYS } from '../booking-limits';
import { countsOf, daysView, resolveBookingFilter, viewsOf } from '../services/booking-filter';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { mayContactCustomers } from '../services/contact-access';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { Instant } from '../../domain/time/instant';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { GetBookingCalendarInput } from '../contracts/booking-inputs';
import type { BookingCalendarView } from '../contracts/booking-views';

export type GetBookingCalendarError =
  BookingAccessError | ValidationAppError | InfrastructureAppError;

/**
 * Every booking of the days a manager's calendar shows (at most six weeks), with the list's filters
 * and the same counts, so the calendar and the list never disagree. One more booking than the bound
 * is read only to know the range holds more than is drawn. Needs `booking.read`; who booked is in the
 * answer only for those who manage bookings (`mayContactCustomers`).
 */
export class GetBookingCalendar {
  constructor(private readonly deps: EmployeeAreaDependencies) {}

  execute(
    input: GetBookingCalendarInput,
  ): AppResultAsync<BookingCalendarView, GetBookingCalendarError> {
    const { access } = this.deps;
    const now = currentInstant(this.deps.clock);

    return access
      .authorizeWebsite('booking.read', input.websiteId)
      .andThen(({ actor }) =>
        mayContactCustomers(access, input.websiteId).andThen((withCustomer) =>
          this.read(actor, input, { now, withCustomer }),
        ),
      );
  }

  private read(
    actor: Actor,
    input: GetBookingCalendarInput,
    context: { readonly now: Instant; readonly withCustomer: boolean },
  ): AppResultAsync<BookingCalendarView, GetBookingCalendarError> {
    const { now, withCustomer } = context;
    const scope = scopeOfActor(actor);
    return resolveBookingFilter(this.deps, scope, {
      // A search by e-mail would tell someone who may not see customers that one booked.
      input: withCustomer ? input : { ...input, customerEmail: undefined },
      now,
      maxDays: MAX_CALENDAR_DAYS,
    }).andThen((filter) =>
      this.deps.bookings
        .list(scope, {
          ...filter.query,
          statuses: filter.statuses,
          ...(filter.assignment === undefined ? {} : { assignment: filter.assignment }),
          limit: MAX_CALENDAR_BOOKINGS + 1,
        })
        .andThen((stored) =>
          countsOf(this.deps, scope, filter.query).map((counts): BookingCalendarView => ({
            days: daysView(filter.days),
            items: viewsOf(stored.slice(0, MAX_CALENDAR_BOOKINGS), filter.locations, {
              websiteId: scope.websiteId,
              withCustomer,
            }),
            isTruncated: stored.length > MAX_CALENDAR_BOOKINGS,
            counts,
          })),
        ),
    );
  }
}
