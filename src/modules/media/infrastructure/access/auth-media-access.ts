import type { AuthorizationService, getAuthQueries, Permission } from '@modules/auth';

import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MEDIA_VALIDATION_CODES, fieldValidationFailed } from '../../domain/errors/media-errors';

import type {
  MediaAccess,
  MediaAccessError,
  MediaScope,
} from '../../domain/ports/media-access.port';

/** Delegates target permissions to auth; no actor or membership is captured at construction. */
export class AuthMediaAccess implements MediaAccess {
  constructor(
    private readonly getQueries: () => Pick<
      ReturnType<typeof getAuthQueries>,
      'authorizeWebsiteAccess'
    >,
    private readonly authorization: Pick<AuthorizationService, 'requireActor'>,
  ) {}

  authorizeWebsite(
    permission: Permission,
    rawWebsiteId: unknown,
  ): AppResultAsync<MediaScope, MediaAccessError> {
    return this.authorization.requireActor().andThen((actor) => {
      if (typeof rawWebsiteId !== 'string') {
        return errAsync(fieldValidationFailed('websiteId', MEDIA_VALIDATION_CODES.websiteInvalid));
      }
      return this.getQueries()
        .authorizeWebsiteAccess.execute(permission, rawWebsiteId)
        .map((tenantId) => ({ actorId: actor.id, tenantId }));
    });
  }
}
