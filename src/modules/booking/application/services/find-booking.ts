import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { bookingNotFound } from '../../domain/errors/booking-errors';
import { heldResourceIds } from '../../domain/models/booking';
import { parseBookingId } from '../../domain/models/ids';

import { withContext } from './booking-context';
import { scopeOfActor } from './booking-scope';

import type { BookableResource } from '../../domain/models/bookable-resource';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';
import type { BookingContext } from './booking-context';

/** Everything the lookup of one existing booking can fail with once the actor is authorized. */
export type FindBookingError = ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface FoundBooking extends BookingContext {
  readonly actor: Actor;
  readonly scope: BookingScope;
}

/**
 * The booking an authorized actor names, with the service and the location it refers to, as every
 * rule and view needs them. It is looked up by the id AND the actor's scope (the website auth has
 * just authorized), so a booking of another website is "not found", the same answer as a booking
 * that does not exist.
 */
export function findBooking(
  deps: BookingDependencies,
  actor: Actor,
  rawId: string,
): AppResultAsync<FoundBooking, FindBookingError> {
  const scope = scopeOfActor(actor);
  return parseBookingId(rawId)
    .asyncAndThen((id) => deps.bookings.findById(scope, id))
    .andThen((found): AppResultAsync<StoredBooking, NotFoundAppError> =>
      found === null ? errAsync(bookingNotFound()) : okAsync(found),
    )
    .andThen((stored) => withContext(deps, scope, stored))
    .map((context) => ({ ...context, actor, scope }));
}

/**
 * `findBooking` for an employee, who reaches only the bookings they serve. Their own calendar is
 * found by the signed-in person (`assignedActorId`), never by an id from the request; a booking
 * they do not hold, or a person who has no calendar, gets "not found", so an employee cannot tell a
 * colleague's booking from a missing one.
 */
export function findEmployeeBooking(
  deps: BookingDependencies,
  actor: Actor,
  rawId: string,
): AppResultAsync<FoundBooking & { readonly own: BookableResource }, FindBookingError> {
  return findBooking(deps, actor, rawId).andThen((found) =>
    deps.resources.findEmployeeOf(found.scope, actor.id).andThen((own) => {
      if (own === null || !heldResourceIds(found.stored.booking).includes(own.id)) {
        return errAsync<never, NotFoundAppError>(bookingNotFound());
      }
      return okAsync({ ...found, own });
    }),
  );
}
