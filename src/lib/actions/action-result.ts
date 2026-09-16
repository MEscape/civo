import type { Result } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/app-error";

/**
 * The serializable result shape returned by every Server Action.
 *
 * Server Actions cannot return arbitrary `Result<T, AppError>` to the
 * client because `AppError.cause` may contain non-serializable values
 * (e.g. Error instances from Prisma or external APIs). This type strips
 * the cause and converts the code to a safe user-facing message.
 *
 * Usage:
 *   return toActionResult(await someService.doSomething(input));
 */
export type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; message: string; field?: string };

/**
 * Converts a service-layer `Result<T, AppError>` into a serializable
 * `ActionResult<T>` safe to return from a Server Action to a Client
 * Component.
 *
 * The `cause` field is intentionally dropped here — it must never reach
 * the client. The message is run through `toUserMessage` to prevent
 * leaking internal error detail.
 */
export function toActionResult<T>(result: Result<T, AppError>): ActionResult<T> {
    if (result.ok) return { ok: true, data: result.data };
    return {
        ok: false,
        message: toUserMessage(result.error),
        field: result.error.field,
    };
}
