"use server";

import { revalidatePath } from "next/cache";
import { pageService } from "@/modules/builder/infrastructure/page-service";

import { ActionResult, toActionResult } from "@/lib/actions/action-result";
import type { PageConfigInput } from "@/modules/builder/domain/page-schema";
import type { PageWithConfig } from "@/modules/builder/infrastructure/page-repository";

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
        revalidatePath(`/${websiteId}`);
    }
    return toActionResult(result);
}

export async function createPageAction(input: {
    websiteId: string;
    path: string;
    title: string;
}): Promise<ActionResult<PageWithConfig>> {
    const result = await pageService.create(input);
    if (result.ok) {
        revalidatePath(`/websites/${input.websiteId}/builder`);
    }
    return toActionResult(result);
}
