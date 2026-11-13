import type {
  ApplyMigrationResultView,
  MigrationPlanView,
  MigrationProposalView,
  MigrationStatus,
  PageOutcome,
} from '../../application/contracts/migration-views';

/**
 * JSON-safe migration plan presented to the reviewer.
 *
 * The application-layer plan contains no non-serializable values, so the DTO
 * currently has the same shape as the application view.
 *
 * Keeping the DTO as a named type still gives the UI its own boundary and
 * allows the transport representation to evolve independently later.
 */
export type MigrationPlanDto = MigrationPlanView;

/**
 * Proposal returned after checking a website for migrations.
 *
 * `migrationId` is null when the check determines that no migration record
 * needs to be reviewed. When a migration is recorded, the ID identifies the
 * server-side proposal that can subsequently be applied.
 */
export interface MigrationProposalDto {
  readonly migrationId: string | null;
  readonly sourceReleaseId: string;
  readonly plan: MigrationPlanDto;
}

/**
 * Converts an application-layer migration plan into its transport DTO.
 *
 * Migration plans are already JSON-safe, so no field-by-field mapping is
 * currently necessary.
 */
export function toMigrationPlanDto(view: MigrationPlanView): MigrationPlanDto {
  return view;
}

/**
 * Converts the application-layer migration proposal into the JSON-safe
 * contract returned by the proposal Server Action.
 */
export function toMigrationProposalDto(view: MigrationProposalView): MigrationProposalDto {
  return {
    migrationId: view.migrationId,
    sourceReleaseId: view.sourceReleaseId,
    plan: toMigrationPlanDto(view.plan),
  };
}

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
