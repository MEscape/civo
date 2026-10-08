import type {
  ApplyMigrationResultView,
  MigrationStatus,
  PageOutcome,
} from '../../application/contracts/release-views';

/**
 * JSON-safe outcome for one page during migration application.
 *
 * This intentionally exposes only the information needed by the UI to explain
 * what happened to the page. Internal application details are not transported.
 */
export interface PageOutcomeDto {
  readonly path: string;
  readonly outcome: PageOutcome;
}

export function toPageOutcomeDto(view: {
  readonly path: string;
  readonly outcome: PageOutcome;
}): PageOutcomeDto {
  return { path: view.path, outcome: view.outcome };
}

/**
 * Result returned after attempting to apply a migration.
 *
 * An apply can be incomplete: some pages/nodes may have been updated while
 * others were skipped. The result therefore carries both the final migration
 * status and the page-level outcomes needed by the reviewer.
 */
export interface ApplyMigrationResultDto {
  readonly migrationId: string;
  readonly websiteId: string;
  readonly status: MigrationStatus;
  readonly pages: readonly PageOutcomeDto[];
  readonly updatedNodeCount: number;
  readonly skippedNodeCount: number;
}

/**
 * Converts the application-layer apply result into the JSON-safe DTO returned
 * by the apply-migration Server Action.
 */
export function toApplyMigrationResultDto(view: ApplyMigrationResultView): ApplyMigrationResultDto {
  return {
    migrationId: view.migrationId,
    websiteId: view.websiteId,
    status: view.status,
    pages: view.pages.map(toPageOutcomeDto),
    updatedNodeCount: view.updatedNodeCount,
    skippedNodeCount: view.skippedNodeCount,
  };
}
