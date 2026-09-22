import { createHash } from "node:crypto";
import { getByPath } from "@/modules/data-sources/domain/field-mapping-schema";

/**
 * Serializes a value the same way regardless of the object key order it
 * happens to be built with. `JSON.stringify` alone follows insertion
 * order, so a mapped record built by iterating mapping fields in a
 * different order (e.g. after an administrator reorders fields in the
 * mapping UI) would otherwise hash differently even though its content
 * is identical — defeating the "stable as long as content doesn't
 * change" guarantee this module documents.
 */
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

/**
 * Derives a stable id for a mapped record from its raw external record
 * (Phase 3.5 spec §10, §12). Shared by every REST-backed canonical
 * provider (RestCivicDataProvider, RestSmartCityDataProvider) since the
 * strategy is the same regardless of which canonical type is being
 * produced: prefer a common id-like field on the RAW record (most
 * municipal/open-data APIs provide one, even though it's not part of the
 * content mapping an administrator configures) so the same external
 * record keeps the same id across refreshes; otherwise fall back to a
 * hash of the mapped content, stable as long as the record's mapped
 * fields don't change — the same guarantee a real external id would give
 * for an edited record.
 */
export function deriveMappedRecordId(raw: unknown, mapped: Record<string, unknown>): string {
    for (const key of ["id", "_id", "uuid", "guid"]) {
        const value = getByPath(raw, key);
        if (typeof value === "string" && value.length > 0) return value;
        if (typeof value === "number") return String(value);
    }
    return createHash("sha256").update(stableStringify(mapped)).digest("hex").slice(0, 16);
}
