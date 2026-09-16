import { describe, it, expect } from "vitest";
import {
    appError,
    AppErrors,
    toUserMessage,
} from "./app-error";

describe("appError", () => {
    it("creates an AppError with a code and message", () => {
        const error = appError("CONFLICT", "The resource already exists.");

        expect(error).toEqual({
            code: "CONFLICT",
            message: "The resource already exists.",
            cause: undefined,
            field: undefined,
        });
    });

    it("includes a cause when provided", () => {
        const cause = new Error("Database connection failed");

        const error = appError(
            "DATABASE_ERROR",
            "A database error occurred.",
            { cause },
        );

        expect(error).toEqual({
            code: "DATABASE_ERROR",
            message: "A database error occurred.",
            cause,
            field: undefined,
        });
    });

    it("includes a field when provided", () => {
        const error = appError(
            "VALIDATION_ERROR",
            "Email is required.",
            { field: "email" },
        );

        expect(error).toEqual({
            code: "VALIDATION_ERROR",
            message: "Email is required.",
            cause: undefined,
            field: "email",
        });
    });

    it("supports both cause and field", () => {
        const cause = new Error("Underlying error");

        const error = appError(
            "VALIDATION_ERROR",
            "Invalid value.",
            {
                cause,
                field: "email",
            },
        );

        expect(error).toEqual({
            code: "VALIDATION_ERROR",
            message: "Invalid value.",
            cause,
            field: "email",
        });
    });
});

describe("AppErrors", () => {
    it("creates a validation error", () => {
        expect(AppErrors.validation("Email is invalid")).toEqual({
            code: "VALIDATION_ERROR",
            message: "Email is invalid",
            cause: undefined,
            field: undefined,
        });
    });

    it("creates a validation error with a field", () => {
        expect(AppErrors.validation("Email is invalid", "email")).toEqual({
            code: "VALIDATION_ERROR",
            message: "Email is invalid",
            cause: undefined,
            field: "email",
        });
    });

    it("creates a not found error", () => {
        expect(AppErrors.notFound("User")).toEqual({
            code: "NOT_FOUND",
            message: "User was not found.",
            cause: undefined,
            field: undefined,
        });
    });

    it("creates a conflict error", () => {
        expect(AppErrors.conflict("Email already exists.")).toEqual({
            code: "CONFLICT",
            message: "Email already exists.",
            cause: undefined,
            field: undefined,
        });
    });

    it("creates a database error", () => {
        const cause = new Error("Connection refused");

        expect(AppErrors.database(cause)).toEqual({
            code: "DATABASE_ERROR",
            message: "A database error occurred.",
            cause,
            field: undefined,
        });
    });

    it("creates a database error without a cause", () => {
        expect(AppErrors.database()).toEqual({
            code: "DATABASE_ERROR",
            message: "A database error occurred.",
            cause: undefined,
            field: undefined,
        });
    });

    it("creates an external API error", () => {
        const cause = new Error("Request failed");

        expect(
            AppErrors.externalApi("Payment provider unavailable.", cause),
        ).toEqual({
            code: "EXTERNAL_API_ERROR",
            message: "Payment provider unavailable.",
            cause,
            field: undefined,
        });
    });

    it("creates an external API error without a cause", () => {
        expect(AppErrors.externalApi("Payment provider unavailable.")).toEqual({
            code: "EXTERNAL_API_ERROR",
            message: "Payment provider unavailable.",
            cause: undefined,
            field: undefined,
        });
    });

    it("creates an unauthorized error", () => {
        expect(AppErrors.unauthorized()).toEqual({
            code: "UNAUTHORIZED",
            message: "Authentication is required for this action.",
            cause: undefined,
            field: undefined,
        });
    });

    it("creates a forbidden error", () => {
        expect(AppErrors.forbidden()).toEqual({
            code: "FORBIDDEN",
            message: "You do not have permission to perform this action.",
            cause: undefined,
            field: undefined,
        });
    });

    it("creates an internal error", () => {
        const cause = new Error("Unexpected failure");

        expect(AppErrors.internal(cause)).toEqual({
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred.",
            cause,
            field: undefined,
        });
    });

    it("creates an internal error without a cause", () => {
        expect(AppErrors.internal()).toEqual({
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred.",
            cause: undefined,
            field: undefined,
        });
    });
});

describe("toUserMessage", () => {
    it("returns the validation message", () => {
        const error = AppErrors.validation(
            "Email must be valid.",
            "email",
        );

        expect(toUserMessage(error)).toBe("Email must be valid.");
    });

    it("returns the not found message", () => {
        const error = AppErrors.notFound("User");

        expect(toUserMessage(error)).toBe("User was not found.");
    });

    it("returns the conflict message", () => {
        const error = AppErrors.conflict("Email already exists.");

        expect(toUserMessage(error)).toBe("Email already exists.");
    });

    it("returns the safe unauthorized message", () => {
        const error = AppErrors.unauthorized();

        expect(toUserMessage(error)).toBe(
            "Please sign in to continue.",
        );
    });

    it("returns the safe forbidden message", () => {
        const error = AppErrors.forbidden();

        expect(toUserMessage(error)).toBe(
            "You do not have permission to perform this action.",
        );
    });

    it("hides database error details", () => {
        const error = AppErrors.database(
            new Error("postgres password=super-secret"),
        );

        expect(toUserMessage(error)).toBe(
            "Something went wrong. Please try again.",
        );

        expect(toUserMessage(error)).not.toContain("postgres");
        expect(toUserMessage(error)).not.toContain("super-secret");
    });

    it("hides external API error details", () => {
        const error = AppErrors.externalApi(
            "Stripe API key sk_secret_123 was rejected.",
        );

        expect(toUserMessage(error)).toBe(
            "Something went wrong. Please try again.",
        );
    });

    it("hides internal error details", () => {
        const error = AppErrors.internal(
            new Error("Internal implementation detail"),
        );

        expect(toUserMessage(error)).toBe(
            "Something went wrong. Please try again.",
        );
    });

    it("does not expose the cause", () => {
        const cause = new Error("Sensitive infrastructure detail");

        const error = AppErrors.database(cause);

        expect(toUserMessage(error)).not.toContain(
            "Sensitive infrastructure detail",
        );
    });

    it("returns a generic message for an unknown runtime error code", () => {
        const error = {
            code: "SOME_UNKNOWN_CODE",
            message: "Sensitive internal detail",
        } as never;

        expect(toUserMessage(error)).toBe(
            "Something went wrong. Please try again.",
        );
    });
});
