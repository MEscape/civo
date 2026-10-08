import type {
  MigrationPlanView,
  MigrationProposalView,
} from '../../application/contracts/release-views';

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
