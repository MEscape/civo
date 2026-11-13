import type { AuthorizationService, getAuthQueries, Permission } from '@modules/auth';

import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  fieldValidationFailed,
  WEBSITE_VALIDATION_CODES,
} from '../../domain/errors/website-errors';
import { parseWebsiteId, toWebsiteId } from '../../domain/models/ids';

import type {
  WebsiteAccess,
  WebsiteAccessError,
  WebsiteScope,
  ReadableWebsites,
} from '../../domain/ports/website-access.port';

/** Delegates membership reach and target permission checks to auth without capturing an actor. */
export class AuthWebsiteAccess implements WebsiteAccess {
  constructor(
    private readonly getQueries: () => Pick<
      ReturnType<typeof getAuthQueries>,
      'authorizeWebsiteAccess' | 'listAccessibleWebsites'
    >,
    private readonly authorization: Pick<AuthorizationService, 'requireActor'>,
  ) {}

  listReadableWebsites(): AppResultAsync<ReadableWebsites, WebsiteAccessError> {
    return this.getQueries()
      .listAccessibleWebsites.execute('website.read')
      .map((readable) => ({
        websiteIds: readable.isPlatform ? null : readable.websites.map(({ id }) => toWebsiteId(id)),
        // Platform name options are bounded too, but its table reads all websites independently of those options.
        isTruncated: !readable.isPlatform && readable.isTruncated,
      }));
  }

  authorizeWebsite(
    permission: Permission,
    rawWebsiteId: unknown,
  ): AppResultAsync<WebsiteScope, WebsiteAccessError> {
    return this.authorization.requireActor().andThen((actor) => {
      if (typeof rawWebsiteId !== 'string') {
        return errAsync(fieldValidationFailed('id', WEBSITE_VALIDATION_CODES.idInvalid));
      }
      return parseWebsiteId(rawWebsiteId).asyncAndThen((websiteId) =>
        this.getQueries()
          .authorizeWebsiteAccess.execute(permission, websiteId)
          .map((tenantId) => ({ websiteId, tenantId, actorId: actor.id })),
      );
    });
  }
}
