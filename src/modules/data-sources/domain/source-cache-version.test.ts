import { describe, expect, it } from "vitest";
import { sourceCacheVersion } from "@/modules/data-sources/domain/source-cache-version";

const base = {
    kind: "REST",
    config: { baseUrl: "https://example.de/api", path: "/events", authMode: "NONE" },
    mapping: { fields: [{ sourcePath: "a", targetPath: "title", required: true }] },
};

describe("sourceCacheVersion", () => {
    it("is stable for identical input", () => {
        expect(sourceCacheVersion(base)).toBe(sourceCacheVersion({ ...base }));
    });

    it("ignores object key order, since the database may return keys in any order", () => {
        const reordered = {
            mapping: { fields: [{ required: true, targetPath: "title", sourcePath: "a" }] },
            config: { authMode: "NONE", path: "/events", baseUrl: "https://example.de/api" },
            kind: "REST",
        };

        expect(sourceCacheVersion(reordered)).toBe(sourceCacheVersion(base));
    });

    it("changes when the URL changes", () => {
        expect(sourceCacheVersion({ ...base, config: { ...base.config, baseUrl: "https://other.de/api" } })).not.toBe(
            sourceCacheVersion(base)
        );
    });

    it("changes when the path changes", () => {
        expect(sourceCacheVersion({ ...base, config: { ...base.config, path: "/news" } })).not.toBe(
            sourceCacheVersion(base)
        );
    });

    it("changes when the auth mode changes", () => {
        expect(sourceCacheVersion({ ...base, config: { ...base.config, authMode: "API_KEY" } })).not.toBe(
            sourceCacheVersion(base)
        );
    });

    it("changes when the mapping changes", () => {
        const changed = { fields: [{ sourcePath: "a", targetPath: "description", required: false }] };

        expect(sourceCacheVersion({ ...base, mapping: changed })).not.toBe(sourceCacheVersion(base));
    });

    it("changes when the mapping is cleared", () => {
        expect(sourceCacheVersion({ ...base, mapping: null })).not.toBe(sourceCacheVersion(base));
    });

    it("changes when the kind changes", () => {
        expect(sourceCacheVersion({ ...base, kind: "GRAPHQL" })).not.toBe(sourceCacheVersion(base));
    });

    it("treats array order as significant, because mapping field order is meaningful", () => {
        const a = { ...base, mapping: { fields: [{ n: 1 }, { n: 2 }] } };
        const b = { ...base, mapping: { fields: [{ n: 2 }, { n: 1 }] } };

        expect(sourceCacheVersion(a)).not.toBe(sourceCacheVersion(b));
    });

    it("does not depend on any bookkeeping fields such as status or timestamps", () => {
        const withBookkeeping = { ...base, status: "ERROR", lastCheckedAt: new Date(), updatedAt: new Date() };

        expect(sourceCacheVersion(withBookkeeping)).toBe(sourceCacheVersion(base));
    });
});
