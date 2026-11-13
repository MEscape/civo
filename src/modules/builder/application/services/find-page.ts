import type {
  AppError,
  InfrastructureAppError,
  NotFoundAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { pageNotFound } from '../../domain/errors/builder-errors';
import { parsePageId } from '../../domain/models/ids';

import type { PageId } from '../../domain/models/ids';
import type { Page, PageSummary } from '../../domain/models/page';
import type { BuilderScope } from '../../domain/ports/builder-access.port';
import type { PageRepository } from '../../domain/ports/page.repository';

/** Everything an operation that needs only the page's identity can fail with. */
export type FindPageSummaryError = ValidationAppError | NotFoundAppError | InfrastructureAppError;

/** Reading the config can additionally fail closed on corrupted stored JSON. */
export type FindPageError = FindPageSummaryError | UnexpectedAppError;

type Lookup<TPage extends PageSummary, TError extends AppError> = (
  id: PageId,
  scope: BuilderScope,
) => AppResultAsync<TPage | null, TError>;

/**
 * Loads one page of the authorized website. Another website's id is simply "not found", and a
 * record from another tenant is refused even if a repository ever returned one.
 */
function findIn<
  TPage extends PageSummary,
  TError extends InfrastructureAppError | UnexpectedAppError,
>(
  scope: BuilderScope,
  rawId: string,
  find: Lookup<TPage, TError>,
): AppResultAsync<TPage, ValidationAppError | NotFoundAppError | TError> {
  return parsePageId(rawId)
    .asyncAndThen((id) => find(id, scope))
    .andThen((page): AppResultAsync<TPage, NotFoundAppError> =>
      page?.tenantId === scope.tenantId ? okAsync(page) : errAsync(pageNotFound()),
    );
}

/** A page with its config, for operations that read or compare it. */
export function findPage(
  pages: PageRepository,
  scope: BuilderScope,
  rawId: string,
): AppResultAsync<Page, FindPageError> {
  return findIn(scope, rawId, (id) => pages.findById(id, scope.tenantId));
}

/**
 * Only the page's identity and ownership. For operations that need the website but not the
 * config (a render runs on every edit and must not read a megabyte of JSON each time).
 */
export function findPageSummary(
  pages: PageRepository,
  scope: BuilderScope,
  rawId: string,
): AppResultAsync<PageSummary, FindPageSummaryError> {
  return findIn(scope, rawId, (id) => pages.findSummaryById(id, scope.tenantId));
}
