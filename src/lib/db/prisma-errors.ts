import { Prisma } from "@prisma/client";

/**
 * Type-safe utility to check if an unknown error is a Prisma unique constraint violation (P2002).
 */
export function isUniqueConstraintError(cause: unknown): boolean {
    return cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002";
}

/**
 * Type-safe utility to check if an unknown error is a Prisma not found error (P2025).
 */
export function isNotFoundError(cause: unknown): boolean {
    return cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2025";
}
