/**
 * Three-way configuration merge (Phase 4 Rule 6 / Phase 12 / Phase 13).
 *
 * Operates on a single component's `props` (a plain, already-normalized
 * `Record<string, unknown>` — see PageNode.props in
 * builder/domain/page-node.ts), not on a whole page tree. Merging a page
 * means running this once per node that exists in both LOCAL and NEW
 * (see migration-plan.ts for that orchestration).
 *
 * SCOPE — what this deliberately does NOT do:
 * - Field renames (Phase 13 Case 6) are not detected here. A rename is
 *   only knowable from a component's own migration definition (Phase 5's
 *   `migrationFrom`, e.g. "v1's `showDate` becomes v2's `dateDisplay`"),
 *   which must run BEFORE this merge to produce a NEW-shaped candidate
 *   for LOCAL first. This function only ever compares three objects that
 *   already agree on what a key means; it has no way to know
 *   `showDate` and `dateDisplay` are "the same" field.
 * - Dataset/mapping-identity changes (Phase 13 Case 7) don't apply to
 *   component props at all — this module doesn't model them (see
 *   content/domain/contract-versions.ts's own scope note on why no
 *   separate Dataset/Mapping entity exists yet).
 */

export type FieldDiffCase =
    | "unchanged" // BASE === LOCAL === NEW
    | "developer-only" // BASE === LOCAL, NEW differs → safe to take NEW
    | "municipality-only" // BASE === NEW, LOCAL differs → keep LOCAL
    | "converged" // LOCAL === NEW (both changed to the same value), BASE differs
    | "conflict" // All three differ pairwise → needs explicit resolution
    | "removed-with-customization"; // NEW no longer has this key, but LOCAL customized it away from BASE

export type FieldConflict = {
    key: string;
    case: Extract<FieldDiffCase, "conflict" | "removed-with-customization">;
    base: unknown;
    local: unknown;
    /** `undefined` for "removed-with-customization" — there is no NEW value, that's the point. */
    incoming: unknown;
};

export type ThreeWayMergeResult = {
    merged: Record<string, unknown>;
    conflicts: FieldConflict[];
    /**
     * Keys that exist only in NEW (not in BASE or LOCAL) — a genuinely
     * new field the upgraded component introduces. Included for
     * visibility (Phase 61: "the migration must record: added field,
     * default used") even though these never conflict — nothing existed
     * before for the municipality to have customized.
     */
    addedFields: string[];
};

/**
 * Deep-equality check good enough for props values: primitives, and
 * plain JSON-shaped objects/arrays (which is everything props can
 * contain, since props round-trip through Postgres JSON — see
 * page-schema.ts). Not a general-purpose deep-equal (no Date/Map/Set
 * handling), because props never contain those.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        return a.every((item, index) => valuesEqual(item, b[index]));
    }
    if (typeof a === "object" && typeof b === "object") {
        const aKeys = Object.keys(a as Record<string, unknown>);
        const bKeys = Object.keys(b as Record<string, unknown>);
        if (aKeys.length !== bKeys.length) return false;
        return aKeys.every((key) =>
            valuesEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
        );
    }
    return false; // Different primitives already failed the === check above.
}

/**
 * Classifies a single field across BASE/LOCAL/NEW per Phase 13's case
 * table. `hasNew` distinguishes "NEW has this key with value undefined"
 * (not actually possible in JSON-shaped props, but kept explicit) from
 * "NEW does not have this key at all" (Case 5: field removed).
 */
function classifyField(base: unknown, local: unknown, hasNew: boolean, next: unknown): FieldDiffCase {
    const baseEqualsLocal = valuesEqual(base, local);

    if (!hasNew) {
        // The new schema/defaults no longer have this key at all.
        return baseEqualsLocal ? "unchanged" : "removed-with-customization";
        // "unchanged" here means the municipality never customized a now-
        // removed field either — nothing to warn about, it simply drops.
    }

    const baseEqualsNew = valuesEqual(base, next);
    const localEqualsNew = valuesEqual(local, next);

    if (baseEqualsLocal && baseEqualsNew) return "unchanged";
    if (baseEqualsLocal && !baseEqualsNew) return "developer-only";
    if (!baseEqualsLocal && baseEqualsNew) return "municipality-only";
    if (!baseEqualsLocal && localEqualsNew) return "converged";
    return "conflict"; // BASE, LOCAL, NEW are all pairwise different.
}

/**
 * Runs the three-way merge over one component's props.
 *
 * `base` and `local` may be `undefined` when there is no prior BASE to
 * compare against at all (e.g. a brand-new node with no publish
 * history) — every field is then treated relative to whatever `local`
 * currently holds, with a `base` of `{}` (nothing was ever "originally"
 * set), so an unset field the municipality never touched still resolves
 * to "developer-only" rather than misfiring as a conflict.
 */
export function threeWayMergeProps(
    base: Record<string, unknown> | undefined,
    local: Record<string, unknown> | undefined,
    next: Record<string, unknown>
): ThreeWayMergeResult {
    const baseProps = base ?? {};
    const localProps = local ?? {};

    const merged: Record<string, unknown> = {};
    const conflicts: FieldConflict[] = [];
    const addedFields: string[] = [];

    const allKeys = new Set([...Object.keys(baseProps), ...Object.keys(localProps), ...Object.keys(next)]);

    for (const key of allKeys) {
        const baseValue = baseProps[key];
        const localValue = localProps[key];
        const hasNew = Object.prototype.hasOwnProperty.call(next, key);
        const nextValue = next[key];

        const wasInBase = Object.prototype.hasOwnProperty.call(baseProps, key);
        const wasInLocal = Object.prototype.hasOwnProperty.call(localProps, key);
        if (!wasInBase && !wasInLocal && hasNew) {
            // A field that exists only in NEW — genuinely new, not a diff
            // of anything the municipality could have touched.
            merged[key] = nextValue;
            addedFields.push(key);
            continue;
        }

        const fieldCase = classifyField(baseValue, localValue, hasNew, nextValue);

        switch (fieldCase) {
            case "unchanged":
                // If NEW still declares this key, carry its value through
                // (developer and municipality agree, and so does NEW).
                // If NEW does NOT declare it, the field is gone from the
                // new component version and nobody customized it away
                // from BASE — drop it from `merged` with no conflict
                // (there is nothing to lose; see "removed-with-
                // customization" below for the case where there IS).
                if (hasNew) merged[key] = nextValue;
                break;
            case "developer-only":
                merged[key] = nextValue;
                break;
            case "municipality-only":
                merged[key] = localValue;
                break;
            case "converged":
                merged[key] = localValue; // === nextValue, either is fine
                break;
            case "conflict":
                merged[key] = localValue; // Keep LOCAL until explicitly resolved — never silently prefer NEW.
                conflicts.push({ key, case: "conflict", base: baseValue, local: localValue, incoming: nextValue });
                break;
            case "removed-with-customization":
                // Field no longer exists in NEW, but LOCAL diverged from
                // BASE — the municipality's customization would be
                // silently lost if we just dropped the key (Phase 60: no
                // silent data loss). Keep it out of `merged` (the new
                // component version doesn't declare this prop and won't
                // read it), but surface it as a conflict so a human sees
                // what would be discarded.
                conflicts.push({
                    key,
                    case: "removed-with-customization",
                    base: baseValue,
                    local: localValue,
                    incoming: undefined,
                });
                break;
        }
    }

    return { merged, conflicts, addedFields };
}
