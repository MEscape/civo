import { toMigrationPlanDto } from './migration-plan-dto';

import type { MigrationPlanDto } from './migration-plan-dto';
import type { NodeMigrationStatus } from '../../application/contracts/release-constraints';
import type {
  MigrationDetailView,
  MigrationStatus,
  MigrationSummaryPageDetailView,
  MigrationSummaryView,
} from '../../application/contracts/release-views';

/**
 * JSON-safe summary of a migration.
 *
 * This is the reusable migration identity used by history lists and other
 * views that need to describe a migration without exposing its full plan.
 *
 * Dates are represented as ISO-8601 strings because this DTO crosses the
 * Server Component / Client Component and Server Action boundaries.
 */
export interface MigrationSummaryPageDto {
  readonly path: string;
  readonly nodes: ReadonlyArray<{
    readonly nodeId: string;
    readonly type: string;
    readonly fromVersion: number;
    readonly toVersion?: number | undefined;
    readonly status: NodeMigrationStatus;
  }>;
}

export interface MigrationSummaryDto {
  readonly id: string;
  readonly websiteId: string;
  readonly sourceReleaseId: string;
  readonly status: MigrationStatus;
  readonly createdAt: string;
  readonly appliedAt: string | null;
  readonly pages?: readonly MigrationSummaryPageDto[] | undefined;
  readonly changedNodeCount?: number | undefined;
}

/**
 * JSON-safe representation of a migration together with the plan that was
 * recorded for it.
 *
 * Use this when the consumer needs the migration's details rather than only
 * its history/list representation.
 */
export interface MigrationDetailDto extends MigrationSummaryDto {
  readonly plan: MigrationPlanDto;
}

/** Converts one page of a migration's change summary into its JSON-safe DTO. */
export function toMigrationSummaryPageDto(
  view: MigrationSummaryPageDetailView,
): MigrationSummaryPageDto {
  return {
    path: view.path,
    nodes: view.nodes.map((node) => ({
      nodeId: node.nodeId,
      type: node.type,
      fromVersion: node.fromVersion,
      toVersion: node.toVersion,
      status: node.status,
    })),
  };
}

/**
 * Converts an application-layer migration summary view into the JSON-safe
 * DTO exposed to the UI.
 */
export function toMigrationSummaryDto(view: MigrationSummaryView): MigrationSummaryDto {
  return {
    id: view.id,
    websiteId: view.websiteId,
    sourceReleaseId: view.sourceReleaseId,
    status: view.status,
    createdAt: view.createdAt.toISOString(),
    appliedAt: view.appliedAt?.toISOString() ?? null,
    pages: view.pages?.map(toMigrationSummaryPageDto),
    changedNodeCount: view.changedNodeCount,
  };
}

/**
 * Converts an application-layer migration detail view into the JSON-safe
 * DTO exposed to the UI.
 */
export function toMigrationDetailDto(view: MigrationDetailView): MigrationDetailDto {
  return {
    id: view.id,
    websiteId: view.websiteId,
    sourceReleaseId: view.sourceReleaseId,
    status: view.status,
    createdAt: view.createdAt.toISOString(),
    appliedAt: view.appliedAt?.toISOString() ?? null,
    plan: toMigrationPlanDto(view.plan),
  };
}
