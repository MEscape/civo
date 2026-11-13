import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { keyBy } from '@lib/utils';

import { assessEligibility } from '../../domain/assignment/assignment-eligibility';
import { rankBookings } from '../../domain/assignment/assignment-ranking';
import { NO_UNIT, findOpenUnit } from '../../domain/assignment/booking-assignment';
import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { heldResourceIds } from '../../domain/models/booking';
import { serviceAtLocation } from '../../domain/models/service-at-location';
import { serviceAsBooked } from '../../domain/models/service-snapshot';
import { mayEmployeeClaim } from '../../domain/policies/service-policy';
import { MAX_OPEN_BOOKINGS } from '../booking-limits';
import { toEmployeeBookingView, toFitView } from '../booking-view-mappers';
import { daysOf } from '../services/assignment-candidates';
import { scopeOfActor } from '../services/booking-scope';
import { locationsOfBookings } from '../services/booking-zones';
import { currentInstant } from '../services/clock-instant';
import { labelsOf, loadBookingFacts, loadLocations } from '../services/employee-labels';
import { blockingAround, servicesOfBookings } from '../services/open-booking-context';
import { isOnDay, parseOpenFilter } from '../services/open-booking-filter';
import { scheduleOf, windowAround } from '../services/scheduling-context';

import type { scheduleTooLarge } from '../../domain/errors/booking-errors';
import type { BookableResource } from '../../domain/models/bookable-resource';
import type { BookableService } from '../../domain/models/bookable-service';
import type { Booking } from '../../domain/models/booking';
import type { EmployeePreferences } from '../../domain/models/employee-preferences';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { OpenBookingView } from '../contracts/booking-views';
import type { GetOpenBookingsInput } from '../contracts/employee-inputs';
import type { OpenFilter } from '../services/open-booking-filter';

export type GetOpenBookingsError =
  | BookingAccessError
  | ValidationAppError
  | NotFoundAppError
  | InfrastructureAppError
  | ReturnType<typeof scheduleTooLarge>;

interface Offered {
  readonly stored: StoredBooking;
  readonly location: BookingLocationFacts;
}

/**
 * The open bookings the signed-in employee could take, best fit first. A booking is offered only
 * if its service lets employees claim, the employee holds none of its units yet, and the domain's
 * eligibility rules accept the employee's own calendar for an open unit of it (qualified, at the
 * location, working and free for the whole of it): an employee never sees a booking they could not
 * take. The employee is the signed-in person (their calendar), never an id from the request. Their
 * preferences only order the list (BD-07); the filters narrow it. No customer data, only names.
 */
export class GetOpenBookings {
  constructor(private readonly deps: EmployeeAreaDependencies) {}

  execute(
    input: GetOpenBookingsInput,
  ): AppResultAsync<readonly OpenBookingView[], GetOpenBookingsError> {
    const { access, resources, bookings, preferences, clock } = this.deps;
    const now = currentInstant(clock);
    const filter = parseOpenFilter(input);

    return access.authorizeWebsite('booking.claim.own', input.websiteId).andThen(({ actor }) => {
      if (filter === null) {
        return errAsync(fieldValidationFailed('filter', CODES.idInvalid));
      }
      const scope = scopeOfActor(actor);
      return resources.findEmployeeOf(scope, actor.id).andThen((own) =>
        own === null
          ? okAsync<readonly OpenBookingView[], GetOpenBookingsError>([])
          : bookings
              .listOpen(scope, {
                now,
                limit: MAX_OPEN_BOOKINGS,
                ...(filter.locationId === undefined ? {} : { locationId: filter.locationId }),
              })
              .andThen((open) =>
                open.length === 0
                  ? okAsync([])
                  : preferences
                      .findMany(scope, [own.id])
                      .andThen((saved) =>
                        this.offered({ scope, own, open, now, filter }, saved.get(own.id) ?? null),
                      ),
              ),
      );
    });
  }

  private offered(
    request: {
      readonly scope: BookingScope;
      readonly own: BookableResource;
      readonly open: readonly StoredBooking[];
      readonly now: Instant;
      readonly filter: OpenFilter;
    },
    wishes: EmployeePreferences | null,
  ): AppResultAsync<readonly OpenBookingView[], GetOpenBookingsError> {
    const { scope, own, open, now, filter } = request;
    return servicesOfBookings(this.deps, scope, open).andThen((services) =>
      locationsOfBookings(this.deps, scope, open).andThen((locations) =>
        blockingAround(this.deps, { scope, own: own.id, open, now }).andThen((blocking) => {
          const fits = open.flatMap((stored) => {
            const service = services.get(stored.booking.serviceId);
            const location = locations.get(stored.booking.locationId);
            return service === undefined ||
              location === undefined ||
              !isOnDay(stored.booking, location.zone, filter)
              ? []
              : this.fits(stored, {
                  own,
                  service: serviceAsBooked(
                    serviceAtLocation(service, stored.booking.locationId),
                    stored.placement.snapshot,
                  ),
                  location,
                  blocking,
                  now,
                });
          });
          return this.named(scope, fits, wishes);
        }),
      ),
    );
  }

  /** The bookings in the order the employee's preferences give, with their names. */
  private named(
    scope: BookingScope,
    fits: readonly Offered[],
    wishes: EmployeePreferences | null,
  ): AppResultAsync<readonly OpenBookingView[], InfrastructureAppError> {
    const fitById = keyBy(fits, ({ stored }) => stored.booking.id);
    const booked = fits.map(({ stored }) => stored.booking);
    return loadLocations(this.deps, scope).andThen((names) =>
      loadBookingFacts(this.deps, scope, booked).map((facts) =>
        rankBookings({
          bookings: fits.map(({ stored, location }) => ({
            booking: stored.booking,
            zone: location.zone,
          })),
          preferences: wishes,
        }).flatMap(({ booking, fit }) => {
          const found = fitById.get(booking.id);
          return found === undefined
            ? []
            : [
                {
                  booking: toEmployeeBookingView(
                    found.stored,
                    found.location.zone,
                    scope.websiteId,
                  ),
                  fit: toFitView(fit),
                  labels: labelsOf(booking, facts, names),
                },
              ];
        }),
      ),
    );
  }

  /** `stored` with its location if the employee could take it, nothing otherwise. */
  private fits(
    stored: StoredBooking,
    context: {
      readonly own: BookableResource;
      readonly service: BookableService;
      readonly location: BookingLocationFacts;
      readonly blocking: readonly Booking[];
      readonly now: Instant;
    },
  ): Offered[] {
    const { own, service, location, blocking, now } = context;
    const { booking } = stored;
    if (!mayEmployeeClaim(service) || heldResourceIds(booking).includes(own.id)) {
      return [];
    }
    const window = windowAround(daysOf(booking, location));
    const candidate = {
      resource: own,
      schedule: scheduleOf(own, {
        location,
        window,
        blocking: blocking.filter((other) => other.id !== booking.id),
      }),
    };
    const isOffered = service.requirements.some(
      (requirement, requirementIndex) =>
        findOpenUnit(booking, requirementIndex) !== NO_UNIT &&
        assessEligibility({ now, booking, requirement, requirementIndex, candidate }).kind ===
          'eligible',
    );
    return isOffered ? [{ stored, location }] : [];
  }
}
