import type { Result } from "@/lib/result/result";
import { err, ok } from "@/lib/result/result";
import type { RestDataSourceConfig } from "@/modules/data-sources/domain/data-source-schema";
import { checkOutboundUrl } from "@/modules/data-sources/domain/outbound-url";

/**
 * Combines a REST source's `baseUrl` and `path` and validates the result
 * against the outbound SSRF policy.
 *
 * This is the only place the two are combined. `path` may itself be an
 * absolute or protocol-relative URL, in which case `new URL(path, base)`
 * uses path's own host and silently ignores `baseUrl` — so validating
 * `baseUrl` alone would miss a private target smuggled in via `path`.
 * Save-time validation and request-time validation both call this, so the
 * two can never disagree about which URL is being checked.
 */
export function resolveRestUrl(config: Pick<RestDataSourceConfig, "baseUrl" | "path">): Result<URL, string> {
    let target: URL;

    try {
        target = new URL(config.path, config.baseUrl);
    } catch {
        return err("Die konfigurierte URL ist ungültig.");
    }

    const check = checkOutboundUrl(target.toString());

    if (!check.ok) return err(check.error);

    return ok(target);
}
