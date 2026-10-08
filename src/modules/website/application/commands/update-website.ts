import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { definedKeys } from '@lib/utils';

import { isEmptyChanges, parseWebsiteChanges } from '../../domain/models/website';
import { loadAuthorizedWebsite } from '../load-authorized-website';
import { toWebsiteView } from '../website-view-mappers';

import type { Website } from '../../domain/models/website';
import type { UpdateWebsiteInput, WebsiteView } from '../contracts/website-views';
import type { LoadWebsiteError } from '../load-authorized-website';
import type { WebsiteDependencies } from '../website-dependencies';

/** Renames a website or edits its description. The slug is immutable: it is a public URL. */
export class UpdateWebsite {
  constructor(private readonly deps: WebsiteDependencies) {}

  execute(input: UpdateWebsiteInput): AppResultAsync<WebsiteView, LoadWebsiteError> {
    const { websites, audit } = this.deps;

    return loadAuthorizedWebsite(this.deps, input.id, 'website.update').andThen(
      ({ actor, website }) =>
        parseWebsiteChanges(input)
          .asyncAndThen(
            (changes): AppResultAsync<Website, NotFoundAppError | InfrastructureAppError> => {
              if (isEmptyChanges(changes)) {
                return okAsync(website);
              }
              return websites.update(website.id, actor.tenantId, changes).map((updated) => {
                audit.record({
                  type: 'website.updated',
                  actorId: actor.id,
                  tenantId: actor.tenantId,
                  websiteId: updated.id,
                  changedFields: definedKeys(changes),
                });
                return updated;
              });
            },
          )
          .map(toWebsiteView),
    );
  }
}
