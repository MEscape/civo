import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  bookingNotFound,
  locationNotFound,
  serviceNotFound,
} from '../../domain/errors/booking-errors';
import { serviceAtLocation } from '../../domain/models/service-at-location';
import { serviceAsBooked } from '../../domain/models/service-snapshot';

import type { BookableService } from '../../domain/models/bookable-service';
import type { BookingId } from '../../domain/models/ids';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { BookingDependencies, BookingFlowDependencies } from '../booking-dependencies';

type Reads = Pick<
  BookingDependencies | BookingFlowDependencies,
  'bookings' | 'services' | 'locations'
>;

/** A stored booking with the service and the location it refers to, which the rules and the views need. */
export interface BookingContext {
  readonly stored: StoredBooking;
  readonly service: BookableService;
  readonly location: BookingLocationFacts;
}

export type BookingContextError = NotFoundAppError | InfrastructureAppError;

/** The service and location a stored booking refers to. Both exist (foreign keys), but a read can still find none. */
export function withContext(
  deps: Pick<Reads, 'services' | 'locations'>,
  scope: BookingScope,
  stored: StoredBooking,
): AppResultAsync<BookingContext, BookingContextError> {
  return deps.services
    .findById(scope, stored.booking.serviceId)
    .andThen((service): AppResultAsync<BookableService, NotFoundAppError> =>
      service === null ? errAsync(serviceNotFound()) : okAsync(service),
    )
    .andThen((service) =>
      deps.locations
        .findById(scope, stored.booking.locationId)
        .andThen((location): AppResultAsync<BookingLocationFacts, NotFoundAppError> =>
          location === null ? errAsync(locationNotFound()) : okAsync(location),
        )
        .map((location) => ({
          stored,
          service: serviceAsBooked(
            serviceAtLocation(service, stored.booking.locationId),
            stored.placement.snapshot,
          ),
          location,
        })),
    );
}

/** The booking in the scope, or "not found": another website's booking looks exactly like a missing one. */
export function requireBooking(
  deps: Pick<Reads, 'bookings'>,
  scope: BookingScope,
  id: BookingId,
): AppResultAsync<StoredBooking, BookingContextError> {
  return deps.bookings
    .findById(scope, id)
    .andThen((found): AppResultAsync<StoredBooking, NotFoundAppError> =>
      found === null ? errAsync(bookingNotFound()) : okAsync(found),
    );
}
