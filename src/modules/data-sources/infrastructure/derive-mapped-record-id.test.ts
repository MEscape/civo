import { describe, it, expect } from "vitest";
import { deriveMappedRecordId } from "./derive-mapped-record-id";

describe("deriveMappedRecordId", () => {
    it("prefers a raw 'id' field", () => {
        expect(deriveMappedRecordId({ id: "raw-1", other: "x" }, { title: "A" })).toBe("raw-1");
    });

    it("falls back to '_id', 'uuid', then 'guid' in order", () => {
        expect(deriveMappedRecordId({ _id: "underscore-id" }, {})).toBe("underscore-id");
        expect(deriveMappedRecordId({ uuid: "uuid-1" }, {})).toBe("uuid-1");
        expect(deriveMappedRecordId({ guid: "guid-1" }, {})).toBe("guid-1");
    });

    it("converts a numeric id field to a string", () => {
        expect(deriveMappedRecordId({ id: 42 }, {})).toBe("42");
    });

    it("falls back to a content hash when no id-like field exists", () => {
        const result = deriveMappedRecordId({ event_name: "Stadtfest" }, { title: "Stadtfest" });
        expect(result).toMatch(/^[a-f0-9]{16}$/);
    });

    it("produces a stable hash for the same mapped content", () => {
        const a = deriveMappedRecordId({}, { title: "Stadtfest", startDate: "2026-09-20" });
        const b = deriveMappedRecordId({}, { title: "Stadtfest", startDate: "2026-09-20" });
        expect(a).toBe(b);
    });

    it("produces different hashes for different mapped content", () => {
        const a = deriveMappedRecordId({}, { title: "Stadtfest" });
        const b = deriveMappedRecordId({}, { title: "Weihnachtsmarkt" });
        expect(a).not.toBe(b);
    });

    it("ignores an empty-string id field and falls through to the hash", () => {
        const result = deriveMappedRecordId({ id: "" }, { title: "Stadtfest" });
        expect(result).toMatch(/^[a-f0-9]{16}$/);
    });

    it("produces the same hash regardless of the mapped object's key order", () => {
        const a = deriveMappedRecordId({}, { title: "Stadtfest", location: "Rathaus" });
        const b = deriveMappedRecordId({}, { location: "Rathaus", title: "Stadtfest" });
        expect(a).toBe(b);
    });

    it("produces the same hash regardless of key order in nested objects", () => {
        const a = deriveMappedRecordId({}, { location: { name: "Rathaus", zip: "12345" } });
        const b = deriveMappedRecordId({}, { location: { zip: "12345", name: "Rathaus" } });
        expect(a).toBe(b);
    });

    it("still treats array element order as significant", () => {
        const a = deriveMappedRecordId({}, { tags: ["a", "b"] });
        const b = deriveMappedRecordId({}, { tags: ["b", "a"] });
        expect(a).not.toBe(b);
    });
});
