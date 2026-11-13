import type { AuthorizationError } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { DatasetId, WebsiteId } from '../models/ids';

/** What a deletion would remove: datasets of one website. */
export interface DeletionScope {
  readonly websiteId: WebsiteId;
  readonly datasetIds: readonly DatasetId[];
}

export type DeletionGuardError = ConflictAppError | InfrastructureAppError | AuthorizationError;

/**
 * Asked right before datasets are deleted, after the deletion itself was
 * authorized: whether pages still show them. This module cannot see pages
 * (it sits below every module that has them), so the caller that can see
 * them supplies the answer; a conflict stops the deletion. Required, so no
 * caller deletes without asking.
 */
export type DatasetDeletionGuard = (
  scope: DeletionScope,
) => AppResultAsync<void, DeletionGuardError>;
