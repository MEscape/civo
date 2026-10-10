import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { resourceNotFound } from '../domain/errors/booking-errors';
import { parseBookableResourceId } from '../domain/models/ids';

import { scopeOf } from './booking-scope';

import type { BookingDependencies } from './booking-dependencies';
import type { BookableResource } from '../domain/models/bookable-resource';

/** Everything an operation on one existing resource can fail with. */
export type LoadResourceError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface AuthorizedResource {
  readonly actor: Actor;
  readonly resource: BookableResource;
}

/**
 * The shared first half of every operation on an existing resource:
 * permission first (so a caller without it learns nothing about which ids
 * exist), then a lookup by (id, actor.tenantId) so another tenant's id is
 * simply "not found", then a check against the STORED record's tenant.
 */
export function loadAuthorizedResource(
  deps: BookingDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedResource, LoadResourceError> {
  const { authorization, resources } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseBookableResourceId(rawId)
      .asyncAndThen((id) => resources.findById(id, actor.tenantId))
      .andThen((record): AppResultAsync<BookableResource, NotFoundAppError> =>
        record === null ? errAsync(resourceNotFound()) : okAsync(record),
      )
      .andThen((record) =>
        authorization
          .requireOnResource(permission, scopeOf(record))
          .map((verifiedActor) => ({ actor: verifiedActor, resource: record })),
      ),
  );
}
