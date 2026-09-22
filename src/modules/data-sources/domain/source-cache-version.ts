/**
 * Derives a version string for the parts of a data source that determine
 * WHAT is fetched and HOW it is interpreted: its `kind`, its `config`
 * (URL, path, auth mode) and its field `mapping`.
 *
 * This is deliberately not `updatedAt`. Prisma bumps `updatedAt` on every
 * write, including the status/`lastCheckedAt` bookkeeping that a "Test
 * Connection" click performs — so keying a cache on it would throw the
 * cache away every time an administrator merely tests a source, even
 * though nothing that affects the fetched data changed.
 *
 * Object keys are sorted before serializing, so two structurally equal
 * blobs always produce the same version regardless of the key order the
 * database happened to return them in.
 */
export function sourceCacheVersion(source: { kind: string; config: unknown; mapping: unknown }): string {
    return stableStringify({ kind: source.kind, config: source.config, mapping: source.mapping });
}

function stableStringify(value: unknown): string {
    return JSON.stringify(value, (_key, nested: unknown) => {
        if (nested === null || typeof nested !== "object" || Array.isArray(nested)) return nested;

        const sorted: Record<string, unknown> = {};

        for (const key of Object.keys(nested).sort()) {
            sorted[key] = (nested as Record<string, unknown>)[key];
        }

        return sorted;
    });
}
