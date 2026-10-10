import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { locationNotFound } from '../domain/errors/booking-errors';
import { parseBookingLocationId } from '../domain/models/ids';

import { scopeOf } from './booking-scope';

import type { BookingDependencies } from './booking-dependencies';
import type { BookingLocation } from '../domain/models/booking-location';

/** Everything an operation on one existing location can fail with. */
export type LoadLocationError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface AuthorizedLocation {
  readonly actor: Actor;
  readonly location: BookingLocation;
}

/**
 * The shared first half of every operation on an existing location:
 * permission first (so a caller without it learns nothing about which ids
 * exist), then a lookup by (id, actor.tenantId) so another tenant's id is
 * simply "not found", then a check against the STORED record's tenant.
 */
export function loadAuthorizedLocation(
  deps: BookingDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedLocation, LoadLocationError> {
  const { authorization, locations } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseBookingLocationId(rawId)
      .asyncAndThen((id) => locations.findById(id, actor.tenantId))
      .andThen((record): AppResultAsync<BookingLocation, NotFoundAppError> =>
        record === null ? errAsync(locationNotFound()) : okAsync(record),
      )
      .andThen((record) =>
        authorization
          .requireOnResource(permission, scopeOf(record))
          .map((verifiedActor) => ({ actor: verifiedActor, location: record })),
      ),
  );
}
