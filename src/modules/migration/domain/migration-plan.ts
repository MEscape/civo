import { flattenTree } from "@/modules/builder/domain/drop-placement";
import type { PageNode, PageConfig } from "@/modules/builder/domain/page-node";
import { threeWayMergeProps, type FieldConflict } from "@/modules/migration/domain/three-way-merge";
import { tryGetComponentDefinitionVersion, tryGetComponentDefinition } from "@/modules/component-platform/domain";
import type { ReleaseSnapshot } from "@/modules/release/domain/release-snapshot";

/**
 * Migration planning (Phase 4 Rule 5 / Phase 9 / Phase 14).
 *
 * A migration plan compares a website's PUBLISHED state (where "which
 * component version was this node built against" is a recorded fact —
 * see release-snapshot.ts's `dependencies`) against the CURRENT registry
 * state, and proposes what upgrading would change.
 *
 * There is deliberately no equivalent for a never-published draft: a
 * draft has no recorded "version this was built against" anywhere, so
 * there is nothing to migrate FROM — editing a draft against whatever is
 * currently registered is just normal editing, not a migration. Once
 * the draft is published, its release records that fact, and only then
 * can a future component version bump generate a migration plan against
 * it (Phase 4 Rule 5's whole flow: Existing Website → ... → New Draft
 * starts from a PUBLISHED website).
 *
 * BASE for a node's props is obtained by calling the OLD component
 * version's own `createDefaultNode().props` fresh, right now — not by
 * storing a separate BASE snapshot anywhere. This is sound specifically
 * because Phase 4B guarantees a registered component version is
 * immutable once published (old versions are retained, never
 * overwritten), so `EventsGrid@1`'s defaults today are, by construction,
 * the same defaults it had when this node was created against it.
 */

export type NodeMigrationStatus =
    | "unchanged" // Component version hasn't changed since publish.
    | "upgradable" // A newer version exists; merge produced no conflicts.
    | "needs-review" // A newer version exists; merge produced conflicts.
    | "unresolvable"; // The OLD version this node was built against is no longer registered at all — cannot compute BASE.

export type NodeMigrationPlan = {
    nodeId: string;
    type: string;
    fromVersion: number;
    toVersion: number;
    status: NodeMigrationStatus;
    mergedProps?: Record<string, unknown>;
    conflicts: FieldConflict[];
    addedFields: string[];
};

export type PageMigrationPlan = {
    path: string;
    nodes: NodeMigrationPlan[];
};

export type MigrationPlan = {
    pages: PageMigrationPlan[];
    /** True when at least one node anywhere has conflicts or is unresolvable — the UI's "review needed" gate. */
    requiresReview: boolean;
    /** True when EVERY node is already "unchanged" — nothing to migrate at all. */
    isUpToDate: boolean;
};

/**
 * Plans the migration for a single node, given the component version it
 * was published against (`fromVersion`, from the release's recorded
 * dependencies).
 */
function planNode(node: PageNode, fromVersion: number): NodeMigrationPlan {
    const currentDefinition = tryGetComponentDefinition(node.type);
    const oldDefinition = tryGetComponentDefinitionVersion(node.type, fromVersion);

    if (!currentDefinition || !oldDefinition) {
        // Either the type itself, or the specific version this node was
        // built against, is no longer registered at all — there is no
        // NEW (or no BASE) to compute a merge against. Phase 31: a
        // removed component version must never silently vanish from an
        // existing release, but planning an upgrade FOR it is simply
        // impossible without a registered definition to ask for
        // defaults. Checked BEFORE the unchanged-version fast path below
        // on purpose: without a registered `currentDefinition`, there is
        // no real "current version" to compare fromVersion against, so
        // any comparison here would be meaningless, not just imprecise.
        return {
            nodeId: node.id,
            type: node.type,
            fromVersion,
            toVersion: currentDefinition?.version ?? fromVersion,
            status: "unresolvable",
            conflicts: [],
            addedFields: [],
        };
    }

    const toVersion = currentDefinition.version ?? 1;
    if (toVersion === fromVersion) {
        return {
            nodeId: node.id,
            type: node.type,
            fromVersion,
            toVersion,
            status: "unchanged",
            conflicts: [],
            addedFields: [],
        };
    }

    const base = oldDefinition.createDefaultNode().props;
    const next = currentDefinition.createDefaultNode().props;
    const { merged, conflicts, addedFields } = threeWayMergeProps(base, node.props, next);

    return {
        nodeId: node.id,
        type: node.type,
        fromVersion,
        toVersion,
        status: conflicts.length > 0 ? "needs-review" : "upgradable",
        mergedProps: merged,
        conflicts,
        addedFields,
    };
}

function planPageNodes(config: PageConfig, versionByType: Map<string, number>): NodeMigrationPlan[] {
    const plans: NodeMigrationPlan[] = [];
    for (const { node } of flattenTree(config.children)) {
        const fromVersion = versionByType.get(node.type);
        if (fromVersion === undefined) continue; // Type wasn't in the release's own dependency record — nothing recorded to migrate from.
        plans.push(planNode(node, fromVersion));
    }
    return plans;
}

/**
 * Builds a full migration plan for a published release: every node on
 * every page, compared against the CURRENT registry. Nodes whose type
 * has no recorded dependency entry (e.g. a purely structural component
 * with no `dependsOnContracts` — recall `dependencies` in
 * release-snapshot.ts records every distinct type used, not just data-
 * bound ones) still get a fromVersion, since `extractComponentDependencies`
 * records every resolvable type's version, not only ones with contract
 * dependencies.
 */
export function planMigration(snapshot: ReleaseSnapshot): MigrationPlan {
    const versionByType = new Map(snapshot.dependencies.map((d) => [d.type, d.version]));

    const pages: PageMigrationPlan[] = snapshot.pages.map((page) => ({
        path: page.path,
        nodes: planPageNodes(page.config, versionByType),
    }));

    const allNodes = pages.flatMap((page) => page.nodes);
    return {
        pages,
        requiresReview: allNodes.some((n) => n.status === "needs-review" || n.status === "unresolvable"),
        isUpToDate: allNodes.every((n) => n.status === "unchanged"),
    };
}
