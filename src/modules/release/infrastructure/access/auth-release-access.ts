import type { AuthorizationService, getAuthQueries, Permission } from '@modules/auth';

import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  RELEASE_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/release-errors';
import { parseWebsiteId } from '../../domain/models/ids';

import type {
  ReleaseAccess,
  ReleaseAccessError,
  ReleaseScope,
} from '../../domain/ports/release-access.port';

/** Delegates target permissions to auth; no actor or membership is captured at construction. */
export class AuthReleaseAccess implements ReleaseAccess {
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
  ): AppResultAsync<ReleaseScope, ReleaseAccessError> {
    return this.authorization.requireActor().andThen((actor) => {
      if (typeof rawWebsiteId !== 'string') {
        return errAsync(fieldValidationFailed('websiteId', RELEASE_VALIDATION_CODES.idInvalid));
      }
      return parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
        this.getQueries()
          .authorizeWebsiteAccess.execute(permission, websiteId)
          // Audit and rate-limit subjects belong to the authorized target, even when another website is open.
          .map((tenantId) => ({ websiteId, actor: { ...actor, tenantId } })),
      );
    });
  }
}
