/**
 * Structured application error model.
 *
 * These represent *expected* failure modes surfaced through `Result`,
 * never thrown. Keep `message` safe to show in logs; it is NOT guaranteed
 * to be safe to render to end users verbatim (see toUserMessage below).
 */
export type AppErrorCode =
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "CONFLICT"
    | "DATABASE_ERROR"
    | "EXTERNAL_API_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "INTERNAL_ERROR";

export type AppError = {
    code: AppErrorCode;
    message: string;
    /** Underlying cause (e.g. caught exception). Never sent to the client. */
    cause?: unknown;
    /** Optional field name, useful for surfacing validation errors in forms. */
    field?: string;
};

export function appError(
    code: AppErrorCode,
    message: string,
    options?: { cause?: unknown; field?: string }
): AppError {
    return { code, message, cause: options?.cause, field: options?.field };
}

export const AppErrors = {
    validation: (message: string, field?: string): AppError =>
        appError("VALIDATION_ERROR", message, { field }),
    notFound: (resource: string): AppError =>
        appError("NOT_FOUND", `${resource} was not found.`),
    conflict: (message: string): AppError => appError("CONFLICT", message),
    database: (cause?: unknown): AppError =>
        appError("DATABASE_ERROR", "A database error occurred.", { cause }),
    externalApi: (message: string, cause?: unknown): AppError =>
        appError("EXTERNAL_API_ERROR", message, { cause }),
    unauthorized: (): AppError =>
        appError("UNAUTHORIZED", "Authentication is required for this action."),
    forbidden: (): AppError =>
        appError("FORBIDDEN", "You do not have permission to perform this action."),
    internal: (cause?: unknown): AppError =>
        appError("INTERNAL_ERROR", "An unexpected error occurred.", { cause }),
};

/**
 * Maps an AppErrorCode to a safe, generic message for end users.
 * Never leak `cause` or raw database/infrastructure detail to the client.
 */
export function toUserMessage(error: AppError): string {
    switch (error.code) {
        case "VALIDATION_ERROR":
            return error.message;
        case "NOT_FOUND":
            return error.message;
        case "CONFLICT":
            return error.message;
        case "UNAUTHORIZED":
            return "Please sign in to continue.";
        case "FORBIDDEN":
            return "You do not have permission to perform this action.";
        case "DATABASE_ERROR":
        case "EXTERNAL_API_ERROR":
        case "INTERNAL_ERROR":
            return "Something went wrong. Please try again.";
        default:
            return "Something went wrong. Please try again.";
    }
}
