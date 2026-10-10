import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { bookingNotFound } from '../domain/errors/booking-errors';
import { parseBookingId } from '../domain/models/ids';

import { scopeOf } from './booking-scope';

import type { BookingDependencies } from './booking-dependencies';
import type { Booking } from '../domain/models/booking';

/** Everything an operation on one existing booking can fail with. */
export type LoadBookingError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface AuthorizedBooking {
  readonly actor: Actor;
  readonly booking: Booking;
}

/**
 * The shared first half of every operation on an existing booking:
 * permission first (so a caller without it learns nothing about which ids
 * exist), then a lookup by (id, actor.tenantId) so another tenant's id is
 * simply "not found", then a check against the STORED record's tenant.
 */
export function loadAuthorizedBooking(
  deps: BookingDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedBooking, LoadBookingError> {
  const { authorization, bookings } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseBookingId(rawId)
      .asyncAndThen((id) => bookings.findById(id, actor.tenantId))
      .andThen((record): AppResultAsync<Booking, NotFoundAppError> =>
        record === null ? errAsync(bookingNotFound()) : okAsync(record),
      )
      .andThen((record) =>
        authorization
          .requireOnResource(permission, scopeOf(record))
          .map((verifiedActor) => ({ actor: verifiedActor, booking: record })),
      ),
  );
}
