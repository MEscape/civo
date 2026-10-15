import { toReleaseSummaryDto } from './release-dto';

import type { ReleaseSummaryDto } from './release-dto';
import type { ReleaseHistoryView } from '../../application/contracts/release-views';

/** What a Server Component hands to the release history panel: JSON-safe, newest first. */
export interface ReleaseHistoryDto {
  readonly activeReleaseId: string | null;
  readonly releases: readonly ReleaseSummaryDto[];
  /** Every release of the website, not only this page of them. */
  readonly total: number;
}

export function toReleaseHistoryDto(view: ReleaseHistoryView): ReleaseHistoryDto {
  return {
    activeReleaseId: view.activeReleaseId,
    releases: view.items.map(toReleaseSummaryDto),
    total: view.total,
  };
}
