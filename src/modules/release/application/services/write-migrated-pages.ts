import type { ConflictAppError, ForbiddenAppError, UnauthorizedAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { isSuccessfulOutcome, judgeDraft } from '../../domain/migration/page-draft';

import type { AppliedPage } from '../../domain/migration/apply-migration';
import type { PageOutcome } from '../../domain/migration/page-draft';
import type { PageDraftError } from '../../domain/ports/page-source.port';
import type { ApplyMigrationDependencies } from '../release-dependencies';
import type { MigrationReview } from './migration-review';

/** Failures that must stop the whole operation instead of being reported per page. */
export type StopError = UnauthorizedAppError | ForbiddenAppError;

export interface PageResult {
  readonly path: string;
  readonly outcome: PageOutcome;
  readonly updatedNodeCount: number;
}

type PageWriteDependencies = Pick<ApplyMigrationDependencies, 'pages'>;
type PageWriteReview = Pick<MigrationReview, 'published' | 'drafts'>;

/**
 * An unauthenticated or forbidden builder call stops the operation. Someone
 * saving between our read and our write is the same as a diverged draft.
 * Any other failure is reported against its page, so the caller sees what
 * was written before it and can retry the rest.
 */
function settle(
  error: ConflictAppError | PageDraftError,
  toResult: (outcome: PageOutcome) => PageResult,
): AppResultAsync<PageResult, StopError> {
  if (error.kind === 'unauthorized' || error.kind === 'forbidden') {
    return errAsync(error);
  }
  return okAsync(toResult(error.kind === 'conflict' ? 'draft_diverged' : 'failed'));
}

function writePage(
  deps: PageWriteDependencies,
  review: PageWriteReview,
  page: AppliedPage,
): AppResultAsync<PageResult, StopError> {
  const toResult = (outcome: PageOutcome): PageResult => ({
    path: page.path,
    outcome,
    updatedNodeCount: isSuccessfulOutcome(outcome) ? page.updatedNodeIds.length : 0,
  });

  const published = review.published.get(page.path);
  const draft = review.drafts.get(page.path);
  if (published === undefined || draft === undefined) {
    return okAsync(toResult('page_missing'));
  }

  switch (judgeDraft(draft, published, page.children)) {
    case 'already_applied':
      return okAsync(toResult('already_applied'));
    case 'diverged':
      return okAsync(toResult('draft_diverged'));
    case 'writable':
      return deps.pages
        .replaceChildren({
          websiteId: draft.websiteId,
          pageId: draft.pageId,
          expectedVersion: draft.version,
          children: page.children,
        })
        .map(() => toResult('written'))
        .orElse((error) => settle(error, toResult));
  }
}

/** One page after another: the builder revises pages independently, and the order is stable. */
export function writeMigratedPages(
  deps: PageWriteDependencies,
  review: PageWriteReview,
  pages: readonly AppliedPage[],
): AppResultAsync<readonly PageResult[], StopError> {
  return pages.reduce<AppResultAsync<readonly PageResult[], StopError>>(
    (done, page) =>
      done.andThen((results) =>
        writePage(deps, review, page).map((result) => [...results, result]),
      ),
    okAsync([]),
  );
}
