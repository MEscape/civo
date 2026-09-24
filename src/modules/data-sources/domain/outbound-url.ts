import type { Result } from "@/lib/result/result";
import { err, ok } from "@/lib/result/result";

/**
 * SSRF guard for URLs the SERVER fetches on an administrator's behalf
 * (Phase 3.5 spec §22).
 *
 * Distinct from `@/lib/utils/safe-link`, which governs what is safe to
 * RENDER as an `<a href>`. Here the danger points the other way: an
 * administrator-supplied URL that reaches the server's own private
 * network (cloud metadata, localhost, internal services).
 *
 * The domain layer stays framework-free, so this module never resolves
 * DNS. Two complementary checks are exported instead:
 *
 *  - `checkOutboundUrl`      — hostname-level check (scheme, blocked
 *                              names, literal IPs). Used at save time
 *                              and before every request.
 *  - `checkResolvedAddress`  — the same IP policy applied to an address
 *                              the infrastructure layer obtained from DNS.
 *                              This closes the "public hostname that
 *                              resolves to a private address" hole that a
 *                              hostname check alone cannot.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "[::1]", "::1"]);

const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".internal", ".localhost"];

type Ipv4Range = readonly [start: number, end: number];

/** Converts four octets to an unsigned 32-bit integer. */
function ipv4ToInt(a: number, b: number, c: number, d: number): number {
    return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function cidr(a: number, b: number, c: number, d: number, prefixLength: number): Ipv4Range {
    const start = ipv4ToInt(a, b, c, d);
    const size = 2 ** (32 - prefixLength);
    return [start, start + size - 1];
}

/**
 * IPv4 ranges that are never valid targets for a data source. Full CIDR
 * math (rather than string prefixes) so public neighbours such as
 * 172.200.0.0 are not over-blocked.
 */
const BLOCKED_IPV4_RANGES: readonly Ipv4Range[] = [
    cidr(0, 0, 0, 0, 8), //        "this" network
    cidr(10, 0, 0, 0, 8), //       RFC 1918 private
    cidr(100, 64, 0, 0, 10), //    carrier-grade NAT
    cidr(127, 0, 0, 0, 8), //      loopback
    cidr(169, 254, 0, 0, 16), //   link-local (cloud metadata endpoints)
    cidr(172, 16, 0, 0, 12), //    RFC 1918 private (172.16.0.0 – 172.31.255.255)
    cidr(192, 0, 0, 0, 24), //     IETF protocol assignments
    cidr(192, 168, 0, 0, 16), //   RFC 1918 private
    cidr(198, 18, 0, 0, 15), //    benchmarking
    cidr(224, 0, 0, 0, 4), //      multicast
    cidr(240, 0, 0, 0, 4), //      reserved + broadcast
];

const IPV4_LITERAL = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function parseIpv4(address: string): number | null {
    const match = IPV4_LITERAL.exec(address);

    if (!match) return null;

    const octets = match.slice(1).map(Number);

    if (octets.some((octet) => octet > 255)) return null;

    return ipv4ToInt(octets[0]!, octets[1]!, octets[2]!, octets[3]!);
}

function isBlockedIpv4(address: string): boolean {
    const value = parseIpv4(address);

    if (value === null) return false;

    return BLOCKED_IPV4_RANGES.some(([start, end]) => value >= start && value <= end);
}

/**
 * Extracts the embedded IPv4 address from an IPv4-mapped IPv6 address such
 * as `::ffff:127.0.0.1` or `::ffff:7f00:1`, so the IPv4 policy also
 * covers them. Returns null for any other IPv6 address.
 */
function embeddedIpv4(ipv6: string): string | null {
    const lower = ipv6.toLowerCase();
    const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);

    if (dotted) return dotted[1]!;

    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);

    if (hex) {
        const high = parseInt(hex[1]!, 16);
        const low = parseInt(hex[2]!, 16);

        return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
    }

    return null;
}

/**
 * Only globally routable unicast IPv6 (2000::/3) is considered
 * potentially public. Everything else — loopback, link-local (fe80::/10),
 * unique-local (fc00::/7), unspecified, multicast — is rejected. The
 * documentation prefix 2001:db8::/32 is rejected as non-routable.
 */
function isBlockedIpv6(address: string): boolean {
    const lower = address.toLowerCase();
    const mapped = embeddedIpv4(lower);

    if (mapped !== null) return isBlockedIpv4(mapped);

    const firstGroup = lower.split(":")[0] ?? "";
    const isGlobalUnicast = /^[23][0-9a-f]{3}$/.test(firstGroup);

    if (!isGlobalUnicast) return true;

    return lower.startsWith("2001:db8:") || lower.startsWith("2001:0db8:");
}

function stripBrackets(hostname: string): string {
    return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

/** Applies the address policy to a bare IP literal (no brackets). */
function isBlockedAddress(address: string): boolean {
    if (address.includes(":")) return isBlockedIpv6(address);

    return isBlockedIpv4(address);
}

export type OutboundUrlCheck = Result<void, string>;

const NOT_ALLOWED = "This address is not allowed.";

/**
 * Checks a URL before any server-side request is made to it — at save
 * time (data-source-service.ts) and again at request time
 * (rest-json-adapter.ts), so configuration saved before a stricter check
 * existed is not fetchable forever.
 *
 * IP-literal hosts are checked against the address policy directly.
 * Public IPv6 literals are allowed only when they are globally routable
 * unicast; anything else is rejected rather than guessed at.
 */
export function checkOutboundUrl(rawUrl: string): OutboundUrlCheck {
    let url: URL;

    try {
        url = new URL(rawUrl);
    } catch {
        return err("Keine gültige URL.");
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        return err("Es sind nur http- und https-URLs erlaubt.");
    }

    if (url.username !== "" || url.password !== "") {
        return err("URLs mit eingebetteten Zugangsdaten sind nicht erlaubt.");
    }

    const hostname = url.hostname.toLowerCase();

    if (BLOCKED_HOSTNAMES.has(hostname)) return err(NOT_ALLOWED);

    if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
        return err(NOT_ALLOWED);
    }

    if (isBlockedAddress(stripBrackets(hostname))) return err(NOT_ALLOWED);

    return ok(undefined);
}

/**
 * Applies the address policy to an IP the infrastructure layer resolved
 * from DNS for an already-validated hostname (DNS-rebinding defence).
 */
export function checkResolvedAddress(address: string): OutboundUrlCheck {
    if (isBlockedAddress(stripBrackets(address.toLowerCase()))) return err(NOT_ALLOWED);

    return ok(undefined);
}
