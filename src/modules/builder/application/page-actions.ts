"use server";

import { revalidatePath } from "next/cache";
import { pageService } from "@/modules/builder/application/page-service";

import { ActionResult, toActionResult } from "@/lib/actions/action-result";
import type { PageConfigInput } from "@/modules/builder/domain/page-schema";
import type { PageView } from "@/modules/builder/domain/page-schema";

/**
 * The builder's "Save" action. Client sends the current draft tree (as
 * plain PageConfig JSON, built from Redux's `draftChildren`), the server
 * re-validates it with the exact same Zod schema used for persisted
 * config — client-side validation is never trusted.
 *
 * This only ever writes a draft (see pageRepository.saveConfig) and only
 * revalidates the builder route. It never revalidates the public route —
 * making a save visible on the public site is publishReleaseAction's job
 * (Phase 4 Rule 1 / Rule 2): revalidating /s/[siteSlug] here would
 * invalidate the public cache for content nobody published yet.
 */
export async function savePageConfigAction(
    pageId: string,
    websiteId: string,
    config: unknown
): Promise<ActionResult<PageConfigInput>> {
    const result = await pageService.saveConfig(pageId, config);
    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/builder`);
    }
    return toActionResult(result);
}

export async function createPageAction(input: {
    websiteId: string;
    path: string;
    title: string;
}): Promise<ActionResult<PageView>> {
    const result = await pageService.create(input);
    if (result.ok) {
        revalidatePath(`/websites/${input.websiteId}/builder`);
    }
    return toActionResult(result);
}
