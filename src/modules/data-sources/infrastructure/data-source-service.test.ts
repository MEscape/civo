import { beforeEach, describe, expect, it, vi } from "vitest";
import { dataSourceService } from "./data-source-service";
import { dataSourceRepository } from "./data-source-repository";
import { restJsonAdapter } from "./adapters/rest-json-adapter";
import type { DatasetMapping } from "@/modules/data-sources/domain/field-mapping-schema";

vi.mock("./data-source-repository", () => ({
    dataSourceRepository: {
        findByWebsite: vi.fn(),
        findById: vi.fn(),
        upsert: vi.fn(),
        recordTestResult: vi.fn(),
        saveMapping: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock("./adapters/rest-json-adapter", () => ({
    restJsonAdapter: {
        testConnection: vi.fn(),
        discover: vi.fn(),
        fetch: vi.fn(),
    },
}));

describe("dataSourceService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("upsert", () => {
        it("rejects input that fails the top-level schema", async () => {
            const result = await dataSourceService.upsert({ websiteId: "website-1" });

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.upsert).not.toHaveBeenCalled();
        });

        it("rejects REST config shaped like GraphQL config", async () => {
            const result = await dataSourceService.upsert({
                websiteId: "website-1",
                name: "Municipal Events",
                kind: "REST",
                dataset: "civic",
                config: { endpoint: "https://example.de/graphql" },
            });

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.upsert).not.toHaveBeenCalled();
        });

        it("rejects config containing a stray credential-like field (strict schema)", async () => {
            const result = await dataSourceService.upsert({
                websiteId: "website-1",
                name: "Municipal Events",
                kind: "REST",
                dataset: "civic",
                config: { baseUrl: "https://example.de/api", apiKey: "should-not-be-here" },
            });

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.upsert).not.toHaveBeenCalled();
        });

        it("rejects a REST baseUrl pointing at a private/internal address (SSRF guard at save time)", async () => {
            const result = await dataSourceService.upsert({
                websiteId: "website-1",
                name: "Municipal Events",
                kind: "REST",
                dataset: "civic",
                config: { baseUrl: "http://169.254.169.254/latest/meta-data/" },
            });

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.field).toBe("config.baseUrl");
            expect(dataSourceRepository.upsert).not.toHaveBeenCalled();
        });

        it("rejects a safe-looking baseUrl combined with an absolute 'path' that resolves to a private address", async () => {
            const result = await dataSourceService.upsert({
                websiteId: "website-1",
                name: "Municipal Events",
                kind: "REST",
                dataset: "civic",
                config: { baseUrl: "https://example.de/api", path: "http://169.254.169.254/latest/meta-data/" },
            });

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.field).toBe("config.baseUrl");
            expect(dataSourceRepository.upsert).not.toHaveBeenCalled();
        });

        it("delegates a valid REST input to the repository with normalized config", async () => {
            const row = { id: "ds-1" };
            vi.mocked(dataSourceRepository.upsert).mockResolvedValue({ ok: true, data: row as never });

            const result = await dataSourceService.upsert({
                websiteId: "website-1",
                name: "Municipal Events",
                kind: "REST",
                dataset: "civic",
                config: { baseUrl: "https://example.de/api" },
            });

            expect(result).toEqual({ ok: true, data: row });
            expect(dataSourceRepository.upsert).toHaveBeenCalledWith({
                websiteId: "website-1",
                dataset: "civic",
                name: "Municipal Events",
                kind: "REST",
                config: { baseUrl: "https://example.de/api", path: "/", authMode: "NONE" },
            });
        });
    });

    describe("delete", () => {
        it("delegates to the repository", async () => {
            vi.mocked(dataSourceRepository.delete).mockResolvedValue({ ok: true, data: undefined });

            const result = await dataSourceService.delete("ds-1");

            expect(result).toEqual({ ok: true, data: undefined });
            expect(dataSourceRepository.delete).toHaveBeenCalledWith("ds-1");
        });
    });

    describe("testConnection", () => {
        const restRow = {
            id: "ds-1",
            kind: "REST",
            config: { baseUrl: "https://example.de/api", path: "/events", authMode: "NONE" },
        };

        it("returns not-found when the data source does not exist", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({ ok: true, data: null });

            const result = await dataSourceService.testConnection("missing");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.category).toBe("CONNECTION_FAILED");
            expect(restJsonAdapter.testConnection).not.toHaveBeenCalled();
        });

        it("returns an INVALID_CONFIGURATION error for a kind with no adapter", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({
                ok: true,
                data: { id: "ds-1", kind: "MOCK", config: {} } as never,
            });

            const result = await dataSourceService.testConnection("ds-1");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.category).toBe("INVALID_CONFIGURATION");
        });

        it("returns an INVALID_CONFIGURATION error when the saved config no longer validates", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({
                ok: true,
                data: { id: "ds-1", kind: "REST", config: { endpoint: "not-a-rest-shape" } } as never,
            });

            const result = await dataSourceService.testConnection("ds-1");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.category).toBe("INVALID_CONFIGURATION");
        });

        it("calls the adapter and records a successful result", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.testConnection).mockResolvedValue({
                ok: true,
                data: { statusCode: 200, responseTimeMs: 42 },
            });
            vi.mocked(dataSourceRepository.recordTestResult).mockResolvedValue({ ok: true, data: {} as never });

            const result = await dataSourceService.testConnection("ds-1");

            expect(result).toEqual({ ok: true, data: { statusCode: 200, responseTimeMs: 42 } });
            expect(dataSourceRepository.recordTestResult).toHaveBeenCalledWith("ds-1", {
                status: "OK",
                lastError: null,
            });
        });

        it("calls the adapter and records a failed result with the error message", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.testConnection).mockResolvedValue({
                ok: false,
                error: { code: "UNAUTHORIZED", message: "Authentication is required for this action.", category: "AUTHENTICATION_FAILED" },
            });
            vi.mocked(dataSourceRepository.recordTestResult).mockResolvedValue({ ok: true, data: {} as never });

            const result = await dataSourceService.testConnection("ds-1");

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.category).toBe("AUTHENTICATION_FAILED");
            expect(dataSourceRepository.recordTestResult).toHaveBeenCalledWith("ds-1", {
                status: "ERROR",
                lastError: "Authentication is required for this action.",
            });
        });
    });

    describe("discover", () => {
        const restRow = {
            id: "ds-1",
            kind: "REST",
            config: { baseUrl: "https://example.de/api", path: "/events", authMode: "NONE" },
        };

        it("delegates to the adapter for a valid REST source", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({ ok: true, data: restRow as never });
            const discoveryResult = { fields: [{ path: "title", sampleType: "string" as const, sampleValue: "Stadtfest" }], sample: {} };
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({ ok: true, data: discoveryResult });

            const result = await dataSourceService.discover("ds-1");

            expect(result).toEqual({ ok: true, data: discoveryResult });
        });

        it("does not write any diagnostic state (read-only)", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({ ok: true, data: { fields: [], sample: {} } });

            await dataSourceService.discover("ds-1");

            expect(dataSourceRepository.recordTestResult).not.toHaveBeenCalled();
        });
    });

    describe("previewMapping", () => {
        const restRow = {
            id: "ds-1",
            kind: "REST",
            config: { baseUrl: "https://example.de/api", path: "/events", authMode: "NONE" },
        };
        const mapping: DatasetMapping = {
            fields: [{ sourcePath: "event_name", targetPath: "title", required: true }],
        };

        it("applies the mapping to the first sample record", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({
                ok: true,
                data: { fields: [], sample: [{ event_name: "Stadtfest" }] },
            });

            const result = await dataSourceService.previewMapping("ds-1", mapping);

            expect(result).toEqual({ ok: true, data: { ok: true, value: { title: "Stadtfest" } } });
        });

        it("returns INVALID_RESPONSE when discovery yields no sample record", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({ ok: true, data: { fields: [], sample: [] } });

            const result = await dataSourceService.previewMapping("ds-1", mapping);

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.category).toBe("INVALID_RESPONSE");
        });

        it("propagates a discovery failure", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({ ok: true, data: null });

            const result = await dataSourceService.previewMapping("ds-1", mapping);

            expect(result.ok).toBe(false);
        });
    });

    describe("saveMapping", () => {
        const restRow = {
            id: "ds-1",
            kind: "REST",
            config: { baseUrl: "https://example.de/api", path: "/events", authMode: "NONE" },
        };

        it("rejects malformed mapping input", async () => {
            const result = await dataSourceService.saveMapping({ dataSourceId: "ds-1", mapping: { fields: [] } });

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.saveMapping).not.toHaveBeenCalled();
        });

        it("saves the mapping once it previews successfully against a live sample", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({
                ok: true,
                data: { fields: [], sample: [{ event_name: "Stadtfest" }] },
            });
            const savedRow = { id: "ds-1", mapping: {} };
            vi.mocked(dataSourceRepository.saveMapping).mockResolvedValue({ ok: true, data: savedRow as never });

            const result = await dataSourceService.saveMapping({
                dataSourceId: "ds-1",
                mapping: { fields: [{ sourcePath: "event_name", targetPath: "title", required: true }] },
            });

            expect(result).toEqual({ ok: true, data: savedRow });
            expect(dataSourceRepository.saveMapping).toHaveBeenCalledWith("ds-1", {
                fields: [{ sourcePath: "event_name", targetPath: "title", required: true }],
            });
        });

        it("rejects a mapping that fails to apply to a live sample, without saving", async () => {
            vi.mocked(dataSourceRepository.findById).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({
                ok: true,
                data: { fields: [], sample: [{ other_field: "value" }] },
            });

            const result = await dataSourceService.saveMapping({
                dataSourceId: "ds-1",
                mapping: { fields: [{ sourcePath: "event_name", targetPath: "title", required: true }] },
            });

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.saveMapping).not.toHaveBeenCalled();
        });
    });
});
