import type { TenantId } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { Page, PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';
import type { Website, WebsiteChanges, WebsiteDraft, WebsiteSummary } from '../models/website';
import type { WebsiteTheme } from '../models/website-theme';

export interface NewWebsite {
  readonly draft: WebsiteDraft;
  readonly theme: WebsiteTheme;
}

/**
 * Persistence for websites. Every tenant-owned read and write takes the
 * tenant and matches on (id, tenantId), so another tenant's id behaves
 * exactly like an id that does not exist. `findBySlug` is the one
 * unscoped lookup: it serves the public site, which has no actor.
 *
 * Finders return `null` for "absent"; deciding that absence is an error
 * is the use case's job. Adapters translate every driver failure into our
 * own error kinds before returning (errors.md).
 */
export interface WebsiteRepository {
  findById(
    id: WebsiteId,
    tenantId: TenantId,
  ): AppResultAsync<Website | null, InfrastructureAppError>;

  findBySlug(slug: string): AppResultAsync<Website | null, InfrastructureAppError>;

  /**
   * One page of every website of the platform, newest activity first, with the
   * total (performance.md: every list is bounded). Not tenant-scoped: only the
   * platform administrator's use case calls it.
   */
  list(page: PageRequest): AppResultAsync<Page<WebsiteSummary>, InfrastructureAppError>;

  /** The names of the websites of these tenants (a tenant is its website), by name. Bounded by `limit`; tenants that name no website are skipped. */
  findNames(
    tenantIds: readonly TenantId[],
    limit: number,
  ): AppResultAsync<
    ReadonlyArray<{ readonly id: WebsiteId; readonly name: string }>,
    InfrastructureAppError
  >;

  /**
   * Stores the website as its own tenant: a tenant is its website, so the
   * store gives the website one id and uses it as the tenant too.
   */
  create(input: NewWebsite): AppResultAsync<Website, ConflictAppError | InfrastructureAppError>;

  update(
    id: WebsiteId,
    tenantId: TenantId,
    changes: WebsiteChanges,
  ): AppResultAsync<Website, NotFoundAppError | InfrastructureAppError>;

  updateTheme(
    id: WebsiteId,
    tenantId: TenantId,
    theme: WebsiteTheme,
  ): AppResultAsync<Website, NotFoundAppError | InfrastructureAppError>;

  /** Idempotent: deleting a website that is already gone succeeds. */
  deleteById(id: WebsiteId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError>;
}
