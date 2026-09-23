import { describe, expect, it } from "vitest";
import { datasetCacheVersion } from "@/modules/data-sources/domain/source-cache-version";

const base = {
    sourceKind: "REST" as const,
    sourceConfig: { baseUrl: "https://example.de/api", path: "/events", authMode: "NONE" },
    datasetMapping: { fields: [{ sourcePath: "a", targetPath: "title", required: true }] },
};

describe("datasetCacheVersion", () => {
    it("is stable for identical input", () => {
        expect(datasetCacheVersion(base)).toBe(datasetCacheVersion({ ...base }));
    });

    it("ignores object key order, since the database may return keys in any order", () => {
        const reordered = {
            datasetMapping: { fields: [{ required: true, targetPath: "title", sourcePath: "a" }] },
            sourceConfig: { authMode: "NONE", path: "/events", baseUrl: "https://example.de/api" },
            sourceKind: "REST" as const,
        };

        expect(datasetCacheVersion(reordered)).toBe(datasetCacheVersion(base));
    });

    it("changes when the URL changes", () => {
        expect(datasetCacheVersion({ ...base, sourceConfig: { ...base.sourceConfig, baseUrl: "https://other.de/api" } })).not.toBe(
            datasetCacheVersion(base)
        );
    });

    it("changes when the path changes", () => {
        expect(datasetCacheVersion({ ...base, sourceConfig: { ...base.sourceConfig, path: "/news" } })).not.toBe(
            datasetCacheVersion(base)
        );
    });

    it("changes when the auth mode changes", () => {
        expect(datasetCacheVersion({ ...base, sourceConfig: { ...base.sourceConfig, authMode: "API_KEY" } })).not.toBe(
            datasetCacheVersion(base)
        );
    });

    it("changes when the mapping changes", () => {
        const changed = { fields: [{ sourcePath: "a", targetPath: "description", required: false }] };

        expect(datasetCacheVersion({ ...base, datasetMapping: changed })).not.toBe(datasetCacheVersion(base));
    });

    it("changes when the mapping is cleared", () => {
        expect(datasetCacheVersion({ ...base, datasetMapping: null })).not.toBe(datasetCacheVersion(base));
    });

    it("changes when the kind changes", () => {
        expect(datasetCacheVersion({ ...base, sourceKind: "MOCK" as const })).not.toBe(datasetCacheVersion(base));
    });

    it("treats array order as significant, because mapping field order is meaningful", () => {
        const a = { ...base, datasetMapping: { fields: [{ n: 1 }, { n: 2 }] } };
        const b = { ...base, datasetMapping: { fields: [{ n: 2 }, { n: 1 }] } };

        expect(datasetCacheVersion(a)).not.toBe(datasetCacheVersion(b));
    });

    it("does not depend on any bookkeeping fields such as status or timestamps", () => {
        const withBookkeeping = { ...base, status: "ERROR", lastCheckedAt: new Date(), updatedAt: new Date() };

        expect(datasetCacheVersion(withBookkeeping)).toBe(datasetCacheVersion(base));
    });
});
