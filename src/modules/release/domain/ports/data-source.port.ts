import type { AuthorizationError } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { DataSourceId, DatasetId, WebsiteId } from '../models/ids';

/** What a deletion would remove: datasets of one website. */
export interface DataRemovalScope {
  readonly websiteId: WebsiteId;
  readonly datasetIds: readonly DatasetId[];
}

export type DataRemovalGuardError = ConflictAppError | InfrastructureAppError | AuthorizationError;

/** Asked right before data is deleted; a conflict keeps it. */
export type DataRemovalGuard = (
  scope: DataRemovalScope,
) => AppResultAsync<void, DataRemovalGuardError>;

/** What was deleted, so the caller can refresh what showed it. */
export interface DataRemoval {
  readonly websiteId: WebsiteId;
  /** The source, when a whole source was removed. */
  readonly dataSourceId: DataSourceId | null;
  readonly datasetIds: readonly DatasetId[];
}

/** What deleting data can fail with: the data module's own refusals, and the guard's. */
export type DataRemovalError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

/**
 * The datasets the website's pages read, and their deletion: the data
 * module cannot see pages, so deleting data goes through here, where the
 * draft pages (builder) and the live release (this module) are both known.
 */
export interface DataSourcePort {
  /** The datasets stored page JSON (a snapshot page) reads. */
  datasetsInStoredPage(stored: unknown): ReadonlySet<DatasetId>;
  /** The datasets the website's saved draft pages read, as the current actor may see them. */
  datasetsInDrafts(websiteId: WebsiteId): AppResultAsync<ReadonlySet<DatasetId>>;
  /** The error a guard answers with when a page still shows the data. */
  inUse(): ConflictAppError;
  deleteDataset(
    id: DatasetId,
    guard: DataRemovalGuard,
  ): AppResultAsync<DataRemoval, DataRemovalError>;
  deleteDataSource(
    id: DataSourceId,
    guard: DataRemovalGuard,
  ): AppResultAsync<DataRemoval, DataRemovalError>;
}
