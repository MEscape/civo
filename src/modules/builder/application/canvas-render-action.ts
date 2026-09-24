"use server";

import type { ReactNode } from "react";

import { pageConfigSchema } from "@/modules/builder/domain/page-schema";
import { renderPageNodes } from "@/modules/component-platform/infrastructure/render-nodes";

import {
    err,
    ok,
    type Result,
} from "@/lib/result/result";

import type { AppError } from "@/lib/errors/app-error";
import { toActionResult, type ActionResult } from "@/lib/actions/action-result";

/**
 * Server-side rendering operation for the builder canvas.
 *
 * This is intentionally a Result-producing function rather than an
 * ActionResult-producing function. The Result belongs to the application/
 * service layer; the Server Action converts it into the serializable,
 * client-safe ActionResult at the boundary.
 */
function renderCanvas(
    config: unknown
): Result<ReactNode, AppError> {
    const parsed = pageConfigSchema.safeParse(config);

    if (!parsed.success) {
        return err({
            code: "VALIDATION_ERROR",
            message: "Die aktuelle Seitenkonfiguration ist ungültig.",
        });
    }

    return ok(
        renderPageNodes(
            parsed.data.children,
            true
        )
    );
}

/**
 * Server Action boundary.
 *
 * Server Actions return the serializable ActionResult shape rather than
 * exposing internal AppError instances or arbitrary Result error values
 * to the client.
 *
 * The React element tree itself is returned as the successful `data`
 * payload. Next.js serializes it through the RSC payload, allowing the
 * client to render the result without manually calling react-dom/server
 * or using dangerouslySetInnerHTML.
 */
export async function renderCanvasAction(
    config: unknown
): Promise<ActionResult<ReactNode>> {
    return toActionResult(
        renderCanvas(config)
    );
}
