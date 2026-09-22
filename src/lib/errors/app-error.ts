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
        appError("NOT_FOUND", `${resource} wurde nicht gefunden.`),
    conflict: (message: string): AppError => appError("CONFLICT", message),
    database: (cause?: unknown): AppError =>
        appError("DATABASE_ERROR", "Ein Datenbankfehler ist aufgetreten.", { cause }),
    externalApi: (message: string, cause?: unknown): AppError =>
        appError("EXTERNAL_API_ERROR", message, { cause }),
    unauthorized: (): AppError =>
        appError("UNAUTHORIZED", "Für diese Aktion ist eine Anmeldung erforderlich."),
    forbidden: (): AppError =>
        appError("FORBIDDEN", "Sie haben keine Berechtigung, diese Aktion auszuführen."),
    internal: (cause?: unknown): AppError =>
        appError("INTERNAL_ERROR", "Ein unerwarteter Fehler ist aufgetreten.", { cause }),
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
            return "Bitte melden Sie sich an, um fortzufahren.";
        case "FORBIDDEN":
            return "Sie haben keine Berechtigung, diese Aktion auszuführen.";
        case "DATABASE_ERROR":
        case "EXTERNAL_API_ERROR":
        case "INTERNAL_ERROR":
            return "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.";
        default:
            return "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.";
    }
}
