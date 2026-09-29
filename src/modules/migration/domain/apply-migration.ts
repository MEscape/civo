import type { PageConfig, PageNode } from "@/modules/builder/domain/page-node";
import type { FieldConflict } from "@/modules/migration/domain/three-way-merge";
import type { MigrationPlan, NodeMigrationPlan } from "@/modules/migration/domain/migration-plan";

/**
 * Applying a resolved migration plan (Phase 4 Rule 5 / Phase 15 / Phase
 * 16 / Phase 58).
 *
 * This module is pure — it takes the page trees the plan was computed
 * from (the published snapshot's `pages[].config`, unchanged) plus a set
 * of conflict resolutions, and returns NEW page config trees. It never
 * touches persistence itself; the caller (migration-service.ts) is
 * responsible for writing the result as a new draft via
 * `pageRepository.saveConfig` — which already appends a new immutable
 * PageConfig row rather than mutating one in place, so "copy-on-write"
 * (Phase 58) falls out of infrastructure that already exists rather
 * than needing anything new here.
 *
 * A migration is applied "all or nothing" PER NODE, never per field:
 * either every conflict on a node has an explicit resolution and the
 * node's merged props are used, or the node is left completely
 * untouched at its old props (Phase 60: no silent data loss — an
 * unresolved conflict must never partially apply). The page tree
 * STRUCTURE (which nodes exist, their order, nesting) is never touched
 * by a migration — only `props` on nodes the plan identified. Renaming,
 * adding, or removing nodes is ordinary editing, not migration.
 */

export type ConflictResolution =
    | { action: "keep-local" }
    | { action: "use-new" }
    | { action: "custom"; value: unknown };

/**
 * Resolutions keyed by node id, then by field key. A node with
 * conflicts that has no entry here (or is missing a resolution for one
 * of its conflicting fields) is treated as "skip this node" — its props
 * are left exactly as they were, matching Phase 15's explicit "Skip
 * migration" action as the safe default for anything not explicitly
 * resolved, not just an option a user has to pick on purpose.
 */
export type ConflictResolutions = Record<string, Record<string, ConflictResolution>>;

export type ApplyMigrationResult = {
    pages: { path: string; config: PageConfig }[];
    /** Node ids that were actually changed. Empty means nothing to write — the caller can skip creating a new draft entirely. */
    updatedNodeIds: string[];
    /** Node ids that had conflicts but were left untouched because a resolution was missing for at least one field. */
    skippedNodeIds: string[];
};

const UNRESOLVED = Symbol("unresolved");

function resolveConflict(conflict: FieldConflict, resolution: ConflictResolution | undefined): unknown | typeof UNRESOLVED {
    if (!resolution) return UNRESOLVED;
    switch (resolution.action) {
        case "keep-local":
            return conflict.local;
        case "use-new":
            return conflict.incoming;
        case "custom":
            return resolution.value;
    }
}

/**
 * Resolves one node's final props, given its plan and any resolutions
 * provided for it. Returns `null` when the node should be skipped
 * entirely (no changes to apply, or an unresolved conflict blocks it).
 */
function resolveNodeProps(
    plan: NodeMigrationPlan,
    resolutions: Record<string, ConflictResolution> | undefined
): Record<string, unknown> | null {
    if (plan.status === "unchanged" || plan.status === "unresolvable") return null;
    if (!plan.mergedProps) return null; // Defensive — upgradable/needs-review always set this, but never assume.

    if (plan.conflicts.length === 0) {
        // status "upgradable": nothing to resolve, the plan's merge is final.
        return plan.mergedProps;
    }

    // status "needs-review": every conflict needs an explicit resolution
    // or the whole node is skipped (Phase 60 — see module doc).
    const finalProps: Record<string, unknown> = { ...plan.mergedProps };
    for (const conflict of plan.conflicts) {
        const resolved = resolveConflict(conflict, resolutions?.[conflict.key]);
        if (resolved === UNRESOLVED) return null;
        finalProps[conflict.key] = resolved;
    }
    return finalProps;
}

function applyToNode(node: PageNode, nodePlansById: Map<string, NodeMigrationPlan>, resolutions: ConflictResolutions, updatedNodeIds: string[], skippedNodeIds: string[]): PageNode {
    const plan = nodePlansById.get(node.id);
    const children = node.children?.map((child) =>
        applyToNode(child, nodePlansById, resolutions, updatedNodeIds, skippedNodeIds)
    );

    if (!plan) {
        // No plan for this node (its type had no recorded dependency —
        // see migration-plan.ts) — pass it through untouched, but still
        // recurse into children above, since a plain container can have
        // migratable descendants.
        return children ? { ...node, children } : node;
    }

    const resolvedProps = resolveNodeProps(plan, resolutions[node.id]);
    if (resolvedProps === null) {
        if (plan.status === "needs-review") skippedNodeIds.push(node.id);
        return children ? { ...node, children } : node;
    }

    updatedNodeIds.push(node.id);
    return { ...node, props: resolvedProps, ...(children ? { children } : {}) };
}

/**
 * Applies a migration plan's resolutions to the page trees it was
 * computed from, producing new trees ready to be saved as a draft.
 *
 * `pages` must be the exact same page configs `planMigration` was given
 * (the published snapshot's pages) — this function does not re-validate
 * that a node's plan still matches the tree; mismatched input produces
 * nodes silently passed through untouched (no plan found), not an error,
 * since a caller re-deriving `pages` from anywhere else is a caller bug
 * this function has no way to detect from the data alone.
 */
export function applyMigrationPlan(
    plan: MigrationPlan,
    pages: { path: string; config: PageConfig }[],
    resolutions: ConflictResolutions = {}
): ApplyMigrationResult {
    const updatedNodeIds: string[] = [];
    const skippedNodeIds: string[] = [];

    const resultPages = pages.map((page) => {
        const pagePlan = plan.pages.find((p) => p.path === page.path);
        const nodePlansById = new Map((pagePlan?.nodes ?? []).map((n) => [n.nodeId, n]));

        const children = page.config.children.map((node) =>
            applyToNode(node, nodePlansById, resolutions, updatedNodeIds, skippedNodeIds)
        );

        return { path: page.path, config: { type: "page" as const, children } };
    });

    return { pages: resultPages, updatedNodeIds, skippedNodeIds };
}
