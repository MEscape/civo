import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { websiteNotFound } from '../domain/errors/website-errors';
import { parseWebsiteId } from '../domain/models/ids';

import { scopeOf } from './website-scope';

import type { WebsiteDependencies } from './website-dependencies';
import type { Website } from '../domain/models/website';

/** Everything an operation on one existing website can fail with. */
export type LoadWebsiteError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface AuthorizedWebsite {
  readonly actor: Actor;
  readonly website: Website;
}

/**
 * The shared first half of every operation on an existing website:
 *
 *  1. `requireInTenant` FIRST, so a caller without the permission learns
 *     nothing about which ids exist.
 *  2. Look the website up by (id, actor.tenantId): another tenant's id is
 *     simply "not found".
 *  3. `requireOnResource` against the STORED tenant, the backstop should a
 *     repository ever return a foreign record.
 */
export function loadAuthorizedWebsite(
  deps: WebsiteDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedWebsite, LoadWebsiteError> {
  const { authorization, websites } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseWebsiteId(rawId)
      .asyncAndThen((id) => websites.findById(id, actor.tenantId))
      .andThen((website): AppResultAsync<Website, NotFoundAppError> =>
        website === null ? errAsync(websiteNotFound()) : okAsync(website),
      )
      .andThen((website) =>
        authorization
          .requireOnResource(permission, scopeOf(website))
          .map((verifiedActor) => ({ actor: verifiedActor, website })),
      ),
  );
}
