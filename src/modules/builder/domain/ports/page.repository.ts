import type { TenantId } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  UnexpectedAppError,
} from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { PageId, WebsiteId } from '../models/ids';
import type { Page, PageDraft, PageSummary } from '../models/page';
import type { PageConfig } from '../models/page-config';
import type { SavedRevision } from '../models/page-revision';
import type { ReleasePage } from '../models/release-page';

/**
 * Reads fail with `unexpected` when stored JSON violates the page
 * invariants (`restorePageConfig`): reads fail closed, they never hand the
 * renderer a broken tree.
 */
export type PageReadError = InfrastructureAppError | UnexpectedAppError;

export interface NewPage {
  readonly tenantId: TenantId;
  readonly draft: PageDraft;
}

export interface SavePageConfigInput {
  readonly id: PageId;
  readonly tenantId: TenantId;
  readonly config: PageConfig;
  /** The revision the editor loaded. A newer stored revision means a conflict. */
  readonly expectedVersion: number;
}

/**
 * Persistence for pages. Every tenant-owned read and write takes the tenant
 * and matches on (id, tenantId), so another tenant's id behaves exactly like
 * an id that does not exist. `listReleasePages`
 * is the unscoped lookup: it serves a trusted publisher, which has no actor.
 * The public site never reads pages: it serves release snapshots.
 *
 * A page's tenant always equals its website's tenant: the database enforces
 * it with a composite foreign key, so a page can never be filed under a
 * foreign tenant's website.
 *
 * Finders return `null` for "absent"; deciding that absence is an error is
 * the use case's job. Adapters translate every driver failure into our own
 * error kinds before returning (errors.md).
 */
export interface PageRepository {
  findById(id: PageId, tenantId: TenantId): AppResultAsync<Page | null, PageReadError>;

  /** Identity and ownership only: no page JSON is read, so it is cheap on hot paths. */
  findSummaryById(
    id: PageId,
    tenantId: TenantId,
  ): AppResultAsync<PageSummary | null, InfrastructureAppError>;

  /** Bounded: never returns more than `limit` items (performance.md). */
  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly PageSummary[], InfrastructureAppError>;

  /**
   * Every page of a website with its latest configuration, restored
   * leniently: a damaged page is reported as such instead of failing the
   * read. Bounded: never returns more than `limit` items.
   */
  listReleasePages(
    websiteId: WebsiteId,
    limit: number,
  ): AppResultAsync<readonly ReleasePage[], InfrastructureAppError>;

  /** `NotFoundAppError` means the website does not exist in this tenant. */
  create(
    input: NewPage,
  ): AppResultAsync<Page, NotFoundAppError | ConflictAppError | InfrastructureAppError>;

  /**
   * Stores a new revision atomically against `expectedVersion`, so two
   * editors can never silently overwrite each other.
   */
  saveConfig(
    input: SavePageConfigInput,
  ): AppResultAsync<SavedRevision, ConflictAppError | NotFoundAppError | InfrastructureAppError>;
}
