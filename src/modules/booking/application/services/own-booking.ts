import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  bookingNotFound,
  locationNotFound,
  serviceNotFound,
} from '../../domain/errors/booking-errors';
import { normalizeEmail } from '../../domain/models/booking-customer';
import { parseBookingReference } from '../../domain/models/booking-reference';

import type { PublicScope } from './public-scope';
import type { BookableService } from '../../domain/models/bookable-service';
import type { Booking } from '../../domain/models/booking';
import type { BookingLocation } from '../../domain/models/booking-location';
import type { PublicBookingDependencies } from '../booking-dependencies';

export interface BookingParts {
  readonly booking: Booking;
  readonly service: BookableService;
  readonly location: BookingLocation;
}

export type BookingPartsError = NotFoundAppError | InfrastructureAppError;
export type OwnBookingError = ValidationAppError | BookingPartsError;

type PartsDependencies = Pick<PublicBookingDependencies, 'services' | 'locations'>;
type OwnDependencies = Pick<PublicBookingDependencies, 'services' | 'locations' | 'bookings'>;

/** A booking together with the service and location it refers to. A dangling reference counts as "not found". */
export function loadBookingParts(
  deps: PartsDependencies,
  scope: PublicScope,
  booking: Booking,
): AppResultAsync<BookingParts, BookingPartsError> {
  return deps.services.findById(booking.serviceId, scope.tenantId).andThen((service) =>
    deps.locations
      .findById(booking.locationId, scope.tenantId)
      .andThen((location): AppResultAsync<BookingParts, NotFoundAppError> => {
        if (service === null) {
          return errAsync(serviceNotFound());
        }
        if (location === null) {
          return errAsync(locationNotFound());
        }
        return okAsync({ booking, service, location });
      }),
  );
}

/**
 * Finds a visitor's booking from the reference they were given and the
 * e-mail address they used. A wrong address answers exactly like an unknown
 * reference ("not found"), so the pair cannot be used to probe which
 * references exist.
 */
export function loadOwnBooking(
  deps: OwnDependencies,
  scope: PublicScope,
  claim: { readonly reference: string; readonly email: string },
): AppResultAsync<BookingParts, OwnBookingError> {
  return parseBookingReference(claim.reference).asyncAndThen((reference) =>
    deps.bookings
      .findByReference(reference, scope.websiteId, scope.tenantId)
      .andThen((booking): AppResultAsync<Booking, NotFoundAppError> => {
        const isOwner =
          booking !== null &&
          booking.customer !== null &&
          booking.customer.email === normalizeEmail(claim.email);
        return isOwner ? okAsync(booking) : errAsync(bookingNotFound());
      })
      .andThen((booking) => loadBookingParts(deps, scope, booking)),
  );
}
