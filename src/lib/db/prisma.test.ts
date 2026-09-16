import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    PrismaClient: vi.fn(),
    PrismaPg: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
    PrismaClient: mocks.PrismaClient,
}));

vi.mock("@prisma/adapter-pg", () => ({
    PrismaPg: mocks.PrismaPg,
}));

describe("prisma client", () => {
    beforeEach(() => {
        vi.resetModules();

        vi.stubEnv(
            "DATABASE_URL",
            "postgresql://test:test@localhost:5432/test",
        );

        vi.stubEnv("NODE_ENV", "test");

        mocks.PrismaClient.mockReset();
        mocks.PrismaPg.mockReset();

        delete (globalThis as { prisma?: unknown }).prisma;

        mocks.PrismaPg.mockImplementation(function(options) {
            return { ...options };
        });

        mocks.PrismaClient.mockImplementation(function(options) {
            return { ...options };
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();

        delete (globalThis as { prisma?: unknown }).prisma;
    });

    it("creates a PrismaPg adapter using DATABASE_URL", async () => {
        await import("./prisma");

        expect(mocks.PrismaPg).toHaveBeenCalledTimes(1);

        expect(mocks.PrismaPg).toHaveBeenCalledWith({
            connectionString:
                "postgresql://test:test@localhost:5432/test",
        });
    });

    it("creates a PrismaClient using the adapter", async () => {
        await import("./prisma");

        expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);

        expect(mocks.PrismaClient).toHaveBeenCalledWith(
            expect.objectContaining({
                adapter: expect.anything(),
            }),
        );
    });

    it("uses warn and error logging in development", async () => {
        vi.stubEnv("NODE_ENV", "development");

        await import("./prisma");

        expect(mocks.PrismaClient).toHaveBeenCalledWith(
            expect.objectContaining({
                log: ["warn", "error"],
            }),
        );
    });

    it("uses only error logging outside development", async () => {
        vi.stubEnv("NODE_ENV", "test");

        await import("./prisma");

        expect(mocks.PrismaClient).toHaveBeenCalledWith(
            expect.objectContaining({
                log: ["error"],
            }),
        );
    });

    it("exports the created PrismaClient instance", async () => {
        const { prisma } = await import("./prisma");

        expect(prisma).toBeDefined();

        expect(prisma).toBe(
            mocks.PrismaClient.mock.results[0].value,
        );
    });

    it("stores the PrismaClient on globalThis in development", async () => {
        vi.stubEnv("NODE_ENV", "development");

        const { prisma } = await import("./prisma");

        expect(
            (globalThis as { prisma?: unknown }).prisma,
        ).toBe(prisma);
    });

    it("does not store the PrismaClient on globalThis in production", async () => {
        vi.stubEnv("NODE_ENV", "production");

        const { prisma } = await import("./prisma");

        expect(
            (globalThis as { prisma?: unknown }).prisma,
        ).toBeUndefined();

        expect(prisma).toBeDefined();
    });

    it("reuses an existing global PrismaClient in development", async () => {
        vi.stubEnv("NODE_ENV", "development");

        const existingPrisma = {
            existing: true,
        };

        (globalThis as { prisma?: unknown }).prisma = existingPrisma;

        const { prisma } = await import("./prisma");

        expect(prisma).toBe(existingPrisma);

        expect(mocks.PrismaClient).not.toHaveBeenCalled();
    });

    it("creates a new PrismaClient when no global instance exists", async () => {
        vi.stubEnv("NODE_ENV", "development");

        const { prisma } = await import("./prisma");

        expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);

        expect(prisma).toBe(
            mocks.PrismaClient.mock.results[0].value,
        );
    });
});
