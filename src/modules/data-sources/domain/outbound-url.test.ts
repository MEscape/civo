import { describe, it, expect } from "vitest";
import { checkOutboundUrl, checkResolvedAddress } from "@/modules/data-sources/domain/outbound-url";

describe("checkOutboundUrl", () => {
    describe("allowed targets", () => {
        it("allows a normal public https URL", () => {
            expect(checkOutboundUrl("https://example-municipality.de/api/events").ok).toBe(true);
        });

        it("allows a normal public http URL", () => {
            expect(checkOutboundUrl("http://opendata.example.de/api").ok).toBe(true);
        });

        it("allows a public IPv4 address outside the blocked ranges", () => {
            expect(checkOutboundUrl("http://93.184.216.34/").ok).toBe(true);
        });

        it("does not over-block public addresses that merely share a string prefix with a private range", () => {
            // The previous prefix check ("172.2") wrongly rejected all of these.
            expect(checkOutboundUrl("http://172.200.0.1/").ok).toBe(true);
            expect(checkOutboundUrl("http://172.32.0.1/").ok).toBe(true);
            expect(checkOutboundUrl("http://172.15.255.255/").ok).toBe(true);
            expect(checkOutboundUrl("http://100.63.255.255/").ok).toBe(true);
            expect(checkOutboundUrl("http://100.128.0.1/").ok).toBe(true);
        });

        it("allows a globally routable IPv6 literal", () => {
            expect(checkOutboundUrl("http://[2606:4700:4700::1111]/").ok).toBe(true);
        });
    });

    describe("malformed input and schemes", () => {
        it("rejects a malformed URL", () => {
            expect(checkOutboundUrl("not-a-url").ok).toBe(false);
        });

        it("rejects non-http(s) schemes", () => {
            for (const scheme of ["ftp://example.de", "file:///etc/passwd", "gopher://example.de"]) {
                expect(checkOutboundUrl(scheme).ok).toBe(false);
            }
        });

        it("rejects URLs that embed credentials", () => {
            expect(checkOutboundUrl("https://user:pass@example.de/").ok).toBe(false);
            expect(checkOutboundUrl("https://user@example.de/").ok).toBe(false);
        });
    });

    describe("blocked hostnames", () => {
        it("rejects localhost", () => {
            expect(checkOutboundUrl("http://localhost:5432/").ok).toBe(false);
            expect(checkOutboundUrl("http://localhost/").ok).toBe(false);
        });

        it("rejects .local, .internal and .localhost hostnames", () => {
            expect(checkOutboundUrl("http://printer.local/").ok).toBe(false);
            expect(checkOutboundUrl("http://service.internal/").ok).toBe(false);
            expect(checkOutboundUrl("http://app.localhost/").ok).toBe(false);
        });
    });

    describe("blocked IPv4 ranges", () => {
        it("rejects loopback IPv4 addresses", () => {
            expect(checkOutboundUrl("http://127.0.0.1/").ok).toBe(false);
            expect(checkOutboundUrl("http://127.1.2.3/").ok).toBe(false);
        });

        it("rejects the cloud metadata link-local address", () => {
            expect(checkOutboundUrl("http://169.254.169.254/latest/meta-data/").ok).toBe(false);
        });

        it("rejects the full RFC 1918 private ranges, including their boundaries", () => {
            expect(checkOutboundUrl("http://10.0.0.5/").ok).toBe(false);
            expect(checkOutboundUrl("http://10.255.255.255/").ok).toBe(false);
            expect(checkOutboundUrl("http://192.168.1.1/").ok).toBe(false);
            expect(checkOutboundUrl("http://172.16.0.1/").ok).toBe(false);
            expect(checkOutboundUrl("http://172.20.5.5/").ok).toBe(false);
            expect(checkOutboundUrl("http://172.31.255.255/").ok).toBe(false);
        });

        it("rejects carrier-grade NAT, benchmarking, multicast and reserved ranges", () => {
            expect(checkOutboundUrl("http://100.64.0.1/").ok).toBe(false);
            expect(checkOutboundUrl("http://100.127.255.255/").ok).toBe(false);
            expect(checkOutboundUrl("http://198.18.0.1/").ok).toBe(false);
            expect(checkOutboundUrl("http://224.0.0.1/").ok).toBe(false);
            expect(checkOutboundUrl("http://255.255.255.255/").ok).toBe(false);
        });

        it("rejects alternative IPv4 spellings, which the URL parser normalizes", () => {
            expect(checkOutboundUrl("http://2130706433/").ok).toBe(false); // decimal 127.0.0.1
            expect(checkOutboundUrl("http://0x7f.0.0.1/").ok).toBe(false); // hex octet
            expect(checkOutboundUrl("http://127.1/").ok).toBe(false); // short form
            expect(checkOutboundUrl("http://0/").ok).toBe(false); // 0.0.0.0
        });
    });

    describe("blocked IPv6 literals", () => {
        it("rejects loopback, unspecified, link-local and unique-local addresses", () => {
            expect(checkOutboundUrl("http://[::1]/").ok).toBe(false);
            expect(checkOutboundUrl("http://[::]/").ok).toBe(false);
            expect(checkOutboundUrl("http://[fe80::1]/").ok).toBe(false);
            expect(checkOutboundUrl("http://[fd00::1]/").ok).toBe(false);
        });

        it("rejects the IPv6 documentation prefix", () => {
            expect(checkOutboundUrl("http://[2001:db8::1]/").ok).toBe(false);
        });

        it("rejects IPv4-mapped IPv6 addresses that embed a blocked IPv4 address", () => {
            expect(checkOutboundUrl("http://[::ffff:127.0.0.1]/").ok).toBe(false);
            expect(checkOutboundUrl("http://[::ffff:169.254.169.254]/").ok).toBe(false);
            expect(checkOutboundUrl("http://[::ffff:10.0.0.1]/").ok).toBe(false);
        });
    });
});

describe("checkResolvedAddress", () => {
    it("allows a public IPv4 address", () => {
        expect(checkResolvedAddress("93.184.216.34").ok).toBe(true);
    });

    it("allows a globally routable IPv6 address", () => {
        expect(checkResolvedAddress("2606:4700:4700::1111").ok).toBe(true);
    });

    it("rejects private, loopback and metadata IPv4 addresses", () => {
        expect(checkResolvedAddress("10.1.2.3").ok).toBe(false);
        expect(checkResolvedAddress("127.0.0.1").ok).toBe(false);
        expect(checkResolvedAddress("169.254.169.254").ok).toBe(false);
    });

    it("rejects non-public IPv6 addresses, with or without brackets", () => {
        expect(checkResolvedAddress("::1").ok).toBe(false);
        expect(checkResolvedAddress("[::1]").ok).toBe(false);
        expect(checkResolvedAddress("fe80::1").ok).toBe(false);
        expect(checkResolvedAddress("::ffff:192.168.0.1").ok).toBe(false);
    });
});
