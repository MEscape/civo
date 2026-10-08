import type { ConflictAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { literalGuard } from '@lib/utils';

import { releaseNotRestorable } from '../errors/release-errors';

import type { ReleaseId, WebsiteId } from './ids';
import type { ReleaseSnapshot } from './release-snapshot';

/**
 * `draft` and `failed` are not produced by the current publish flow but
 * can exist in storage; they stay readable and can never go live.
 */
export const RELEASE_STATUSES = ['draft', 'published', 'rolled_back', 'failed'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

/** Only a release that was once fully built may be activated again. */
export const ACTIVATABLE_STATUSES = [
  'published',
  'rolled_back',
] as const satisfies readonly ReleaseStatus[];

export const isActivatableStatus = literalGuard(ACTIVATABLE_STATUSES);

export const FIRST_RELEASE_NUMBER = 1;

/** A release without its snapshot: what lists need, so history never loads snapshots. */
export interface ReleaseSummary {
  readonly id: ReleaseId;
  readonly websiteId: WebsiteId;
  /** Sequential per website, starting at 1. */
  readonly releaseNumber: number;
  readonly status: ReleaseStatus;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
}

/** An immutable build artifact. Only `status` ever changes after creation. */
export interface Release extends ReleaseSummary {
  readonly snapshot: ReleaseSnapshot;
}

export interface ReleaseHistory {
  /** The release the public site currently serves; `null` if never published. */
  readonly activeReleaseId: ReleaseId | null;
  /** Newest first. */
  readonly releases: readonly ReleaseSummary[];
}

export function nextReleaseNumber(latest: number | null): number {
  return latest === null ? FIRST_RELEASE_NUMBER : latest + 1;
}

/** Whether a rollback to this release is meaningful and allowed right now. */
export function canActivate(release: ReleaseSummary, activeReleaseId: ReleaseId | null): boolean {
  return release.id !== activeReleaseId && isActivatableStatus(release.status);
}

/** The status rule behind rollback; whether it is already live is not an error. */
export function ensureActivatable<T extends ReleaseSummary>(
  release: T,
): AppResult<T, ConflictAppError> {
  return isActivatableStatus(release.status) ? ok(release) : err(releaseNotRestorable());
}
