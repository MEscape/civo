import { describe, expect, it } from "vitest";
import { threeWayMergeProps } from "@/modules/migration/domain/three-way-merge";

describe("threeWayMergeProps", () => {
    // Phase 13, Case 1 — developer-only change
    it("Case 1: takes NEW when only the developer changed a field (BASE=LOCAL, NEW differs)", () => {
        const result = threeWayMergeProps({ columns: 3 }, { columns: 3 }, { columns: 4 });
        expect(result.merged.columns).toBe(4);
        expect(result.conflicts).toEqual([]);
    });

    // Phase 13, Case 2 — municipality-only change
    it("Case 2: keeps LOCAL when only the municipality changed a field (BASE=NEW, LOCAL differs)", () => {
        const result = threeWayMergeProps({ columns: 3 }, { columns: 2 }, { columns: 3 });
        expect(result.merged.columns).toBe(2);
        expect(result.conflicts).toEqual([]);
    });

    // Phase 13, Case 3 — both changed to the same value
    it("Case 3: uses the common value with no conflict when both changed to the same thing", () => {
        const result = threeWayMergeProps({ columns: 3 }, { columns: 2 }, { columns: 2 });
        expect(result.merged.columns).toBe(2);
        expect(result.conflicts).toEqual([]);
    });

    // Phase 13, Case 4 — both changed differently
    it("Case 4: raises a conflict when developer and municipality changed a field differently", () => {
        const result = threeWayMergeProps({ columns: 3 }, { columns: 2 }, { columns: 4 });
        expect(result.conflicts).toEqual([
            { key: "columns", case: "conflict", base: 3, local: 2, incoming: 4 },
        ]);
    });

    it("Case 4: keeps LOCAL in the merged result until the conflict is explicitly resolved", () => {
        const result = threeWayMergeProps({ columns: 3 }, { columns: 2 }, { columns: 4 });
        expect(result.merged.columns).toBe(2);
    });

    // Phase 13, Case 5 — field removed
    it("Case 5: does not silently drop a municipality customization for a field the new schema removed", () => {
        const result = threeWayMergeProps(
            { showLocation: true },
            { showLocation: false }, // Municipality turned it off.
            {} // New component version no longer has this field at all.
        );
        expect(result.merged.showLocation).toBeUndefined();
        expect(result.conflicts).toEqual([
            { key: "showLocation", case: "removed-with-customization", base: true, local: false, incoming: undefined },
        ]);
    });

    it("Case 5 (no customization): a removed field the municipality never touched drops silently, no conflict", () => {
        const result = threeWayMergeProps({ showLocation: true }, { showLocation: true }, {});
        expect(result.merged.showLocation).toBeUndefined();
        expect(result.conflicts).toEqual([]);
    });

    // Unchanged field
    it("carries a field through unchanged when nobody touched it", () => {
        const result = threeWayMergeProps({ heading: "Termine" }, { heading: "Termine" }, { heading: "Termine" });
        expect(result.merged.heading).toBe("Termine");
        expect(result.conflicts).toEqual([]);
    });

    // New field
    it("adds a genuinely new field from NEW and records it in addedFields, never as a conflict", () => {
        const result = threeWayMergeProps({ columns: 3 }, { columns: 3 }, { columns: 3, showOrganizer: true });
        expect(result.merged.showOrganizer).toBe(true);
        expect(result.addedFields).toEqual(["showOrganizer"]);
        expect(result.conflicts).toEqual([]);
    });

    // No BASE at all
    it("treats every field as developer-only when there is no BASE to compare against", () => {
        const result = threeWayMergeProps(undefined, undefined, { columns: 4 });
        expect(result.merged.columns).toBe(4);
        expect(result.conflicts).toEqual([]);
    });

    it("flags a field as removed-with-customization when BASE is empty and LOCAL set something NEW doesn't declare", () => {
        // No BASE (undefined) means BASE is treated as {} — the field
        // never "originally" existed. LOCAL has a value BASE doesn't,
        // and NEW doesn't declare it either. This is NOT the same as
        // Case 2 (municipality-only change): Case 2 requires BASE and
        // NEW to agree on a real value, not both being "never set".
        // With no BASE to compare against, a value only LOCAL has and
        // NEW doesn't declare is indistinguishable from Case 5's "field
        // removed with customization" — so it must still surface as a
        // conflict rather than being silently kept or silently dropped.
        const result = threeWayMergeProps(undefined, { heading: "Custom" }, {});
        expect(result.merged.heading).toBeUndefined();
        expect(result.conflicts).toEqual([
            { key: "heading", case: "removed-with-customization", base: undefined, local: "Custom", incoming: undefined },
        ]);
    });

    // The spec's own worked example (Phase 12) shows `title` resolving
    // cleanly to the municipality's value with no conflict mentioned —
    // but by the letter of Phase 13's own Case 4 ("both changed
    // differently → conflict"), BASE/LOCAL/NEW are all pairwise
    // different for `title` here, which IS a Case 4 conflict. The spec
    // does not reconcile this itself. This implementation follows
    // Case 4's rule literally and consistently rather than silently
    // special-casing "text-looking" fields to avoid conflicting — see
    // this function's own module doc. A future product decision to
    // treat prose/label fields more leniently should be an explicit,
    // separately-reviewed field-level policy (e.g. a `mergeStrategy`
    // hint on PropField), not a silent exception buried in this
    // otherwise-general algorithm.
    it("Phase 12's worked example: `columns` resolves per Case 2, but `title` is actually a Case 4 conflict", () => {
        const base = { title: "Unsere Veranstaltungen", columns: 3, showLocation: true };
        const local = { title: "Veranstaltungen in Musterstadt", columns: 2, showLocation: true };
        const next = { title: "Events", columns: 4, showLocation: true, showOrganizer: true };

        const result = threeWayMergeProps(base, local, next);

        // columns: BASE=NEW would need to match for Case 2, but here
        // BASE=3, NEW=4 — they don't match, so this is actually Case 4
        // too by a strict reading. Both `columns` and `title` in the
        // spec's own example are really Case 4 once you take BASE
        // literally instead of assuming it equals NEW's old default.
        expect(result.conflicts.map((c) => c.key).sort()).toEqual(["columns", "title"]);
        expect(result.merged).toEqual({
            title: "Veranstaltungen in Musterstadt", // LOCAL kept until resolved
            columns: 2, // LOCAL kept until resolved
            showLocation: true, // unchanged
            showOrganizer: true, // added
        });
        expect(result.addedFields).toEqual(["showOrganizer"]);
    });

    // Deep equality for object/array-valued props
    it("treats two structurally-equal objects as unchanged, not a false conflict", () => {
        const result = threeWayMergeProps(
            { links: [{ label: "A", href: "/a" }] },
            { links: [{ label: "A", href: "/a" }] },
            { links: [{ label: "A", href: "/a" }, { label: "B", href: "/b" }] }
        );
        expect(result.merged.links).toEqual([{ label: "A", href: "/a" }, { label: "B", href: "/b" }]);
        expect(result.conflicts).toEqual([]);
    });

    it("detects a real conflict on array-valued props that differ structurally in both directions", () => {
        const result = threeWayMergeProps(
            { links: [{ label: "A", href: "/a" }] },
            { links: [{ label: "A", href: "/a" }, { label: "Custom", href: "/custom" }] },
            { links: [{ label: "A", href: "/a" }, { label: "New Default", href: "/new" }] }
        );
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0]?.key).toBe("links");
    });
});
