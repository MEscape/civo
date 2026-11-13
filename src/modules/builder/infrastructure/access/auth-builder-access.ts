import type { AuthorizationService, getAuthQueries, Permission } from '@modules/auth';

import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BUILDER_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/builder-errors';

import type {
  BuilderAccess,
  BuilderAccessError,
  BuilderScope,
} from '../../domain/ports/builder-access.port';

/** Delegates target permissions to auth; no actor or membership is captured at construction. */
export class AuthBuilderAccess implements BuilderAccess {
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
  ): AppResultAsync<BuilderScope, BuilderAccessError> {
    return this.authorization.requireActor().andThen((actor) => {
      if (typeof rawWebsiteId !== 'string') {
        return errAsync(fieldValidationFailed('websiteId', BUILDER_VALIDATION_CODES.idInvalid));
      }
      return this.getQueries()
        .authorizeWebsiteAccess.execute(permission, rawWebsiteId)
        .map((tenantId) => ({ actorId: actor.id, tenantId }));
    });
  }

  mayInWebsite(permission: Permission, rawWebsiteId: unknown) {
    return this.authorizeWebsite(permission, rawWebsiteId)
      .map(() => true)
      .orElse((error) => (error.kind === 'forbidden' ? okAsync(false) : errAsync(error)));
  }
}
