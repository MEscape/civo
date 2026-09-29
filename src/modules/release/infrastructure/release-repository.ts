import { prisma } from "@/lib/db/prisma";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import type { Prisma, WebsiteRelease } from "@prisma/client";
import { releaseSnapshotSchema } from "@/modules/release/domain/release-snapshot";

/**
 * Repository layer for WebsiteRelease. The only place in the application
 * allowed to call Prisma directly for release data (mirrors
 * websiteRepository/pageRepository's contract: every method returns a
 * Result, never throws).
 *
 * A WebsiteRelease row is never updated once created — see the Prisma
 * schema comment on the model. `publish` is the one operation that mutates
 * anything, and it only ever touches `Website.publishedReleaseId` plus the
 * new release's own `status`/`publishedAt`, inside one transaction
 * (Phase 4 Rule 7 / Rule 49: publishing must be atomic and transactional).
 */
export const releaseRepository = {
    async findPublishedByWebsiteId(
        websiteId: string
    ): Promise<Result<WebsiteRelease | null, AppError>> {
        try {
            const website = await prisma.website.findUnique({
                where: { id: websiteId },
                include: { publishedRelease: true },
            });
            return ok(website?.publishedRelease ?? null);
        } catch (cause) {
            logger.error("releaseRepository.findPublishedByWebsiteId failed", { cause, websiteId });
            return err(AppErrors.database(cause));
        }
    },

    async findHistoryByWebsiteId(websiteId: string): Promise<Result<WebsiteRelease[], AppError>> {
        try {
            const releases = await prisma.websiteRelease.findMany({
                where: { websiteId },
                orderBy: { releaseNumber: "desc" },
            });
            return ok(releases);
        } catch (cause) {
            logger.error("releaseRepository.findHistoryByWebsiteId failed", { cause, websiteId });
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Every currently-published release across every website — the raw
     * data an "affected websites" query needs (Phase 4 Rule 17 / Phase
     * 43). Queried via `Website.publishedReleaseId` (the same pointer
     * public rendering resolves through) rather than "the newest release
     * per website," so a website with a rolled-back or unpublished draft
     * release never shows up as depending on something it isn't actually
     * serving.
     *
     * This is a full scan with no dependency index behind it yet — see
     * dependency-graph.ts's own scope note on why building one now would
     * be premature. Fine at today's scale; Phase 43 flags exactly this
     * as the thing to revisit once a real fleet of websites exists.
     */
    async findAllPublished(): Promise<Result<WebsiteRelease[], AppError>> {
        try {
            const websites = await prisma.website.findMany({
                where: { publishedReleaseId: { not: null } },
                include: { publishedRelease: true },
            });
            const releases: (WebsiteRelease | null)[] = websites.map(
                (website: { publishedRelease: WebsiteRelease | null }) => website.publishedRelease
            );
            return ok(releases.filter((release): release is WebsiteRelease => release !== null));
        } catch (cause) {
            logger.error("releaseRepository.findAllPublished failed", { cause });
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Creates a new release row and immediately points the website's
     * `publishedReleaseId` at it, inside a single transaction — this is
     * the atomic switch (Phase 4 Rule 7 / Phase 19). The previous release
     * row, if any, is left completely untouched: only the pointer moves.
     *
     * `releaseNumber` is computed inside the transaction (max + 1) rather
     * than passed in, so two concurrent publish calls for the same website
     * cannot race onto the same number — the `@@unique([websiteId,
     * releaseNumber])` constraint turns any remaining race into a request
     * that fails loudly rather than one that silently succeeds twice.
     */
    async publish(
        websiteId: string,
        snapshot: Prisma.InputJsonValue,
        snapshotHash: string
    ): Promise<Result<WebsiteRelease, AppError>> {
        try {
            const release = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                const latest = await tx.websiteRelease.findFirst({
                    where: { websiteId },
                    orderBy: { releaseNumber: "desc" },
                });

                const created = await tx.websiteRelease.create({
                    data: {
                        websiteId,
                        releaseNumber: (latest?.releaseNumber ?? 0) + 1,
                        status: "PUBLISHED",
                        snapshot,
                        snapshotHash,
                        publishedAt: new Date(),
                    },
                });

                await tx.website.update({
                    where: { id: websiteId },
                    data: { publishedReleaseId: created.id },
                });

                return created;
            });

            return ok(release);
        } catch (cause) {
            logger.error("releaseRepository.publish failed", { cause, websiteId });
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Finds a specific release by ID (used by rollback to verify the
     * artifact still exists before switching traffic to it — Phase 20).
     */
    async findById(releaseId: string): Promise<Result<WebsiteRelease | null, AppError>> {
        try {
            const release = await prisma.websiteRelease.findUnique({
                where: { id: releaseId },
            });
            return ok(release);
        } catch (cause) {
            logger.error("releaseRepository.findById failed", { cause, releaseId });
            return err(AppErrors.database(cause));
        }
    },

    /**
     * Rolls back a website to a previously-published release (Phase 20).
     *
     * Validates the target release:
     * - must exist
     * - must belong to this website
     * - must have a PUBLISHED status (can only activate a release that was
     *   once fully published, not a failed build or an orphaned draft)
     * - its snapshot must still be valid (integrity check, Phase 21)
     *
     * Then, inside a single transaction:
     * 1. Points Website.publishedReleaseId at the target.
     * 2. Updates the OLD active release's status to ROLLED_BACK (purely
     *    for history/audit purposes — its config/snapshot is NEVER touched,
     *    per Rule 1 and Phase 20: "do not mutate the rolled-back release").
     *
     * Returns the release that is now live.
     */
    async rollback(
        websiteId: string,
        targetReleaseId: string
    ): Promise<Result<WebsiteRelease, AppError>> {
        try {
            // --- Pre-flight checks (outside the transaction so failures are cheap) ---
            const targetRelease = await prisma.websiteRelease.findUnique({
                where: { id: targetReleaseId },
            });
            if (!targetRelease) {
                return err(AppErrors.notFound("Ziel-Release"));
            }
            if (targetRelease.websiteId !== websiteId) {
                return err(AppErrors.forbidden());
            }
            if (targetRelease.status !== "PUBLISHED" && targetRelease.status !== "ROLLED_BACK") {
                return err(
                    AppErrors.validation(
                        "Dieses Release wurde nie erfolgreich veröffentlicht und kann nicht wiederhergestellt werden."
                    )
                );
            }
            // Integrity check: snapshot must still parse (Phase 21).
            const snapshotCheck = releaseSnapshotSchema.safeParse(targetRelease.snapshot);
            if (!snapshotCheck.success) {
                return err(
                    AppErrors.validation(
                        "Das Snapshot dieses Releases ist beschädigt und kann nicht wiederhergestellt werden."
                    )
                );
            }

            // --- Atomic activation (Phase 19 / Phase 20) ---
            const activatedRelease = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                const website = await tx.website.findUnique({
                    where: { id: websiteId },
                    select: { publishedReleaseId: true },
                });

                // Mark the currently-active release as ROLLED_BACK (audit trail
                // only — config unchanged, per Phase 20's "do not mutate").
                if (website?.publishedReleaseId && website.publishedReleaseId !== targetReleaseId) {
                    await tx.websiteRelease.update({
                        where: { id: website.publishedReleaseId },
                        data: { status: "ROLLED_BACK" },
                    });
                }

                // Reactivate the target: switch the pointer and reset its status
                // to PUBLISHED so tooling sees it as the live release.
                const activated = await tx.websiteRelease.update({
                    where: { id: targetReleaseId },
                    data: { status: "PUBLISHED" },
                });

                await tx.website.update({
                    where: { id: websiteId },
                    data: { publishedReleaseId: targetReleaseId },
                });

                return activated;
            });

            return ok(activatedRelease);
        } catch (cause) {
            logger.error("releaseRepository.rollback failed", { cause, websiteId, targetReleaseId });
            return err(AppErrors.database(cause));
        }
    },
};
