import { toErrorResponseBody } from '@lib/errors';
import type { AppError, ErrorResponseBody } from '@lib/errors';

import type { AppResult } from './app-result';

/**
 * `Result` instances from neverthrow are class instances with methods —
 * they do not survive serialization across the Server Action boundary
 * intact. `ActionResult` is the plain-object shape Client Components
 * actually receive, per nextjs.md ("Server Actions are framework adapters")
 * and api.md ("map Result values at the boundary, not before").
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: SerializedActionError };

/**
 * An error as a Client Component receives it: message, a stable code, and
 * the field-level issues or retry delay where they apply. Never a `cause`.
 * It is the same body a Route Handler answers with (`toErrorResponseBody`),
 * so the two boundaries cannot drift apart.
 */
export type SerializedActionError = ErrorResponseBody;

/**
 * Converts an application-layer AppResult into the serializable shape a
 * Server Action returns to the client. This is the one place that
 * boundary crossing happens — call it at the end of every Server Action,
 * never inside application/domain code (boundaries.md: application must
 * not import presentation).
 */
export function toActionResult<T, E extends AppError>(result: AppResult<T, E>): ActionResult<T> {
  return result.isOk()
    ? { ok: true, data: result.value }
    : { ok: false, error: toErrorResponseBody(result.error) };
}
