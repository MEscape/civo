import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { releaseWebsiteNotFound } from '../domain/errors/release-errors';
import { parseWebsiteId } from '../domain/models/ids';

import type { ReleaseDependencies } from './release-dependencies';
import type { PublishableWebsite } from '../domain/models/publishable';

/** Everything an operation on one website's releases can fail with. */
export type LoadReleaseWebsiteError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface AuthorizedReleaseWebsite {
  readonly actor: Actor;
  readonly website: PublishableWebsite;
}

/**
 * The shared first half of every release operation:
 *
 *  1. `requireInTenant` FIRST, so a caller without the permission learns
 *     nothing about which websites exist.
 *  2. Resolve the website through the website module, which enforces the
 *     actor's tenant: another tenant's website is simply "not found".
 *
 * Releases belong to a website and carry no tenant of their own, so
 * reaching a release only through an authorized website is what isolates
 * tenants here.
 *
 * @tenant-scope delegated The website module loads by the actor's tenant and checks the stored website's scope itself.
 */
export function loadAuthorizedReleaseWebsite(
  deps: ReleaseDependencies,
  rawWebsiteId: string,
  permission: Permission,
): AppResultAsync<AuthorizedReleaseWebsite, LoadReleaseWebsiteError> {
  const { authorization, websites } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseWebsiteId(rawWebsiteId)
      .asyncAndThen((id) => websites.findById(id))
      .andThen((website): AppResultAsync<PublishableWebsite, NotFoundAppError> =>
        website === null ? errAsync(releaseWebsiteNotFound()) : okAsync(website),
      )
      .map((website) => ({ actor, website })),
  );
}
