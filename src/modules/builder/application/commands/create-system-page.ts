import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createSystemPageDraft } from '../../domain/models/page';
import { checkComposition } from '../../domain/rules/page-save-checks';
import { toPageSummaryView } from '../page-view-mappers';

import type { CreateSystemPageInput, PageSummaryView } from '../contracts/page-views';
import type { SystemPageDependencies } from '../page-dependencies';

/**
 * `validation` here means the blueprint was rejected: a template that
 * produced an unknown component or an illegal nesting is a bug in that
 * template, and the caller decides how to report it.
 */
export type CreateSystemPageError =
  ValidationAppError | NotFoundAppError | ConflictAppError | InfrastructureAppError;

/**
 * Seeds a page with a prepared tree, for trusted modules (website
 * provisioning). Deliberately has no actor and no authorization: it is
 * exported only through the builder's public API for module-to-module use,
 * and `tenantId` MUST come from a stored record, never a request. The
 * content gets the same checks as a user save, minus the edit scope: the
 * system may build any structure.
 *
 * @authorization system Called by the website module right after it created and authorized the website; never reachable from a request.
 */
export class CreateSystemPage {
  constructor(private readonly deps: SystemPageDependencies) {}

  execute(input: CreateSystemPageInput): AppResultAsync<PageSummaryView, CreateSystemPageError> {
    const { pages, components, audit } = this.deps;

    return createSystemPageDraft(input)
      .andThen((draft) => checkComposition(draft.config, components).map(() => draft))
      .asyncAndThen((draft) => pages.create({ tenantId: input.tenantId, draft }))
      .map((page) => {
        audit.record({
          type: 'page.system_created',
          tenantId: page.tenantId,
          pageId: page.id,
          websiteId: page.websiteId,
        });
        return toPageSummaryView(page);
      });
  }
}
