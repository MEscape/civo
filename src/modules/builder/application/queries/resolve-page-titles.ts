import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { okAsync, parseValidIds } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parsePageId, parseWebsiteId } from '../../domain/models/ids';
import { MAX_RESOLVED_PAGE_TITLES } from '../list-limits';

import type { PageTitleView } from '../contracts/page-views';
import type { PageAccessDependencies } from '../page-dependencies';

/**
 * The titles of some pages of a website, so a screen that keeps only page
 * ids (the audit log) can name them. Whoever may read pages may ask; an id
 * that is no page of the website (malformed, deleted, another website's)
 * yields nothing, so the caller tells "gone" from "named".
 */
export class ResolvePageTitles {
  constructor(private readonly deps: PageAccessDependencies) {}

  execute(
    websiteId: string,
    rawIds: readonly string[],
  ): AppResultAsync<
    readonly PageTitleView[],
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const ids = parseValidIds(rawIds, parsePageId, MAX_RESOLVED_PAGE_TITLES);

    return this.deps.authorization
      .requireInTenant('page.read')
      .andThen((actor) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          ids.length === 0
            ? okAsync<readonly PageTitleView[]>([])
            : this.deps.pages.findTitles(id, actor.tenantId, ids),
        ),
      );
  }
}
