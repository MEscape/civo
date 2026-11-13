import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { websiteNotFound } from '../../domain/errors/website-errors';

import type { Website } from '../../domain/models/website';
import type { WebsiteScope } from '../../domain/ports/website-access.port';
import type { WebsiteRepository } from '../../domain/ports/website.repository';

/** Loads only the authorized target; a missing or inconsistent record never escapes the tenant boundary. */
export function findWebsite(
  websites: WebsiteRepository,
  scope: WebsiteScope,
): AppResultAsync<Website, NotFoundAppError | InfrastructureAppError> {
  return websites
    .findById(scope.websiteId, scope.tenantId)
    .andThen((website) =>
      website?.id !== scope.websiteId || website.tenantId !== scope.tenantId
        ? errAsync(websiteNotFound())
        : okAsync(website),
    );
}
