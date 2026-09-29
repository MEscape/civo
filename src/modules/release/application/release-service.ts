import { createHash } from "node:crypto";
import type { Result } from "@/lib/result/result";
import { ok, err } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { AppErrors } from "@/lib/errors/app-error";
import { releaseRepository } from "@/modules/release/infrastructure/release-repository";
import { releaseSnapshotSchema, type ReleaseSnapshot } from "@/modules/release/domain/release-snapshot";
import { extractComponentDependencies, mergeComponentDependencies } from "@/modules/release/domain/dependency-graph";
import { websiteRepository } from "@/modules/website/infrastructure/website-repository";
import { pageRepository } from "@/modules/builder/infrastructure/page-repository";
import { pageConfigSchema } from "@/modules/builder/domain/page-schema";
import { toDomainTheme } from "@/modules/website/domain/theme";
import { getCurrentContractVersion, type ContractName } from "@/modules/content/domain/contract-versions";
import type { Prisma, WebsiteRelease } from "@prisma/client";

/**
 * Deterministically stringifies a value with object keys sorted, so the
 * same logical snapshot always hashes to the same string regardless of
 * property insertion order (Phase 2: "the same release input should
 * produce deterministic configuration").
 */
function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }
    if (value !== null && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b)
        );
        return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
    }
    return JSON.stringify(value);
}

function hashSnapshot(snapshot: ReleaseSnapshot): string {
    return createHash("sha256").update(stableStringify(snapshot)).digest("hex");
}

/**
 * Checks a page's resolved component dependencies against the contract
 * versions currently in force (Phase 4 Rule 4 / Phase 46) — the release
 * compiler's compatibility gate. Takes already-extracted dependencies
 * (see extractComponentDependencies) rather than walking the tree itself,
 * so publish() only walks each page's tree once.
 *
 * Returns a human-readable message for the first incompatible dependency
 * found, or null if all of them are compatible. Stops at the first
 * failure rather than collecting all of them — good enough for now,
 * since there is exactly one call site (publish) and it already fails
 * the whole release on the first problem; collecting every incompatible
 * component across every page becomes worth doing once a migration
 * preview UI (Phase 14) needs to show them all at once.
 */
function findFirstContractIncompatibility(
    dependencies: ReleaseSnapshot["dependencies"]
): string | null {
    for (const dependency of dependencies) {
        for (const required of dependency.contracts) {
            // getCurrentContractVersion only accepts ContractName values;
            // `required.contract` is always one at the source
            // (ComponentDefinition.dependsOnContracts is typed as
            // ContractName), so this narrowing is sound, not just
            // silenced — see contract-versions.ts and types.ts.
            const actual = getCurrentContractVersion(required.contract as ContractName);
            if (actual < required.minVersion) {
                return `Component "${dependency.type}" requires ${required.contract}@${required.minVersion} or newer, but ${required.contract}@${actual} is currently available.`;
            }
        }
    }
    return null;
}

/**
 * Service/domain layer for WebsiteRelease operations.
 *
 * `publish` is the ONLY place that reads the current (mutable) Page/
 * PageConfig rows for the purpose of producing something the public site
 * will render — every other read path (see getPublishedSnapshot) resolves
 * through the immutable snapshot already stored on a WebsiteRelease row,
 * never through live draft state (Phase 4 Rule 2).
 */
