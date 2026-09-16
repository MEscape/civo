import { describe, expect, it } from "vitest";
import { err, ok } from "@/lib/result/result";
import { AppErrors, appError } from "@/lib/errors/app-error";
import {
    toActionResult,
    type ActionResult,
} from "./action-result";

describe("toActionResult", () => {
    it("converts a successful Result into a successful ActionResult", () => {
        const result = ok({ id: "123", name: "Test" });

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: true,
            data: {
                id: "123",
                name: "Test",
            },
        });
    });

    it("preserves the success data", () => {
        const data = {
            id: "123",
            value: 42,
            nested: {
                active: true,
            },
        };

        const actionResult = toActionResult(ok(data));

        expect(actionResult).toEqual({
            ok: true,
            data,
        });
    });

    it("converts a failed Result into a failed ActionResult", () => {
        const result = err(
            AppErrors.validation("Email is invalid."),
        );

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "Email is invalid.",
            field: undefined,
        });
    });

    it("preserves the validation field", () => {
        const result = err(
            AppErrors.validation(
                "Email is invalid.",
                "email",
            ),
        );

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "Email is invalid.",
            field: "email",
        });
    });

    it("does not include the AppError cause", () => {
        const cause = new Error("Sensitive database details");

        const result = err(
            appError(
                "DATABASE_ERROR",
                "Database connection failed.",
                { cause },
            ),
        );

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "Something went wrong. Please try again.",
            field: undefined,
        });

        expect(actionResult).not.toHaveProperty("cause");
        expect(JSON.stringify(actionResult)).not.toContain(
            "Sensitive database details",
        );
    });

    it("uses the safe user message for database errors", () => {
        const result = err(
            AppErrors.database(
                new Error("postgres://user:password@localhost"),
            ),
        );

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "Something went wrong. Please try again.",
            field: undefined,
        });
    });

    it("uses the safe user message for external API errors", () => {
        const result = err(
            AppErrors.externalApi(
                "External API returned secret internal details.",
                new Error("API failure"),
            ),
        );

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "Something went wrong. Please try again.",
            field: undefined,
        });
    });

    it("uses the safe user message for unauthorized errors", () => {
        const result = err(AppErrors.unauthorized());

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "Please sign in to continue.",
            field: undefined,
        });
    });

    it("uses the safe user message for forbidden errors", () => {
        const result = err(AppErrors.forbidden());

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "You do not have permission to perform this action.",
            field: undefined,
        });
    });

    it("preserves the not-found message", () => {
        const result = err(AppErrors.notFound("User"));

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "User was not found.",
            field: undefined,
        });
    });

    it("preserves the conflict message", () => {
        const result = err(
            AppErrors.conflict("Email already exists."),
        );

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "Email already exists.",
            field: undefined,
        });
    });

    it("uses the safe user message for internal errors", () => {
        const result = err(
            AppErrors.internal(
                new Error("Internal implementation detail"),
            ),
        );

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "Something went wrong. Please try again.",
            field: undefined,
        });
    });

    it("returns a serializable result", () => {
        const result = err(
            appError(
                "DATABASE_ERROR",
                "Database failed.",
                {
                    cause: new Error("Database exploded"),
                },
            ),
        );

        const actionResult = toActionResult(result);

        expect(() => JSON.stringify(actionResult)).not.toThrow();
    });
});

describe("ActionResult type", () => {
    it("supports successful results", () => {
        const result: ActionResult<{ id: string }> = {
            ok: true,
            data: {
                id: "123",
            },
        };

        expect(result).toEqual({
            ok: true,
            data: {
                id: "123",
            },
        });
    });

    it("supports failed results with a field", () => {
        const result: ActionResult<unknown> = {
            ok: false,
            message: "Invalid email.",
            field: "email",
        };

        expect(result).toEqual({
            ok: false,
            message: "Invalid email.",
            field: "email",
        });
    });

    it("does not leak the error cause to the client", () => {
        const result = err(
            appError(
                "DATABASE_ERROR",
                "Internal database failure",
                {
                    cause: new Error("password=super-secret"),
                },
            ),
        );

        const actionResult = toActionResult(result);

        expect(actionResult).toEqual({
            ok: false,
            message: "Something went wrong. Please try again.",
            field: undefined,
        });

        expect(JSON.stringify(actionResult)).not.toContain(
            "super-secret",
        );
    });
});
