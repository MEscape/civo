import type { AuthorizationService, getAuthQueries, Permission } from '@modules/auth';

import { errAsync } from '@lib/result';

import {
  fieldValidationFailed,
  DATA_SOURCE_VALIDATION_CODES,
} from '../../domain/errors/data-source-errors';
import { parseWebsiteId } from '../../domain/models/ids';

import type { DataSourceAccess } from '../../domain/ports/data-source-access.port';

/** Resolves current membership authority for the target, independently of the selected website. */
export class AuthDataSourceAccess implements DataSourceAccess {
  constructor(
    private readonly getQueries: typeof getAuthQueries,
    private readonly authorization: Pick<AuthorizationService, 'requireActor'>,
  ) {}

  authorizeWebsite(permission: Permission, rawWebsiteId: unknown) {
    return this.authorization.requireActor().andThen((actor) =>
      typeof rawWebsiteId !== 'string'
        ? errAsync(fieldValidationFailed('websiteId', DATA_SOURCE_VALIDATION_CODES.idInvalid))
        : parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
            this.getQueries()
              .authorizeWebsiteAccess.execute(permission, websiteId)
              .map((tenantId) => ({ websiteId, tenantId, actorId: actor.id })),
          ),
    );
  }
}
