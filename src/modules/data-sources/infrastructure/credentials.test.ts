import { describe, expect, it } from "vitest";
import {
    buildAuthHeaders,
    credentialEnvironmentVariableName,
    resolveCredential,
} from "@/modules/data-sources/infrastructure/credentials";

describe("credentialEnvironmentVariableName", () => {
    it("builds the documented variable name for each auth mode", () => {
        expect(credentialEnvironmentVariableName("ckabc123", "API_KEY")).toBe("DATASOURCE_ckabc123_API_KEY");
        expect(credentialEnvironmentVariableName("ckabc123", "BEARER_TOKEN")).toBe(
            "DATASOURCE_ckabc123_BEARER_TOKEN"
        );
    });

    it("normalizes hyphens (uuid-style ids) to underscores", () => {
        expect(credentialEnvironmentVariableName("3f2a-91bc", "API_KEY")).toBe("DATASOURCE_3f2a_91bc_API_KEY");
    });

    it("returns null for ids that cannot form a valid variable name", () => {
        expect(credentialEnvironmentVariableName("bad id", "API_KEY")).toBeNull();
        expect(credentialEnvironmentVariableName("a/b", "API_KEY")).toBeNull();
        expect(credentialEnvironmentVariableName("", "API_KEY")).toBeNull();
        expect(credentialEnvironmentVariableName("x\nY", "API_KEY")).toBeNull();
    });
});

describe("resolveCredential", () => {
    it("returns null without consulting the environment when auth is NONE", () => {
        expect(resolveCredential("ds1", "NONE", { DATASOURCE_ds1_API_KEY: "secret" })).toBeNull();
    });

    it("reads the API key for the matching data source only", () => {
        const environment = { DATASOURCE_ds1_API_KEY: "key-1", DATASOURCE_ds2_API_KEY: "key-2" };

        expect(resolveCredential("ds1", "API_KEY", environment)).toBe("key-1");
        expect(resolveCredential("ds2", "API_KEY", environment)).toBe("key-2");
    });

    it("does not return a bearer token for an API_KEY source", () => {
        expect(resolveCredential("ds1", "API_KEY", { DATASOURCE_ds1_BEARER_TOKEN: "token" })).toBeNull();
    });

    it("treats an empty value as not configured", () => {
        expect(resolveCredential("ds1", "API_KEY", { DATASOURCE_ds1_API_KEY: "" })).toBeNull();
    });

    it("returns null for an id that cannot form a valid variable name", () => {
        expect(resolveCredential("bad id", "API_KEY", { "DATASOURCE_bad id_API_KEY": "leak" })).toBeNull();
    });
});

describe("buildAuthHeaders", () => {
    it("returns no headers when auth is NONE", () => {
        expect(buildAuthHeaders("ds1", "NONE", {})).toEqual({ ok: true, data: {} });
    });

    it("builds an X-API-Key header", () => {
        expect(buildAuthHeaders("ds1", "API_KEY", { DATASOURCE_ds1_API_KEY: "key" })).toEqual({
            ok: true,
            data: { "X-API-Key": "key" },
        });
    });

    it("builds a bearer Authorization header", () => {
        expect(buildAuthHeaders("ds1", "BEARER_TOKEN", { DATASOURCE_ds1_BEARER_TOKEN: "tok" })).toEqual({
            ok: true,
            data: { Authorization: "Bearer tok" },
        });
    });

    it("fails closed when the credential is missing, with a mode-specific message", () => {
        expect(buildAuthHeaders("ds1", "API_KEY", {})).toEqual({
            ok: false,
            error: "Für diese Datenquelle ist kein API-Schlüssel konfiguriert.",
        });
        expect(buildAuthHeaders("ds1", "BEARER_TOKEN", {})).toEqual({
            ok: false,
            error: "Für diese Datenquelle ist kein Bearer-Token konfiguriert.",
        });
    });

    it("never echoes the secret in the failure message", () => {
        const result = buildAuthHeaders("ds1", "API_KEY", { DATASOURCE_ds1_API_KEY: "" });

        expect(JSON.stringify(result)).not.toContain("DATASOURCE_");
    });
});
