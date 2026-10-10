import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { parseWebsiteId } from '../../domain/models/ids';
import { parseLocalDateRange } from '../../domain/scheduling/local-date-range';
import { addDays } from '../../domain/time/local-date';
import { startOfLocalDay } from '../../domain/time/time-zone';
import {
  MAX_CALENDAR_BOOKINGS_PER_QUERY,
  MAX_CALENDAR_RANGE_DAYS,
  MAX_LOCATIONS_PER_WEBSITE,
  MAX_RESOURCES_PER_WEBSITE,
  MAX_SERVICES_PER_WEBSITE,
} from '../booking-limits';
import { toCalendarBookingView } from '../booking-view-mappers';
import { parseBookingFilter } from '../services/request-parsing';

import type { BookingDependencies } from '../booking-dependencies';
import type { GetOperationsCalendarInput } from '../contracts/booking-inputs';
import type { OperationsCalendarView } from '../contracts/booking-views';

/**
 * The bookings of a website over a range of days, for the operations
 * calendar. Days are days of the (chosen or first) location's calendar, so
 * "Monday" means Monday where the people are, whatever zone the browser is
 * in. Contains customer details: it needs `booking.read`.
 */
export class GetOperationsCalendar {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: GetOperationsCalendarInput,
  ): AppResultAsync<
    OperationsCalendarView,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, locations, resources, services, bookings } = this.deps;

    return authorization.requireInTenant('booking.read').andThen((actor) => {
      const parsed = parseWebsiteId(input.websiteId).andThen((websiteId) =>
        parseLocalDateRange(input.from, input.to, MAX_CALENDAR_RANGE_DAYS).andThen((range) =>
          parseBookingFilter(input).map((filter) => ({ websiteId, range, filter })),
        ),
      );
      if (parsed.isErr()) {
        return errAsync(parsed.error);
      }
      const { websiteId, range, filter } = parsed.value;

      return locations
        .listByWebsite(websiteId, actor.tenantId, MAX_LOCATIONS_PER_WEBSITE)
        .andThen((storedLocations) => {
          const chosen =
            filter.locationId === undefined
              ? storedLocations[0]
              : storedLocations.find((location) => location.id === filter.locationId);
          if (chosen === undefined) {
            return errAsync(
              fieldValidationFailed('locationId', BOOKING_VALIDATION_CODES.idInvalid),
            );
          }
          const span = {
            start: startOfLocalDay(range.from, chosen.timeZone),
            end: startOfLocalDay(addDays(range.to, 1), chosen.timeZone),
          };
          return bookings
            .listInRange(websiteId, actor.tenantId, span, filter, MAX_CALENDAR_BOOKINGS_PER_QUERY)
            .andThen((found) =>
              services
                .listByWebsite(websiteId, actor.tenantId, MAX_SERVICES_PER_WEBSITE)
                .andThen((storedServices) =>
                  resources
                    .listByWebsite(websiteId, actor.tenantId, MAX_RESOURCES_PER_WEBSITE)
                    .map((storedResources) => {
                      const names = new Map(
                        storedServices.map((service) => [service.id, service.name]),
                      );
                      return {
                        timeZone: chosen.timeZone,
                        from: input.from,
                        to: input.to,
                        bookings: found.map((booking) =>
                          toCalendarBookingView(booking, names.get(booking.serviceId) ?? ''),
                        ),
                        resources: storedResources
                          .filter((resource) => resource.isActive)
                          .filter(
                            (resource) =>
                              resource.locationId === null || resource.locationId === chosen.id,
                          )
                          .map((resource) => ({
                            id: resource.id,
                            name: resource.name,
                            type: resource.type,
                            locationId: resource.locationId,
                          })),
                      };
                    }),
                ),
            );
        });
    });
  }
}
