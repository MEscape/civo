import { describe, it, expect } from "vitest";
import { checkOutboundUrl } from "@/modules/data-sources/domain/outbound-url";

describe("checkOutboundUrl", () => {
    it("allows a normal public https URL", () => {
        expect(
            checkOutboundUrl("https://example-municipality.de/api/events").ok
        ).toBe(true);
    });

    it("allows a normal public http URL", () => {
        expect(
            checkOutboundUrl("http://opendata.example.de/api").ok
        ).toBe(true);
    });

    it("rejects a malformed URL", () => {
        const result = checkOutboundUrl("not-a-url");

        expect(result.ok).toBe(false);
    });

    it("rejects non-http(s) schemes", () => {
        for (const scheme of [
            "ftp://example.de",
            "file:///etc/passwd",
            "gopher://example.de",
        ]) {
            expect(checkOutboundUrl(scheme).ok).toBe(false);
        }
    });

    it("rejects localhost", () => {
        expect(checkOutboundUrl("http://localhost:5432/").ok).toBe(false);
        expect(checkOutboundUrl("http://localhost/").ok).toBe(false);
    });

    it("rejects loopback IPv4 addresses", () => {
        expect(checkOutboundUrl("http://127.0.0.1/").ok).toBe(false);
        expect(checkOutboundUrl("http://127.1.2.3/").ok).toBe(false);
    });

    it("rejects the cloud metadata link-local address", () => {
        expect(
            checkOutboundUrl(
                "http://169.254.169.254/latest/meta-data/"
            ).ok
        ).toBe(false);
    });

    it("rejects RFC 1918 private ranges", () => {
        expect(checkOutboundUrl("http://10.0.0.5/").ok).toBe(false);
        expect(checkOutboundUrl("http://192.168.1.1/").ok).toBe(false);
        expect(checkOutboundUrl("http://172.16.0.1/").ok).toBe(false);
        expect(checkOutboundUrl("http://172.31.255.255/").ok).toBe(false);
    });

    it("allows a public IPv4 address outside the blocked ranges", () => {
        expect(checkOutboundUrl("http://93.184.216.34/").ok).toBe(true);
    });

    it("rejects .local and .internal hostnames", () => {
        expect(checkOutboundUrl("http://printer.local/").ok).toBe(false);
        expect(checkOutboundUrl("http://service.internal/").ok).toBe(false);
    });

    it("rejects bracketed IPv6 literals", () => {
        expect(checkOutboundUrl("http://[::1]/").ok).toBe(false);
        expect(checkOutboundUrl("http://[2001:db8::1]/").ok).toBe(false);
    });
});
