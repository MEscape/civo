import { actorHasPermission } from '@modules/auth';
import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { addDays } from '../../domain/time/local-date';
import { localDateOf, startOfLocalDay } from '../../domain/time/time-zone';
import {
  BOOKING_SUMMARY_DAYS,
  BOOKING_SUMMARY_NEXT,
  MAX_CALENDAR_BOOKINGS_PER_QUERY,
  MAX_LOCATIONS_PER_WEBSITE,
  MAX_SERVICES_PER_WEBSITE,
} from '../booking-limits';
import { toUpcomingBookingView } from '../booking-view-mappers';

import type { BookingDependencies } from '../booking-dependencies';
import type { BookingSummaryView } from '../contracts/calendar-views';

/**
 * What the website overview shows of the bookings: how many appointments are
 * today, how many come in the next days, and the next few. Days are days of
 * the first location's calendar, like the operations calendar's. Contains
 * customer names, so it follows the same rule: everyone who may read bookings
 * sees all of them, an employee only those on their own resources.
 */
export class GetBookingSummary {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<
    BookingSummaryView,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, locations, services, bookings, clock } = this.deps;

    return authorization.requireInTenant('booking.read.own').andThen((actor) =>
      parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
        locations
          .listByWebsite(websiteId, actor.tenantId, MAX_LOCATIONS_PER_WEBSITE)
          .andThen(
            (storedLocations): AppResultAsync<BookingSummaryView, InfrastructureAppError> => {
              const location = storedLocations[0];
              if (location === undefined) {
                return okAsync({
                  hasLocation: false,
                  today: 0,
                  upcoming: 0,
                  days: BOOKING_SUMMARY_DAYS,
                  next: [],
                });
              }
              const now = clock.now();
              const zone = location.timeZone;
              const today = localDateOf(now.getTime(), zone);
              const span = {
                start: startOfLocalDay(today, zone),
                end: startOfLocalDay(addDays(today, BOOKING_SUMMARY_DAYS), zone),
              };
              const tomorrowStart = startOfLocalDay(addDays(today, 1), zone);

              return bookings
                .listInRange(
                  { websiteId, tenantId: actor.tenantId },
                  {
                    span,
                    filter: {},
                    limit: MAX_CALENDAR_BOOKINGS_PER_QUERY,
                    assignedTo: actorHasPermission(actor, 'booking.read') ? undefined : actor.id,
                  },
                )
                .andThen((found) =>
                  services
                    .listByWebsite(websiteId, actor.tenantId, MAX_SERVICES_PER_WEBSITE)
                    .map((storedServices) => {
                      const names = new Map(
                        storedServices.map((service) => [service.id, service.name]),
                      );
                      // A hold is a visitor still filling in the form; a cancelled booking frees its time.
                      const kept = found.filter(
                        (booking) =>
                          booking.status === 'confirmed' || booking.status === 'completed',
                      );
                      const upcoming = kept
                        .filter(
                          (booking) =>
                            booking.status === 'confirmed' && booking.end.getTime() > now.getTime(),
                        )
                        .sort((a, b) => a.start.getTime() - b.start.getTime());

                      return {
                        hasLocation: true,
                        today: kept.filter((booking) => booking.start.getTime() < tomorrowStart)
                          .length,
                        upcoming: upcoming.length,
                        days: BOOKING_SUMMARY_DAYS,
                        next: upcoming
                          .slice(0, BOOKING_SUMMARY_NEXT)
                          .map((booking) =>
                            toUpcomingBookingView(booking, names.get(booking.serviceId) ?? ''),
                          ),
                      };
                    }),
                );
            },
          ),
      ),
    );
  }
}
