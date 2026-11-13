import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest, offsetOf, toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_PAGE_LIMITS, MAX_LIST_RANGE_DAYS } from '../booking-limits';
import { countsOf, daysView, resolveBookingFilter, viewsOf } from '../services/booking-filter';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { mayContactCustomers } from '../services/contact-access';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingListQuery } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { ListBookingsInput } from '../contracts/booking-inputs';
import type { BookingPageView } from '../contracts/booking-views';
import type { BookingFilter } from '../services/booking-filter';

export type ListBookingsError = BookingAccessError | ValidationAppError | InfrastructureAppError;

/** The repository's question for one page of a filter. */
function pageQuery(filter: BookingFilter, request: PageRequest): BookingListQuery {
  return {
    ...filter.query,
    statuses: filter.statuses,
    ...(filter.assignment === undefined ? {} : { assignment: filter.assignment }),
    limit: request.pageSize,
    offset: offsetOf(request),
  };
}

/**
 * The bookings of the website that start on some days, a page at a time, for the people who look
 * after them, with how many are in each state (the tabs). Filters, counts and the page are made by
 * the database, so a page of 25 never reads 2,000 bookings. The days are read on the locations'
 * clock. Needs `booking.read`; who booked is in the answer only for those who manage bookings
 * (`mayContactCustomers`), a viewer sees when and what. Employees use their own area.
 */
export class ListBookings {
  constructor(private readonly deps: EmployeeAreaDependencies) {}

  execute(input: ListBookingsInput): AppResultAsync<BookingPageView, ListBookingsError> {
    const { access } = this.deps;
    const now = currentInstant(this.deps.clock);

    return access
      .authorizeWebsite('booking.read', input.websiteId)
      .andThen(({ actor }) =>
        mayContactCustomers(access, input.websiteId).andThen((withCustomer) =>
          this.page(actor, input, { now, withCustomer }),
        ),
      );
  }

  private page(
    actor: Actor,
    input: ListBookingsInput,
    context: { readonly now: Instant; readonly withCustomer: boolean },
  ): AppResultAsync<BookingPageView, ListBookingsError> {
    const { bookings } = this.deps;
    const { now, withCustomer } = context;
    const scope = scopeOfActor(actor);
    const requested = resolvePageRequest(input.page, BOOKING_PAGE_LIMITS);
    return resolveBookingFilter(this.deps, scope, {
      // A search by e-mail would tell someone who may not see customers that one booked.
      input: withCustomer ? input : { ...input, customerEmail: undefined },
      now,
      maxDays: MAX_LIST_RANGE_DAYS,
    }).andThen((filter) =>
      loadClampedPage(requested, (request) =>
        bookings
          .count(scope, pageQuery(filter, request))
          .andThen((total) =>
            bookings
              .list(scope, pageQuery(filter, request))
              .map((items) => toPage(items, total, request)),
          ),
      ).andThen((page) =>
        countsOf(this.deps, scope, filter.query).map((counts): BookingPageView => ({
          items: viewsOf(page.items, filter.locations, {
            websiteId: scope.websiteId,
            withCustomer,
          }),
          page: page.page,
          pageSize: page.pageSize,
          total: page.total,
          pageCount: page.pageCount,
          days: daysView(filter.days),
          counts,
        })),
      ),
    );
  }
}
