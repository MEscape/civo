import type { TenantId } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  UnexpectedAppError,
} from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ReleaseId, WebsiteId } from '../models/ids';
import type { Release, ReleaseHistory, ReleaseSummary } from '../models/release';
import type { ReleaseComponentDependency, ReleaseSnapshot } from '../models/release-snapshot';

/** Reading a snapshot can also fail because the stored JSON is corrupted. */
export type ReleaseReadError = InfrastructureAppError | UnexpectedAppError;

export interface NewRelease {
  readonly websiteId: WebsiteId;
  readonly snapshot: ReleaseSnapshot;
  readonly publishedAt: Date;
}

export interface Activation {
  readonly release: ReleaseSummary;
  /** The release that was live before; `null` if there was none. */
  readonly previousReleaseId: ReleaseId | null;
}

/** What one live release declares, for impact analysis. */
export interface PublishedDependencies {
  readonly websiteId: WebsiteId;
  readonly releaseId: ReleaseId;
  readonly dependencies: readonly ReleaseComponentDependency[];
}

/**
 * Persistence for releases. A release is immutable once created: only its
 * `status` and the website's pointer to the live release ever change.
 *
 * Callers authorize through the website first; every release lookup is
 * then matched on (id, websiteId), so another website's release id
 * behaves exactly like an id that does not exist. `findPublished` is the
 * one unscoped read: it serves the public site, which has no actor.
 *
 * Finders return `null` for "absent"; deciding that absence is an error is
 * the use case's job. Adapters translate every driver failure into our own
 * error kinds before returning (errors.md).
 */
export interface ReleaseRepository {
  /** Bounded: never returns more than `limit` releases (performance.md). */
  findHistory(
    websiteId: WebsiteId,
    limit: number,
  ): AppResultAsync<ReleaseHistory, InfrastructureAppError>;

  findById(websiteId: WebsiteId, id: ReleaseId): AppResultAsync<Release | null, ReleaseReadError>;

  /** The release the public site serves, resolved through the live pointer only. */
  findPublished(websiteId: WebsiteId): AppResultAsync<Release | null, ReleaseReadError>;

  /**
   * The live releases' dependency records of one tenant. Bounded by
   * `limit`; corrupted snapshots are skipped, they are not this query's
   * concern.
   */
  listPublishedDependencies(
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly PublishedDependencies[], InfrastructureAppError>;

  /**
   * Stores the next release and makes it live in one transaction. The
   * release number is assigned inside it; a concurrent publish that wins
   * the same number surfaces as a conflict the caller may retry.
   */
  publish(
    input: NewRelease,
  ): AppResultAsync<ReleaseSummary, ConflictAppError | InfrastructureAppError>;

  /**
   * Makes an existing release live again in one transaction. Never
   * rebuilds or edits it. Idempotent for the release that is already live.
   */
  activate(input: {
    readonly websiteId: WebsiteId;
    readonly releaseId: ReleaseId;
  }): AppResultAsync<Activation, NotFoundAppError | InfrastructureAppError>;
}
