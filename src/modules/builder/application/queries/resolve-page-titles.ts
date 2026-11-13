import type { InfrastructureAppError } from '@lib/errors';
import { okAsync, parseValidIds } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parsePageId, parseWebsiteId } from '../../domain/models/ids';
import { MAX_RESOLVED_PAGE_TITLES } from '../builder-limits';

import type { BuilderAccessError } from '../../domain/ports/builder-access.port';
import type { BuilderAccessDependencies } from '../builder-dependencies';
import type { PageTitleView } from '../contracts/page-views';

/**
 * The titles of some pages of a website, so a screen that keeps only page
 * ids (the audit log) can name them. Whoever may read pages may ask; an id
 * that is no page of the website (malformed, deleted, another website's)
 * yields nothing, so the caller tells "gone" from "named".
 */
export class ResolvePageTitles {
  constructor(private readonly deps: BuilderAccessDependencies) {}

  execute(
    websiteId: string,
    rawIds: readonly string[],
  ): AppResultAsync<readonly PageTitleView[], BuilderAccessError | InfrastructureAppError> {
    const ids = parseValidIds(rawIds, parsePageId, MAX_RESOLVED_PAGE_TITLES);

    return this.deps.access
      .authorizeWebsite('page.read', websiteId)
      .andThen((scope) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          ids.length === 0
            ? okAsync<readonly PageTitleView[]>([])
            : this.deps.pages.findTitles(id, scope.tenantId, ids),
        ),
      );
  }
}
