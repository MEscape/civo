import type { AuthorizationError } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createPageDraft } from '../../domain/models/page';
import { toPageSummaryView } from '../page-view-mappers';

import type { CreatePageInput, PageSummaryView } from '../contracts/page-views';
import type { PageDependencies } from '../page-dependencies';

export type CreatePageError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

/**
 * Creates an empty page on one of the actor's websites.
 *
 * There is no loaded resource to check, so the tenant scoping is the
 * guard: the repository resolves the website by (websiteId, actor.tenantId),
 * and another tenant's website is simply "not found".
 */
export class CreatePage {
  constructor(private readonly deps: PageDependencies) {}

  execute(input: CreatePageInput): AppResultAsync<PageSummaryView, CreatePageError> {
    const { authorization, pages, audit } = this.deps;

    return authorization.requireInTenant('page.create').andThen((actor) =>
      createPageDraft(input).asyncAndThen((draft) =>
        pages.create({ tenantId: actor.tenantId, draft }).map((page) => {
          audit.record({
            type: 'page.created',
            actorId: actor.id,
            tenantId: actor.tenantId,
            pageId: page.id,
            websiteId: page.websiteId,
          });
          return toPageSummaryView(page);
        }),
      ),
    );
  }
}
