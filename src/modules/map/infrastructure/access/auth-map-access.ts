import type { AuthorizationService, getAuthQueries } from '@modules/auth';

import { errAsync } from '@lib/result';

import { mapInvalidInput } from '../../domain/errors/map-errors';
import { parseWebsiteId } from '../../domain/models/ids';

import type { MapAccess } from '../../domain/ports/map-access.port';

/** Delegates every decision to auth's current memberships, including explicit cross-website targets. */
export class AuthMapAccess implements MapAccess {
  constructor(
    private readonly queries: typeof getAuthQueries,
    private readonly authorization: Pick<AuthorizationService, 'requireActor'>,
  ) {}

  authorizeWebsite(
    permission: 'page.read' | 'page.update' | 'release.publish',
    rawWebsiteId: unknown,
  ) {
    return this.authorization.requireActor().andThen((actor) =>
      typeof rawWebsiteId !== 'string'
        ? errAsync(mapInvalidInput())
        : parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
            this.queries()
              .authorizeWebsiteAccess.execute(permission, websiteId)
              .map(() => ({ websiteId, actorId: actor.id })),
          ),
    );
  }
}
