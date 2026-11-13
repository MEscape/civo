import { isSuccessfulOutcome } from '../../domain/migration/page-draft';

import type { MigrationReview } from './migration-review';
import type { PageResult } from './write-migrated-pages';
import type { ApplyMigrationResultView } from '../contracts/migration-views';

export interface MigrationOutcome {
  /** Every written page holds the migrated tree and nothing is left unresolved: the migration may be marked applied. */
  readonly isFinished: boolean;
  /** No page failed or diverged. */
  readonly isComplete: boolean;
  readonly failedPageCount: number;
  readonly divergedPageCount: number;
  readonly writtenPageCount: number;
  /** What the caller is told when the migration stays `proposed`; `applied` is the same with that status. */
  readonly view: ApplyMigrationResultView;
}

export interface MigrationOutcomeInput {
  readonly review: Pick<MigrationReview, 'websiteId' | 'migration'>;
  readonly results: readonly PageResult[];
  readonly skippedNodeCount: number;
}

/** What the page writes added up to: whether the migration is finished, and the counts to report. */
export function judgeMigrationOutcome({
  review,
  results,
  skippedNodeCount,
}: MigrationOutcomeInput): MigrationOutcome {
  const isComplete = results.every((result) => isSuccessfulOutcome(result.outcome));
  const countOf = (outcome: PageResult['outcome']) =>
    results.filter((result) => result.outcome === outcome).length;

  return {
    isComplete,
    // Nothing written and something left unresolved: keep it open so it can be resolved and retried.
    isFinished: isComplete && (results.length > 0 || skippedNodeCount === 0),
    failedPageCount: countOf('failed'),
    divergedPageCount: countOf('draft_diverged'),
    writtenPageCount: countOf('written'),
    view: {
      migrationId: review.migration.id,
      websiteId: review.websiteId,
      status: 'proposed',
      pages: results.map(({ path, outcome }) => ({ path, outcome })),
      updatedNodeCount: results.reduce((total, result) => total + result.updatedNodeCount, 0),
      skippedNodeCount,
    },
  };
}
