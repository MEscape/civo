"use server";

import { revalidatePath } from "next/cache";
import { migrationService } from "@/modules/migration/application/migration-service";
import { type ActionResult, toActionResult } from "@/lib/actions/action-result";
import type { MigrationPlan } from "@/modules/migration/domain/migration-plan";
import type { ConflictResolutions } from "@/modules/migration/domain/apply-migration";
import type { Migration } from "@prisma/client";

/**
 * Plans what upgrading the website's currently-published release to
 * today's registered component versions would look like (Phase 14 /
 * Phase 59). Read-only from the municipality's perspective — nothing in
 * the database is modified except creating an audit `Migration` row in
 * PROPOSED status (Phase 35).
 *
 * Returns both the migration ID (for the subsequent applyMigrationAction
 * call) and the full plan (for the conflict-resolution UI, Phase 15).
 */
export async function proposeMigrationAction(
    websiteId: string
): Promise<ActionResult<{ migrationId: string; plan: MigrationPlan }>> {
    const result = await migrationService.proposeMigration(websiteId);
    return toActionResult(result);
}

/**
 * Applies a previously proposed migration's resolutions, writing a new
 * draft PageConfig for each page that actually changes (Phase 16 /
 * Phase 58). Never touches the published release. Revalidates the
 * builder so it loads the migrated draft immediately.
 */
export async function applyMigrationAction(
    websiteId: string,
    plan: MigrationPlan,
    migrationId: string,
    resolutions: ConflictResolutions
): Promise<ActionResult<{ updatedPaths: string[] }>> {
    const result = await migrationService.applyMigration(websiteId, plan, migrationId, resolutions);
    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/builder`);
    }
    return toActionResult(result);
}

/**
 * Returns the full migration audit history for a website (Phase 57).
 * Read-only — no revalidation needed.
 */
export async function getMigrationHistoryAction(
    websiteId: string
): Promise<ActionResult<Migration[]>> {
    const result = await migrationService.getMigrationHistory(websiteId);
    return toActionResult(result);
}
