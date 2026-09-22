import { beforeEach, describe, expect, it, vi } from "vitest";
import { dataSourceService } from "./data-source-service";
import { dataSourceRepository } from "@/modules/data-sources/infrastructure/data-source-repository";
import { restJsonAdapter } from "@/modules/data-sources/infrastructure/adapters/rest-json-adapter";
import type { DatasetMapping } from "@/modules/data-sources/domain/field-mapping-schema";

vi.mock("@/modules/data-sources/infrastructure/data-source-repository", () => ({
    dataSourceRepository: {
        findByWebsite: vi.fn(),
        findById: vi.fn(),
        findByIdForWebsite: vi.fn(),
        upsert: vi.fn(),
        recordTestResult: vi.fn(),
        saveMapping: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock("@/modules/data-sources/infrastructure/adapters/rest-json-adapter", () => ({
    restJsonAdapter: {
        parseConfig: vi.fn(),
        testConnection: vi.fn(),
        discover: vi.fn(),
        fetch: vi.fn(),
    },
}));

vi.mock("@/modules/data-sources/application/website-access-guard", () => ({
    requireWebsiteAccess: vi.fn(),
}));

const WEBSITE_ID = "website-1";

const restConfig = { baseUrl: "https://example.de/api", path: "/events", authMode: "NONE" as const };

const restRow = {
    id: "ds-1",
    websiteId: WEBSITE_ID,
    kind: "REST",
    config: restConfig,
};

describe("dataSourceService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Real RestJsonAdapter#parseConfig behavior, mocked simply: pass
        // REST-shaped config through, reject everything else.
        vi.mocked(restJsonAdapter.parseConfig).mockImplementation((raw) => {
            const value = raw as Record<string, unknown>;

            if (typeof value?.baseUrl !== "string") {
                return { ok: false, error: "Ungültige REST-Datenquellenkonfiguration." };
            }

            return {
                ok: true,
                data: { path: "/", authMode: "NONE", ...value } as never,
            };
        });
    });

    describe("ownership", () => {
        it("testConnection refuses a dataSourceId that belongs to a different website", async () => {
            // findByIdForWebsite is the ownership check itself; simulating its
            // real "not mine" behavior (ok(null)) rather than the row.
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: null });

            const result = await dataSourceService.testConnection("someone-elses-ds", WEBSITE_ID);

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.findByIdForWebsite).toHaveBeenCalledWith("someone-elses-ds", WEBSITE_ID);
            expect(restJsonAdapter.testConnection).not.toHaveBeenCalled();
        });

        it("discover refuses a dataSourceId that belongs to a different website", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: null });

            const result = await dataSourceService.discover("someone-elses-ds", WEBSITE_ID);

            expect(result.ok).toBe(false);
            expect(restJsonAdapter.discover).not.toHaveBeenCalled();
        });

        it("delete refuses a dataSourceId that belongs to a different website", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: null });

            const result = await dataSourceService.delete("someone-elses-ds", WEBSITE_ID);

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.delete).not.toHaveBeenCalled();
        });
    });

    describe("upsert", () => {
        it("rejects input that fails the top-level schema", async () => {
            const result = await dataSourceService.upsert({ websiteId: WEBSITE_ID });

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.upsert).not.toHaveBeenCalled();
        });

        it("rejects a REST baseUrl pointing at a private/internal address (SSRF guard at save time)", async () => {
            const result = await dataSourceService.upsert({
                websiteId: WEBSITE_ID,
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
                websiteId: WEBSITE_ID,
                name: "Municipal Events",
                kind: "REST",
                dataset: "civic",
                config: { baseUrl: "https://example.de/api", path: "http://169.254.169.254/latest/meta-data/" },
            });

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.field).toBe("config.baseUrl");
            expect(dataSourceRepository.upsert).not.toHaveBeenCalled();
        });

        it("delegates a valid REST input to the repository with the adapter-normalized config", async () => {
            const row = { id: "ds-1" };
            vi.mocked(dataSourceRepository.upsert).mockResolvedValue({ ok: true, data: row as never });

            const result = await dataSourceService.upsert({
                websiteId: WEBSITE_ID,
                name: "Municipal Events",
                kind: "REST",
                dataset: "civic",
                config: { baseUrl: "https://example.de/api" },
            });

            expect(result).toEqual({ ok: true, data: row });
            expect(dataSourceRepository.upsert).toHaveBeenCalledWith({
                websiteId: WEBSITE_ID,
                dataset: "civic",
                name: "Municipal Events",
                kind: "REST",
                config: { baseUrl: "https://example.de/api", path: "/", authMode: "NONE" },
            });
        });

        it("routes REST config validation through the adapter's own parseConfig", async () => {
            vi.mocked(dataSourceRepository.upsert).mockResolvedValue({ ok: true, data: {} as never });

            await dataSourceService.upsert({
                websiteId: WEBSITE_ID,
                name: "Municipal Events",
                kind: "REST",
                dataset: "civic",
                config: { baseUrl: "https://example.de/api" },
            });

            expect(restJsonAdapter.parseConfig).toHaveBeenCalledWith({ baseUrl: "https://example.de/api" });
        });

        it("accepts a MOCK source with empty config, which has no adapter to validate through", async () => {
            vi.mocked(dataSourceRepository.upsert).mockResolvedValue({ ok: true, data: {} as never });

            const result = await dataSourceService.upsert({
                websiteId: WEBSITE_ID,
                name: "Sample data",
                kind: "MOCK",
                dataset: "civic",
                config: {},
            });

            expect(result.ok).toBe(true);
            expect(restJsonAdapter.parseConfig).not.toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("delegates to the repository once ownership is confirmed", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(dataSourceRepository.delete).mockResolvedValue({ ok: true, data: undefined });

            const result = await dataSourceService.delete("ds-1", WEBSITE_ID);

            expect(result).toEqual({ ok: true, data: undefined });
            expect(dataSourceRepository.delete).toHaveBeenCalledWith("ds-1");
        });
    });

    describe("testConnection", () => {
        it("returns not-found when the data source does not exist", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: null });

            const result = await dataSourceService.testConnection("missing", WEBSITE_ID);

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.category).toBe("CONNECTION_FAILED");
            expect(restJsonAdapter.testConnection).not.toHaveBeenCalled();
        });

        it("returns an INVALID_CONFIGURATION error for a kind with no adapter", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({
                ok: true,
                data: { id: "ds-1", websiteId: WEBSITE_ID, kind: "MOCK", config: {} } as never,
            });

            const result = await dataSourceService.testConnection("ds-1", WEBSITE_ID);

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.category).toBe("INVALID_CONFIGURATION");
        });

        it("returns an INVALID_CONFIGURATION error when the saved config no longer validates", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({
                ok: true,
                data: { id: "ds-1", websiteId: WEBSITE_ID, kind: "REST", config: { endpoint: "not-a-rest-shape" } } as never,
            });

            const result = await dataSourceService.testConnection("ds-1", WEBSITE_ID);

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.category).toBe("INVALID_CONFIGURATION");
        });

        it("calls the adapter with a DataSourceContext and records a successful result", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.testConnection).mockResolvedValue({
                ok: true,
                data: { statusCode: 200, responseTimeMs: 42 },
            });
            vi.mocked(dataSourceRepository.recordTestResult).mockResolvedValue({ ok: true, data: {} as never });

            const result = await dataSourceService.testConnection("ds-1", WEBSITE_ID);

            expect(result).toEqual({ ok: true, data: { statusCode: 200, responseTimeMs: 42 } });
            expect(restJsonAdapter.testConnection).toHaveBeenCalledWith(expect.anything(), { dataSourceId: "ds-1" });
            expect(dataSourceRepository.recordTestResult).toHaveBeenCalledWith("ds-1", {
                status: "OK",
                lastError: null,
            });
        });

        it("calls the adapter and records a failed result with the error message", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.testConnection).mockResolvedValue({
                ok: false,
                error: {
                    code: "UNAUTHORIZED",
                    message: "Authentication is required for this action.",
                    category: "AUTHENTICATION_FAILED",
                },
            });
            vi.mocked(dataSourceRepository.recordTestResult).mockResolvedValue({ ok: true, data: {} as never });

            const result = await dataSourceService.testConnection("ds-1", WEBSITE_ID);

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.category).toBe("AUTHENTICATION_FAILED");
            expect(dataSourceRepository.recordTestResult).toHaveBeenCalledWith("ds-1", {
                status: "ERROR",
                lastError: "Authentication is required for this action.",
            });
        });
    });

    describe("discover", () => {
        it("delegates to the adapter for a valid REST source", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: restRow as never });
            const discoveryResult = {
                fields: [{ path: "title", sampleType: "string" as const, sampleValue: "Stadtfest" }],
                sample: [{ title: "Stadtfest" }],
            };
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({ ok: true, data: discoveryResult });

            const result = await dataSourceService.discover("ds-1", WEBSITE_ID);

            expect(result).toEqual({ ok: true, data: discoveryResult });
        });

        it("does not write any diagnostic state (read-only)", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({ ok: true, data: { fields: [], sample: [] } });

            await dataSourceService.discover("ds-1", WEBSITE_ID);

            expect(dataSourceRepository.recordTestResult).not.toHaveBeenCalled();
        });
    });

    describe("previewMapping", () => {
        const mapping: DatasetMapping = {
            fields: [{ sourcePath: "event_name", targetPath: "title", required: true }],
        };

        it("applies the mapping to the first sample record", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({
                ok: true,
                data: { fields: [], sample: [{ event_name: "Stadtfest" }] },
            });

            const result = await dataSourceService.previewMapping("ds-1", WEBSITE_ID, mapping);

            expect(result).toEqual({ ok: true, data: { ok: true, data: { title: "Stadtfest" } } });
        });

        it("returns INVALID_RESPONSE when discovery yields no sample record", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({ ok: true, data: { fields: [], sample: [] } });

            const result = await dataSourceService.previewMapping("ds-1", WEBSITE_ID, mapping);

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.category).toBe("INVALID_RESPONSE");
        });

        it("propagates a discovery failure", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: null });

            const result = await dataSourceService.previewMapping("ds-1", WEBSITE_ID, mapping);

            expect(result.ok).toBe(false);
        });
    });

    describe("saveMapping", () => {
        it("rejects malformed mapping input", async () => {
            const result = await dataSourceService.saveMapping({ dataSourceId: "ds-1", mapping: { fields: [] } }, WEBSITE_ID);

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.saveMapping).not.toHaveBeenCalled();
        });

        it("saves the mapping once it previews successfully against a live sample", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({
                ok: true,
                data: { fields: [], sample: [{ event_name: "Stadtfest" }] },
            });
            const savedRow = { id: "ds-1", mapping: {} };
            vi.mocked(dataSourceRepository.saveMapping).mockResolvedValue({ ok: true, data: savedRow as never });

            const result = await dataSourceService.saveMapping(
                {
                    dataSourceId: "ds-1",
                    mapping: { fields: [{ sourcePath: "event_name", targetPath: "title", required: true }] },
                },
                WEBSITE_ID
            );

            expect(result).toEqual({ ok: true, data: savedRow });
            expect(dataSourceRepository.saveMapping).toHaveBeenCalledWith("ds-1", {
                fields: [{ sourcePath: "event_name", targetPath: "title", required: true }],
            });
        });

        it("rejects a mapping that fails to apply to a live sample, without saving", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: restRow as never });
            vi.mocked(restJsonAdapter.discover).mockResolvedValue({
                ok: true,
                data: { fields: [], sample: [{ other_field: "value" }] },
            });

            const result = await dataSourceService.saveMapping(
                {
                    dataSourceId: "ds-1",
                    mapping: { fields: [{ sourcePath: "event_name", targetPath: "title", required: true }] },
                },
                WEBSITE_ID
            );

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.saveMapping).not.toHaveBeenCalled();
        });

        it("does not save a mapping for a dataSourceId belonging to a different website", async () => {
            vi.mocked(dataSourceRepository.findByIdForWebsite).mockResolvedValue({ ok: true, data: null });

            const result = await dataSourceService.saveMapping(
                {
                    dataSourceId: "someone-elses-ds",
                    mapping: { fields: [{ sourcePath: "event_name", targetPath: "title", required: true }] },
                },
                WEBSITE_ID
            );

            expect(result.ok).toBe(false);
            expect(dataSourceRepository.saveMapping).not.toHaveBeenCalled();
        });
    });
});
