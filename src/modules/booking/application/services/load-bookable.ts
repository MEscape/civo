import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_ERROR_CODES as CODES,
  bookingConflict,
  locationNotFound,
  serviceNotFound,
} from '../../domain/errors/booking-errors';
import { parseBookableServiceId, parseBookingLocationId } from '../../domain/models/ids';
import { serviceAtLocation } from '../../domain/models/service-at-location';
import { evaluateBookable } from '../../domain/policies/service-policy';

import type { BookableService } from '../../domain/models/bookable-service';
import type { BookingChannel } from '../../domain/policies/service-policy';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { BookingDependencies, BookingFlowDependencies } from '../booking-dependencies';

export interface BookableContext {
  readonly service: BookableService;
  readonly location: BookingLocationFacts;
}

export type BookableContextError =
  ValidationAppError | NotFoundAppError | ConflictAppError | InfrastructureAppError;

type Reads = Pick<BookingDependencies | BookingFlowDependencies, 'services' | 'locations'>;

/** The stored service at a stored location, found in the scope, or "not found": another website's looks the same. */
export function loadServiceAndLocation(
  deps: Reads,
  scope: BookingScope,
  raw: { readonly serviceId: string; readonly locationId: string },
): AppResultAsync<BookableContext, ValidationAppError | NotFoundAppError | InfrastructureAppError> {
  return parseBookableServiceId(raw.serviceId)
    .andThen((serviceId) =>
      parseBookingLocationId(raw.locationId).map((locationId) => ({ serviceId, locationId })),
    )
    .asyncAndThen(({ serviceId, locationId }) =>
      deps.services
        .findById(scope, serviceId)
        .andThen((service): AppResultAsync<BookableService, NotFoundAppError> =>
          service === null ? errAsync(serviceNotFound()) : okAsync(service),
        )
        .andThen((service) =>
          deps.locations
            .findById(scope, locationId)
            .andThen((location): AppResultAsync<BookingLocationFacts, NotFoundAppError> =>
              location === null ? errAsync(locationNotFound()) : okAsync(location),
            )
            .map((location) => ({ service: serviceAtLocation(service, location.id), location })),
        ),
    );
}

/**
 * `loadServiceAndLocation` for a booking that is about to be made: the service must be switched on
 * and offered at the location (and, for a visitor, take online bookings there), and the location
 * must be open to bookings. Whether the service may
 * be booked HERE is the domain's rule (`evaluateBookable`); this only turns its answer into errors.
 */
export function loadBookable(
  deps: Reads,
  scope: BookingScope,
  raw: {
    readonly serviceId: string;
    readonly locationId: string;
    readonly channel: BookingChannel;
  },
): AppResultAsync<BookableContext, BookableContextError> {
  const { channel } = raw;
  return loadServiceAndLocation(deps, scope, raw).andThen((context) => {
    const denial = evaluateBookable(context.service, context.location.id, channel);
    if (denial === 'service-inactive') {
      return errAsync(bookingConflict(CODES.serviceInactive, 'The service cannot be booked.'));
    }
    if (denial === 'location-not-offered' || !context.location.isActive) {
      return errAsync(
        bookingConflict(CODES.locationNotOffered, 'The service is not offered here.'),
      );
    }
    return okAsync(context);
  });
}
