/**
 * Safe link validation utility (Phase 3 spec §40).
 *
 * Validates that a URL string is a safe absolute HTTP/HTTPS URL or a
 * relative path — rejects `javascript:`, `data:`, `vbscript:`, and any
 * other potentially harmful scheme before a link prop value is persisted
 * in a PageConfig or rendered on the public site.
 *
 * Components do not call this directly — the properties panel validates
 * control values before dispatching, but the canonical check lives here
 * so server-side actions can apply the same rule independently of the UI.
 *
 * Rules:
 *  - Relative URLs starting with `/` or `./` are always safe.
 *  - `mailto:` and `tel:` are explicitly allowed (common civic use cases).
 *  - `http:` and `https:` are allowed.
 *  - Every other scheme (including the empty-scheme / protocol-relative
 *    `//example.com` form) is rejected to be conservative.
 *  - Non-string, null, or undefined values are considered unsafe (returns false).
 *  - Empty strings are considered unsafe.
 */
export function isSafeLink(href: unknown): boolean {
    if (typeof href !== "string" || href.trim() === "") return false;

    const trimmed = href.trim();

    // Relative paths are safe
    if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
        return true;
    }

    // Parse to inspect scheme without string hacking
    let url: URL;
    try {
        // Add a base so relative URLs without leading slash also parse cleanly
        url = new URL(trimmed, "https://example.com");
    } catch {
        return false;
    }

    const scheme = url.protocol.toLowerCase();
    const allowedSchemes = new Set(["https:", "http:", "mailto:", "tel:"]);
    return allowedSchemes.has(scheme);
}

/**
 * Returns the href if safe, or `undefined` otherwise.
 * Useful for inline prop sanitisation in render paths.
 */
export function safeLinkOrUndefined(href: unknown): string | undefined {
    return isSafeLink(href) ? (href as string).trim() : undefined;
}
