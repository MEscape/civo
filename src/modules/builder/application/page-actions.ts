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
 */
export async function savePageConfigAction(
    pageId: string,
    websiteId: string,
    config: unknown
): Promise<ActionResult<PageConfigInput>> {
    const result = await pageService.saveConfig(pageId, config);
    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/builder`);
        // The public route is /s/[siteSlug] (src/app/s/[siteSlug]/page.tsx),
        // which despite its folder name is actually keyed by the
        // website's id, not a slug — see that route's own data fetch.
        // The previous `revalidatePath(`/${websiteId}`)` targeted a path
        // that was never rendered by any route, so a save never actually
        // invalidated the public page's cache (spec §48).
        revalidatePath(`/s/${websiteId}`);
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
