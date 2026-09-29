"use server";

import { revalidatePath } from "next/cache";
import { releaseService } from "@/modules/release/application/release-service";
import { ActionResult, toActionResult } from "@/lib/actions/action-result";
import type { WebsiteRelease } from "@prisma/client";

/**
 * The builder's "Publish" action — distinct from savePageConfigAction
 * (Phase 4 Rule 5/Rule 2). Saving only ever writes a draft; this is the
 * only path that makes a website's current pages visible on the public
 * site, by building and publishing a new immutable WebsiteRelease.
 */
export async function publishReleaseAction(
    websiteId: string
): Promise<ActionResult<WebsiteRelease>> {
    const result = await releaseService.publish(websiteId);
    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/builder`);
        // The public route is /s/[siteSlug], keyed by the website's id —
        // see that route's own comment on this naming quirk.
        revalidatePath(`/s/${websiteId}`);
    }
    return toActionResult(result);
}

/**
 * Fetches the full release history for a website (Phase 4I / Phase 20).
 * Read-only — no revalidation needed.
 */
export async function getReleaseHistoryAction(
    websiteId: string
): Promise<ActionResult<WebsiteRelease[]>> {
    const result = await releaseService.getReleaseHistory(websiteId);
    return toActionResult(result);
}

/**
 * Rolls a website back to a previously-published release (Phase 20).
 *
 * Only switches the Website.publishedReleaseId pointer — the historical
 * release artifact is never rebuilt or mutated. Revalidates both the
 * builder status panel and the public site so the old version becomes
 * live immediately.
 */
export async function rollbackReleaseAction(
    websiteId: string,
    targetReleaseId: string
): Promise<ActionResult<WebsiteRelease>> {
    const result = await releaseService.rollback(websiteId, targetReleaseId);
    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/builder`);
        revalidatePath(`/s/${websiteId}`);
    }
    return toActionResult(result);
}
