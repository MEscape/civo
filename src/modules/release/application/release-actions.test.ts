import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    publishReleaseAction,
    rollbackReleaseAction,
    getReleaseHistoryAction,
} from "@/modules/release/application/release-actions";
import { releaseService } from "@/modules/release/application/release-service";
import { revalidatePath } from "next/cache";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";
import type { WebsiteRelease } from "@prisma/client";

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

vi.mock("@/modules/release/application/release-service", () => ({
    releaseService: {
        publish: vi.fn(),
        rollback: vi.fn(),
        getReleaseHistory: vi.fn(),
    },
}));

describe("publishReleaseAction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns success and revalidates both the builder and public routes when publishing succeeds", async () => {
        const release = { id: "release-1", websiteId: "w1", releaseNumber: 1 } as unknown as WebsiteRelease;
        vi.mocked(releaseService.publish).mockResolvedValue(ok(release));

        const result = await publishReleaseAction("w1");

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toEqual(release);
        expect(revalidatePath).toHaveBeenCalledWith("/websites/w1/builder");
        expect(revalidatePath).toHaveBeenCalledWith("/s/w1");
    });

    it("returns error and does not revalidate anything when publishing fails", async () => {
        vi.mocked(releaseService.publish).mockResolvedValue(
            err(AppErrors.validation("This website has no pages to publish."))
        );

        const result = await publishReleaseAction("w1");

        expect(result.ok).toBe(false);
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});

describe("rollbackReleaseAction", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns success and revalidates both routes when rollback succeeds", async () => {
        const release = { id: "release-old", websiteId: "w1", releaseNumber: 1 } as unknown as WebsiteRelease;
        vi.mocked(releaseService.rollback).mockResolvedValue(ok(release));

        const result = await rollbackReleaseAction("w1", "release-old");

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data).toEqual(release);
        expect(revalidatePath).toHaveBeenCalledWith("/websites/w1/builder");
        expect(revalidatePath).toHaveBeenCalledWith("/s/w1");
    });

    it("returns error and does not revalidate when rollback fails", async () => {
        vi.mocked(releaseService.rollback).mockResolvedValue(
            err(AppErrors.notFound("Ziel-Release"))
        );

        const result = await rollbackReleaseAction("w1", "nonexistent");

        expect(result.ok).toBe(false);
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});

describe("getReleaseHistoryAction", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns the release list from the service", async () => {
        const releases = [{ id: "r1" }, { id: "r2" }] as WebsiteRelease[];
        vi.mocked(releaseService.getReleaseHistory).mockResolvedValue(ok(releases));

        const result = await getReleaseHistoryAction("w1");

        expect(result).toEqual({ ok: true, data: releases });
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("propagates a service error", async () => {
        vi.mocked(releaseService.getReleaseHistory).mockResolvedValue(err(AppErrors.database()));

        const result = await getReleaseHistoryAction("w1");

        expect(result.ok).toBe(false);
    });
});
