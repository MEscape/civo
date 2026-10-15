import type { UnexpectedAppError } from '@lib/errors';
import type { AppResult } from '@lib/result';

import { planMigration } from '../../domain/models/migration-plan';
import { toMigrationSource } from '../../domain/models/migration-source';

import type { MigrationPlan } from '../../domain/models/migration-plan';
import type { MigrationSource } from '../../domain/models/migration-source';
import type { Release } from '../../domain/models/release';
import type { ProposeMigrationDependencies } from '../release-dependencies';

export interface LiveReleasePlan {
  readonly source: MigrationSource;
  readonly plan: MigrationPlan;
}

/**
 * What upgrading a release to today's component versions would change. The
 * one reading of a release into a plan: proposing a migration records it,
 * the publication status only counts it.
 */
export function planLiveRelease(
  deps: Pick<ProposeMigrationDependencies, 'pages' | 'components'>,
  release: Release,
): AppResult<LiveReleasePlan, UnexpectedAppError> {
  return deps.pages.readTrees(release.snapshot.pages).map((trees) => {
    const source = toMigrationSource(release, trees);
    return { source, plan: planMigration(source, deps.components) };
  });
}
