import type { Result } from "@/lib/result/result";
import { err, ok } from "@/lib/result/result";

/**
 * Validates that a URL is safe for the SERVER to fetch on an
 * administrator's behalf (Phase 3.5 spec §22 — "Prevent SSRF, arbitrary
 * internal network access... Do not allow arbitrary server-side URLs
 * without appropriate validation").
 *
 * This is a distinct concern from `@/lib/utils/safe-link` (which governs
 * which URLs are safe to RENDER as an `<a href>` on the public site —
 * `javascript:`/`data:` schemes). Here the risk is the opposite
 * direction: an administrator-supplied `baseUrl` is fetched BY THIS
 * SERVER, so the danger is the URL pointing at the server's own internal
 * network (cloud metadata endpoints, localhost, other services on the
 * private network) rather than at the public internet the administrator
 * presumably intended.
 *
 * This performs a best-effort, allowlist-style check on the URL's
 * hostname. It intentionally does NOT resolve DNS itself (no dependency
 * on Node's `dns` module, keeping this module framework-free per the
 * domain/** boundary) — a hostname that resolves to a private address via
 * DNS rebinding is a known limitation of hostname-level checks alone.
 * For production hardening beyond this MVP, pair this with an egress
 * proxy/allowlist at the network layer (spec §22's own suggestion) rather
 * than relying on this check alone.
 */

const BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "0.0.0.0",
    "[::1]",
    "::1",
]);

/**
 * IPv4 ranges reserved for private/internal use, loopback, link-local
 * (which includes the 169.254.169.254 cloud-provider metadata endpoint),
 * and other non-public purposes. Checked as simple prefix matches rather
 * than full CIDR math — sufficient for this hostname-level allowlist and
 * easy to audit.
 */
const BLOCKED_IPV4_PREFIXES = [
    "0.", // "this" network
    "10.", // RFC 1918 private
    "100.64.", // carrier-grade NAT
    "127.", // loopback
    "169.254.", // link-local — includes cloud metadata endpoints
    "172.16.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.2", // covers 172.20.–172.29.
    "172.30.",
    "172.31.",
    "192.0.0.", // IETF protocol assignments
    "192.168.", // RFC 1918 private
    "198.18.",
    "198.19.", // benchmarking
];

function isBlockedIpv4(hostname: string): boolean {
    return BLOCKED_IPV4_PREFIXES.some((prefix) =>
        hostname.startsWith(prefix)
    );
}

export type OutboundUrlCheck = Result<void, string>;

/**
 * Checks a data source's configured base URL before any server-side
 * request is made to it — at save time (data-source-service.ts) and again
 * defensively at request time (rest-json-adapter.ts), since configuration
 * saved before a stricter check existed should not silently remain
 * fetchable forever.
 */
export function checkOutboundUrl(rawUrl: string): Result<void, string> {
    let url: URL;

    try {
        url = new URL(rawUrl);
    } catch {
        return err("Not a valid URL.");
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        return err("Only http and https URLs are allowed.");
    }

    const hostname = url.hostname.toLowerCase();

    if (BLOCKED_HOSTNAMES.has(hostname)) {
        return err("This address is not allowed.");
    }

    if (
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal")
    ) {
        return err("This address is not allowed.");
    }

    if (isBlockedIpv4(hostname)) {
        return err("This address is not allowed.");
    }

    // Any other literal IPv6 address (bracketed) is blocked out of an
    // abundance of caution — this MVP's allowlist only reasons about
    // IPv4 ranges above, so an IPv6 literal can't be positively verified
    // as public and is rejected rather than guessed at.
    if (hostname.startsWith("[")) {
        return err("This address is not allowed.");
    }

    return ok(undefined);
}
