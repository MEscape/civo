import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
    isUniqueConstraintError,
    isNotFoundError,
} from "./prisma-errors";

describe("Prisma error utilities", () => {
    describe("isUniqueConstraintError", () => {
        it("returns true for a Prisma P2002 error", () => {
            const error = new Prisma.PrismaClientKnownRequestError(
                "Unique constraint failed",
                {
                    code: "P2002",
                    clientVersion: "test",
                },
            );

            expect(isUniqueConstraintError(error)).toBe(true);
        });

        it("returns false for a different Prisma error code", () => {
            const error = new Prisma.PrismaClientKnownRequestError(
                "Record not found",
                {
                    code: "P2025",
                    clientVersion: "test",
                },
            );

            expect(isUniqueConstraintError(error)).toBe(false);
        });

        it("returns false for an ordinary Error", () => {
            expect(
                isUniqueConstraintError(new Error("Something went wrong")),
            ).toBe(false);
        });

        it("returns false for null", () => {
            expect(isUniqueConstraintError(null)).toBe(false);
        });

        it("returns false for undefined", () => {
            expect(isUniqueConstraintError(undefined)).toBe(false);
        });

        it("returns false for a plain object with the same shape", () => {
            expect(
                isUniqueConstraintError({
                    code: "P2002",
                    message: "Unique constraint failed",
                }),
            ).toBe(false);
        });
    });

    describe("isNotFoundError", () => {
        it("returns true for a Prisma P2025 error", () => {
            const error = new Prisma.PrismaClientKnownRequestError(
                "Record not found",
                {
                    code: "P2025",
                    clientVersion: "test",
                },
            );

            expect(isNotFoundError(error)).toBe(true);
        });

        it("returns false for a different Prisma error code", () => {
            const error = new Prisma.PrismaClientKnownRequestError(
                "Unique constraint failed",
                {
                    code: "P2002",
                    clientVersion: "test",
                },
            );

            expect(isNotFoundError(error)).toBe(false);
        });

        it("returns false for an ordinary Error", () => {
            expect(
                isNotFoundError(new Error("Something went wrong")),
            ).toBe(false);
        });

        it("returns false for null", () => {
            expect(isNotFoundError(null)).toBe(false);
        });

        it("returns false for undefined", () => {
            expect(isNotFoundError(undefined)).toBe(false);
        });

        it("returns false for a plain object with the same shape", () => {
            expect(
                isNotFoundError({
                    code: "P2025",
                    message: "Record not found",
                }),
            ).toBe(false);
        });
    });
});
