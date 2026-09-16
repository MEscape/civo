"use server";

import { revalidatePath } from "next/cache";
import { websiteService, type WebsiteWithTheme } from "@/modules/website/infrastructure/website-service";
import { ActionResult, toActionResult } from "@/lib/actions/action-result";

/**
 * Server Actions for Website mutations.
 *
 * Every action: validates via the service layer (which validates via
 * Zod), never trusts client input, and returns a plain serializable
 * Result-shaped object (not the AppError's `cause`, which may contain
 * non-serializable or sensitive detail — see toUserMessage).
 *
 * Flow: Client → Server Action → Zod (in service) → service/domain →
 * repository → Prisma → revalidate.
 */
export async function createWebsiteAction(input: {
    name: string;
    slug: string;
    description?: string;
    templateKey: "municipal" | "smart-city" | "association";
}): Promise<ActionResult<WebsiteWithTheme>> {
    const result = await websiteService.create(input);
    if (result.ok) {
        revalidatePath("/websites");
    }
    return toActionResult(result);
}

export async function updateWebsiteAction(input: {
    id: string;
    name?: string;
    description?: string;
}): Promise<ActionResult<WebsiteWithTheme>> {
    const result = await websiteService.update(input);
    if (result.ok) {
        revalidatePath("/websites");
        revalidatePath(`/websites/${input.id}`);
    }
    return toActionResult(result);
}

export async function updateThemeAction(
    themeId: string,
    input: Partial<{
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
        headingFont: string;
        bodyFont: string;
        radius: "none" | "sm" | "md" | "lg";
        spacingScale: "compact" | "comfortable" | "spacious";
    }>,
    websiteId: string
): Promise<ActionResult<unknown>> {
    const result = await websiteService.updateTheme(themeId, input);
    if (result.ok) {
        revalidatePath(`/websites/${websiteId}`);
        revalidatePath(`/websites/${websiteId}/builder`);
    }
    return toActionResult(result);
}