export const releaseService = {
    /**
     * Builds a fresh, validated snapshot from the website's current pages
     * and publishes it as a new immutable release, atomically becoming the
     * website's published release.
     */
    async publish(websiteId: string): Promise<Result<WebsiteRelease, AppError>> {
        const websiteResult = await websiteRepository.findById(websiteId);
        if (!websiteResult.ok) return websiteResult;
        if (!websiteResult.data) return err(AppErrors.notFound("Website"));
        const website = websiteResult.data;

        const pagesResult = await pageRepository.findByWebsiteId(websiteId);
        if (!pagesResult.ok) return pagesResult;
        if (pagesResult.data.length === 0) {
            return err(AppErrors.validation("This website has no pages to publish."));
        }

        const pages: ReleaseSnapshot["pages"] = [];
        const perPageDependencies: ReturnType<typeof extractComponentDependencies>[] = [];
        for (const page of pagesResult.data) {
            const latestConfig = page.configs[0];
            if (!latestConfig) {
                return err(
                    AppErrors.validation(`Page "${page.path || "/"}" has no saved configuration.`)
                );
            }
            const parsedConfig = pageConfigSchema.safeParse(latestConfig.content);
            if (!parsedConfig.success) {
                return err(
                    AppErrors.validation(
                        `Page "${page.path || "/"}" has an invalid configuration and cannot be published.`
                    )
                );
            }

            const dependencies = extractComponentDependencies(parsedConfig.data);
            const incompatibility = findFirstContractIncompatibility(dependencies);
            if (incompatibility) {
                return err(
                    AppErrors.validation(`Page "${page.path || "/"}" cannot be published: ${incompatibility}`)
                );
            }

            perPageDependencies.push(dependencies);
            pages.push({ path: page.path, title: page.title, config: parsedConfig.data });
        }

        const domainTheme = toDomainTheme(website.theme);
        const snapshotCandidate: ReleaseSnapshot = {
            schemaVersion: 1,
            website: {
                id: website.id,
                name: website.name,
                slug: website.slug,
                description: website.description,
            },
            theme: {
                primaryColor: domainTheme.colors.primary,
                secondaryColor: domainTheme.colors.secondary,
                accentColor: domainTheme.colors.accent,
                headingFont: domainTheme.typography.headingFont,
                bodyFont: domainTheme.typography.bodyFont,
                radius: domainTheme.radius,
                spacingScale: domainTheme.spacingScale,
            },
            pages,
            dependencies: mergeComponentDependencies(perPageDependencies),
        };

        // Re-validate the fully assembled snapshot as a whole, not just its
        // parts — a final structural check after per-page contract
        // compatibility has already been verified above (Phase 4 Rule 4).
        // This can still only fail here if a bug above produced a shape
        // releaseSnapshotSchema disagrees with.
        const parsedSnapshot = releaseSnapshotSchema.safeParse(snapshotCandidate);
        if (!parsedSnapshot.success) {
            return err(AppErrors.internal(parsedSnapshot.error));
        }

        const snapshotHash = hashSnapshot(parsedSnapshot.data);
        return releaseRepository.publish(
            websiteId,
            parsedSnapshot.data as unknown as Prisma.InputJsonValue,
            snapshotHash
        );
    },

    /**
     * Returns the validated snapshot of a website's currently published
     * release. This is the ONLY entry point the public renderer should
     * use — it never reads Page/PageConfig directly (Phase 4 Rule 2).
     * Fails closed (typed NOT_FOUND) for a website that has never been
     * published, rather than falling back to draft content.
     */
    async getPublishedSnapshot(websiteId: string): Promise<Result<ReleaseSnapshot, AppError>> {
        const releaseResult = await releaseRepository.findPublishedByWebsiteId(websiteId);
        if (!releaseResult.ok) return releaseResult;
        if (!releaseResult.data) return err(AppErrors.notFound("Published release"));

        const parsed = releaseSnapshotSchema.safeParse(releaseResult.data.snapshot);
        if (!parsed.success) {
            // A stored, already-published release failing validation means
            // data corruption or a schemaVersion this build no longer
            // understands — never partially render a corrupted release.
            return err(
                AppErrors.internal(parsed.error)
            );
        }
        return ok(parsed.data);
    },

    /**
     * Affected-website detection (Phase 4 Rule 17 / Phase 43): which
     * currently-published websites depend on a given component type, and
     * at which version. Reads each published release's own recorded
     * `dependencies` (see release-snapshot.ts) rather than the live
     * registry — a published release's dependency record is fixed at
     * publish time and must not drift just because the registry moved on.
     *
     * Pass `version` to narrow to websites pinned to that exact version
     * (e.g. "which sites still need to migrate off EventsGrid@2");
     * omit it to find every site using the type at any version (e.g.
     * "can EventsGrid be removed entirely").
     */
    async findWebsitesUsingComponent(
        componentType: string,
        version?: number
    ): Promise<Result<{ websiteId: string; releaseId: string; componentVersion: number }[], AppError>> {
        const releasesResult = await releaseRepository.findAllPublished();
        if (!releasesResult.ok) return releasesResult;

        const matches: { websiteId: string; releaseId: string; componentVersion: number }[] = [];
        for (const release of releasesResult.data) {
            const parsed = releaseSnapshotSchema.safeParse(release.snapshot);
            if (!parsed.success) continue; // Corrupted/unrecognized snapshot — not this query's concern to fail on.

            const dependency = parsed.data.dependencies.find((d) => d.type === componentType);
            if (!dependency) continue;
            if (version !== undefined && dependency.version !== version) continue;

            matches.push({
                websiteId: release.websiteId,
                releaseId: release.id,
                componentVersion: dependency.version,
            });
        }
        return ok(matches);
    },

    /**
     * Returns all releases for a website ordered newest-first, including
     * historical ones. Used by the release management UI (Phase 4I) to
     * show release history and offer rollback targets.
     */
    async getReleaseHistory(
        websiteId: string
    ): Promise<Result<WebsiteRelease[], AppError>> {
        return releaseRepository.findHistoryByWebsiteId(websiteId);
    },

    /**
     * Rolls back a website to a previously-published release (Phase 20).
     *
     * Delegates all validation, integrity checks, and atomic state
     * transition to the repository — this service method exists only to
     * expose the operation through the same surface as publish(), not to
     * duplicate the logic.
     *
     * Never re-builds the old release. Only switches the pointer.
     */
    async rollback(
        websiteId: string,
        targetReleaseId: string
    ): Promise<Result<WebsiteRelease, AppError>> {
        return releaseRepository.rollback(websiteId, targetReleaseId);
    },
};
