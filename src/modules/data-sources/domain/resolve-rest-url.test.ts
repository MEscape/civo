import { describe, expect, it } from "vitest";
import { resolveRestUrl } from "@/modules/data-sources/domain/resolve-rest-url";

describe("resolveRestUrl", () => {
    it("combines baseUrl and a relative path", () => {
        const result = resolveRestUrl({ baseUrl: "https://example.de/api/", path: "events" });

        expect(result.ok).toBe(true);

        if (result.ok) expect(result.data.toString()).toBe("https://example.de/api/events");
    });

    it("resolves the default root path", () => {
        const result = resolveRestUrl({ baseUrl: "https://example.de/api", path: "/" });

        expect(result.ok).toBe(true);

        if (result.ok) expect(result.data.toString()).toBe("https://example.de/");
    });

    it("rejects a private baseUrl", () => {
        expect(resolveRestUrl({ baseUrl: "http://169.254.169.254/", path: "/" }).ok).toBe(false);
    });

    it("rejects an absolute path that overrides a safe-looking baseUrl", () => {
        const result = resolveRestUrl({
            baseUrl: "https://example.de/api",
            path: "http://169.254.169.254/latest/meta-data/",
        });

        expect(result.ok).toBe(false);
    });

    it("rejects a protocol-relative path that overrides the baseUrl host", () => {
        const result = resolveRestUrl({ baseUrl: "https://example.de/api", path: "//127.0.0.1/admin" });

        expect(result.ok).toBe(false);
    });

    it("rejects an unparseable baseUrl with a stable message", () => {
        const result = resolveRestUrl({ baseUrl: "not a url", path: "/" });

        expect(result).toEqual({ ok: false, error: "Die konfigurierte URL ist ungültig." });
    });
});
