import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { bookingNotFound } from '../../domain/errors/booking-errors';
import { parseBookingReference } from '../../domain/models/booking-reference';
import { isCustomerOf } from '../../domain/policies/customer-access';

import { withContext } from './booking-context';

import type { BookingScope } from '../../domain/ports/booking.repository';
import type { BookingFlowDependencies } from '../booking-dependencies';
import type { BookingContext } from './booking-context';

export type FindOwnBookingError = ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The booking a visitor reaches with its reference AND the address it was made with. A reference
 * that does not exist, one in another website, and one whose address does not match all answer the
 * same "not found", so the answer cannot be used to find out which references exist or whose they
 * are. Looking a booking up is rate limited per address by the callers.
 */
export function findOwnBooking(
  deps: BookingFlowDependencies,
  scope: BookingScope,
  key: { readonly reference: string; readonly email: string },
): AppResultAsync<BookingContext, FindOwnBookingError> {
  return parseBookingReference(key.reference).asyncAndThen((reference) =>
    deps.bookings
      .findByReference(scope, reference)
      .andThen((found): AppResultAsync<NonNullable<typeof found>, NotFoundAppError> =>
        found !== null && isCustomerOf(found.booking, key.email)
          ? okAsync(found)
          : errAsync(bookingNotFound()),
      )
      .andThen((stored) => withContext(deps, scope, stored)),
  );
}
