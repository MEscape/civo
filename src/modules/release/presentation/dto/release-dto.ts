import type { ReleaseStatus, ReleaseSummaryView } from '../../application/contracts/release-views';

/** The JSON-safe shape Server Actions return: dates as ISO-8601 strings. Never carries the snapshot. */
export interface ReleaseSummaryDto {
  readonly id: string;
  readonly websiteId: string;
  readonly releaseNumber: number;
  readonly status: ReleaseStatus;
  readonly isActive: boolean;
  readonly canRollback: boolean;
  readonly publishedAt: string | null;
  readonly createdAt: string;
}

export function toReleaseSummaryDto(view: ReleaseSummaryView): ReleaseSummaryDto {
  return {
    id: view.id,
    websiteId: view.websiteId,
    releaseNumber: view.releaseNumber,
    status: view.status,
    isActive: view.isActive,
    canRollback: view.canRollback,
    publishedAt: view.publishedAt?.toISOString() ?? null,
    createdAt: view.createdAt.toISOString(),
  };
}
