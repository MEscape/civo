import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { releaseService } from "@/modules/release/application/release-service";
import { releaseRepository } from "@/modules/release/infrastructure/release-repository";
import { pageRepository } from "@/modules/builder/infrastructure/page-repository";
import { planMigration, type MigrationPlan } from "@/modules/migration/domain/migration-plan";
import { applyMigrationPlan, type ConflictResolutions } from "@/modules/migration/domain/apply-migration";
import { migrationRepository } from "@/modules/migration/infrastructure/migration-repository";
import type { Prisma, Migration } from "@prisma/client";

/**
 * Migration service (Phase 4E / Phase 14 / Phase 16 / Phase 57).
 *
 * Two operations, matching the spec's own flow (Migration Analysis →
 * ... → Migration Proposal → Preview → ... → New Draft):
 * - `proposeMigration`: pure planning (see migration-plan.ts) plus
 *   recording the proposal for audit (Phase 35), read-only with respect
 *   to Page/PageConfig — nothing a municipality is looking at changes.
 * - `applyMigration`: takes a previously proposed plan's resolutions and
 *   writes NEW page drafts via the existing pageRepository.saveConfig —
 *   which already appends rather than mutates (copy-on-write, Phase 58)
 *   — then marks the migration record APPLIED. The currently published
 *   release is never touched by either operation (Phase 4 Rule 5/16):
 *   only Page/PageConfig draft rows change, and only for pages/nodes the
 *   plan actually resolved.
 */
export const migrationService = {
    /**
     * Plans what upgrading `websiteId`'s currently published release to
     * today's registered component versions would look like, and
     * records the proposal (Phase 35 audit trail). Fails NOT_FOUND for a
     * website that has never published anything — there is no published
     * "version this was built against" fact to migrate from (see
     * migration-plan.ts's own scope note).
     */
    async proposeMigration(
        websiteId: string
    ): Promise<Result<{ migrationId: string; plan: MigrationPlan }, AppError>> {
        const releaseResult = await releaseRepository.findPublishedByWebsiteId(websiteId);
        if (!releaseResult.ok) return releaseResult;
        if (!releaseResult.data) return err(AppErrors.notFound("Published release"));
        const release = releaseResult.data;

        const snapshotResult = await releaseService.getPublishedSnapshot(websiteId);
        if (!snapshotResult.ok) return snapshotResult;

        const plan = planMigration(snapshotResult.data);

        const recordResult = await migrationRepository.recordProposed(
            websiteId,
            release.id,
            plan as unknown as Prisma.InputJsonValue
        );
        if (!recordResult.ok) return recordResult;

        return ok({ migrationId: recordResult.data.id, plan });
    },

    /**
     * Applies a previously proposed migration's resolutions, writing a
     * new draft PageConfig for every page that actually changed (pages
     * with zero updated nodes are left alone — no pointless new draft
     * version). Returns which pages were updated so a caller (the
     * builder UI) knows what to re-open/re-preview.
     *
     * Re-derives the page trees to apply against from the SAME published
     * snapshot the plan was computed from (via the migration's own
     * recorded `sourceReleaseId`), not from whatever the draft currently
     * holds — applying against a draft that has since been edited again
     * would silently discard those newer edits (Phase 33's concern, one
     * level up: this is why apply always targets the release's frozen
     * page content, never "whatever is in the draft right now").
     */
    async applyMigration(
        websiteId: string,
        plan: MigrationPlan,
        migrationId: string,
        resolutions: ConflictResolutions
    ): Promise<Result<{ updatedPaths: string[] }, AppError>> {
        const snapshotResult = await releaseService.getPublishedSnapshot(websiteId);
        if (!snapshotResult.ok) return snapshotResult;
        const snapshot = snapshotResult.data;

        const applied = applyMigrationPlan(
            plan,
            snapshot.pages.map((p) => ({ path: p.path, config: p.config })),
            resolutions
        );

        const updatedPaths: string[] = [];
        for (const page of applied.pages) {
            const pagePlan = plan.pages.find((p) => p.path === page.path);
            const changedHere = (pagePlan?.nodes ?? []).some((n) => applied.updatedNodeIds.includes(n.nodeId));
            if (!changedHere) continue; // Nothing on this page actually changed — don't create a pointless new draft version.

            const pageResult = await pageRepository.findByWebsiteAndPath(websiteId, page.path);
            if (!pageResult.ok) return pageResult;
            if (!pageResult.data) {
                return err(AppErrors.notFound(`Page "${page.path || "/"}"`));
            }

            const saveResult = await pageRepository.saveConfig(
                pageResult.data.id,
                page.config as unknown as Prisma.InputJsonValue
            );
            if (!saveResult.ok) return saveResult;

            updatedPaths.push(page.path);
        }

        const markResult = await migrationRepository.markApplied(
            migrationId,
            resolutions as unknown as Prisma.InputJsonValue
        );
        if (!markResult.ok) return markResult;

        return ok({ updatedPaths });
    },

    async getMigrationHistory(websiteId: string): Promise<Result<Migration[], AppError>> {
        return migrationRepository.findHistoryByWebsiteId(websiteId);
    },
};
