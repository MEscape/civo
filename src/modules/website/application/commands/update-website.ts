import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { definedKeys } from '@lib/utils';

import { isEmptyChanges, onlyRealChanges, parseWebsiteChanges } from '../../domain/models/website';
import { WEBSITE_RATE_LIMITS } from '../rate-limits';
import { findWebsite } from '../services/find-website';
import { withinActorLimit } from '../services/within-actor-limit';
import { toWebsiteView } from '../website-view-mappers';

import type { Website } from '../../domain/models/website';
import type { UpdateWebsiteInput, WebsiteView } from '../contracts/website-views';
import type { ExistingWebsiteDependencies, WebsiteMutationError } from '../website-dependencies';

/** Renames a website or edits its description. The slug is immutable: it is a public URL. */
export class UpdateWebsite {
  constructor(private readonly deps: ExistingWebsiteDependencies) {}

  execute(input: UpdateWebsiteInput): AppResultAsync<WebsiteView, WebsiteMutationError> {
    const { websites, audit } = this.deps;

    return this.deps.access
      .authorizeWebsite('website.update', input.id)
      .andThen(withinActorLimit(this.deps, WEBSITE_RATE_LIMITS.update, (scope) => scope))
      .andThen((scope) =>
        findWebsite(websites, scope).andThen((website) =>
          parseWebsiteChanges(input)
            .map((parsed) => onlyRealChanges(parsed, website))
            .asyncAndThen(
              (changes): AppResultAsync<Website, NotFoundAppError | InfrastructureAppError> => {
                if (isEmptyChanges(changes)) {
                  return okAsync(website);
                }
                return websites.update(website.id, scope.tenantId, changes).map((updated) => {
                  audit.record({
                    type: 'website.updated',
                    actorId: scope.actorId,
                    tenantId: scope.tenantId,
                    websiteId: updated.id,
                    changedFields: definedKeys(changes),
                  });
                  return updated;
                });
              },
            )
            .map(toWebsiteView),
        ),
      );
  }
}
