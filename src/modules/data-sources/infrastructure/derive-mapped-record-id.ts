import { createHash } from "node:crypto";
import { getByPath } from "@/modules/data-sources/domain/field-mapping-schema";

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
    return createHash("sha256").update(JSON.stringify(mapped)).digest("hex").slice(0, 16);
}
