import { describe, expect, it, vi, beforeEach } from "vitest";
import { releaseService } from "@/modules/release/application/release-service";
import { releaseRepository } from "@/modules/release/infrastructure/release-repository";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";
import type { WebsiteRelease } from "@prisma/client";

vi.mock("@/modules/release/infrastructure/release-repository", () => ({
    releaseRepository: {
        publish: vi.fn(),
        findPublishedByWebsiteId: vi.fn(),
        findAllPublished: vi.fn(),
        findHistoryByWebsiteId: vi.fn(),
        rollback: vi.fn(),
    },
}));

function makeRelease(overrides: Partial<WebsiteRelease> = {}): WebsiteRelease {
    return {
        id: "release-1",
        websiteId: "website-1",
        releaseNumber: 1,
        status: "PUBLISHED",
        snapshot: {},
        snapshotHash: "abc123",
        publishedAt: new Date("2024-01-01"),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...overrides,
    } as WebsiteRelease;
}

describe("releaseService.getReleaseHistory", () => {
    beforeEach(() => vi.clearAllMocks());

    it("delegates to the repository", async () => {
        const releases = [makeRelease(), makeRelease({ id: "release-2", releaseNumber: 2 })];
        vi.mocked(releaseRepository.findHistoryByWebsiteId).mockResolvedValue(ok(releases));

        const result = await releaseService.getReleaseHistory("website-1");

        expect(result).toEqual({ ok: true, data: releases });
        expect(releaseRepository.findHistoryByWebsiteId).toHaveBeenCalledWith("website-1");
    });

    it("propagates a repository error", async () => {
        const failure = err(AppErrors.database());
        vi.mocked(releaseRepository.findHistoryByWebsiteId).mockResolvedValue(failure);

        const result = await releaseService.getReleaseHistory("website-1");

        expect(result).toBe(failure);
    });
});

describe("releaseService.rollback", () => {
    beforeEach(() => vi.clearAllMocks());

    it("delegates to the repository and returns the activated release", async () => {
        const activated = makeRelease({ id: "release-old", releaseNumber: 1 });
        vi.mocked(releaseRepository.rollback).mockResolvedValue(ok(activated));

        const result = await releaseService.rollback("website-1", "release-old");

        expect(result).toEqual({ ok: true, data: activated });
        expect(releaseRepository.rollback).toHaveBeenCalledWith("website-1", "release-old");
    });

    it("propagates a NOT_FOUND error when the target release doesn't exist", async () => {
        vi.mocked(releaseRepository.rollback).mockResolvedValue(
            err(AppErrors.notFound("Ziel-Release"))
        );

        const result = await releaseService.rollback("website-1", "nonexistent");

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    });

    it("propagates a VALIDATION_ERROR when the target release has an invalid snapshot", async () => {
        vi.mocked(releaseRepository.rollback).mockResolvedValue(
            err(AppErrors.validation("Das Snapshot dieses Releases ist beschädigt."))
        );

        const result = await releaseService.rollback("website-1", "release-corrupt");

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    });

    it("propagates a FORBIDDEN error when the release belongs to a different website", async () => {
        vi.mocked(releaseRepository.rollback).mockResolvedValue(err(AppErrors.forbidden()));

        const result = await releaseService.rollback("website-1", "release-from-other-site");

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    });

    it("propagates a database error", async () => {
        const failure = err(AppErrors.database());
        vi.mocked(releaseRepository.rollback).mockResolvedValue(failure);

        const result = await releaseService.rollback("website-1", "release-1");

        expect(result).toBe(failure);
    });
});
