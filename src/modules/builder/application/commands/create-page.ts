import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createPageDraft } from '../../domain/models/page';
import { toPageSummaryView } from '../builder-view-mappers';

import type { BuilderAccessError } from '../../domain/ports/builder-access.port';
import type { BuilderDependencies } from '../builder-dependencies';
import type { CreatePageInput } from '../contracts/page-inputs';
import type { PageSummaryView } from '../contracts/page-views';

export type CreatePageError =
  BuilderAccessError | NotFoundAppError | ConflictAppError | InfrastructureAppError;

/**
 * Creates an empty page on a website the actor may add pages to.
 *
 * The website is the one the request names, authorized from the actor's memberships in it;
 * the repository then resolves it by (websiteId, authorized tenant), so a website that does not
 * exist is simply "not found".
 */
export class CreatePage {
  constructor(private readonly deps: BuilderDependencies) {}

  execute(input: CreatePageInput): AppResultAsync<PageSummaryView, CreatePageError> {
    const { access, pages, audit } = this.deps;

    return access.authorizeWebsite('page.create', input.websiteId).andThen((scope) =>
      createPageDraft(input).asyncAndThen((draft) =>
        pages.create({ tenantId: scope.tenantId, draft }).map((page) => {
          audit.record({
            type: 'page.created',
            actorId: scope.actorId,
            tenantId: scope.tenantId,
            pageId: page.id,
            websiteId: page.websiteId,
          });
          return toPageSummaryView(page);
        }),
      ),
    );
  }
}
