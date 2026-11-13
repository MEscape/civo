import type { TenantId } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import type { Page, PageRequest, SortSpec } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { MediaAssetId } from '../models/ids';
import type { MediaAsset, MediaVisibility, ValidUpload } from '../models/media-asset';

/** What the library can be ordered by: the file's name, or when it arrived. */
export const MEDIA_SORT_FIELDS = ['name', 'uploaded'] as const;
export type MediaSortField = (typeof MEDIA_SORT_FIELDS)[number];

/** Newest first, until a person asks otherwise. */
export const DEFAULT_MEDIA_SORT: SortSpec<MediaSortField> = {
  field: 'uploaded',
  direction: 'desc',
};

/** Which READY files a list shows and in what order. Absent parts mean "all" and the default order. */
export interface MediaListFilter {
  readonly visibility?: MediaVisibility | undefined;
  /** Part of the file's name, matched case-insensitively and literally (no wildcards). */
  readonly search?: string | undefined;
  readonly sort?: SortSpec<MediaSortField> | undefined;
}

/** What a sweep asks for. */
export interface AbandonedClaim {
  readonly tenantId: TenantId;
  readonly now: Date;
  /** A deletion that started before this and never finished counts as stalled. */
  readonly staleBefore: Date;
  readonly limit: number;
}

export interface NewPendingAsset extends ValidUpload {
  readonly tenantId: TenantId;
  readonly createdBy: string;
  readonly uploadExpiresAt: Date;
}

/** How many unfinished uploads a tenant may hold at `now`; the repository enforces it atomically. */
export interface PendingQuota {
  readonly now: Date;
  readonly maxOpen: number;
}

/**
 * Persistence for uploaded files. Every read and write takes the tenant and matches on
 * (id, tenantId), so another website's id behaves exactly like an id that does not exist.
 *
 * Finders return `null` for "absent"; whether that is an error is the use case's call.
 * Adapters turn every driver failure into our own error kinds.
 */
export interface MediaAssetRepository {
  /**
   * Stores a new PENDING asset unless the tenant already holds `quota.maxOpen` unfinished uploads
   * (a conflict). Counting and storing happen under one lock, so simultaneous requests cannot
   * exceed the quota together. The store mints the id, and the object key is derived from the
   * tenant and that id, so a key can never be influenced by the client.
   */
  createPending(
    input: NewPendingAsset,
    quota: PendingQuota,
  ): AppResultAsync<MediaAsset, ConflictAppError | InfrastructureAppError>;

  findById(
    id: MediaAssetId,
    tenantId: TenantId,
  ): AppResultAsync<MediaAsset | null, InfrastructureAppError>;

  /**
   * PENDING to READY, only while it is still PENDING: the conditional write is what makes two
   * simultaneous finalisations safe. `null` means it was no longer PENDING (or is gone).
   */
  markReady(
    id: MediaAssetId,
    tenantId: TenantId,
    now: Date,
  ): AppResultAsync<MediaAsset | null, InfrastructureAppError>;

  /** Hides the asset while its object is removed. `null` when it is gone. Idempotent. */
  markDeleting(
    id: MediaAssetId,
    tenantId: TenantId,
    now: Date,
  ): AppResultAsync<MediaAsset | null, InfrastructureAppError>;

  /**
   * @truncation none A sweep clears one batch per call; whatever is left is claimed by the next sweep.
   *
   * Claims up to `limit` files that were abandoned and marks them DELETING, in one atomic step so
   * that two requests never clear the same file: uploads whose lifetime ended without being
   * finalised, and files whose deletion started but stalled for longer than `staleBefore`.
   * Returns what was claimed; the caller removes the objects and then the rows.
   */
  claimAbandoned(claim: AbandonedClaim): AppResultAsync<MediaAsset[], InfrastructureAppError>;

  /** READY assets bounded by the page, narrowed and ordered by `filter` (newest first by default). */
  listReady(
    tenantId: TenantId,
    page: PageRequest,
    filter?: MediaListFilter,
  ): AppResultAsync<Page<MediaAsset>, InfrastructureAppError>;

  /** Idempotent: deleting a row that is already gone succeeds. */
  deleteById(id: MediaAssetId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError>;
}
