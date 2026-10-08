import type { Actor, AuthorizationError, Permission, TenantId } from '@modules/auth';

import type {
  AppError,
  InfrastructureAppError,
  NotFoundAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { pageNotFound } from '../domain/errors/builder-errors';
import { parsePageId } from '../domain/models/ids';

import { scopeOf } from './page-scope';

import type { PageAccessDependencies } from './page-dependencies';
import type { PageId } from '../domain/models/ids';
import type { Page, PageSummary } from '../domain/models/page';

/** Everything an operation that needs only the page's identity can fail with. */
export type LoadPageSummaryError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/** Reading the config can additionally fail closed on corrupted stored JSON. */
export type LoadPageError = LoadPageSummaryError | UnexpectedAppError;

export interface AuthorizedPageContext<TPage extends PageSummary> {
  readonly actor: Actor;
  readonly page: TPage;
}

type PageLookup<TPage extends PageSummary, TError extends AppError> = (
  id: PageId,
  tenantId: TenantId,
) => AppResultAsync<TPage | null, TError>;

/**
 * The shared first half of every operation on an existing page:
 *
 *  1. `requireInTenant` FIRST, so a caller without the permission learns
 *     nothing about which ids exist.
 *  2. Look the page up by (id, actor.tenantId): another tenant's id is
 *     simply "not found".
 *  3. `requireOnResource` against the STORED tenant, the backstop should a
 *     repository ever return a foreign record.
 */
function loadAuthorized<TPage extends PageSummary, TError extends AppError>(
  deps: PageAccessDependencies,
  request: { readonly rawId: string; readonly permission: Permission },
  find: PageLookup<TPage, TError>,
): AppResultAsync<
  AuthorizedPageContext<TPage>,
  AuthorizationError | ValidationAppError | NotFoundAppError | TError
> {
  const { authorization } = deps;
  const { rawId, permission } = request;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parsePageId(rawId)
      .asyncAndThen((id) => find(id, actor.tenantId))
      .andThen((page): AppResultAsync<TPage, NotFoundAppError> =>
        page === null ? errAsync(pageNotFound()) : okAsync(page),
      )
      .andThen((page) =>
        authorization
          .requireOnResource(permission, scopeOf(page))
          .map((verifiedActor) => ({ actor: verifiedActor, page })),
      ),
  );
}

/** Loads a page with its config, for operations that read or compare it. */
export function loadAuthorizedPage(
  deps: PageAccessDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedPageContext<Page>, LoadPageError> {
  return loadAuthorized(deps, { rawId, permission }, (id, tenantId) =>
    deps.pages.findById(id, tenantId),
  );
}

/**
 * Loads only the page's identity and ownership. For operations that need
 * the website or the tenant but not the config (a render runs on every
 * edit and must not read a megabyte of JSON each time).
 */
export function loadAuthorizedPageSummary(
  deps: PageAccessDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedPageContext<PageSummary>, LoadPageSummaryError> {
  return loadAuthorized(deps, { rawId, permission }, (id, tenantId) =>
    deps.pages.findSummaryById(id, tenantId),
  );
}
