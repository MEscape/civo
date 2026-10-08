import { toMigrationSummaryDto } from './migration-dto';

import type { MigrationSummaryDto } from './migration-dto';
import type { MigrationSummaryView } from '../../application/contracts/release-views';

/** What a Server Component hands to the migration history panel. */
export interface MigrationHistoryDto {
  readonly migrations: readonly MigrationSummaryDto[];
}

export function toMigrationHistoryDto(views: readonly MigrationSummaryView[]): MigrationHistoryDto {
  return {
    migrations: views.map(toMigrationSummaryDto),
  };
}
