/**
 * Deterministically stringifies an object for cache key generation.
 * Object keys are sorted before serializing, so two structurally equal
 * blobs always produce the same version regardless of key-insertion order.
 */
export function stableStringify(value: unknown): string {
    return JSON.stringify(value, (_key, nested: unknown) => {
        if (nested === null || typeof nested !== "object" || Array.isArray(nested)) return nested;

        const sorted: Record<string, unknown> = {};

        for (const key of Object.keys(nested).sort()) {
            sorted[key] = (nested as Record<string, unknown>)[key];
        }

        return sorted;
    });
}
