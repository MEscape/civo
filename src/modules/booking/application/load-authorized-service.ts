import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { serviceNotFound } from '../domain/errors/booking-errors';
import { parseBookableServiceId } from '../domain/models/ids';

import { scopeOf } from './booking-scope';

import type { BookingDependencies } from './booking-dependencies';
import type { BookableService } from '../domain/models/bookable-service';

/** Everything an operation on one existing service can fail with. */
export type LoadServiceError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface AuthorizedService {
  readonly actor: Actor;
  readonly service: BookableService;
}

/**
 * The shared first half of every operation on an existing service:
 * permission first (so a caller without it learns nothing about which ids
 * exist), then a lookup by (id, actor.tenantId) so another tenant's id is
 * simply "not found", then a check against the STORED record's tenant.
 */
export function loadAuthorizedService(
  deps: BookingDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedService, LoadServiceError> {
  const { authorization, services } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseBookableServiceId(rawId)
      .asyncAndThen((id) => services.findById(id, actor.tenantId))
      .andThen((record): AppResultAsync<BookableService, NotFoundAppError> =>
        record === null ? errAsync(serviceNotFound()) : okAsync(record),
      )
      .andThen((record) =>
        authorization
          .requireOnResource(permission, scopeOf(record))
          .map((verifiedActor) => ({ actor: verifiedActor, service: record })),
      ),
  );
}
